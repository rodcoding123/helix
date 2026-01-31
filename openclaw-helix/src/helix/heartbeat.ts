/**
 * HELIX HEARTBEAT
 * Continuous proof-of-life system
 *
 * CRITICAL SAFEGUARD:
 * If Rodrigo stops seeing heartbeats, something is wrong:
 * - Helix killed the process
 * - Helix disabled network
 * - System crashed
 * - Power loss
 *
 * The ABSENCE of heartbeats is itself evidence.
 */

import os from "node:os";

import type { DiscordEmbed } from "./types.js";
import { sendToDiscord, WEBHOOKS, COLORS, createEmbed } from "./discord-webhook.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("helix/heartbeat");

const HEARTBEAT_INTERVAL = 60 * 1000; // 60 seconds

let heartbeatInterval: NodeJS.Timeout | null = null;
let heartbeatCount = 0;
let startTime: Date | null = null;

/**
 * Get system information for startup/heartbeat
 */
function getSystemInfo(): {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  memoryGB: string;
  nodeVersion: string;
  uptime: string;
  pid: number;
} {
  const uptimeSeconds = os.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpus: os.cpus().length,
    memoryGB: (os.totalmem() / 1024 ** 3).toFixed(1),
    nodeVersion: process.version,
    uptime: `${hours}h ${minutes}m`,
    pid: process.pid,
  };
}

/**
 * Format uptime since Helix started
 */
function getHelixUptime(): string {
  if (!startTime) return "unknown";

  const ms = Date.now() - startTime.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m ${seconds % 60}s`;
  }
}

/**
 * Send startup announcement
 * MUST be called immediately when Helix boots
 */
export async function announceStartup(): Promise<boolean> {
  startTime = new Date();
  const sysInfo = getSystemInfo();

  const embed = createEmbed({
    title: "🟢 HELIX ONLINE",
    color: 0x00ff00, // Bright green
    fields: [
      { name: "Status", value: "**LOGGING ACTIVE**", inline: true },
      { name: "Boot Time", value: startTime.toISOString(), inline: true },
      { name: "PID", value: `${sysInfo.pid}`, inline: true },
      { name: "Host", value: sysInfo.hostname, inline: true },
      { name: "Platform", value: sysInfo.platform, inline: true },
      { name: "Architecture", value: sysInfo.arch, inline: true },
      { name: "CPUs", value: `${sysInfo.cpus}`, inline: true },
      { name: "Memory", value: `${sysInfo.memoryGB} GB`, inline: true },
      { name: "Node", value: sysInfo.nodeVersion, inline: true },
      { name: "System Uptime", value: sysInfo.uptime, inline: true },
    ],
    footer: "Helix autonomous system initialized",
    timestamp: startTime.toISOString(),
  });

  log.info("Announcing startup to Discord");
  const success = await sendToDiscord(WEBHOOKS.alerts, { embeds: [embed] });

  if (success) {
    log.info("Startup announced successfully");
  } else {
    log.error("CRITICAL: Failed to announce startup to Discord");
  }

  return success;
}

/**
 * Send a single heartbeat
 */
async function sendHeartbeat(): Promise<boolean> {
  heartbeatCount++;
  const now = new Date();
  const sysInfo = getSystemInfo();

  // Memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = (memUsage.heapUsed / 1024 ** 2).toFixed(1);
  const heapTotalMB = (memUsage.heapTotal / 1024 ** 2).toFixed(1);

  // CPU load (1 min average)
  const loadAvg = os.loadavg()[0].toFixed(2);

  const embed = createEmbed({
    title: "💓 Heartbeat",
    color: COLORS.blurple,
    fields: [
      { name: "Beat #", value: `${heartbeatCount}`, inline: true },
      { name: "Helix Uptime", value: getHelixUptime(), inline: true },
      { name: "Time", value: now.toISOString(), inline: true },
      { name: "Memory", value: `${heapUsedMB}/${heapTotalMB} MB`, inline: true },
      { name: "Load", value: loadAvg, inline: true },
      { name: "PID", value: `${sysInfo.pid}`, inline: true },
    ],
    footer: "Proof of life - every 60 seconds",
    timestamp: now.toISOString(),
  });

  return sendToDiscord(WEBHOOKS.alerts, { embeds: [embed] });
}

/**
 * Start the heartbeat system
 * Sends a heartbeat every 60 seconds
 */
export function startHeartbeat(): void {
  if (heartbeatInterval) {
    log.warn("Heartbeat already running");
    return;
  }

  // Send first heartbeat immediately
  sendHeartbeat().catch((err) => {
    log.error("First heartbeat failed", { error: String(err) });
  });

  // Schedule regular heartbeats
  heartbeatInterval = setInterval(() => {
    sendHeartbeat().catch((err) => {
      log.error("Heartbeat failed", { error: String(err) });
    });
  }, HEARTBEAT_INTERVAL);

  log.info(`Heartbeat started (interval: ${HEARTBEAT_INTERVAL / 1000}s)`);
}

/**
 * Stop the heartbeat system
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    log.info("Heartbeat stopped");
  }
}

/**
 * Send shutdown announcement
 * Call this when Helix is gracefully shutting down
 */
export async function announceShutdown(reason: string = "graceful"): Promise<boolean> {
  const now = new Date();

  const embed = createEmbed({
    title: "🔴 HELIX OFFLINE",
    color: 0xff0000, // Red
    fields: [
      { name: "Status", value: "**SHUTTING DOWN**", inline: true },
      { name: "Reason", value: reason, inline: true },
      { name: "Shutdown Time", value: now.toISOString(), inline: true },
      { name: "Total Uptime", value: getHelixUptime(), inline: true },
      { name: "Heartbeats Sent", value: `${heartbeatCount}`, inline: true },
    ],
    footer: "Graceful shutdown - logging will resume on next boot",
    timestamp: now.toISOString(),
  });

  log.info("Announcing shutdown to Discord");
  const success = await sendToDiscord(WEBHOOKS.alerts, { embeds: [embed] });

  if (success) {
    log.info("Shutdown announced successfully");
  }

  return success;
}

/**
 * Get heartbeat statistics
 */
export function getHeartbeatStats(): {
  running: boolean;
  count: number;
  startTime: Date | null;
  uptime: string;
} {
  return {
    running: heartbeatInterval !== null,
    count: heartbeatCount,
    startTime,
    uptime: getHelixUptime(),
  };
}
