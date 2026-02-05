#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { applyCliProfileEnv, parseCliProfileArgs } from "./cli/profile.js";
import { isTruthyEnvValue, normalizeEnv } from "./infra/env.js";
import { installProcessWarningFilter } from "./infra/warnings.js";
import { attachChildProcessBridge } from "./process/child-process-bridge.js";

process.title = "openclaw";
installProcessWarningFilter();
normalizeEnv();

// HELIX: Isolation mode constant
// Used to signal plugin discovery that we're in Helix desktop app context
const ISOLATED_MODE_VALUE = "1";
const DEBUG_ISOLATION = process.env.HELIX_DEBUG_ISOLATION === "1";

// HELIX: Force isolated mode - prevent loading global OpenClaw plugins
// This is hardcoded because Helix is a desktop app, not a CLI tool.
// Users should never interact with this runtime directly.
if (!process.env.HELIX_ISOLATED_MODE) {
  const { fileURLToPath } = await import("node:url");
  const pathModule = path;

  // Determine Helix root (parent of helix-runtime/)
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = pathModule.dirname(thisFile);
  const srcDir = pathModule.dirname(thisDir);
  const runtimeRoot = pathModule.dirname(srcDir);
  const helixRoot = pathModule.dirname(runtimeRoot);

  // Validate helixRoot exists
  if (!fs.existsSync(helixRoot)) {
    if (DEBUG_ISOLATION) {
      console.warn(
        `[helix-isolation] Warning: calculated helix root does not exist: ${helixRoot}`,
      );
    }
  }

  // Force Helix-specific paths
  process.env.HELIX_ISOLATED_MODE = ISOLATED_MODE_VALUE;
  process.env.OPENCLAW_STATE_DIR = pathModule.join(helixRoot, ".helix-state");
  process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = pathModule.join(runtimeRoot, "extensions");

  if (DEBUG_ISOLATION) {
    console.log(`[helix-isolation] Enabled - preventing global plugin discovery`);
    console.log(`  Helix root: ${helixRoot}`);
    console.log(`  State dir: ${process.env.OPENCLAW_STATE_DIR}`);
    console.log(`  Plugins dir: ${process.env.OPENCLAW_BUNDLED_PLUGINS_DIR}`);
  }
}

if (process.argv.includes("--no-color")) {
  process.env.NO_COLOR = "1";
  process.env.FORCE_COLOR = "0";
}

const EXPERIMENTAL_WARNING_FLAG = "--disable-warning=ExperimentalWarning";

function hasExperimentalWarningSuppressed(nodeOptions: string): boolean {
  if (!nodeOptions) {
    return false;
  }
  return nodeOptions.includes(EXPERIMENTAL_WARNING_FLAG) || nodeOptions.includes("--no-warnings");
}

function ensureExperimentalWarningSuppressed(): boolean {
  if (isTruthyEnvValue(process.env.OPENCLAW_NO_RESPAWN)) {
    return false;
  }
  if (isTruthyEnvValue(process.env.OPENCLAW_NODE_OPTIONS_READY)) {
    return false;
  }
  const nodeOptions = process.env.NODE_OPTIONS ?? "";
  if (hasExperimentalWarningSuppressed(nodeOptions)) {
    return false;
  }

  process.env.OPENCLAW_NODE_OPTIONS_READY = "1";
  process.env.NODE_OPTIONS = `${nodeOptions} ${EXPERIMENTAL_WARNING_FLAG}`.trim();

  const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: process.env,
  });

  attachChildProcessBridge(child);

  child.once("exit", (code, signal) => {
    if (signal) {
      process.exitCode = 1;
      return;
    }
    process.exit(code ?? 1);
  });

  child.once("error", (error) => {
    console.error(
      "[openclaw] Failed to respawn CLI:",
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(1);
  });

  // Parent must not continue running the CLI.
  return true;
}

function normalizeWindowsArgv(argv: string[]): string[] {
  if (process.platform !== "win32") {
    return argv;
  }
  if (argv.length < 2) {
    return argv;
  }
  const stripControlChars = (value: string): string => {
    let out = "";
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code >= 32 && code !== 127) {
        out += value[i];
      }
    }
    return out;
  };
  const normalizeArg = (value: string): string =>
    stripControlChars(value)
      .replace(/^['"]+|['"]+$/g, "")
      .trim();
  const normalizeCandidate = (value: string): string =>
    normalizeArg(value).replace(/^\\\\\\?\\/, "");
  const execPath = normalizeCandidate(process.execPath);
  const execPathLower = execPath.toLowerCase();
  const execBase = path.basename(execPath).toLowerCase();
  const isExecPath = (value: string | undefined): boolean => {
    if (!value) {
      return false;
    }
    const lower = normalizeCandidate(value).toLowerCase();
    return (
      lower === execPathLower ||
      path.basename(lower) === execBase ||
      lower.endsWith("\\node.exe") ||
      lower.endsWith("/node.exe") ||
      lower.includes("node.exe")
    );
  };
  const next = [...argv];
  for (let i = 1; i <= 3 && i < next.length; ) {
    if (isExecPath(next[i])) {
      next.splice(i, 1);
      continue;
    }
    i += 1;
  }
  const filtered = next.filter((arg, index) => index === 0 || !isExecPath(arg));
  if (filtered.length < 3) {
    return filtered;
  }
  const cleaned = [...filtered];
  for (let i = 2; i < cleaned.length; ) {
    const arg = cleaned[i];
    if (!arg || arg.startsWith("-")) {
      i += 1;
      continue;
    }
    if (isExecPath(arg)) {
      cleaned.splice(i, 1);
      continue;
    }
    break;
  }
  return cleaned;
}

process.argv = normalizeWindowsArgv(process.argv);

if (!ensureExperimentalWarningSuppressed()) {
  const parsed = parseCliProfileArgs(process.argv);
  if (!parsed.ok) {
    // Keep it simple; Commander will handle rich help/errors after we strip flags.
    console.error(`[openclaw] ${parsed.error}`);
    process.exit(2);
  }

  if (parsed.profile) {
    applyCliProfileEnv({ profile: parsed.profile });
    // Keep Commander and ad-hoc argv checks consistent.
    process.argv = parsed.argv;
  }

  // ============================================
  // HELIX: Initialize logging system
  // CRITICAL: Preload secrets FIRST, then initialize logging
  // This fires startup announcement to Discord
  // and starts the heartbeat (proof of life)
  // ============================================
  const helixInit = async () => {
    try {
      const { initializeHelix, shutdownHelix } = await import("./helix/index.js");

      // STEP 1: Initialize logging system
      await initializeHelix();

      // Graceful shutdown on exit
      const handleExit = async (signal: string) => {
        await shutdownHelix(signal);
        process.exit(0);
      };

      process.on("SIGINT", () => handleExit("SIGINT"));
      process.on("SIGTERM", () => handleExit("SIGTERM"));
      process.on("beforeExit", () => handleExit("beforeExit"));
    } catch (err) {
      // Helix initialization failure should not block OpenClaw
      console.warn(
        "[helix] Failed to initialize:",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  // ============================================
  // HELIX: Gateway Security Initialization
  // CRITICAL: Initialize gateway security BEFORE starting OpenClaw gateway
  // This validates bind config, token auth, and WebSocket security
  // ============================================
  const helixGatewayInit = async () => {
    try {
      // Check if this is a gateway-related command
      const isGatewayCommand =
        process.argv.includes("gateway") ||
        process.argv.includes("start") ||
        process.argv.includes("serve");

      if (!isGatewayCommand) {
        return; // Skip gateway init for non-gateway commands
      }

      console.log("[helix] Initializing gateway security...");

      const { initializeHelixGateway } = await import("./helix/index.js");

      // Parse gateway configuration from environment
      const port = parseInt(process.env.OPENCLAW_GATEWAY_PORT || process.env.HELIX_GATEWAY_PORT || "18789", 10);
      const bindHost = process.env.OPENCLAW_GATEWAY_HOST || process.env.HELIX_GATEWAY_HOST || "127.0.0.1";
      const environment = process.env.NODE_ENV === "production" ? "production" : "development";

      // Initialize gateway with security hardening
      const gatewayConfig = await initializeHelixGateway({
        port,
        bindHost,
        environment,
      });

      // Store config for OpenClaw gateway server to use
      // This is read by the gateway server implementation
      process.env.HELIX_GATEWAY_CONFIG = JSON.stringify(gatewayConfig);

      console.log(`[helix] Gateway security ready: ${bindHost}:${port} (${environment})`);
    } catch (err) {
      // Gateway security failure is CRITICAL - fail-closed
      console.error(
        "[helix] Gateway security initialization failed:",
        err instanceof Error ? err.message : String(err),
      );

      // For gateway commands, security failure should block startup
      const isGatewayCommand =
        process.argv.includes("gateway") ||
        process.argv.includes("start") ||
        process.argv.includes("serve");

      if (isGatewayCommand) {
        console.error("[helix] Cannot start gateway without security validation - exiting");
        process.exit(1);
      }
    }
  };
  // ============================================

  // Initialize in sequence: logging first, then gateway security, then CLI
  helixInit()
    .then(() => helixGatewayInit())
    .then(() => import("./cli/run-main.js"))
    .then(({ runCli }) => runCli(process.argv))
    .catch((error) => {
      console.error(
        "[openclaw] Failed to start CLI:",
        error instanceof Error ? (error.stack ?? error.message) : error,
      );
      process.exitCode = 1;
    });
}
