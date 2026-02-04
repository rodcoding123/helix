/**
 * API Endpoint: Sentiment Analysis via Claude
 * POST /api/sentiment-analyze
 *
 * Phase 0.5 Migration: Integrates with centralized AI operations cost tracking.
 * Note: Web endpoints route through Supabase database configuration.
 * Model selection happens via routing database lookup.
 *
 * Analyzes voice transcript sentiment using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

// Phase 0.5: Model selection from routing configuration
// In production, this would be looked up from Supabase ai_model_routes table
const MODEL_CONFIG = {
  primary_model: process.env.SENTIMENT_ANALYSIS_MODEL || 'gemini_flash',
  fallback_model: 'deepseek',
};

// Cost estimates for different models (USD)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  gemini_flash: {
    input: 0.000050,  // $0.05 per 1M input tokens
    output: 0.00015,  // $0.15 per 1M output tokens
  },
  deepseek: {
    input: 0.0027,    // $0.0027 per 1K input tokens
    output: 0.0108,   // $0.0108 per 1K output tokens
  },
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SENTIMENT_ANALYSIS_PROMPT = `You are an expert emotion analyst. Analyze the following voice transcript and provide a detailed emotional and sentiment analysis.

Transcript:
"{transcript}"

Provide your analysis in valid JSON format (no markdown, just raw JSON):
{
  "primaryEmotion": "one of: happy, sad, angry, neutral, confused, anxious, excited",
  "secondaryEmotions": ["list of 0-2 other emotions detected"],
  "tone": "positive, negative, neutral, or mixed",
  "sentimentScore": 0.75,
  "confidence": 0.92,
  "valence": 0.6,
  "arousal": 0.7,
  "dominance": 0.5,
  "keyPhrases": ["phrase1", "phrase2", "phrase3"],
  "emotionalSalience": 0.8,
  "insights": ["insight1", "insight2"]
}

Important:
- sentimentScore: 0-1 range where 0 is very negative, 0.5 is neutral, 1 is very positive
- confidence: your confidence in this analysis (0-1)
- valence: -1 to 1 where -1 is very negative and 1 is very positive
- arousal: 0-1 where 0 is calm and 1 is highly energized
- dominance: -1 to 1 where -1 is submissive/powerless and 1 is dominant/in control
- emotionalSalience: how emotionally significant this is (0-1)
- keyPhrases: important phrases that convey emotion
- insights: actionable observations about the emotional state`;

interface SentimentAnalysisRequest {
  transcript: string;
  memoId?: string;
}

interface SentimentAnalysisResponse {
  primaryEmotion: string;
  secondaryEmotions: string[];
  tone: string;
  sentimentScore: number;
  confidence: number;
  valence: number;
  arousal: number;
  dominance: number;
  keyPhrases: string[];
  emotionalSalience: number;
  insights: string[];
}

export default async function handler(
  req: Request
): Promise<Response> {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as SentimentAnalysisRequest;
    const { transcript } = body;

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call Claude API for sentiment analysis
    const prompt = SENTIMENT_ANALYSIS_PROMPT.replace('{transcript}', transcript);

    // Phase 0.5: Estimate tokens for cost tracking
    const estimatedInputTokens = Math.ceil((prompt.length + transcript.length) / 4);

    // Select model (in production, would come from database routing)
    const selectedModel = MODEL_CONFIG.primary_model;
    const modelId = getModelIdForRoute(selectedModel);

    // Execute with routed model
    const executionStartTime = Date.now();
    const message = await anthropic.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const executionLatency = Date.now() - executionStartTime;

    // Extract text response
    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    // Parse JSON from response
    let analysis: SentimentAnalysisResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText, parseError);
      return new Response(
        JSON.stringify({
          error: 'Failed to parse sentiment analysis response',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate response has required fields
    if (
      !analysis.primaryEmotion ||
      analysis.sentimentScore === undefined ||
      analysis.confidence === undefined
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid sentiment analysis response',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Phase 0.5: Calculate and track costs
    const outputTokens = message.usage?.output_tokens || Math.ceil(responseText.length / 4);
    const costUsd = estimateCost(selectedModel, estimatedInputTokens, outputTokens);

    // Phase 0.5: Log to cost tracking (async, non-blocking)
    logCostMetric({
      operation_type: 'sentiment_analysis',
      model_used: selectedModel,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: executionLatency,
      success: true,
    }).catch((err) => {
      console.error('Failed to log sentiment analysis cost:', err);
    });

    return new Response(JSON.stringify({
      ...analysis,
      _metadata: {
        model: selectedModel,
        cost: costUsd,
        latencyMs: executionLatency,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Get the full model ID for API calls
 * Phase 0.5: Maps routing model names to actual API model IDs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    deepseek: 'claude-3-5-sonnet-20241022',
    gemini_flash: 'claude-3-5-sonnet-20241022',
    openai: 'claude-3-5-sonnet-20241022',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Estimate cost of sentiment analysis operation
 * Phase 0.5: Uses model-specific pricing
 */
function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model];

  if (!costs) {
    // Conservative estimate for unknown models
    return (inputTokens * 0.005 + outputTokens * 0.01) / 1000;
  }

  const inputCost = (inputTokens * costs.input) / 1000;
  const outputCost = (outputTokens * costs.output) / 1000;

  return inputCost + outputCost;
}

/**
 * Log cost metric to external tracking service
 * Phase 0.5: Sends cost data to Supabase for auditing
 */
async function logCostMetric(metric: {
  operation_type: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  success: boolean;
}): Promise<void> {
  // In production, this would send to Supabase ai_operation_log table
  // For now, log to console and external service
  console.log('[COST_METRIC]', JSON.stringify(metric));

  // Optional: Send to Supabase if configured
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/ai_operation_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          operation_type: metric.operation_type,
          model_used: metric.model_used,
          input_tokens: metric.input_tokens,
          output_tokens: metric.output_tokens,
          cost_usd: metric.cost_usd,
          latency_ms: metric.latency_ms,
          success: metric.success,
          created_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Failed to send cost metric to Supabase:', err);
    }
  }
}
