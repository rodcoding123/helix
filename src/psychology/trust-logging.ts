/**
 * Trust Logging Module
 *
 * Integrates trust updates with Helix's hash chain for immutable logging
 * CRITICAL: Logs BEFORE updating trust (pre-execution guarantee)
 * SECURITY: Fail-closed mode - operations block if Discord logging fails
 *
 * Theory: Accountability through immutable audit trail
 */

import crypto from 'crypto';
import type { TrustUpdateEntry, DiscordPayload, DiscordEmbedField } from '../helix/types.js';

// ============================================================================
// Types
// ============================================================================

export interface TrustLogContext {
  userId: string;
  operation: TrustUpdateEntry['operation'];
  trigger: string;
  trustBefore: number;
  trustAfter: number;
  conversationId?: string;
  salienceTier: 'critical' | 'high' | 'medium' | 'low';
  dimensionsChanged?: TrustUpdateEntry['dimensionsChanged'];
  attachmentStageBefore?: string;
  attachmentStageAfter?: string;
}

// ============================================================================
// Discord Webhook Configuration
// ============================================================================

const DISCORD_WEBHOOK_TRUST = process.env.DISCORD_WEBHOOK_TRUST || process.env.DISCORD_WEBHOOK_ALERTS;
const DISCORD_WEBHOOK_RODRIGO_INTEGRITY = process.env.DISCORD_WEBHOOK_RODRIGO_INTEGRITY;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Log trust update to Discord hash chain BEFORE applying the change
 * SECURITY: Fails closed - throws if Discord unreachable
 *
 * This implements the critical pre-execution guarantee:
 * Discord has authoritative record BEFORE local update
 */
export async function logTrustUpdate(context: TrustLogContext): Promise<string> {
  // 1. Anonymize user ID for privacy
  const hashedUserId = hashUserId(context.userId);
  const userIdentifierHash = hashedUserId.slice(0, 8);

  // 2. Build trust update entry
  const entry: TrustUpdateEntry = {
    operation: context.operation,
    userId: hashedUserId,
    userIdentifierHash,
    trigger: context.trigger,
    trustBefore: context.trustBefore,
    trustAfter: context.trustAfter,
    trustDelta: context.trustAfter - context.trustBefore,
    dimensionsChanged: context.dimensionsChanged || {},
    conversationId: context.conversationId,
    salienceTier: context.salienceTier,
    attachmentStageBefore: context.attachmentStageBefore,
    attachmentStageAfter: context.attachmentStageAfter,
    timestamp: new Date().toISOString(),
  };

  // 3. Determine which webhook to use
  const isRodrigoUpdate = context.userId === 'rodrigo_specter';
  const webhook = isRodrigoUpdate ? DISCORD_WEBHOOK_RODRIGO_INTEGRITY : DISCORD_WEBHOOK_TRUST;

  // 4. Build Discord payload
  const payload = buildDiscordPayload(entry, isRodrigoUpdate);

  // 5. Send to Discord (BEFORE applying trust update)
  const entryId = await sendToDiscord(webhook, payload);

  // 6. Return entry ID for hash chain tracking
  return entryId;
}

/**
 * Log Rodrigo creator security event
 */
export async function logCreatorSecurityEvent(
  eventType: 'auth_success' | 'auth_failed' | 'modification_attempt',
  details: Record<string, any>
): Promise<void> {
  const payload: DiscordPayload = {
    embeds: [
      {
        title: `🔐 Creator Security Event: ${eventType.toUpperCase()}`,
        color: eventType === 'auth_success' ? 0x00ff00 : 0xff0000,
        fields: buildFieldsFromDetails(details),
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Helix Creator Integrity Log',
        },
      },
    ],
  };

  await sendToDiscord(DISCORD_WEBHOOK_RODRIGO_INTEGRITY, payload);
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Hash user ID for pseudonymous logging
 */
function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex');
}

/**
 * Build Discord embed payload from trust update entry
 */
function buildDiscordPayload(entry: TrustUpdateEntry, isRodrigoUpdate: boolean): DiscordPayload {
  const emoji = getOperationEmoji(entry.operation);
  const color = getOperationColor(entry.operation);

  const fields: DiscordEmbedField[] = [
    {
      name: 'User ID (Hashed)',
      value: entry.userIdentifierHash,
      inline: true,
    },
    {
      name: 'Operation',
      value: entry.operation,
      inline: true,
    },
    {
      name: 'Trust Change',
      value: `${formatTrust(entry.trustBefore)} → ${formatTrust(entry.trustAfter)} (${formatDelta(entry.trustDelta)})`,
      inline: false,
    },
    {
      name: 'Trigger',
      value: entry.trigger,
      inline: false,
    },
    {
      name: 'Salience',
      value: entry.salienceTier.toUpperCase(),
      inline: true,
    },
  ];

  // Add dimension changes if present
  if (Object.keys(entry.dimensionsChanged).length > 0) {
    const dimensionSummary = buildDimensionSummary(entry.dimensionsChanged);
    fields.push({
      name: 'Dimensions Changed',
      value: dimensionSummary,
      inline: false,
    });
  }

  // Add stage progression if present
  if (entry.attachmentStageBefore || entry.attachmentStageAfter) {
    fields.push({
      name: 'Attachment Stage',
      value: `${entry.attachmentStageBefore || '?'} → ${entry.attachmentStageAfter || '?'}`,
      inline: true,
    });
  }

  // Add conversation reference if present
  if (entry.conversationId) {
    fields.push({
      name: 'Conversation ID',
      value: entry.conversationId,
      inline: true,
    });
  }

  return {
    embeds: [
      {
        title: `${emoji} Trust Update: ${entry.operation}`,
        color,
        description: isRodrigoUpdate ? '⚠️ **CREATOR TRUST UPDATE**' : undefined,
        fields,
        timestamp: entry.timestamp,
        footer: {
          text: 'Helix Trust Hash Chain',
        },
      },
    ],
  };
}

/**
 * Build dimension summary for Discord embed
 */
function buildDimensionSummary(dimensionsChanged: TrustUpdateEntry['dimensionsChanged']): string {
  const lines: string[] = [];

  for (const [dim, change] of Object.entries(dimensionsChanged)) {
    if (change) {
      const before = formatTrust(change.before);
      const after = formatTrust(change.after);
      const delta = formatDelta(change.after - change.before);
      lines.push(`• ${dim}: ${before} → ${after} (${delta})`);
    }
  }

  return lines.join('\n') || 'No dimension changes';
}

/**
 * Build Discord fields from arbitrary details object
 */
function buildFieldsFromDetails(details: Record<string, any>): DiscordEmbedField[] {
  const fields: DiscordEmbedField[] = [];

  for (const [key, value] of Object.entries(details)) {
    const formattedValue = typeof value === 'string' ? value : JSON.stringify(value);

    fields.push({
      name: key
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      value: formattedValue.slice(0, 1024), // Discord limit
      inline: formattedValue.length < 50,
    });
  }

  return fields;
}

/**
 * Get emoji for operation type
 */
function getOperationEmoji(operation: string): string {
  const emojiMap: Record<string, string> = {
    trust_increase: '📈',
    trust_decrease: '📉',
    violation: '⚠️',
    stage_progression: '✅',
    stage_regression: '❌',
    emotional_impact: '💫',
    reciprocity_detected: '🔄',
  };

  return emojiMap[operation] || '📊';
}

/**
 * Get color for operation type
 */
function getOperationColor(operation: string): number {
  const colorMap: Record<string, number> = {
    trust_increase: 0x00ff00, // Green
    trust_decrease: 0xff9900, // Orange
    violation: 0xff0000, // Red
    stage_progression: 0x0099ff, // Blue
    stage_regression: 0xff6600, // Dark Orange
    emotional_impact: 0xff00ff, // Purple
    reciprocity_detected: 0x00ffff, // Cyan
  };

  return colorMap[operation] || 0x808080; // Gray default
}

/**
 * Format trust value for display (0.1234 → 0.12)
 */
function formatTrust(value: number): string {
  return value.toFixed(2);
}

/**
 * Format delta with sign (+0.05 or -0.03)
 */
function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(2)}`;
}

/**
 * Send payload to Discord webhook
 * SECURITY: Throws if webhook unreachable (fail-closed)
 */
async function sendToDiscord(webhookUrl: string | undefined, payload: DiscordPayload): Promise<string> {
  if (!webhookUrl) {
    throw new Error('Discord webhook not configured for trust logging');
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }

    // Generate entry ID based on timestamp and hash
    const entryId = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload) + Date.now())
      .digest('hex')
      .slice(0, 16);

    return entryId;
  } catch (error) {
    // SECURITY: Fail-closed - propagate error
    throw new Error(`Trust logging failed (Discord unreachable): ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Exports
// ============================================================================

export const TrustLogging = {
  logTrustUpdate,
  logCreatorSecurityEvent,
  hashUserId,
};
