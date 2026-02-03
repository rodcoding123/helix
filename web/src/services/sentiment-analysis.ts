/**
 * Sentiment Analysis Service
 * Phase 4.2: Emotion detection, tone classification, and sentiment scoring using Claude API
 *
 * Features:
 * - Real-time emotion detection (happy, sad, angry, neutral, confused)
 * - Tone classification
 * - Sentiment scoring (0-1 range)
 * - Confidence scoring
 * - Trend analysis over time
 * - Batch processing support
 */

import { supabase } from '@/lib/supabase';

export type Emotion = 'happy' | 'sad' | 'angry' | 'neutral' | 'confused' | 'anxious' | 'excited';
export type Tone = 'positive' | 'negative' | 'neutral' | 'mixed';
export type ValenceArousal = 'high_positive' | 'low_positive' | 'neutral' | 'low_negative' | 'high_negative';

export interface SentimentAnalysisResult {
  primaryEmotion: Emotion;
  secondaryEmotions: Emotion[];
  tone: Tone;
  sentimentScore: number; // 0-1, 0.5 = neutral
  confidence: number; // 0-1
  valence: number; // -1 to 1, positivity
  arousal: number; // 0-1, intensity
  dominance: number; // -1 to 1, control/agency
  keyPhrases: string[];
  emotionalSalience: number; // 0-1, how emotionally significant
  insights: string[];
  timestamp: number;
}

export interface SentimentTrendData {
  date: string;
  averageSentiment: number;
  dominantEmotion: Emotion;
  memoCount: number;
  emotionBreakdown: Record<Emotion, number>;
}

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
  "insights": ["insight1", "insight2"],
  "reasoning": "brief explanation of your analysis"
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

class SentimentAnalysisService {
  /**
   * Analyze sentiment of a single transcript
   */
  async analyzeTranscript(
    transcript: string,
    memoId?: string
  ): Promise<SentimentAnalysisResult> {
    try {
      // Call Claude API
      const response = await fetch('/api/sentiment-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          memoId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sentiment analysis failed: ${response.statusText}`);
      }

      const result = await response.json() as SentimentAnalysisResult;
      result.timestamp = Date.now();

      return result;
    } catch (error) {
      console.error('Sentiment analysis error:', error);
      throw error;
    }
  }

  /**
   * Analyze multiple transcripts in batch
   */
  async analyzeBatch(
    transcripts: Array<{ text: string; memoId?: string }>
  ): Promise<SentimentAnalysisResult[]> {
    const results = await Promise.all(
      transcripts.map((item) => this.analyzeTranscript(item.text, item.memoId))
    );
    return results;
  }

  /**
   * Store sentiment analysis in database
   */
  async saveSentimentAnalysis(
    userId: string,
    memoId: string,
    analysis: SentimentAnalysisResult
  ): Promise<void> {
    const { error } = await supabase.from('voice_sentiment_analysis').insert([
      {
        user_id: userId,
        memo_id: memoId,
        primary_emotion: analysis.primaryEmotion,
        secondary_emotions: analysis.secondaryEmotions,
        tone: analysis.tone,
        sentiment_score: analysis.sentimentScore,
        confidence: analysis.confidence,
        valence: analysis.valence,
        arousal: analysis.arousal,
        dominance: analysis.dominance,
        emotional_salience: analysis.emotionalSalience,
        key_phrases: analysis.keyPhrases,
        insights: analysis.insights,
        created_at: new Date(analysis.timestamp),
      },
    ]);

    if (error) {
      throw new Error(`Failed to save sentiment analysis: ${error.message}`);
    }
  }

  /**
   * Get sentiment analysis for a memo
   */
  async getMemoSentiment(memoId: string): Promise<SentimentAnalysisResult | null> {
    const { data, error } = await supabase
      .from('voice_sentiment_analysis')
      .select('*')
      .eq('memo_id', memoId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch sentiment analysis: ${error.message}`);
    }

    if (!data) return null;

    return {
      primaryEmotion: data.primary_emotion,
      secondaryEmotions: data.secondary_emotions || [],
      tone: data.tone,
      sentimentScore: data.sentiment_score,
      confidence: data.confidence,
      valence: data.valence,
      arousal: data.arousal,
      dominance: data.dominance,
      keyPhrases: data.key_phrases || [],
      emotionalSalience: data.emotional_salience,
      insights: data.insights || [],
      timestamp: new Date(data.created_at).getTime(),
    };
  }

  /**
   * Get sentiment trend over time
   */
  async getSentimentTrend(
    userId: string,
    days: number = 30
  ): Promise<SentimentTrendData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('voice_sentiment_analysis')
      .select('primary_emotion, sentiment_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch sentiment trend: ${error.message}`);
    }

    // Group by date and calculate trends
    const trends = new Map<string, Array<{ emotion: Emotion; score: number }>>();

    data?.forEach((item) => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      if (!trends.has(date)) {
        trends.set(date, []);
      }
      trends.get(date)!.push({
        emotion: item.primary_emotion,
        score: item.sentiment_score,
      });
    });

    // Convert to trend data
    return Array.from(trends.entries()).map(([date, entries]) => {
      const emotions: Record<Emotion, number> = {
        happy: 0,
        sad: 0,
        angry: 0,
        neutral: 0,
        confused: 0,
        anxious: 0,
        excited: 0,
      };

      entries.forEach((entry) => {
        emotions[entry.emotion]++;
      });

      const dominantEmotion = (
        Object.entries(emotions).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'
      ) as Emotion;

      return {
        date,
        averageSentiment:
          entries.reduce((sum, e) => sum + e.score, 0) / entries.length,
        dominantEmotion,
        memoCount: entries.length,
        emotionBreakdown: emotions,
      };
    });
  }

  /**
   * Get emotion distribution for user
   */
  async getEmotionDistribution(
    userId: string,
    days: number = 30
  ): Promise<Record<Emotion, number>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('voice_sentiment_analysis')
      .select('primary_emotion')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw new Error(`Failed to fetch emotion distribution: ${error.message}`);
    }

    const distribution: Record<Emotion, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      neutral: 0,
      confused: 0,
      anxious: 0,
      excited: 0,
    };

    data?.forEach((item) => {
      distribution[item.primary_emotion]++;
    });

    return distribution;
  }

  /**
   * Get insights based on sentiment patterns
   */
  async getInsights(userId: string, days: number = 30): Promise<string[]> {
    const distribution = await this.getEmotionDistribution(userId, days);
    const trend = await this.getSentimentTrend(userId, days);

    const insights: string[] = [];

    // Emotion dominance insight
    const emotionEntries = Object.entries(distribution).filter(([, count]) => count > 0);
    if (emotionEntries.length > 0) {
      const [dominant] = emotionEntries.sort(([, a], [, b]) => b - a)[0];
      insights.push(
        `Your most common emotion in voice memos is "${dominant}" (${distribution[dominant as Emotion]} memos)`
      );
    }

    // Trend insight
    if (trend.length > 1) {
      const recent = trend.slice(-7);
      const older = trend.slice(0, Math.max(1, trend.length - 7));

      const recentAvg =
        recent.reduce((sum, t) => sum + t.averageSentiment, 0) / recent.length;
      const olderAvg =
        older.reduce((sum, t) => sum + t.averageSentiment, 0) / older.length;

      if (recentAvg > olderAvg + 0.1) {
        insights.push('Your sentiment has improved over the last week 📈');
      } else if (recentAvg < olderAvg - 0.1) {
        insights.push('Your sentiment has declined over the last week 📉');
      }
    }

    // Volatility insight
    if (trend.length >= 7) {
      const sentiments = trend.map((t) => t.averageSentiment);
      const mean = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
      const variance =
        sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) /
        sentiments.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0.3) {
        insights.push(
          'Your emotional state varies significantly day-to-day. Consider tracking what affects your mood.'
        );
      }
    }

    return insights;
  }

  /**
   * Analyze voice memo with sentiment after transcription
   */
  async analyzeVoiceMemo(memoId: string, transcript: string): Promise<void> {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Analyze sentiment
      const analysis = await this.analyzeTranscript(transcript, memoId);

      // Save to database
      await this.saveSentimentAnalysis(user.id, memoId, analysis);

      // Update voice_memos table with primary emotion (optional)
      await supabase
        .from('voice_memos')
        .update({
          primary_emotion: analysis.primaryEmotion,
          sentiment_score: analysis.sentimentScore,
        })
        .eq('id', memoId);
    } catch (error) {
      console.error('Failed to analyze voice memo:', error);
      throw error;
    }
  }
}

export const sentimentAnalysisService = new SentimentAnalysisService();
