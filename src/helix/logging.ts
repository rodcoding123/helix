/**
 * Logging Module for Phase 0.5
 *
 * Provides centralized Discord logging for AI operations control plane.
 * In production, this integrates with the Discord webhook infrastructure.
 */

/**
 * Log message to Discord
 * @param message Message object with channel, type, and data
 */
export async function logToDiscord(message: {
  channel?: string;
  type?: string;
  [key: string]: unknown;
}): Promise<void> {
  try {
    // For now, log to console
    console.log('[Discord Log]', JSON.stringify(message));

    // TODO: In production, send to actual Discord webhook
    // const webhookUrl = process.env[`DISCORD_WEBHOOK_${message.channel?.toUpperCase() || 'API'}`];
    // if (!webhookUrl) return;
    //
    // await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     content: formatMessage(message)
    //   })
    // });
  } catch (error) {
    console.error('Failed to log to Discord:', error);
  }
}

/**
 * Format message for Discord
 */
function formatMessage(message: Record<string, unknown>): string {
  const type = message.type || 'log';
  const entries = Object.entries(message)
    .filter(([k]) => k !== 'channel' && k !== 'type')
    .map(([k, v]) => `**${k}**: ${JSON.stringify(v)}`)
    .join('\n');

  return `**[${type.toUpperCase()}]**\n${entries}`;
}
