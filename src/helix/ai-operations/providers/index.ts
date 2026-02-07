/**
 * AI Providers - Centralized export
 */

export {
  getAnthropicClient,
  getGeminiClient,
  getDeepSeekClient,
  PROVIDER_PRICING,
  calculateProviderCost,
  isProviderAvailable,
  type ProviderPricing,
} from './registry.js';

export {
  executeWithAnthropic,
  executeSimpleRequest,
  executeConversation,
  type AnthropicMessage,
  type AnthropicExecuteOptions,
  type AnthropicExecuteResult,
} from './anthropic.js';

export {
  analyzeVideoWithGemini,
  type GeminiVideoAnalysisOptions,
  type GeminiVideoAnalysisResult,
} from './gemini.js';

export {
  executeWithDeepSeek,
  simpleRequest as deepSeekSimpleRequest,
  conversation as deepSeekConversation,
  DeepSeekClient,
  type ExecuteWithDeepSeekOptions,
  type ExecuteWithDeepSeekResult,
} from './deepseek.js';

export {
  getDeepgramClient,
  transcribeWithDeepgram,
  type DeepgramTranscriptionOptions,
  type DeepgramTranscriptionResult,
} from './deepgram.js';
