/**
 * Anthropic (Claude) LLM Provider
 * Implementation for Claude Opus 4.5
 */

import type { LLMProvider, LLMProviderRequest, LLMProviderResponse } from './index.js';

export class AnthropicProvider implements LLMProvider {
  name = 'claude-opus-4.5';
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
  }

  async complete(request: LLMProviderRequest): Promise<LLMProviderResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-20250805',
        max_tokens: request.maxTokens || 4096,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.userPrompt,
          },
        ],
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Anthropic API error: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      stopReason: data.stop_reason,
    };
  }
}
