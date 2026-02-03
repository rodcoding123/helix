/**
 * Sentiment Analyzer Component
 * Phase 4.2: Displays emotion detection and sentiment analysis results
 *
 * Features:
 * - Primary and secondary emotion display
 * - Sentiment score visualization
 * - Tone badge
 * - Dimensional emotion visualization (VAD model)
 * - Key phrases and insights
 */

import React, { FC } from 'react';
import {
  SentimentAnalysisResult,
  Emotion,
  Tone,
} from '@/services/sentiment-analysis';
import { AlertCircle, TrendingUp, Sparkles } from 'lucide-react';

interface SentimentAnalyzerProps {
  analysis: SentimentAnalysisResult;
  isLoading?: boolean;
}

/**
 * Emotion icon mapping
 */
function getEmotionEmoji(emotion: Emotion): string {
  const emojiMap: Record<Emotion, string> = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    neutral: '😐',
    confused: '🤔',
    anxious: '😰',
    excited: '🤩',
  };
  return emojiMap[emotion];
}

/**
 * Get sentiment score color
 */
function getSentimentColor(score: number): string {
  if (score >= 0.7) return 'text-green-400';
  if (score >= 0.5) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Get tone badge color
 */
function getToneBadgeColor(tone: Tone): string {
  switch (tone) {
    case 'positive':
      return 'bg-green-500/20 text-green-400 border-green-500/50';
    case 'negative':
      return 'bg-red-500/20 text-red-400 border-red-500/50';
    case 'neutral':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
    case 'mixed':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}

/**
 * VAD Model Visualization
 * Displays Valence-Arousal-Dominance in a 3D-like visualization
 */
const VADVisualization: FC<{
  valence: number;
  arousal: number;
  dominance: number;
}> = ({ valence, arousal, dominance }) => {
  // Map -1..1 to 0..100 for display
  const valencePercent = ((valence + 1) / 2) * 100;
  const arousalPercent = arousal * 100;
  const dominancePercent = ((dominance + 1) / 2) * 100;

  return (
    <div className="space-y-3">
      {/* Valence: Negative to Positive */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-red-400">Negative</span>
          <span className="text-slate-400">Valence</span>
          <span className="text-green-400">Positive</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
            style={{ width: `${valencePercent}%` }}
          />
        </div>
      </div>

      {/* Arousal: Low to High */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Calm</span>
          <span className="text-slate-400">Arousal</span>
          <span className="text-orange-400">Intense</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${arousalPercent}%` }}
          />
        </div>
      </div>

      {/* Dominance: Submissive to Dominant */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-blue-400">Submissive</span>
          <span className="text-slate-400">Dominance</span>
          <span className="text-purple-400">Dominant</span>
        </div>
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
            style={{ width: `${dominancePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Sentiment Analyzer Component
 */
export const SentimentAnalyzer: FC<SentimentAnalyzerProps> = ({
  analysis,
  isLoading = false,
}) => {
  const primaryEmoji = getEmotionEmoji(analysis.primaryEmotion);

  return (
    <div className="sentiment-analyzer space-y-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Sentiment Analysis
        </h3>
        <span className="text-xs text-slate-400">
          {new Date(analysis.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin text-2xl mb-2">⟳</div>
          <p className="text-slate-400 text-sm">Analyzing sentiment...</p>
        </div>
      ) : (
        <>
          {/* Primary Emotion */}
          <div className="flex items-center gap-4">
            <div className="text-5xl">{primaryEmoji}</div>
            <div>
              <p className="text-slate-400 text-sm">Primary Emotion</p>
              <p className="text-2xl font-bold text-slate-100 capitalize">
                {analysis.primaryEmotion}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Confidence: {(analysis.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Sentiment Score */}
          <div className="bg-slate-700/30 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-400">Overall Sentiment</span>
              <span className={`text-2xl font-bold ${getSentimentColor(analysis.sentimentScore)}`}>
                {(analysis.sentimentScore * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
                style={{ width: `${analysis.sentimentScore * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Negative</span>
              <span>Neutral</span>
              <span>Positive</span>
            </div>
          </div>

          {/* Tone Badge */}
          <div className="flex gap-2">
            <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getToneBadgeColor(analysis.tone)} capitalize`}>
              {analysis.tone} Tone
            </span>
            {analysis.emotionalSalience > 0.7 && (
              <span className="px-3 py-1 text-xs font-medium rounded-full border bg-orange-500/20 text-orange-400 border-orange-500/50">
                High Emotional Intensity
              </span>
            )}
          </div>

          {/* Secondary Emotions */}
          {analysis.secondaryEmotions.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Secondary Emotions</p>
              <div className="flex flex-wrap gap-2">
                {analysis.secondaryEmotions.map((emotion) => (
                  <span
                    key={emotion}
                    className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded capitalize"
                  >
                    {getEmotionEmoji(emotion)} {emotion}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* VAD Model Visualization */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-400 mb-3 font-medium">Emotional Dimensions</p>
            <VADVisualization
              valence={analysis.valence}
              arousal={analysis.arousal}
              dominance={analysis.dominance}
            />
          </div>

          {/* Key Phrases */}
          {analysis.keyPhrases.length > 0 && (
            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 mb-2 font-medium">Key Phrases</p>
              <div className="flex flex-wrap gap-2">
                {analysis.keyPhrases.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-slate-700/50 text-slate-300 rounded italic"
                  >
                    "{phrase}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {analysis.insights.length > 0 && (
            <div className="border-t border-slate-700 pt-4 space-y-2">
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Insights
              </p>
              {analysis.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 p-2 bg-blue-500/10 rounded border border-blue-500/30"
                >
                  <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-300">{insight}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SentimentAnalyzer;
