/**
 * Phase 8: AI Provider Client
 * Abstraction layer for calling routed AI models via Phase 0.5 router
 * Supports DeepSeek, Gemini Flash, and fallbacks
 */

import type { RoutingResponse } from '../services/intelligence/router-client';

export type AIModel = 'deepseek' | 'gemini_flash' | 'openai' | 'deepgram' | 'edge_tts' | 'elevenlabs';

export interface CompletionRequest {
  model: AIModel;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
}

export interface CompletionResponse {
  content: string;
  model: string;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

/**
 * Client for calling AI models through Phase 0.5 router
 * Handles provider-specific APIs and response parsing
 */
export class AIProviderClient {
  private baseUrl: string;
  private apiKeys: Map<AIModel, string> = new Map();

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

    // Load API keys from environment
    const deepseekKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (deepseekKey) this.apiKeys.set('deepseek', deepseekKey);
    if (geminiKey) this.apiKeys.set('gemini_flash', geminiKey);
  }

  /**
   * Call an AI model via the router
   * Handles model-specific API formatting and response parsing
   */
  async callModel(routing: RoutingResponse, request: CompletionRequest): Promise<CompletionResponse> {
    const model = routing.model as AIModel;

    switch (model) {
      case 'deepseek':
        return this.callDeepSeek(request);
      case 'gemini_flash':
        return this.callGemini(request);
      case 'openai':
        return this.callOpenAI(request);
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  /**
   * Call DeepSeek API
   * Used for: email composition, classification, response, calendar prep, task operations, analytics
   */
  private async callDeepSeek(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.apiKeys.get('deepseek');
    if (!apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.95,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DeepSeek API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      model: 'deepseek',
      tokenUsage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
    };
  }

  /**
   * Call Google Gemini Flash API
   * Used for: email classification, calendar time optimization, analytics summary, anomaly detection
   */
  private async callGemini(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.apiKeys.get('gemini_flash');
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...(request.systemPrompt ? [{ text: request.systemPrompt }] : []),
              { text: request.prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: request.temperature ?? 0.7,
          topP: request.topP ?? 0.95,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Estimate token count (Gemini doesn't always return exact counts)
    const inputTokens = Math.ceil(request.prompt.length / 4);
    const outputTokens = Math.ceil(content.length / 4);

    return {
      content,
      model: 'gemini_flash',
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      finishReason: data.candidates?.[0]?.finishReason || 'STOP',
    };
  }

  /**
   * Call OpenAI API (fallback or specific use cases)
   */
  private async callOpenAI(request: CompletionRequest): Promise<CompletionResponse> {
    const apiKey = this.apiKeys.get('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt },
        ],
        max_tokens: request.maxTokens,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.95,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      model: 'openai',
      tokenUsage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      finishReason: data.choices[0]?.finish_reason || 'stop',
    };
  }

  /**
   * Estimate tokens for content (rough estimation)
   * Used for pre-routing token calculation
   */
  static estimateTokens(content: string): number {
    // Average: 1 token per 4 characters
    return Math.ceil(content.length / 4);
  }

  /**
   * Estimate tokens for multiple pieces of content
   */
  static estimateTokensMultiple(...contents: (string | undefined)[]): number {
    return contents.reduce((sum, content) => sum + this.estimateTokens(content || ''), 0);
  }
}

// Singleton instance
let providerClient: AIProviderClient | null = null;

export function getProviderClient(): AIProviderClient {
  if (!providerClient) {
    providerClient = new AIProviderClient();
  }
  return providerClient;
}
