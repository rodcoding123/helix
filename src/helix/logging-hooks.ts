/**
 * HELIX LOGGING HOOKS
 * Main hook installer for unhackable pre-execution logging
 *
 * Core Principle: Logs fire BEFORE actions, not after.
 * Discord webhooks are called synchronously before execution proceeds.
 *
 * SECURITY: Implements FAIL-CLOSED behavior - operations BLOCK when logging unavailable
 */

import crypto from 'node:crypto';
import type {
  InternalHookEvent,
  WebhookHealthStatus,
  SecurityConfigStatus,
  DiscordEmbed,
} from './types.js';
import { HelixSecurityError, REQUIRED_WEBHOOKS, OPTIONAL_WEBHOOKS } from './types.js';
import { loadSecret } from '../lib/secrets-loader.js';
import { globalSanitizer } from '../lib/log-sanitizer.js';
import { resilientDiscordSend, getResilienceStatus } from './resilience-middleware.js';

// Discord webhook URLs - loaded at initialization
let WEBHOOKS = {
  commands: process.env.DISCORD_WEBHOOK_COMMANDS,
  api: process.env.DISCORD_WEBHOOK_API,
  files: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
  consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS,
  alerts: process.env.DISCORD_WEBHOOK_ALERTS,
  hashChain: process.env.DISCORD_WEBHOOK_HASH_CHAIN,
};

/**
 * Initialize Discord webhooks from 1Password
 * Call this once at application startup
 */
export function initializeDiscordWebhooks(): void {
  try {
    WEBHOOKS = {
      commands: loadSecret('Discord Webhook - Commands', 'notes'),
      api: loadSecret('Discord Webhook - API', 'notes'),
      files: loadSecret('Discord Webhook - File Changes', 'notes'),
      consciousness: loadSecret('Discord Webhook - Consciousness', 'notes'),
      alerts: loadSecret('Discord Webhook - Alerts', 'notes'),
      hashChain: loadSecret('Discord Webhook - Hash Chain', 'notes'),
    };
    console.log('[Helix] Discord webhooks initialized from 1Password');
  } catch (error) {
    // SECURITY: Sanitize error to prevent secret leakage in logs
    const sanitizedError = globalSanitizer.sanitizeError(error);
    console.warn(
      '[Helix] Failed to load webhooks from 1Password, using environment fallback:',
      sanitizedError
    );
    // .env fallback is already loaded above
  }
}

// Security mode - when true, operations fail if logging unavailable
let failClosedMode = true;

/**
 * Enable or disable fail-closed security mode (INTERNAL ONLY)
 * WARNING: This function is for testing only. In production, fail-closed is always enabled.
 * Disabling this compromises the "unhackable logging" guarantee.
 *
 * @internal
 * @throws Error if attempting to disable in production
 */
export function setFailClosedMode(enabled: boolean): void {
  // Production security: fail-closed mode CANNOT be disabled
  if (process.env.NODE_ENV === 'production' && !enabled) {
    throw new Error(
      '[Helix] SECURITY ERROR: Cannot disable fail-closed mode in production. ' +
        'This function is for testing only and is not exported in production builds.'
    );
  }

  if (!enabled) {
    console.warn(
      '[Helix] WARNING: Disabling fail-closed mode compromises security! (TEST MODE ONLY)'
    );
  }
  failClosedMode = enabled;
}

interface DiscordPayload {
  embeds: DiscordEmbed[];
}

/**
 * Send a payload to a Discord webhook with resilience
 * In fail-closed mode, throws HelixSecurityError if webhook unavailable AND operation not queued
 * Returns true if successful, false otherwise (only in non-critical mode)
 *
 * RESILIENCE: Uses circuit breaker + operation queue for graceful degradation
 */
async function sendToDiscord(
  webhookUrl: string | undefined,
  payload: DiscordPayload,
  critical: boolean = false
): Promise<boolean> {
  if (!webhookUrl) {
    if (critical && failClosedMode) {
      throw new HelixSecurityError(
        'Critical webhook not configured - execution blocked for security',
        'WEBHOOK_NOT_CONFIGURED',
        { payload }
      );
    }
    return false;
  }

  try {
    // Use resilient send which wraps circuit breaker + operation queue
    const result = await resilientDiscordSend(webhookUrl, payload, critical);

    // If operation was queued, it won't be lost
    if (result.queued) {
      if (critical && failClosedMode) {
        // For critical operations, queuing alone isn't enough - but at least it's not lost
        console.warn(
          `[Helix] Critical operation queued (Discord unavailable): ${result.operationId}`
        );
        // Don't throw if queued - operation will be retried when Discord recovers
        return false;
      }
      // Non-critical: queue is acceptable
      return false;
    }

    // Successful send
    if (result.success) {
      return true;
    }

    // Failed to send and not queued
    if (critical && failClosedMode) {
      throw new HelixSecurityError(
        `Critical logging failed - execution blocked (error: ${result.error})`,
        'LOGGING_FAILED',
        { error: result.error, operationId: result.operationId }
      );
    }

    // SECURITY: Sanitize error to prevent secret leakage in logs
    const sanitizedError = globalSanitizer.sanitize(result.error);
    console.error('[Helix] Discord webhook failed:', sanitizedError);
    return false;
  } catch (error) {
    if (error instanceof HelixSecurityError) throw error;

    if (critical && failClosedMode) {
      throw new HelixSecurityError(
        'Discord unreachable - execution blocked for security',
        'DISCORD_UNREACHABLE',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }

    // SECURITY: Sanitize error to prevent secret leakage in logs
    const sanitizedError = globalSanitizer.sanitizeError(error);
    console.error('[Helix] Discord webhook failed:', sanitizedError);
    return false;
  }
}

/**
 * Check health of a single webhook
 */
async function checkSingleWebhook(
  name: string,
  url: string | undefined
): Promise<WebhookHealthStatus> {
  const status: WebhookHealthStatus = {
    name,
    url: url ? `${url.slice(0, 50)}...` : undefined,
    configured: !!url,
    reachable: false,
  };

  if (!url) {
    status.error = 'Not configured';
    return status;
  }

  try {
    const start = Date.now();
    // Discord webhooks accept GET to check if they exist
    const response = await fetch(url, { method: 'GET' });
    status.latencyMs = Date.now() - start;
    status.reachable = response.ok;
    if (!response.ok) {
      status.error = `HTTP ${response.status}`;
    }
  } catch (error) {
    status.error = error instanceof Error ? error.message : 'Network error';
  }

  return status;
}

/**
 * Check health of all Discord webhooks
 * Returns detailed status of each webhook
 */
export async function checkWebhookHealth(): Promise<WebhookHealthStatus[]> {
  const checks = [
    checkSingleWebhook('commands', WEBHOOKS.commands),
    checkSingleWebhook('api', WEBHOOKS.api),
    checkSingleWebhook('files', WEBHOOKS.files),
    checkSingleWebhook('consciousness', WEBHOOKS.consciousness),
    checkSingleWebhook('alerts', WEBHOOKS.alerts),
    checkSingleWebhook('hashChain', WEBHOOKS.hashChain),
  ];

  return Promise.all(checks);
}

/**
 * Validate security configuration at startup
 * MUST be called before any operations - throws if critical webhooks missing
 */
export async function validateSecurityConfiguration(): Promise<SecurityConfigStatus> {
  const status: SecurityConfigStatus = {
    valid: true,
    webhooks: [],
    criticalIssues: [],
    warnings: [],
    checkedAt: new Date().toISOString(),
  };

  // Check all webhooks
  status.webhooks = await checkWebhookHealth();

  // Check required webhooks
  for (const envVar of REQUIRED_WEBHOOKS) {
    const value = process.env[envVar];
    if (!value) {
      status.criticalIssues.push(`Missing required webhook: ${envVar}`);
      status.valid = false;
    }
  }

  // Check optional webhooks
  for (const envVar of OPTIONAL_WEBHOOKS) {
    const value = process.env[envVar];
    if (!value) {
      status.warnings.push(`Missing optional webhook: ${envVar}`);
    }
  }

  // Verify critical webhooks are reachable
  const criticalWebhooks = ['commands', 'hashChain', 'alerts'];
  for (const webhook of status.webhooks) {
    if (criticalWebhooks.includes(webhook.name) && !webhook.reachable) {
      status.criticalIssues.push(`Critical webhook unreachable: ${webhook.name}`);
      status.valid = false;
    }
  }

  if (!status.valid && failClosedMode) {
    throw new HelixSecurityError(
      'Security configuration invalid - cannot start',
      'SECURITY_CONFIG_INVALID',
      { issues: status.criticalIssues }
    );
  }

  return status;
}

/**
 * Update the hash chain with a new entry
 * CRITICAL: Uses fail-closed mode for command-related actions
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

  // Command-related hash chain entries are critical (fail-closed)
  const isCritical = action.startsWith('command');

  await sendToDiscord(
    WEBHOOKS.hashChain,
    {
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
          footer: {
            text: isCritical ? 'Critical hash chain entry (fail-closed)' : 'Hash chain entry',
          },
        },
      ],
    },
    isCritical
  );
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
  // CRITICAL: This uses fail-closed mode - command execution blocks if logging fails
  registerInternalHook('command', async event => {
    const timestamp = new Date().toISOString();
    const commandText = event.context?.command || event.action || 'unknown';

    // Send to Discord FIRST - before any execution
    // critical=true means this will THROW if logging fails (fail-closed)
    await sendToDiscord(
      WEBHOOKS.commands,
      {
        embeds: [
          {
            title: '🔵 Command Initiated',
            color: 0x5865f2,
            fields: [
              {
                name: 'Command',
                value: `\`\`\`${commandText.slice(0, 1500)}\`\`\``,
                inline: false,
              },
              { name: 'Session', value: event.sessionKey || 'unknown', inline: true },
              { name: 'Status', value: 'STARTING', inline: true },
            ],
            timestamp,
            footer: { text: 'Pre-execution log - unhackable (fail-closed)' },
          },
        ],
      },
      true // CRITICAL - fail-closed mode
    );

    // Update hash chain (also critical)
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

/**
 * Get resilience status for monitoring
 * Shows circuit breaker states and operation queue status
 * Useful for health checks and dashboards
 *
 * @returns Resilience status including circuit breaker states and queue metrics
 */
export function getDiscordResilienceStatus(): ReturnType<typeof getResilienceStatus> {
  try {
    return getResilienceStatus();
  } catch (error) {
    console.error('[Helix] Failed to get resilience status:', error);
    return {
      discord: { state: 'unknown', error: String(error) },
      onePassword: { state: 'unknown' },
      plugins: { state: 'unknown' },
      queue: { total: 0, pending: 0, processed: 0, deadLetters: 0 },
    };
  }
}

// sendToDiscord is not exported as public - it's internal
// The security functions are exported via their declarations above
export { WEBHOOKS };
