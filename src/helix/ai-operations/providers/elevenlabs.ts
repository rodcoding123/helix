/**
 * ElevenLabs Provider Client - Text-to-Speech Synthesis
 *
 * Wraps the ElevenLabs SDK and provides a unified interface for TTS synthesis.
 * Handles cost calculation and token tracking.
 */

import { calculateProviderCost } from './registry.js';

// Lazy-loaded ElevenLabs module
let elevenLabsModule: unknown = null;

/**
 * Options for ElevenLabs text-to-speech
 */
export interface ElevenLabsTTSOptions {
  model: string;
  text: string;
  voice?: string;
  language?: string;
}

/**
 * Result from ElevenLabs text-to-speech
 */
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
 * Get or initialize ElevenLabs client
 *
 * Lazy-loads the elevenlabs package and initializes client with API key.
 * Throws error if ELEVENLABS_API_KEY is not set.
 *
 * @returns ElevenLabs client instance
 */
export async function getElevenLabsClient(): Promise<unknown> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable not set');
  }

  // Lazy-load ElevenLabs SDK using dynamic import
  if (elevenLabsModule === null) {
    // @ts-expect-error - elevenlabs is optional and lazy-loaded
    elevenLabsModule = await import('elevenlabs');
  }

  const ElevenLabs = (elevenLabsModule as Record<string, unknown>).default as {
    new (apiKey: string): unknown;
  };
  return new ElevenLabs(apiKey);
}

/**
 * Synthesize text to speech with ElevenLabs
 *
 * Takes text and synthesizes it into audio using the ElevenLabs API.
 *
 * Handles:
 * - Client initialization via lazy-loading
 * - Text-to-speech synthesis with specified voice and model
 * - Audio buffer conversion to base64 data URI
 * - Duration estimation based on word count (150 words per minute)
 * - Token estimation from text length and audio duration
 * - Cost calculation using provider pricing
 *
 * @param options - TTS options
 * @returns Result with audio buffer, URL, tokens, cost, and duration
 */
export async function synthesizeWithElevenLabs(
  options: ElevenLabsTTSOptions
): Promise<ElevenLabsTTSResult> {
  // Get the ElevenLabs client
  const client = await getElevenLabsClient();

  // Set defaults
  const voice = options.voice || 'default';

  try {
    // Synthesize text with ElevenLabs
    const response: unknown = await (
      client as {
        generate: (params: Record<string, unknown>) => Promise<unknown>;
      }
    ).generate({
      text: options.text,
      voice: voice,
      model_id: options.model,
    });

    // Extract audio buffer from response
    let audioBuffer: Buffer;

    // Handle response - ElevenLabs returns audio as buffer or stream
    if (Buffer.isBuffer(response)) {
      audioBuffer = response;
    } else if ((response as Record<string, unknown>).audio) {
      audioBuffer = (response as Record<string, unknown>).audio as Buffer;
    } else {
      // Fallback: convert response to buffer
      audioBuffer = Buffer.from(response as ArrayBufferLike);
    }

    // Estimate duration: 150 words per minute average speaking rate
    const wordCount = options.text.split(/\s+/).length;
    const durationSeconds = (wordCount / 150) * 60;

    // Estimate tokens from text length (approximately 1 token per 4 characters)
    const inputTokens = Math.ceil(options.text.length / 4);

    // Estimate output tokens from audio duration (approximately 100 tokens per minute)
    const outputTokens = Math.ceil((durationSeconds / 60) * 100);

    // Calculate cost using provider pricing
    const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

    // Convert audio buffer to base64 data URI
    const audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

    return {
      audioBuffer,
      audioUrl,
      inputTokens,
      outputTokens,
      costUsd,
      model: options.model,
      durationSeconds,
    };
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`ElevenLabs synthesis failed: ${error.message}`);
    }
    throw new Error('ElevenLabs synthesis failed with unknown error');
  }
}
