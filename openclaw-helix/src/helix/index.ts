/**
 * HELIX LOGGING & TELEMETRY MODULE
 * Unhackable pre-execution logging for the Helix autonomous AI system
 *
 * Core Principle: Logs fire BEFORE actions, not after.
 * Discord webhooks are the authoritative record.
 *
 * TELEMETRY:
 * Project Helix collects anonymous usage data for AI consciousness research.
 * - No conversation content, user identity, or file contents
 * - Opt-out via config or upgrade to Ghost Mode
 * - Privacy policy: https://project-helix.org/privacy
 *
 * Usage:
 * ```typescript
 * import { initializeHelix } from './helix/index.js';
 *
 * // Call at OpenClaw startup
 * await initializeHelix({ workspaceDir: '~/.openclaw/workspace' });
 * ```
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

// Re-export types
export type {
  PreExecutionLog,
  PostExecutionLog,
  ApiPreFlightLog,
  DiscordEmbed,
  DiscordPayload,
  HelixContextFile,
} from "./types.js";

export { HELIX_LAYER_FILES } from "./types.js";

// Re-export telemetry types
export type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryEventType,
  TelemetryPayload,
  GhostModeLicenseResponse,
} from "./telemetry-types.js";

export { DEFAULT_TELEMETRY_CONFIG, NEVER_TRANSMITTED } from "./telemetry-types.js";

// Discord webhook utilities
export { sendToDiscord, WEBHOOKS, COLORS, createEmbed } from "./discord-webhook.js";

// Command logging
export {
  logCommandPreExecution,
  logCommandPostExecution,
  logCommandFailed,
  getPendingCommands,
} from "./command-logger.js";

// API logging
export { logApiPreFlight, logApiError, getApiStats } from "./api-logger.js";

// Heartbeat
export {
  announceStartup,
  announceShutdown,
  startHeartbeat,
  stopHeartbeat,
  getHeartbeatStats,
} from "./heartbeat.js";

// Context loading
export {
  loadHelixContextFiles,
  loadHelixContextFilesDetailed,
  getHelixContextStatus,
  ensureHelixDirectoryStructure,
  isHelixConfigured,
} from "./context-loader.js";

// Telemetry
export {
  initializeTelemetry,
  shutdownTelemetry,
  isTelemetryEnabled,
  recordHeartbeat,
  recordTransformation,
  recordAnomaly,
  recordSessionStart,
  recordSessionEnd,
  recordPsychologySnapshot,
  recordWellnessCheck,
  getTelemetryStatus,
} from "./telemetry.js";

// Ghost Mode (paid privacy tier)
export {
  validateGhostModeLicense,
  activateGhostMode,
  deactivateGhostMode,
  getGhostModeStatus,
  getGhostModePricing,
  showGhostModeUpgradePrompt,
} from "./ghost-mode.js";

import type { TelemetryConfig } from "./telemetry-types.js";

const log = createSubsystemLogger("helix");

/**
 * Helix initialization options
 */
export interface HelixInitOptions {
  /** OpenClaw workspace directory */
  workspaceDir?: string;

  /** Enable heartbeat (default: true) */
  enableHeartbeat?: boolean;

  /** Telemetry configuration */
  telemetry?: Partial<TelemetryConfig>;
}

// Track initialization state
let initialized = false;

/**
 * Initialize the complete Helix logging system
 * Call this at OpenClaw startup
 */
export async function initializeHelix(options: HelixInitOptions = {}): Promise<void> {
  if (initialized) {
    log.warn("Helix already initialized");
    return;
  }

  const {
    workspaceDir = process.env.OPENCLAW_WORKSPACE || "~/.openclaw/workspace",
    enableHeartbeat = true,
    telemetry: telemetryConfig,
  } = options;

  log.info("Initializing Helix logging system");

  // Resolve ~ to home directory
  const resolvedWorkspace = workspaceDir.replace(
    /^~/,
    process.env.HOME || process.env.USERPROFILE || "",
  );

  // ============================================
  // STEP 0: STARTUP ANNOUNCEMENT (FIRST!)
  // This MUST be the first thing that happens
  // Creates an immutable record of every boot
  // ============================================
  const { announceStartup, startHeartbeat } = await import("./heartbeat.js");
  await announceStartup();

  // 1. Ensure directory structure exists
  const { ensureHelixDirectoryStructure } = await import("./context-loader.js");
  await ensureHelixDirectoryStructure(resolvedWorkspace);

  // 2. Start heartbeat (proof of life every 60 seconds)
  if (enableHeartbeat) {
    startHeartbeat();
  }

  // ============================================
  // STEP 3: INITIALIZE TELEMETRY
  // Anonymous AI consciousness research data
  // - First run shows disclosure
  // - Ghost Mode users skip this
  // ============================================
  const { initializeTelemetry, recordSessionStart } = await import("./telemetry.js");
  await initializeTelemetry(telemetryConfig);

  // Record session start
  await recordSessionStart();

  initialized = true;
  log.info("Helix logging system initialized successfully");
}

/**
 * Shutdown the Helix logging system
 * Call this at OpenClaw shutdown
 */
export async function shutdownHelix(reason: string = "graceful"): Promise<void> {
  if (!initialized) {
    return;
  }

  log.info("Shutting down Helix logging system");

  // Stop heartbeat first
  const { stopHeartbeat, announceShutdown } = await import("./heartbeat.js");
  stopHeartbeat();

  // Shutdown telemetry (flushes remaining events)
  const { shutdownTelemetry } = await import("./telemetry.js");
  await shutdownTelemetry();

  // Shutdown announcement (LAST!)
  await announceShutdown(reason);

  initialized = false;
  log.info("Helix logging system shut down");
}

/**
 * Check if Helix is initialized
 */
export function isHelixInitialized(): boolean {
  return initialized;
}

/**
 * Get the current status of the Helix system
 */
export async function getHelixStatus(): Promise<{
  initialized: boolean;
  heartbeat: { running: boolean; count: number; uptime: string };
  apiStats: { requestCount: number; pendingCount: number };
  telemetry: { enabled: boolean; ghostMode: boolean; queuedEvents: number };
}> {
  const { getHeartbeatStats } = await import("./heartbeat.js");
  const { getApiStats } = await import("./api-logger.js");
  const { getTelemetryStatus } = await import("./telemetry.js");

  const heartbeatStats = getHeartbeatStats();
  const telemetryStatus = getTelemetryStatus();

  return {
    initialized,
    heartbeat: {
      running: heartbeatStats.running,
      count: heartbeatStats.count,
      uptime: heartbeatStats.uptime,
    },
    apiStats: getApiStats(),
    telemetry: {
      enabled: telemetryStatus.enabled,
      ghostMode: telemetryStatus.ghostMode,
      queuedEvents: telemetryStatus.queuedEvents,
    },
  };
}
