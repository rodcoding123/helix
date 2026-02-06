/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * Deepgram Provider Client - Audio Transcription
 *
 * Wraps the Deepgram SDK and provides a unified interface for audio transcription.
 * Handles cost calculation and token tracking.
 */

import { calculateProviderCost } from './registry.js';

/**
 * Deepgram SDK module interface for dynamic import
 */
interface DeepgramSdkModule {
  createClient: (apiKey: string) => unknown;
}

// Lazy-loaded Deepgram module
let deepgramModule: DeepgramSdkModule | null = null;

/**
 * Options for Deepgram transcription
 */
export interface DeepgramTranscriptionOptions {
  model: string;
  audioBuffer: Buffer;
  mimeType?: string;
}

/**
 * Result from Deepgram transcription
 */
export interface DeepgramTranscriptionResult {
  transcript: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  confidence: number;
}

/**
 * Get or initialize Deepgram client
 *
 * Lazy-loads the @deepgram/sdk package and initializes client with API key.
 * Throws error if DEEPGRAM_API_KEY is not set.
 *
 * @returns Deepgram client instance
 */
export async function getDeepgramClient(): Promise<unknown> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable not set');
  }

  // Lazy-load Deepgram SDK using dynamic import
  if (deepgramModule === null) {
    // @ts-ignore - @deepgram/sdk optional dependency
    deepgramModule = (await import('@deepgram/sdk')) as DeepgramSdkModule;
  }

  return deepgramModule.createClient(apiKey);
}

/**
 * Transcribe audio with Deepgram
 *
 * Takes an audio buffer and transcribes it using the Deepgram API.
 * Assumes audio is 16kHz 16-bit mono WAV format unless specified.
 *
 * Handles:
 * - Client initialization via lazy-loading
 * - Audio buffer transcription
 * - Transcript extraction from response
 * - Token estimation from audio duration and transcript length
 * - Cost calculation using provider pricing
 * - Confidence score extraction
 *
 * @param options - Transcription options
 * @returns Result with transcript, tokens, cost, and confidence
 */
export async function transcribeWithDeepgram(
  options: DeepgramTranscriptionOptions
): Promise<DeepgramTranscriptionResult> {
  // Get the Deepgram client
  const client = await getDeepgramClient();

  // Set defaults
  const mimeType = options.mimeType || 'audio/wav';

  try {
    // Transcribe audio buffer with Deepgram

    const response: unknown = await (
      client as {
        listen: {
          prerecorded: {
            transcribeBuffer: (buffer: Buffer, opts: Record<string, unknown>) => Promise<unknown>;
          };
        };
      }
    ).listen.prerecorded.transcribeBuffer(options.audioBuffer, {
      model: options.model,
      mimeType,
      punctuate: true,
      utterances: true,
    });

    // Extract transcript and confidence from response
    let transcript = '';
    let confidence = 0;

    const result = (response as Record<string, unknown>).result as Record<string, unknown>;

    const results = result.results as Record<string, unknown>;

    const channels = results.channels as Array<Record<string, unknown>>;

    const alternatives = channels[0]?.alternatives as Array<Record<string, unknown>>;

    if (alternatives?.[0]) {
      const alternative = alternatives[0];
      transcript = (alternative.transcript as string) || '';
      confidence = (alternative.confidence as number) || 0;
    }

    // Estimate audio duration in minutes (assumes 16kHz 16-bit mono: 2 bytes per sample)
    // audioBuffer.length / (16000 samples/sec * 2 bytes/sample * 60 sec/min)
    const audioDurationMinutes = options.audioBuffer.length / (16000 * 2 * 60);

    // Estimate input tokens from audio duration (approximately 100 tokens per minute)
    const inputTokens = Math.ceil(audioDurationMinutes * 100);

    // Estimate output tokens from transcript length (approximately 1 token per 4 characters)
    const outputTokens = Math.ceil(transcript.length / 4);

    // Calculate cost using provider pricing
    const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

    return {
      transcript,
      inputTokens,
      outputTokens,
      costUsd,
      model: options.model,
      confidence,
    };
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }
    throw new Error('Deepgram transcription failed with unknown error');
  }
}
