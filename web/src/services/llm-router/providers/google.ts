/**
 * Google Gemini LLM Provider
 * Implementation for Gemini 2.0 Flash
 */

import type { LLMProvider, LLMProviderRequest, LLMProviderResponse } from './index.js';

export class GoogleProvider implements LLMProvider {
  name = 'gemini-2.0-flash';
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable not set');
    }
  }

  async complete(request: LLMProviderRequest): Promise<LLMProviderResponse> {
    const response = await fetch(
      `${this.baseUrl}/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: {
              text: request.systemPrompt,
            },
          },
          contents: {
            parts: {
              text: request.userPrompt,
            },
          },
          generationConfig: {
            maxOutputTokens: request.maxTokens || 8000,
            temperature: request.temperature ?? 0.7,
            topP: request.topP ?? 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Google API error: ${error.error?.message || 'Unknown error'}`
      );
    }

    const data = await response.json();

    // Extract token counts from usageMetadata
    const usageMetadata = data.usageMetadata || {};
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0,
      stopReason: data.candidates?.[0]?.finishReason || 'UNKNOWN',
    };
  }
}
