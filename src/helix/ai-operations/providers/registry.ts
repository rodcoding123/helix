/**
 * Provider Registry - Central management of AI provider clients
 * Supports: Anthropic, Google Gemini, Deepgram, ElevenLabs
 */

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy-loaded provider clients
let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

/**
 * Get or initialize Anthropic client
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Get or initialize Google Generative AI client
 */
export function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable not set');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Provider configuration with pricing
 */
export interface ProviderPricing {
  provider: string;
  model: string;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
  supportedOperations: string[];
}

/**
 * Provider pricing table (updated quarterly)
 * Prices in USD per 1K tokens
 */
export const PROVIDER_PRICING: Record<string, ProviderPricing> = {
  // Anthropic Claude Models
  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    inputCostPer1kTokens: 0.008,
    outputCostPer1kTokens: 0.024,
    supportedOperations: ['agent_execution', 'email_analysis'],
  },
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    supportedOperations: ['agent_execution', 'email_analysis'],
  },
  'claude-opus-4-1-20250805': {
    provider: 'anthropic',
    model: 'claude-opus-4-1-20250805',
    inputCostPer1kTokens: 0.015,
    outputCostPer1kTokens: 0.075,
    supportedOperations: ['agent_execution', 'email_analysis'],
  },

  // Simplified Claude names (for Phase 8 and control plane)
  claude_haiku: {
    provider: 'anthropic',
    model: 'claude_haiku',
    inputCostPer1kTokens: 0.008,
    outputCostPer1kTokens: 0.024,
    supportedOperations: ['email_analysis', 'task_management'],
  },
  claude_sonnet: {
    provider: 'anthropic',
    model: 'claude_sonnet',
    inputCostPer1kTokens: 0.003,
    outputCostPer1kTokens: 0.015,
    supportedOperations: ['task_breakdown', 'email_analysis'],
  },

  // Google Gemini Models
  'gemini-2-0-flash': {
    provider: 'google',
    model: 'gemini-2-0-flash',
    inputCostPer1kTokens: 0.00005,
    outputCostPer1kTokens: 0.00015,
    supportedOperations: ['video_understanding'],
  },

  // Simplified Gemini name (for Phase 8 and control plane)
  gemini_flash: {
    provider: 'google',
    model: 'gemini_flash',
    inputCostPer1kTokens: 0.00005,
    outputCostPer1kTokens: 0.00015,
    supportedOperations: ['calendar_optimization', 'analytics_summary', 'sentiment_analysis'],
  },

  // DeepSeek Models
  deepseek: {
    provider: 'deepseek',
    model: 'deepseek',
    inputCostPer1kTokens: 0.0027,
    outputCostPer1kTokens: 0.0108,
    supportedOperations: [
      'chat',
      'email_compose',
      'email_classify',
      'email_respond',
      'calendar_prep',
      'task_prioritize',
      'task_breakdown',
      'analytics_anomaly',
    ],
  },

  // Deepgram Models
  'nova-2': {
    provider: 'deepgram',
    model: 'nova-2',
    inputCostPer1kTokens: 0.00003,
    outputCostPer1kTokens: 0.00003,
    supportedOperations: ['audio_transcription'],
  },

  // ElevenLabs Models
  eleven_turbo_v2_5: {
    provider: 'elevenlabs',
    model: 'eleven_turbo_v2_5',
    inputCostPer1kTokens: 0.03,
    outputCostPer1kTokens: 0.06,
    supportedOperations: ['text_to_speech'],
  },
};

/**
 * Calculate actual cost based on provider pricing
 */
export function calculateProviderCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PROVIDER_PRICING[model];
  if (!pricing) {
    console.warn(`No pricing found for model: ${model}, using estimate`);
    return 0;
  }

  const inputCost = (inputTokens / 1000) * pricing.inputCostPer1kTokens;
  const outputCost = (outputTokens / 1000) * pricing.outputCostPer1kTokens;

  return Math.round((inputCost + outputCost) * 10000) / 10000; // Round to 4 decimals
}

/**
 * Check if provider is available (API key exists)
 */
export function isProviderAvailable(provider: string): boolean {
  switch (provider) {
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'google':
      return !!process.env.GOOGLE_API_KEY;
    case 'deepgram':
      return !!process.env.DEEPGRAM_API_KEY;
    case 'elevenlabs':
      return !!process.env.ELEVENLABS_API_KEY;
    default:
      return false;
  }
}
