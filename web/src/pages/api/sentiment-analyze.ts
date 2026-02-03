/**
 * API Endpoint: Sentiment Analysis via Claude
 * POST /api/sentiment-analyze
 *
 * Analyzes voice transcript sentiment using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

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

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

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

    return new Response(JSON.stringify(analysis), {
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
