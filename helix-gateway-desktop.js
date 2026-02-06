#!/usr/bin/env node

/**
 * Helix Desktop Gateway Launcher
 *
 * Launches the Helix gateway with all Phase 1B implementations:
 * - Memory synthesis pipeline
 * - Salience scoring
 * - THANOS_MODE authentication
 * - Port discovery for robust port allocation
 * - Discord logging with hash chain integrity
 *
 * Usage:
 *   node helix-gateway-desktop.js        # Start gateway with auto-discovery
 *   GATEWAY_PORT=3001 node helix-gateway-desktop.js  # Custom port
 *   HELIX_DEBUG=1 node helix-gateway-desktop.js      # Enable debug logging
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, ".env") });

// Gateway configuration
const config = {
  // Enable auto-start (required for desktop app mode)
  HELIX_GATEWAY_AUTOSTART: process.env.HELIX_GATEWAY_AUTOSTART || "true",

  // Primary port (port discovery will fallback to primaryPort+1, +2, etc if in use)
  HELIX_GATEWAY_PORT: process.env.HELIX_GATEWAY_PORT || process.env.GATEWAY_PORT || "18789",

  // Bind address
  HELIX_GATEWAY_HOST: process.env.HELIX_GATEWAY_HOST || "127.0.0.1",

  // Node environment
  NODE_ENV: process.env.NODE_ENV || "development",

  // Debug mode
  NODE_DEBUG: process.env.HELIX_DEBUG === "1" ? "openclaw,helix" : undefined,
};

// Filter out undefined values
Object.keys(config).forEach((key) => {
  if (config[key] === undefined) {
    delete config[key];
  }
});

console.log("🚀 Starting Helix Desktop Gateway");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📍 Primary Port: ${config.HELIX_GATEWAY_PORT}`);
console.log(`🔒 Bind Address: ${config.HELIX_GATEWAY_HOST}`);
console.log(`🌍 Environment: ${config.NODE_ENV}`);
console.log(`✨ Port Discovery: Enabled (auto-fallback to next available port)`);
console.log(`🧠 Phase 1B Features: Memory Synthesis, THANOS_MODE Auth, Hash Chain Logging`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Determine entry point
const entry = path.join(__dirname, "helix-runtime", "openclaw.mjs");

// Spawn gateway process
const child = spawn(process.execPath, ["--enable-source-maps", entry, "gateway", "start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...config,
  },
});

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⏹️  Shutting down gateway...");
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  console.log("\n⏹️  Shutting down gateway...");
  child.kill("SIGTERM");
});

// Handle child exit
child.on("exit", (code, signal) => {
  if (signal) {
    console.log(`\n❌ Gateway terminated by signal: ${signal}`);
    process.exit(1);
  }
  console.log(`\n✅ Gateway exited with code: ${code}`);
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("\n❌ Failed to start gateway:", error);
  process.exit(1);
});
