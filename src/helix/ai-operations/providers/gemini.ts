/**
 * Google Gemini Provider Client - Video analysis
 *
 * Wraps the Google Generative AI SDK and provides a unified interface for video
 * understanding operations. Handles video encoding, content analysis, and cost calculation.
 */

import { getGeminiClient, calculateProviderCost } from './registry.js';

/**
 * Options for video analysis with Google Gemini
 */
export interface GeminiVideoAnalysisOptions {
  model: string;
  videoBuffer: Buffer;
  mimeType?: string;
  prompt?: string;
}

/**
 * Result from Gemini video analysis
 */
export interface GeminiVideoAnalysisResult {
  description: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
}

/**
 * Analyze video with Google Gemini
 *
 * Handles:
 * - Client initialization via registry
 * - Video encoding to base64
 * - Content generation with inline video data
 * - Token estimation from buffer and response
 * - Cost calculation using provider pricing
 * - Error handling
 *
 * @param options - Video analysis options
 * @returns Result with description, tokens, and cost
 */
export async function analyzeVideoWithGemini(
  options: GeminiVideoAnalysisOptions
): Promise<GeminiVideoAnalysisResult> {
  // Get the Gemini client from registry (lazy-loaded, reuses instance)
  const client = getGeminiClient();

  // Set defaults
  const mimeType = options.mimeType || 'video/mp4';
  const prompt =
    options.prompt ||
    'Analyze this video and provide a detailed description of the content, objects, actions, and any text visible.';

  try {
    // Get the generative model
    const model = client.getGenerativeModel({ model: options.model });

    // Convert video buffer to base64
    const videoBase64 = options.videoBuffer.toString('base64');

    // Prepare video content for API
    const videoPart = {
      inlineData: {
        data: videoBase64,
        mimeType,
      },
    };

    // Execute API call with Gemini SDK
    const response = await model.generateContent([prompt, videoPart]);

    // Extract text content from response
    let description = '';
    const responseText = response.response.text();
    if (responseText) {
      description = responseText;
    }

    // Estimate tokens
    // Input tokens: estimate from video buffer (1 token ≈ 4 bytes for video data)
    const inputTokens = Math.ceil(options.videoBuffer.length / 4);
    // Output tokens: estimate from response (1 token ≈ 4 characters)
    const outputTokens = Math.ceil(description.length / 4);

    // Calculate cost using provider pricing
    const costUsd = calculateProviderCost(options.model, inputTokens, outputTokens);

    return {
      description,
      inputTokens,
      outputTokens,
      costUsd,
      model: options.model,
    };
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw new Error(`Gemini video analysis failed: ${error.message}`);
    }
    throw new Error('Gemini video analysis failed with unknown error');
  }
}
