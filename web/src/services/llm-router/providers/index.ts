/**
 * LLM Provider Interface and Factory
 * Unified abstraction for different LLM providers
 */

import { AnthropicProvider } from './anthropic.js';
import { DeepSeekProvider } from './deepseek.js';
import { GoogleProvider } from './google.js';

export interface LLMProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface LLMProviderResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}

export interface LLMProvider {
  name: string;
  complete(request: LLMProviderRequest): Promise<LLMProviderResponse>;
}

/**
 * Factory function to get provider instance
 */
export function getProvider(
  modelId: string
): LLMProvider {
  switch (modelId) {
    case 'claude-opus-4.5':
      return new AnthropicProvider();
    case 'deepseek-v3.2':
      return new DeepSeekProvider();
    case 'gemini-2.0-flash':
      return new GoogleProvider();
    default:
      throw new Error(`Unknown model: ${modelId}`);
  }
}

export { AnthropicProvider, DeepSeekProvider, GoogleProvider };
