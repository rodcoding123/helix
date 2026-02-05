/**
 * DeepSeek LLM Provider
 * Implementation for DeepSeek v3.2
 */

import type { LLMProvider, LLMProviderRequest, LLMProviderResponse } from './index.js';

export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek-v3.2';
  private apiKey: string;
  private baseUrl = 'https://api.deepseek.com/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable not set');
    }
  }

  async complete(request: LLMProviderRequest): Promise<LLMProviderResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: request.maxTokens || 4096,
        messages: [
          {
            role: 'system',
            content: request.systemPrompt,
          },
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
        `DeepSeek API error: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
      stopReason: data.choices[0].finish_reason,
    };
  }
}
