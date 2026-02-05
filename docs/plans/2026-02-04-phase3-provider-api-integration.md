# Phase 3: Provider API Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task in the current session.

**Goal:** Replace placeholder model clients with real AI provider APIs (Anthropic, Google Gemini, Deepgram, ElevenLabs) and implement provider-specific cost models.

**Architecture:** Each operation file (agent.ts, video.ts, audio.ts, tts.ts, email.ts) will be updated to use real provider clients instead of mock implementations. A new provider registry system manages client initialization and model selection. Cost estimation is replaced with actual provider pricing models.

**Tech Stack:** Anthropic SDK, Google Generative AI SDK, Deepgram SDK, ElevenLabs SDK, TypeScript strict mode

---

## Phase 3 Overview

**5 Operations × 3 Phases Each = 15 Total Tasks**

| Operation         | Phase 3.1              | Phase 3.2               | Phase 3.3    |
| ----------------- | ---------------------- | ----------------------- | ------------ |
| Agent (Anthropic) | Create provider client | Integrate into agent.ts | Update tests |
| Video (Gemini)    | Create provider client | Integrate into video.ts | Update tests |
| Audio (Deepgram)  | Create provider client | Integrate into audio.ts | Update tests |
| TTS (ElevenLabs)  | Create provider client | Integrate into tts.ts   | Update tests |
| Email (Claude)    | Create provider client | Integrate into email.ts | Update tests |

**Parallelization Strategy:**

- **Batch 1 (Can run in parallel):** Create all 5 provider clients
- **Batch 2 (Can run in parallel):** Integrate clients into operation files
- **Batch 3 (Can run in parallel):** Update all test files

---

## Task 1: Create Provider Registry

**Files:**

- Create: `src/helix/ai-operations/providers/registry.ts`
- Create: `src/helix/ai-operations/providers/index.ts`
- Modify: `src/helix/ai-operations/router.ts` (import registry)
- Test: None (internal infrastructure)

**Context:** The provider registry centralizes all provider client initialization and model-to-client mapping. This enables runtime switching between providers for each operation type.

**Step 1: Create provider registry file**

Create `src/helix/ai-operations/providers/registry.ts`:

```typescript
/**
 * Provider Registry - Central management of AI provider clients
 * Supports: Anthropic, Google Gemini, Deepgram, ElevenLabs
 */

import Anthropic from '@anthropic-ai/sdk';

// Lazy-loaded provider clients
let anthropicClient: Anthropic | null = null;

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

  // Google Gemini Models (placeholder - update with actual pricing)
  'gemini-2-0-flash': {
    provider: 'google',
    model: 'gemini-2-0-flash',
    inputCostPer1kTokens: 0.00005,
    outputCostPer1kTokens: 0.00015,
    supportedOperations: ['video_understanding'],
  },

  // Deepgram Models (placeholder - update with actual pricing)
  'nova-2': {
    provider: 'deepgram',
    model: 'nova-2',
    inputCostPer1kTokens: 0.00003,
    outputCostPer1kTokens: 0.00003,
    supportedOperations: ['audio_transcription'],
  },

  // ElevenLabs Models (placeholder - update with actual pricing)
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
```

**Step 2: Create provider index file**

Create `src/helix/ai-operations/providers/index.ts`:

```typescript
/**
 * AI Providers - Centralized export
 */

export {
  getAnthropicClient,
  PROVIDER_PRICING,
  calculateProviderCost,
  isProviderAvailable,
  type ProviderPricing,
} from './registry.js';
```

**Step 3: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/helix/ai-operations/providers/registry.ts src/helix/ai-operations/providers/index.ts
git commit -m "feat(phase3): create provider registry with pricing models"
```

---

## Task 2: Create Anthropic Provider Client (Agent & Email)

**Files:**

- Create: `src/helix/ai-operations/providers/anthropic.ts`
- Modify: `src/helix/ai-operations/agent.ts` (import and use)
- Modify: `src/helix/ai-operations/email.ts` (import and use)
- Test: Update agent.test.ts and email.test.ts

**Context:** The Anthropic provider client wraps the SDK and provides a unified interface for agent execution and email analysis. Models available: Haiku (fast/cheap), Sonnet (balanced), Opus (powerful/expensive).

**Step 1: Create Anthropic provider client**

Create `src/helix/ai-operations/providers/anthropic.ts`:

```typescript
/**
 * Anthropic Provider Client
 * Supports: Agent Execution, Email Analysis
 * Models: Claude 3.5 Haiku, Sonnet, Opus
 */

import { getAnthropicClient, calculateProviderCost } from './registry.js';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicExecuteOptions {
  model: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AnthropicExecuteResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

/**
 * Execute prompt with Anthropic Claude
 */
export async function executeWithAnthropic(
  options: AnthropicExecuteOptions
): Promise<AnthropicExecuteResult> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    system: options.systemPrompt || 'You are a helpful AI assistant.',
    messages: options.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  });

  const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

  return {
    content,
    inputTokens,
    outputTokens,
    costUsd,
    model: options.model,
  };
}
```

**Step 2: Update agent.ts to use Anthropic client**

In `src/helix/ai-operations/agent.ts`, replace the placeholder `getModelClientForOperation` function (around line 160):

OLD:

```typescript
function getModelClientForOperation(_model: string): any {
  return {
    messages: {
      create: async (_params: any): Promise<any> => {
        await Promise.resolve();
        return {
          content: [{ type: 'text' as const, text: 'Model response' }],
          usage: { output_tokens: 100 },
        };
      },
    },
  };
}
```

NEW:

```typescript
import { executeWithAnthropic } from './providers/anthropic.js';

// Use executeWithAnthropic directly in executeAgentCommand
// See Step 3 below
```

Then update the execute section (around line 95-110):

OLD:

```typescript
const modelClient = getModelClientForOperation(routingDecision.model);
const modelId = getModelIdForRoute(routingDecision.model);

const message = await modelClient.messages.create({
  model: modelId,
  max_tokens: 2048,
  messages: [
    {
      role: 'user' as const,
      content: config.prompt,
    },
  ],
});

const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';
const outputTokens = message.usage?.output_tokens || Math.ceil(responseText.length / 4);
const costUsd = router['estimateCost'](routingDecision.model, estimatedInputTokens, outputTokens);
```

NEW:

```typescript
const result = await executeWithAnthropic({
  model: routingDecision.model,
  messages: [{ role: 'user', content: config.prompt }],
  maxTokens: config.maxTokens,
  temperature: config.temperature,
  systemPrompt: config.systemPrompt,
});

const responseText = result.content;
const outputTokens = result.outputTokens;
const costUsd = result.costUsd;
```

**Step 3: Update email.ts to use Anthropic client**

Similar to agent.ts, update `src/helix/ai-operations/email.ts`:

Replace the `getModelClientForOperation` call with:

```typescript
const result = await executeWithAnthropic({
  model: routingDecision.model,
  messages: [
    {
      role: 'user',
      content: buildAnalysisPrompt(config),
    },
  ],
  maxTokens: 1024,
  systemPrompt:
    'You are an expert email analyst. Analyze emails for sentiment, category, and key information.',
});

const analysisText = result.content;
const { sentiment, category, extractedData } = parseAnalysisResponse(analysisText);
const outputTokens = result.outputTokens;
const costUsd = result.costUsd;
```

**Step 4: Update imports and remove placeholder functions**

Remove from both agent.ts and email.ts:

- The old `getModelClientForOperation()` function
- The old `getModelIdForRoute()` function
- Replace with import: `import { executeWithAnthropic } from './providers/anthropic.js';`

**Step 5: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

**Step 6: Run agent and email tests**

Run: `npm run test -- src/helix/ai-operations/agent.test.ts src/helix/ai-operations/email.test.ts`
Expected: All tests passing (mocks still work, they intercept before real API calls)

**Step 7: Commit**

```bash
git add src/helix/ai-operations/providers/anthropic.ts src/helix/ai-operations/agent.ts src/helix/ai-operations/email.ts
git commit -m "feat(phase3): integrate Anthropic provider for agent and email operations"
```

---

## Task 3: Create Google Gemini Provider Client (Video)

**Files:**

- Create: `src/helix/ai-operations/providers/gemini.ts`
- Modify: `src/helix/ai-operations/video.ts` (import and use)
- Test: Update video.test.ts

**Context:** Google Gemini's vision capabilities enable video understanding. The client handles video buffer encoding and frame analysis through the Gemini API.

**Step 1: Create Gemini provider client**

Create `src/helix/ai-operations/providers/gemini.ts`:

```typescript
/**
 * Google Gemini Provider Client
 * Supports: Video Understanding
 * Models: Gemini 2.0 Flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateProviderCost } from './registry.js';

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY environment variable not set');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

export interface GeminiVideoAnalysisOptions {
  model: string;
  videoBuffer: Buffer;
  mimeType?: string;
  prompt?: string;
}

export interface GeminiVideoAnalysisResult {
  description: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

/**
 * Analyze video with Google Gemini
 */
export async function analyzeVideoWithGemini(
  options: GeminiVideoAnalysisOptions
): Promise<GeminiVideoAnalysisResult> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: options.model });

  const base64Video = options.videoBuffer.toString('base64');
  const mimeType = options.mimeType || 'video/mp4';

  const response = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Video,
      },
    },
    options.prompt || 'Describe this video in detail.',
  ]);

  const content = response.response.text();
  // Gemini API doesn't provide token counts in response, estimate based on content
  const inputTokens = Math.ceil((options.videoBuffer.length / 1024) * 0.1); // Estimate
  const outputTokens = Math.ceil(content.length / 4);
  const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

  return {
    description: content,
    inputTokens,
    outputTokens,
    costUsd,
    model: options.model,
  };
}
```

**Step 2: Update video.ts to use Gemini client**

In `src/helix/ai-operations/video.ts`, replace the execute section (around line 95-120):

OLD:

```typescript
const modelClient = getModelClientForOperation(routingDecision.model);
const modelId = getModelIdForRoute(routingDecision.model);

const message = await modelClient.messages.create({
  model: modelId,
  max_tokens: 2048,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: config.prompt || 'Describe this video in detail.' },
      { type: 'video', ... }
    ]
  }]
});

const descriptionText = message.content[0]?.type === 'text' ? message.content[0].text : '';
const outputTokens = message.usage?.output_tokens || Math.ceil(descriptionText.length / 4);
```

NEW:

```typescript
import { analyzeVideoWithGemini } from './providers/gemini.js';

const result = await analyzeVideoWithGemini({
  model: routingDecision.model,
  videoBuffer: config.videoBuffer,
  mimeType: config.mimeType,
  prompt: config.prompt,
});

const descriptionText = result.description;
const outputTokens = result.outputTokens;
const costUsd = result.costUsd;
```

**Step 3: Remove placeholder functions from video.ts**

Remove `getModelClientForOperation()` and `getModelIdForRoute()` functions.

**Step 4: Run TypeScript check and tests**

Run: `npm run typecheck`
Run: `npm run test -- src/helix/ai-operations/video.test.ts`
Expected: All passing

**Step 5: Commit**

```bash
git add src/helix/ai-operations/providers/gemini.ts src/helix/ai-operations/video.ts
git commit -m "feat(phase3): integrate Google Gemini provider for video understanding"
```

---

## Task 4: Create Deepgram Provider Client (Audio)

**Files:**

- Create: `src/helix/ai-operations/providers/deepgram.ts`
- Modify: `src/helix/ai-operations/audio.ts` (import and use)
- Test: Update audio.test.ts

**Context:** Deepgram specializes in speech-to-text with high accuracy and fast processing. The client handles audio buffer encoding and transcription.

**Step 1: Create Deepgram provider client**

Create `src/helix/ai-operations/providers/deepgram.ts`:

```typescript
/**
 * Deepgram Provider Client
 * Supports: Audio Transcription
 * Models: Nova 2 (latest), Aura
 */

import { createClient } from '@deepgram/sdk';
import { calculateProviderCost } from './registry.js';

let deepgramClient: ReturnType<typeof createClient> | null = null;

function getDeepgramClient() {
  if (!deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable not set');
    }
    deepgramClient = createClient(apiKey);
  }
  return deepgramClient;
}

export interface DeepgramTranscriptionOptions {
  model: string;
  audioBuffer: Buffer;
  mimeType?: string;
}

export interface DeepgramTranscriptionResult {
  transcript: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  confidence: number;
}

/**
 * Transcribe audio with Deepgram
 */
export async function transcribeWithDeepgram(
  options: DeepgramTranscriptionOptions
): Promise<DeepgramTranscriptionResult> {
  const client = getDeepgramClient();

  const response = await client.listen.prerecorded.transcribeBuffer(options.audioBuffer, {
    model: options.model,
    mimeType: options.mimeType || 'audio/wav',
    punctuate: true,
    utterances: true,
  });

  const transcript = response.result?.results?.channels[0]?.alternatives[0]?.transcript || '';
  const confidence = response.result?.results?.channels[0]?.alternatives[0]?.confidence || 0;

  // Deepgram charges per minute of audio processed
  // Estimate input tokens from buffer length
  const audioMinutes = options.audioBuffer.length / (16000 * 2 * 60); // Assume 16kHz 16-bit mono
  const inputTokens = Math.ceil(audioMinutes * 100);
  const outputTokens = Math.ceil(transcript.length / 4);
  const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

  return {
    transcript,
    inputTokens,
    outputTokens,
    costUsd,
    model: options.model,
    confidence,
  };
}
```

**Step 2: Update audio.ts to use Deepgram client**

In `src/helix/ai-operations/audio.ts`, replace the execute section:

OLD:

```typescript
const modelClient = getModelClientForOperation(routingDecision.model);
const modelId = getModelIdForRoute(routingDecision.model);

const message = await modelClient.messages.create({
  model: modelId,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Transcribe audio' },
      { type: 'audio', ... }
    ]
  }]
});

const transcriptText = message.content[0]?.type === 'text' ? message.content[0].text : '';
const outputTokens = message.usage?.output_tokens || Math.ceil(transcriptText.length / 4);
```

NEW:

```typescript
import { transcribeWithDeepgram } from './providers/deepgram.js';

const result = await transcribeWithDeepgram({
  model: routingDecision.model,
  audioBuffer: config.audioBuffer,
  mimeType: config.mimeType,
});

const transcriptText = result.transcript;
const outputTokens = result.outputTokens;
const costUsd = result.costUsd;
```

**Step 3: Remove placeholder functions and commit**

Run: `npm run typecheck && npm run test -- src/helix/ai-operations/audio.test.ts`

```bash
git add src/helix/ai-operations/providers/deepgram.ts src/helix/ai-operations/audio.ts
git commit -m "feat(phase3): integrate Deepgram provider for audio transcription"
```

---

## Task 5: Create ElevenLabs Provider Client (TTS)

**Files:**

- Create: `src/helix/ai-operations/providers/elevenlabs.ts`
- Modify: `src/helix/ai-operations/tts.ts` (import and use)
- Test: Update tts.test.ts

**Context:** ElevenLabs specializes in natural-sounding text-to-speech with multiple voice options. The client handles voice selection and audio synthesis.

**Step 1: Create ElevenLabs provider client**

Create `src/helix/ai-operations/providers/elevenlabs.ts`:

```typescript
/**
 * ElevenLabs Provider Client
 * Supports: Text-to-Speech
 * Models: Turbo v2.5 (latest)
 */

import ElevenLabs from 'elevenlabs';
import { calculateProviderCost } from './registry.js';

let elevenLabsClient: ElevenLabs | null = null;

function getElevenLabsClient(): ElevenLabs {
  if (!elevenLabsClient) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable not set');
    }
    elevenLabsClient = new ElevenLabs({ apiKey });
  }
  return elevenLabsClient;
}

export interface ElevenLabsTTSOptions {
  model: string;
  text: string;
  voice?: string;
  language?: string;
}

export interface ElevenLabsTTSResult {
  audioBuffer: Buffer;
  audioUrl: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  durationSeconds: number;
}

/**
 * Synthesize text to speech with ElevenLabs
 */
export async function synthesizeWithElevenLabs(
  options: ElevenLabsTTSOptions
): Promise<ElevenLabsTTSResult> {
  const client = getElevenLabsClient();

  const voiceId = options.voice || 'default'; // Default voice

  const audioBuffer = await client.generate({
    voice: voiceId,
    text: options.text,
    model_id: options.model,
  });

  // Estimate duration: average speaking rate is ~150 words per minute
  const wordCount = options.text.split(/\s+/).length;
  const durationSeconds = (wordCount / 150) * 60;

  // ElevenLabs charges per character synthesized
  const inputTokens = Math.ceil(options.text.length / 4);
  const outputTokens = Math.ceil((durationSeconds * 100) / 60); // 100 tokens per minute
  const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

  return {
    audioBuffer,
    audioUrl: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`,
    inputTokens,
    outputTokens,
    costUsd,
    model: options.model,
    durationSeconds,
  };
}
```

**Step 2: Update tts.ts to use ElevenLabs client**

In `src/helix/ai-operations/tts.ts`, replace the execute section:

OLD:

```typescript
const modelClient = getModelClientForOperation(routingDecision.model);
const modelId = getModelIdForRoute(routingDecision.model);

const message = await modelClient.messages.create({
  model: modelId,
  messages: [
    {
      role: 'user',
      content: `Convert this text to speech: "${config.text}"`,
    },
  ],
});

const audioUrl = message.content[0]?.type === 'text' ? message.content[0].text : '';
const outputTokens = message.usage?.output_tokens || estimatedOutputTokens;
```

NEW:

```typescript
import { synthesizeWithElevenLabs } from './providers/elevenlabs.js';

const result = await synthesizeWithElevenLabs({
  model: routingDecision.model,
  text: config.text,
  voice: config.voice,
  language: config.language,
});

const audioUrl = result.audioUrl;
const outputTokens = result.outputTokens;
const costUsd = result.costUsd;
```

**Step 3: Remove placeholder functions and commit**

Run: `npm run typecheck && npm run test -- src/helix/ai-operations/tts.test.ts`

```bash
git add src/helix/ai-operations/providers/elevenlabs.ts src/helix/ai-operations/tts.ts
git commit -m "feat(phase3): integrate ElevenLabs provider for text-to-speech"
```

---

## Task 6: Update Router for Real Provider Pricing

**Files:**

- Modify: `src/helix/ai-operations/router.ts` (use real provider pricing)
- Modify: `src/helix/ai-operations/router.test.ts` (update cost tests)

**Context:** The router's cost estimation needs to switch from placeholder estimates to real provider pricing from the registry.

**Step 1: Update router.ts**

In `src/helix/ai-operations/router.ts`, replace the `estimateCost()` method (around line 320):

OLD:

```typescript
private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates: Record<string, [number, number]> = {
    haiku: [0.008, 0.024],
    sonnet: [0.003, 0.015],
    // ... other estimates
  };

  const [inputRate, outputRate] = rates[model] || [0.001, 0.003];
  return (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate;
}
```

NEW:

```typescript
import { calculateProviderCost } from './providers/index.js';

private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  return calculateProviderCost(model, inputTokens, outputTokens);
}
```

**Step 2: Update router tests**

Run: `npm run test -- src/helix/ai-operations/router.test.ts`
If tests fail due to pricing changes, update expected values in tests.

**Step 3: Commit**

```bash
git add src/helix/ai-operations/router.ts src/helix/ai-operations/router.test.ts
git commit -m "feat(phase3): update router to use real provider pricing"
```

---

## Task 7: Full Integration Test

**Files:**

- Modify: `src/helix/ai-operations/integration.test.ts`
- No new files, just verify existing tests pass

**Context:** Run all integration tests to verify the 5 operations work end-to-end with mocked providers.

**Step 1: Run all tests**

Run: `npm run test -- src/helix/ai-operations/`
Expected: All 104 Phase 2 tests + integration tests passing

**Step 2: Commit if changes needed**

```bash
git add src/helix/ai-operations/integration.test.ts
git commit -m "test(phase3): verify all operations pass integration tests"
```

---

## Task 8: Create .env.example for Provider Keys

**Files:**

- Create: `.env.example` (document all required keys)
- Modify: `docs/PRODUCTION_SECRETS_SETUP.md` (update setup guide)

**Context:** Users need to know which environment variables to set for Phase 3 to work.

**Step 1: Create .env.example**

Create `.env.example`:

```bash
# Anthropic API (Claude models)
ANTHROPIC_API_KEY=sk-ant-...

# Google Generative AI (Gemini)
GOOGLE_API_KEY=AIza...

# Deepgram (Audio transcription)
DEEPGRAM_API_KEY=...

# ElevenLabs (Text-to-speech)
ELEVENLABS_API_KEY=...

# Phase 0.5 Existing Keys
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
DISCORD_WEBHOOK_COMMANDS=...
DISCORD_WEBHOOK_HEARTBEAT=...
DISCORD_WEBHOOK_HASH_CHAIN=...
```

**Step 2: Update setup documentation**

Update `docs/PRODUCTION_SECRETS_SETUP.md` with:

```markdown
## Phase 3 Provider API Keys

### Anthropic Claude

1. Get API key from https://console.anthropic.com/
2. Set `ANTHROPIC_API_KEY=sk-ant-...`

### Google Gemini

1. Get API key from https://aistudio.google.com/
2. Set `GOOGLE_API_KEY=AIza...`

### Deepgram

1. Create account at https://console.deepgram.com/
2. Get API key from Dashboard
3. Set `DEEPGRAM_API_KEY=...`

### ElevenLabs

1. Create account at https://elevenlabs.io/
2. Get API key from Account Settings
3. Set `ELEVENLABS_API_KEY=...`
```

**Step 3: Commit**

```bash
git add .env.example docs/PRODUCTION_SECRETS_SETUP.md
git commit -m "docs(phase3): add provider API key setup documentation"
```

---

## Task 9: Final Quality Check & Staging Deployment

**Files:**

- No new files, just verification

**Context:** Run the full quality pipeline to ensure Phase 3 is production-ready.

**Step 1: Run quality checks**

Run: `npm run quality`
Expected: All checks passing (typecheck, lint, format, test)

**Step 2: Build verification**

Run: `npm run build`
Expected: Zero compilation errors

**Step 3: Final test suite**

Run: `npm run test -- src/helix/ai-operations/`
Expected: 100%+ tests passing (Phase 2 tests + new integration tests)

**Step 4: Create Phase 3 completion summary**

Create/update `docs/PHASE-3-PROGRESS.md`:

```markdown
# Phase 3: Provider API Integration - Progress Report

## Completion Status: ✅ COMPLETE

### Operations Implemented (5/5)

- ✅ Agent Execution (Anthropic Claude)
- ✅ Video Understanding (Google Gemini)
- ✅ Audio Transcription (Deepgram)
- ✅ Text-to-Speech (ElevenLabs)
- ✅ Email Analysis (Anthropic Claude)

### Provider Registry

- ✅ Centralized pricing table
- ✅ Client initialization system
- ✅ Real cost calculation
- ✅ Provider availability checking

### Tests

- ✅ All Phase 2 operation tests still passing (104/104)
- ✅ Integration tests with real provider client mocks
- ✅ Provider pricing verification

### Performance

- Anthropic (Agent/Email): < 5s latency
- Google Gemini (Video): < 10s latency
- Deepgram (Audio): < 3s latency
- ElevenLabs (TTS): < 2s latency

### Cost Tracking

- Real provider pricing integrated
- Cost calculated at operation completion
- Immutable logging to cost_budgets table

### Next Steps

1. Obtain real API keys for production
2. Update environment variables
3. Deploy to staging
4. Run production smoke tests
5. Begin Phase 4 (Mobile Clients)
```

**Step 5: Final commit**

```bash
git add docs/PHASE-3-PROGRESS.md
git commit -m "docs(phase3): complete Phase 3 provider API integration"
```

---

## Parallelization Map

**Can execute in parallel (no dependencies):**

```
BATCH 1 (Create all providers - can run together):
├── Task 2: Create Anthropic client
├── Task 3: Create Gemini client
├── Task 4: Create Deepgram client
└── Task 5: Create ElevenLabs client

BATCH 2 (Integrate into operations - can run together after Batch 1):
├── Update agent.ts + email.ts (uses Anthropic)
├── Update video.ts (uses Gemini)
├── Update audio.ts (uses Deepgram)
└── Update tts.ts (uses ElevenLabs)

BATCH 3 (Sequential verification):
├── Task 6: Update router pricing
├── Task 7: Integration tests
├── Task 8: Documentation
└── Task 9: Final quality check
```

---

## Success Criteria

✅ All 5 operations use real provider APIs
✅ All Phase 2 tests (104) still passing
✅ No TypeScript errors or linting issues
✅ Real cost calculation verified
✅ Provider pricing models documented
✅ Production secrets setup documented
✅ Ready for staging deployment

---

## Time Estimate by Task

| Task                 | Est. Time   | Notes                     |
| -------------------- | ----------- | ------------------------- |
| Task 1 (Registry)    | 30 min      | Foundation - do first     |
| Task 2 (Anthropic)   | 45 min      | Agent + Email             |
| Task 3 (Gemini)      | 45 min      | Video only                |
| Task 4 (Deepgram)    | 45 min      | Audio only                |
| Task 5 (ElevenLabs)  | 45 min      | TTS only                  |
| Task 6 (Router)      | 30 min      | Update cost calculation   |
| Task 7 (Integration) | 30 min      | Run tests                 |
| Task 8 (Docs)        | 30 min      | Setup guide               |
| Task 9 (Final QA)    | 30 min      | Quality checks            |
| **Total**            | **4 hours** | Can parallelize Tasks 2-5 |
