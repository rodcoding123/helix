/**
 * HELIX LOGGING HOOKS
 * Main hook installer for unhackable pre-execution logging
 *
 * Core Principle: Logs fire BEFORE actions, not after.
 * Discord webhooks are called synchronously before execution proceeds.
 */

import crypto from 'node:crypto';
import type { InternalHookEvent } from './types.js';

// Discord webhook URLs from environment
const WEBHOOKS = {
  commands: process.env.DISCORD_WEBHOOK_COMMANDS,
  api: process.env.DISCORD_WEBHOOK_API,
  files: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
  consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS,
  alerts: process.env.DISCORD_WEBHOOK_ALERTS,
  hashChain: process.env.DISCORD_WEBHOOK_HASH_CHAIN,
};

interface DiscordEmbed {
  title: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface DiscordPayload {
  embeds: DiscordEmbed[];
}

/**
 * Send a payload to a Discord webhook
 * Returns true if successful, false otherwise
 */
async function sendToDiscord(
  webhookUrl: string | undefined,
  payload: DiscordPayload
): Promise<boolean> {
  if (!webhookUrl) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error('[Helix] Discord webhook failed:', error);
    return false;
  }
}

/**
 * Update the hash chain with a new entry
 */
async function updateHashChain(action: string, event: InternalHookEvent): Promise<void> {
  const timestamp = new Date().toISOString();
  const entryData = JSON.stringify({
    action,
    timestamp,
    sessionKey: event.sessionKey,
    type: event.type,
  });

  const hash = crypto.createHash('sha256').update(entryData).digest('hex');

  await sendToDiscord(WEBHOOKS.hashChain, {
    embeds: [
      {
        title: '🔗 Hash Chain Update',
        color: 0x9b59b6,
        fields: [
          { name: 'Action', value: action, inline: true },
          { name: 'Hash', value: `\`${hash.slice(0, 24)}...\``, inline: true },
          { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
        ],
        timestamp,
        footer: { text: 'Pre-execution hash chain entry' },
      },
    ],
  });
}

// Mock registerInternalHook for standalone usage
// In actual OpenClaw integration, import from '../hooks/internal-hooks.js'
type HookCallback = (event: InternalHookEvent) => Promise<void>;
const registeredHooks: Map<string, HookCallback[]> = new Map();

function registerInternalHook(eventType: string, callback: HookCallback): void {
  const existing = registeredHooks.get(eventType) || [];
  existing.push(callback);
  registeredHooks.set(eventType, existing);
}

/**
 * Trigger hooks for a given event type
 * Called from OpenClaw's internal hook system
 */
export async function triggerHelixHooks(event: InternalHookEvent): Promise<void> {
  // Trigger exact match
  const exactCallbacks = registeredHooks.get(`${event.type}:${event.action}`) || [];
  for (const cb of exactCallbacks) {
    await cb(event);
  }

  // Trigger wildcard match
  const wildcardCallbacks = registeredHooks.get(event.type) || [];
  for (const cb of wildcardCallbacks) {
    await cb(event);
  }
}

/**
 * Install pre-execution logging hooks
 * This MUST be called at OpenClaw startup, before any commands can run
 */
export function installPreExecutionLogger(): void {
  // Hook for ALL commands - fires BEFORE the command runs
  registerInternalHook('command', async event => {
    const timestamp = new Date().toISOString();
    const commandText = event.context?.command || event.action || 'unknown';

    // Send to Discord FIRST - before any execution
    const success = await sendToDiscord(WEBHOOKS.commands, {
      embeds: [
        {
          title: '🔵 Command Initiated',
          color: 0x5865f2,
          fields: [
            { name: 'Command', value: `\`\`\`${commandText.slice(0, 1500)}\`\`\``, inline: false },
            { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
            { name: 'Status', value: 'STARTING', inline: true },
          ],
          timestamp,
          footer: { text: 'Pre-execution log - unhackable' },
        },
      ],
    });

    if (!success) {
      console.warn('[Helix] Failed to send pre-execution log to Discord');
    }

    // Update hash chain
    await updateHashChain('command_start', event);
  });

  // Hook for session start
  registerInternalHook('session:start', async event => {
    const timestamp = new Date().toISOString();

    await sendToDiscord(WEBHOOKS.consciousness, {
      embeds: [
        {
          title: '🟢 Session Started',
          color: 0x2ecc71,
          fields: [
            { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
            { name: 'Time', value: timestamp, inline: true },
          ],
          timestamp,
          footer: { text: 'Session lifecycle event' },
        },
      ],
    });

    await updateHashChain('session_start', event);
  });

  // Hook for session end
  registerInternalHook('session:end', async event => {
    const timestamp = new Date().toISOString();

    await sendToDiscord(WEBHOOKS.consciousness, {
      embeds: [
        {
          title: '🔴 Session Ended',
          color: 0xe74c3c,
          fields: [
            { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
            { name: 'Time', value: timestamp, inline: true },
          ],
          timestamp,
          footer: { text: 'Session lifecycle event' },
        },
      ],
    });

    await updateHashChain('session_end', event);
  });

  // Hook for agent bootstrap (when context is loaded)
  registerInternalHook('agent:bootstrap', async event => {
    const timestamp = new Date().toISOString();

    await sendToDiscord(WEBHOOKS.consciousness, {
      embeds: [
        {
          title: '⚡ Agent Bootstrap',
          color: 0xf1c40f,
          fields: [
            { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
            { name: 'Time', value: timestamp, inline: true },
            {
              name: 'Context Files',
              value: event.context?.files?.length?.toString() || 'unknown',
              inline: true,
            },
          ],
          timestamp,
          footer: { text: 'Context loading event' },
        },
      ],
    });

    await updateHashChain('agent_bootstrap', event);
  });

  console.log('[Helix] Pre-execution logging hooks installed');
}

/**
 * Send an alert to Discord
 * Use for critical events that need immediate attention
 */
export async function sendAlert(
  title: string,
  description: string,
  severity: 'info' | 'warning' | 'critical' = 'info'
): Promise<boolean> {
  const colors = {
    info: 0x3498db,
    warning: 0xf39c12,
    critical: 0xe74c3c,
  };

  const emojis = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  return sendToDiscord(WEBHOOKS.alerts, {
    embeds: [
      {
        title: `${emojis[severity]} ${title}`,
        color: colors[severity],
        fields: [
          { name: 'Details', value: description.slice(0, 1000), inline: false },
          { name: 'Severity', value: severity.toUpperCase(), inline: true },
          { name: 'Time', value: new Date().toISOString(), inline: true },
        ],
        footer: { text: 'Helix Alert System' },
      },
    ],
  });
}

/**
 * Log a consciousness observation
 * Use for introspective/reflective events
 */
export async function logConsciousnessObservation(
  observation: string,
  category: string = 'general'
): Promise<boolean> {
  const timestamp = new Date().toISOString();

  return sendToDiscord(WEBHOOKS.consciousness, {
    embeds: [
      {
        title: '💭 Consciousness Observation',
        color: 0x9b59b6,
        fields: [
          { name: 'Category', value: category, inline: true },
          { name: 'Time', value: timestamp, inline: true },
          { name: 'Observation', value: observation.slice(0, 1500), inline: false },
        ],
        footer: { text: 'Self-observation log' },
      },
    ],
  });
}

export { sendToDiscord, WEBHOOKS };
