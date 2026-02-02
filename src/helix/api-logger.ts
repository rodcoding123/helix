/**
 * HELIX API LOGGER
 * Pre-flight and response logging for API calls
 *
 * CRITICAL: logApiPreFlight MUST complete BEFORE the API request is sent.
 * This ensures Discord has the log before Claude receives the prompt.
 */

import crypto from 'node:crypto';
import type { ApiPreFlightLog, ApiResponseLog, DiscordEmbed } from './types.js';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_API;

interface ApiLogState {
  pending: Map<string, ApiPreFlightLog>;
  requestCount: number;
  tokenCount: number;
}

const state: ApiLogState = {
  pending: new Map(),
  requestCount: 0,
  tokenCount: 0,
};

/**
 * Send webhook to Discord
 */
async function sendWebhook(embed: DiscordEmbed, sync: boolean = true): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  const sendPromise = fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch(error => {
    console.error('[Helix] API webhook failed:', error);
  });

  if (sync) {
    await sendPromise;
  }
}

/**
 * Message structure for API context arrays
 */
interface ApiMessage {
  role?: string;
  content?: string | object;
}

/**
 * Type guard for API message
 */
function isApiMessage(value: unknown): value is ApiMessage {
  return typeof value === 'object' && value !== null && ('role' in value || 'content' in value);
}

/**
 * Type guard for objects with string properties
 */
function hasStringProperty(obj: object, key: string): boolean {
  return key in obj && typeof (obj as Record<string, unknown>)[key] === 'string';
}

/**
 * Extract a preview from the prompt context
 * Handles various prompt structures
 */
function extractPromptPreview(context: unknown, maxLength: number = 500): string {
  if (!context) return '[no context]';

  if (typeof context === 'string') {
    return context.slice(0, maxLength);
  }

  if (Array.isArray(context)) {
    // Handle message array format - find last user message
    const messages = context.filter(isApiMessage);
    const lastUserMessage = messages.reverse().find(msg => msg.role === 'user');

    if (lastUserMessage?.content !== undefined) {
      const content =
        typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage.content);
      return content.slice(0, maxLength);
    }
  }

  if (typeof context === 'object' && context !== null) {
    const obj = context as Record<string, unknown>;
    if (hasStringProperty(obj, 'prompt')) {
      return (obj.prompt as string).slice(0, maxLength);
    }
    if ('messages' in obj) {
      return extractPromptPreview(obj.messages, maxLength);
    }
    if (hasStringProperty(obj, 'content')) {
      return (obj.content as string).slice(0, maxLength);
    }
  }

  return '[complex context]';
}

/**
 * Log API request BEFORE it is sent
 * This function MUST complete before the API call starts
 */
export async function logApiPreFlight(log: ApiPreFlightLog): Promise<string> {
  const requestId = log.requestId || crypto.randomUUID();
  state.requestCount++;

  // Store for correlation
  const logEntry: ApiPreFlightLog = {
    ...log,
    requestId,
    timestamp: log.timestamp || new Date().toISOString(),
  };
  state.pending.set(requestId, logEntry);

  const embed: DiscordEmbed = {
    title: '🤖 API Request',
    color: 0x57f287,
    fields: [
      { name: 'Request ID', value: `\`${requestId.slice(0, 8)}\``, inline: true },
      { name: 'Model', value: log.model || 'unknown', inline: true },
      { name: 'Provider', value: log.provider || 'unknown', inline: true },
      { name: 'Time', value: logEntry.timestamp, inline: true },
      { name: 'Request #', value: `${state.requestCount}`, inline: true },
    ],
    timestamp: logEntry.timestamp,
    footer: { text: 'PRE-FLIGHT - Logged before API receives request' },
  };

  if (log.sessionKey) {
    embed.fields.push({ name: 'Session', value: log.sessionKey, inline: true });
  }

  if (log.promptPreview) {
    embed.fields.push({
      name: 'Prompt Preview',
      value: `\`\`\`\n${log.promptPreview.slice(0, 500)}\`\`\``,
      inline: false,
    });
  }

  // SYNC: Must wait for Discord before API call
  await sendWebhook(embed, true);

  return requestId;
}

/**
 * Log API response after it completes
 */
export async function logApiResponse(log: ApiResponseLog): Promise<void> {
  state.pending.delete(log.requestId || '');

  if (log.tokenCount) {
    state.tokenCount += log.tokenCount;
  }

  const embed: DiscordEmbed = {
    title: '✅ API Response',
    color: 0x2ecc71,
    fields: [
      { name: 'Request ID', value: `\`${(log.requestId || '').slice(0, 8)}\``, inline: true },
      { name: 'Latency', value: log.latencyMs ? `${log.latencyMs}ms` : 'N/A', inline: true },
      { name: 'Tokens', value: log.tokenCount?.toString() || 'N/A', inline: true },
    ],
    timestamp: new Date().toISOString(),
    footer: { text: 'POST-RESPONSE' },
  };

  if (log.responsePreview) {
    embed.fields.push({
      name: 'Response Preview',
      value: `\`\`\`\n${log.responsePreview.slice(0, 500)}\`\`\``,
      inline: false,
    });
  }

  // ASYNC: Response log can be fire-and-forget
  await sendWebhook(embed, false);
}

/**
 * Log API error
 */
export async function logApiError(
  requestId: string,
  error: string,
  statusCode?: number
): Promise<void> {
  const pending = state.pending.get(requestId);
  state.pending.delete(requestId);

  const embed: DiscordEmbed = {
    title: '❌ API Error',
    color: 0xe74c3c,
    fields: [{ name: 'Request ID', value: `\`${requestId.slice(0, 8)}\``, inline: true }],
    timestamp: new Date().toISOString(),
    footer: { text: 'API CALL FAILED' },
  };

  if (statusCode) {
    embed.fields.push({ name: 'Status', value: `${statusCode}`, inline: true });
  }

  embed.fields.push({ name: 'Error', value: error.slice(0, 500), inline: false });

  if (pending?.model) {
    embed.fields.push({ name: 'Model', value: pending.model, inline: true });
  }

  await sendWebhook(embed, true);
}

/**
 * Get session statistics
 */
export function getApiStats(): {
  requestCount: number;
  tokenCount: number;
  pendingCount: number;
} {
  return {
    requestCount: state.requestCount,
    tokenCount: state.tokenCount,
    pendingCount: state.pending.size,
  };
}

/**
 * Create a wrapper for API streaming functions
 * This is designed to wrap OpenClaw's anthropic-payload-log.ts wrapStreamFn
 */
export function createApiLoggerWrapper<T extends (...args: unknown[]) => unknown>(
  streamFn: T,
  options: {
    modelId?: string;
    provider?: string;
    sessionKey?: string;
  } = {}
): T {
  const wrapped = async function (...args: Parameters<T>): Promise<ReturnType<T>> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Extract context from args (typically second parameter)
    const context = args[1];
    const promptPreview = extractPromptPreview(context);

    // PRE-FLIGHT LOG (sync)
    await logApiPreFlight({
      requestId,
      model: options.modelId,
      provider: options.provider,
      sessionKey: options.sessionKey,
      timestamp: new Date().toISOString(),
      promptPreview,
    });

    try {
      // Execute the API call
      const result = await (streamFn as (...args: unknown[]) => Promise<unknown>)(...args);

      // POST-RESPONSE LOG (async)
      const latencyMs = Date.now() - startTime;
      logApiResponse({
        requestId,
        model: options.modelId,
        provider: options.provider,
        sessionKey: options.sessionKey,
        timestamp: new Date().toISOString(),
        latencyMs,
        responsePreview: typeof result === 'string' ? result.slice(0, 200) : undefined,
      }).catch(console.error);

      return result as ReturnType<T>;
    } catch (error) {
      await logApiError(requestId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  return wrapped as T;
}

/**
 * Clear API state for testing (INTERNAL ONLY)
 * @internal
 */
export function __clearApiStateForTesting(): void {
  state.pending.clear();
  state.requestCount = 0;
  state.tokenCount = 0;
}

export { extractPromptPreview };
