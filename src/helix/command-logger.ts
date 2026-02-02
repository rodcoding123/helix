/**
 * HELIX COMMAND LOGGER
 * Pre-execution and post-execution logging for bash commands
 *
 * CRITICAL: logCommandPreExecution MUST complete BEFORE the command runs.
 * This ensures Discord has the log before any action takes place.
 */

import crypto from 'node:crypto';
import type { PreExecutionLog, PostExecutionLog, DiscordEmbed } from './types.js';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_COMMANDS;

interface CommandLogState {
  pending: Map<string, PreExecutionLog>;
}

const state: CommandLogState = {
  pending: new Map(),
};

/**
 * Send webhook to Discord
 * For pre-execution: MUST be awaited to ensure log arrives before action
 * For post-execution: Can be fire-and-forget
 */
async function sendWebhook(embed: DiscordEmbed, sync: boolean = true): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  const sendPromise = fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch(error => {
    console.error('[Helix] Command webhook failed:', error);
  });

  if (sync) {
    await sendPromise;
  }
}

/**
 * Truncate command for display, preserving sensitive info warning
 */
function sanitizeCommand(command: string, maxLength: number = 1500): string {
  // Check for potentially sensitive patterns
  const sensitivePatterns = [
    /password[=:]/i,
    /secret[=:]/i,
    /token[=:]/i,
    /api[_-]?key[=:]/i,
    /auth[=:]/i,
  ];

  let sanitized = command;
  for (const pattern of sensitivePatterns) {
    if (pattern.test(command)) {
      sanitized = '[CONTAINS SENSITIVE DATA - CHECK LOGS]';
      break;
    }
  }

  if (sanitized.length > maxLength) {
    return sanitized.slice(0, maxLength) + '... [truncated]';
  }

  return sanitized;
}

/**
 * Log command BEFORE execution
 * This function MUST complete before the command starts
 *
 * @param log - Pre-execution log data
 * @returns The log ID for correlation with post-execution log
 */
export async function logCommandPreExecution(log: PreExecutionLog): Promise<string> {
  const logId = log.id || crypto.randomUUID();

  // Store in pending for correlation
  state.pending.set(logId, { ...log, id: logId });

  const elevatedWarning = log.elevated ? ' ⚠️ ELEVATED' : '';
  const timestamp = log.timestamp || new Date().toISOString();

  const embed: DiscordEmbed = {
    title: `🔵 Command Starting${elevatedWarning}`,
    color: log.elevated ? 0xe74c3c : 0x3498db,
    fields: [
      { name: 'ID', value: `\`${logId.slice(0, 8)}\``, inline: true },
      { name: 'Time', value: timestamp, inline: true },
      { name: 'Elevated', value: log.elevated ? 'YES ⚠️' : 'No', inline: true },
      { name: 'Directory', value: `\`${log.workdir}\``, inline: false },
      {
        name: 'Command',
        value: `\`\`\`bash\n${sanitizeCommand(log.command)}\`\`\``,
        inline: false,
      },
    ],
    timestamp,
    footer: { text: 'PRE-EXECUTION - Already logged before running' },
  };

  if (log.sessionKey) {
    embed.fields.push({ name: 'Session', value: log.sessionKey, inline: true });
  }

  // SYNC: Must wait for Discord to receive before continuing
  await sendWebhook(embed, true);

  return logId;
}

/**
 * Log command AFTER execution completes
 * This is secondary - the pre-execution log is the authoritative record
 */
export async function logCommandPostExecution(log: PostExecutionLog): Promise<void> {
  // Remove from pending
  state.pending.delete(log.id);

  const success = log.exitCode === 0;
  const status = success ? '✅ Success' : `❌ Failed (${log.exitCode})`;
  const color = success ? 0x2ecc71 : 0xe74c3c;
  const timestamp = new Date().toISOString();

  const embed: DiscordEmbed = {
    title: status,
    color,
    fields: [
      { name: 'ID', value: `\`${log.id.slice(0, 8)}\``, inline: true },
      { name: 'Duration', value: `${log.durationMs}ms`, inline: true },
      { name: 'Exit', value: `${log.exitCode ?? 'N/A'}`, inline: true },
    ],
    timestamp,
    footer: { text: 'POST-EXECUTION' },
  };

  if (log.signal) {
    embed.fields.push({ name: 'Signal', value: log.signal, inline: true });
  }

  if (log.outputPreview) {
    const output = log.outputPreview.slice(0, 1000);
    embed.fields.push({
      name: 'Output Preview',
      value: `\`\`\`\n${output}\`\`\``,
      inline: false,
    });
  }

  // ASYNC: Post-execution can be fire-and-forget
  await sendWebhook(embed, false);
}

/**
 * Log a command that failed to start
 */
export async function logCommandFailed(logId: string, error: string): Promise<void> {
  const pending = state.pending.get(logId);
  state.pending.delete(logId);

  const embed: DiscordEmbed = {
    title: '🚫 Command Failed to Start',
    color: 0xe74c3c,
    fields: [
      { name: 'ID', value: `\`${logId.slice(0, 8)}\``, inline: true },
      { name: 'Error', value: error.slice(0, 500), inline: false },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'EXECUTION FAILED' },
  };

  if (pending) {
    embed.fields.push({
      name: 'Command',
      value: `\`\`\`bash\n${sanitizeCommand(pending.command, 500)}\`\`\``,
      inline: false,
    });
  }

  await sendWebhook(embed, true);
}

/**
 * Get pending commands (for debugging/monitoring)
 */
export function getPendingCommands(): Map<string, PreExecutionLog> {
  return new Map(state.pending);
}

/**
 * Check if a command is still pending
 */
export function isCommandPending(logId: string): boolean {
  return state.pending.has(logId);
}

/**
 * Create a wrapped executor that logs before/after
 * This can wrap any command execution function
 */
export function createLoggedExecutor<T>(
  executor: (command: string, workdir: string) => Promise<T>,
  options: { sessionKey?: string; elevated?: boolean } = {}
): (command: string, workdir: string) => Promise<T> {
  return async (command: string, workdir: string): Promise<T> => {
    const logId = crypto.randomUUID();
    const startTime = Date.now();

    // PRE-EXECUTION LOG (sync - must complete first)
    await logCommandPreExecution({
      id: logId,
      command,
      workdir,
      timestamp: new Date().toISOString(),
      sessionKey: options.sessionKey,
      elevated: options.elevated,
    });

    try {
      // Execute the command
      const result = await executor(command, workdir);

      // POST-EXECUTION LOG (async - fire and forget)
      const durationMs = Date.now() - startTime;
      logCommandPostExecution({
        id: logId,
        command,
        workdir,
        timestamp: new Date().toISOString(),
        sessionKey: options.sessionKey,
        elevated: options.elevated,
        exitCode: 0,
        signal: null,
        durationMs,
        outputPreview: typeof result === 'string' ? result : JSON.stringify(result).slice(0, 500),
      }).catch(console.error);

      return result;
    } catch (error) {
      // LOG FAILURE
      await logCommandFailed(logId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
}

/**
 * Clear pending commands state (testing utility only)
 * Should only be used in test suites to reset state between tests
 */
export function __resetPendingCommandsForTesting(): void {
  state.pending.clear();
}
