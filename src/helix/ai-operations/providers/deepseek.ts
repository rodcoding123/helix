/**
 * DeepSeek Provider
 *
 * Backend implementation for DeepSeek V3.2 API integration.
 * Part of centralized AI orchestration for cost optimization and observability.
 *
 * Pricing: $0.0027 input / $0.0108 output per 1K tokens (primary model)
 * Phase 1: Router Integration
 */

import { calculateProviderCost } from './registry.js';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ExecuteWithDeepSeekOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeout?: number;
}

export interface ExecuteWithDeepSeekResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  stopReason: string;
}

let deepseekClient: DeepSeekClient | null = null;

/**
 * Singleton instance of DeepSeek client
 */
function getDeepSeekClient(): DeepSeekClient {
  if (!deepseekClient) {
    deepseekClient = new DeepSeekClient();
  }
  return deepseekClient;
}

/**
 * DeepSeek API Client
 *
 * Handles HTTP communication with DeepSeek API including:
 * - Request formatting
 * - Response parsing
 * - Error handling
 * - Token counting
 * - Cost calculation
 */
export class DeepSeekClient {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.deepseek.com/v1';
  private model = 'deepseek-chat';
  private initialized = false;

  constructor() {
    // API key will be loaded lazily on first use
  }

  /**
   * Initialize client with API key
   */
  private initialize(): void {
    if (this.initialized) return;

    // Get API key from environment (set by secrets preloader or manually)
    this.apiKey = process.env.DEEPSEEK_API_KEY ?? null;

    if (!this.apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY environment variable not set. ' +
          'Set via environment or configure in 1Password vault.'
      );
    }

    this.initialized = true;
  }

  /**
   * Make raw API request to DeepSeek
   */
  private async request(payload: DeepSeekRequest, timeoutMs = 30000): Promise<DeepSeekResponse> {
    if (!this.apiKey) {
      this.initialize();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Unknown error';

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const errorJson = JSON.parse(errorText);
          if (typeof errorJson === 'object' && errorJson !== null) {
            const error = (errorJson as Record<string, unknown>).error as
              | Record<string, unknown>
              | undefined;

            errorMessage =
              (error?.message as string) ||
              (errorJson as Record<string, string>).message ||
              errorText;
          }
        } catch {
          errorMessage = errorText;
        }

        throw new Error(`DeepSeek API error (${response.status}): ${errorMessage}`);
      }

      const data = (await response.json()) as DeepSeekResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`DeepSeek API request timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
      throw new Error(`DeepSeek API request failed: ${String(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute a completion request with DeepSeek
   *
   * This is the primary method for sending messages to DeepSeek.
   * It handles:
   * - API authentication
   * - Request formatting
   * - Response parsing
   * - Token counting
   * - Cost calculation
   */
  async execute(options: ExecuteWithDeepSeekOptions): Promise<ExecuteWithDeepSeekResult> {
    const { messages, maxTokens = 4096, temperature = 0.7, topP = 1.0, timeout = 30000 } = options;

    // Validate input
    if (!messages || messages.length === 0) {
      throw new Error('At least one message is required');
    }

    // Build request
    const payload: DeepSeekRequest = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
    };

    // Make API request
    const response = await this.request(payload, timeout);

    // Parse response
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Empty response from DeepSeek API');
    }

    const choice = response.choices[0];
    const content = choice.message.content;
    const inputTokens = response.usage.prompt_tokens;
    const outputTokens = response.usage.completion_tokens;
    const totalTokens = response.usage.total_tokens;

    // Calculate cost
    const costUsd = calculateProviderCost('deepseek', inputTokens, outputTokens);

    return {
      content,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      stopReason: choice.finish_reason,
    };
  }

  /**
   * Simple request wrapper for single-message completion
   */
  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: Partial<ExecuteWithDeepSeekOptions>
  ): Promise<ExecuteWithDeepSeekResult> {
    return this.execute({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      topP: options?.topP ?? 1.0,
      timeout: options?.timeout ?? 30000,
    });
  }

  /**
   * Multi-turn conversation wrapper
   */
  async conversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string,
    options?: Partial<ExecuteWithDeepSeekOptions>
  ): Promise<ExecuteWithDeepSeekResult> {
    const allMessages: DeepSeekMessage[] = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }

    return this.execute({
      messages: allMessages,
      maxTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.7,
      topP: options?.topP ?? 1.0,
      timeout: options?.timeout ?? 30000,
    });
  }
}

/**
 * Execute a request with DeepSeek
 *
 * Primary public interface for chat operations.
 * This function should be called by the router for all DeepSeek operations.
 *
 * @param messages - Array of messages (system, user, assistant)
 * @param options - Optional execution parameters
 * @returns Execution result with content, tokens, and cost
 */
export async function executeWithDeepSeek(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: Partial<ExecuteWithDeepSeekOptions>
): Promise<ExecuteWithDeepSeekResult> {
  const client = getDeepSeekClient();
  return client.execute({
    messages,
    maxTokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
    topP: options?.topP ?? 1.0,
    timeout: options?.timeout ?? 30000,
  });
}

/**
 * Simple request wrapper
 *
 * Convenience function for single-message completions.
 *
 * @param systemPrompt - System context for the model
 * @param userPrompt - User message to complete
 * @param options - Optional execution parameters
 * @returns Execution result
 */
export async function simpleRequest(
  systemPrompt: string,
  userPrompt: string,
  options?: Partial<ExecuteWithDeepSeekOptions>
): Promise<ExecuteWithDeepSeekResult> {
  const client = getDeepSeekClient();
  return client.complete(systemPrompt, userPrompt, options);
}

/**
 * Multi-turn conversation wrapper
 *
 * For ongoing conversations with message history.
 *
 * @param messages - Conversation history (user and assistant alternating)
 * @param systemPrompt - Optional system context
 * @param options - Optional execution parameters
 * @returns Execution result
 */
export async function conversation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt?: string,
  options?: Partial<ExecuteWithDeepSeekOptions>
): Promise<ExecuteWithDeepSeekResult> {
  const client = getDeepSeekClient();
  return client.conversation(messages, systemPrompt, options);
}

/**
 * Export client for advanced usage
 */
export function getDeepSeekClientInstance(): DeepSeekClient {
  return getDeepSeekClient();
}
