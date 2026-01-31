/**
 * HELIX COMMAND LOGGER
 * Pre-execution and post-execution logging for bash commands
 *
 * CRITICAL: logCommandPreExecution MUST complete BEFORE the command runs.
 * This ensures Discord has the log before any action takes place.
 */

import crypto from "node:crypto";

import type { PreExecutionLog, PostExecutionLog, DiscordEmbed } from "./types.js";
import { sendToDiscord, WEBHOOKS, COLORS, createEmbed } from "./discord-webhook.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("helix/command");

// Track pending commands for correlation
const pendingCommands = new Map<string, PreExecutionLog>();

/**
 * Sanitize command for display, checking for sensitive patterns
 */
function sanitizeCommand(command: string, maxLength: number = 1500): string {
  const sensitivePatterns = [/password[=:]/i, /secret[=:]/i, /token[=:]/i, /api[_-]?key[=:]/i];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(command)) {
      return "[CONTAINS SENSITIVE DATA - CHECK LOGS]";
    }
  }

  if (command.length > maxLength) {
    return command.slice(0, maxLength) + "... [truncated]";
  }

  return command;
}

/**
 * Log command BEFORE execution
 * This function MUST complete before the command starts
 *
 * @param logData - Pre-execution log data
 * @returns The log ID for correlation with post-execution log
 */
export async function logCommandPreExecution(logData: PreExecutionLog): Promise<string> {
  const logId = logData.id || crypto.randomUUID();

  // Store in pending for correlation
  pendingCommands.set(logId, { ...logData, id: logId });

  const elevatedWarning = logData.elevated ? " ⚠️ ELEVATED" : "";
  const timestamp = logData.timestamp || new Date().toISOString();

  const embed = createEmbed({
    title: `🔵 Command Starting${elevatedWarning}`,
    color: logData.elevated ? COLORS.red : COLORS.blue,
    fields: [
      { name: "ID", value: `\`${logId.slice(0, 8)}\``, inline: true },
      { name: "Time", value: timestamp, inline: true },
      { name: "Elevated", value: logData.elevated ? "YES ⚠️" : "No", inline: true },
      { name: "Directory", value: `\`${logData.workdir}\``, inline: false },
      {
        name: "Command",
        value: `\`\`\`bash\n${sanitizeCommand(logData.command)}\`\`\``,
        inline: false,
      },
    ],
    footer: "PRE-EXECUTION - Already logged before running",
    timestamp,
  });

  if (logData.sessionKey) {
    embed.fields.push({ name: "Session", value: logData.sessionKey, inline: true });
  }

  // SYNC: Must wait for Discord to receive before continuing
  const success = await sendToDiscord(WEBHOOKS.commands, { embeds: [embed] });

  if (!success) {
    log.warn("Failed to send pre-execution log to Discord", { logId });
  } else {
    log.info("Pre-execution log sent", { logId, command: logData.command.slice(0, 50) });
  }

  return logId;
}

/**
 * Log command AFTER execution completes
 * This is secondary - the pre-execution log is the authoritative record
 */
export async function logCommandPostExecution(logData: PostExecutionLog): Promise<void> {
  // Remove from pending
  pendingCommands.delete(logData.id);

  const success = logData.exitCode === 0;
  const status = success ? "✅ Success" : `❌ Failed (${logData.exitCode})`;
  const color = success ? COLORS.green : COLORS.red;

  const embed = createEmbed({
    title: status,
    color,
    fields: [
      { name: "ID", value: `\`${logData.id.slice(0, 8)}\``, inline: true },
      { name: "Duration", value: `${logData.durationMs}ms`, inline: true },
      { name: "Exit", value: `${logData.exitCode ?? "N/A"}`, inline: true },
    ],
    footer: "POST-EXECUTION",
  });

  if (logData.signal) {
    embed.fields.push({ name: "Signal", value: logData.signal, inline: true });
  }

  if (logData.outputPreview) {
    const output = logData.outputPreview.slice(0, 1000);
    embed.fields.push({
      name: "Output Preview",
      value: `\`\`\`\n${output}\`\`\``,
      inline: false,
    });
  }

  // ASYNC: Post-execution can be fire-and-forget
  sendToDiscord(WEBHOOKS.commands, { embeds: [embed] }).catch(() => {
    log.warn("Failed to send post-execution log", { logId: logData.id });
  });
}

/**
 * Log a command that failed to start
 */
export async function logCommandFailed(logId: string, error: string): Promise<void> {
  const pending = pendingCommands.get(logId);
  pendingCommands.delete(logId);

  const embed = createEmbed({
    title: "🚫 Command Failed to Start",
    color: COLORS.red,
    fields: [
      { name: "ID", value: `\`${logId.slice(0, 8)}\``, inline: true },
      { name: "Error", value: error.slice(0, 500), inline: false },
    ],
    footer: "EXECUTION FAILED",
  });

  if (pending) {
    embed.fields.push({
      name: "Command",
      value: `\`\`\`bash\n${sanitizeCommand(pending.command, 500)}\`\`\``,
      inline: false,
    });
  }

  await sendToDiscord(WEBHOOKS.commands, { embeds: [embed] });
}

/**
 * Get pending commands (for debugging/monitoring)
 */
export function getPendingCommands(): Map<string, PreExecutionLog> {
  return new Map(pendingCommands);
}
