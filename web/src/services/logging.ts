/**
 * Logging utilities for web services
 * Provides Discord logging and hash chain integration
 */

export async function logToDiscord(message: {
  type: string;
  content: string;
  metadata?: Record<string, any>;
  status?: 'pending' | 'completed' | 'error';
  timestamp?: number;
}): Promise<void> {
  try {
    await fetch('/api/discord-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'helix-api',
        message: {
          content: `**${message.type}**: ${message.content}`,
          embeds: message.metadata
            ? [
                {
                  title: message.type,
                  description: message.content,
                  fields: Object.entries(message.metadata).map(([key, value]) => ({
                    name: key,
                    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                    inline: true,
                  })),
                  color:
                    message.status === 'error'
                      ? 0xff0000
                      : message.status === 'completed'
                        ? 0x00ff00
                        : 0xffa500,
                  timestamp: new Date().toISOString(),
                },
              ]
            : undefined,
        },
      }),
    });
  } catch (error) {
    // Non-fatal logging error - don't throw
    console.error('Discord logging failed:', error);
  }
}

export async function logToHashChain(entry: {
  type: string;
  data: string;
  userId?: string;
  metadata?: Record<string, any>;
}): Promise<{ hash: string; index: number } | null> {
  try {
    const response = await fetch('/api/hash-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Hash chain logging failed:', error);
  }

  return null;
}
