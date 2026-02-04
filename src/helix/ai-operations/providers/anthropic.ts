/**
 * Anthropic Provider Client - Unified SDK wrapper
 *
 * Wraps the Anthropic SDK and provides a unified interface for agent execution
 * and email analysis operations. Handles cost calculation and token tracking.
 */

import { getAnthropicClient, calculateProviderCost } from './registry.js';

/**
 * Message interface for Anthropic API
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Execution options for Anthropic API calls
 */
export interface AnthropicExecuteOptions {
  model: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Result from Anthropic API execution
 */
export interface AnthropicExecuteResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

/**
 * Execute API call with Anthropic SDK
 *
 * Handles:
 * - Client initialization via registry
 * - Message formatting
 * - Token extraction from response
 * - Cost calculation using provider pricing
 * - Error handling
 *
 * @param options - Execution options
 * @returns Result with content, tokens, and cost
 */
export async function executeWithAnthropic(
  options: AnthropicExecuteOptions
): Promise<AnthropicExecuteResult> {
  // Get the Anthropic client from registry (lazy-loaded, reuses instance)
  const client = getAnthropicClient();

  // Set defaults
  const maxTokens = options.maxTokens || 2048;
  const temperature = options.temperature ?? 0.7;
  const systemPrompt = options.systemPrompt || 'You are a helpful AI assistant.';

  // Convert message interface to Anthropic SDK format
  const messages = options.messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    // Execute API call with Anthropic SDK
    const response = await client.messages.create({
      model: options.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages,
    });

    // Extract text content from response
    let content = '';
    if (response.content && response.content.length > 0) {
      const firstBlock = response.content[0];
      if (firstBlock.type === 'text') {
        content = firstBlock.text;
      }
    }

    // Extract token counts from response
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    // Calculate cost using provider pricing
    const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

    return {
      content,
      inputTokens,
      outputTokens,
      costUsd,
      model: options.model,
    };
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`Anthropic execution failed: ${error.message}`);
    }
    throw new Error('Anthropic execution failed with unknown error');
  }
}

/**
 * Execute a simple text request with Anthropic
 *
 * Convenience function for single-message requests
 *
 * @param prompt - User prompt
 * @param model - Model to use
 * @param systemPrompt - Optional system prompt
 * @returns Result with content, tokens, and cost
 */
export async function executeSimpleRequest(
  prompt: string,
  model: string,
  systemPrompt?: string
): Promise<AnthropicExecuteResult> {
  return executeWithAnthropic({
    model,
    messages: [{ role: 'user', content: prompt }],
    systemPrompt,
  });
}

/**
 * Execute a multi-turn conversation with Anthropic
 *
 * @param messages - Conversation history
 * @param model - Model to use
 * @param options - Additional execution options
 * @returns Result with content, tokens, and cost
 */
export async function executeConversation(
  messages: AnthropicMessage[],
  model: string,
  options?: Partial<AnthropicExecuteOptions>
): Promise<AnthropicExecuteResult> {
  return executeWithAnthropic({
    model,
    messages,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    systemPrompt: options?.systemPrompt,
  });
}
