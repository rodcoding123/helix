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
export function logToDiscord(message: {
  channel?: string;
  type?: string;
  [key: string]: unknown;
}): void {
  try {
    // For now, log to console
    console.log('[Discord Log]', JSON.stringify(message));

    // TODO: In production, send to actual Discord webhook with fire-and-forget pattern
    // const webhookUrl = process.env[`DISCORD_WEBHOOK_${String(message.channel || 'API').toUpperCase()}`];
    // if (webhookUrl) {
    //   fetch(webhookUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ content: formatMessage(message) }),
    //   }).catch(err => console.error('Discord webhook failed:', err));
    // }
  } catch (error) {
    console.error('Failed to log to Discord:', error);
  }
}

/**
 * Format message for Discord
 */
export function formatMessage(message: Record<string, unknown>): string {
  const type = String(message.type || 'log');
  const entries = Object.entries(message)
    .filter(([k]) => k !== 'channel' && k !== 'type')
    .map(([k, v]) => `**${k}**: ${JSON.stringify(v)}`)
    .join('\n');

  return `**[${type.toUpperCase()}]**\n${entries}`;
}
