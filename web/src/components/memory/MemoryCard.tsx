import React from 'react';
import type { Conversation } from '@/lib/types/memory';

interface MemoryCardProps {
  memory: Conversation;
  onMarkImportant?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * MemoryCard displays a single conversation memory with emotional analysis
 * Shows topics, emotional dimensions, salience tier, and conversation preview
 */
export const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  onMarkImportant,
  onDelete,
}) => {
  // Format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = Date.now();
    const then = new Date(date).getTime();
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'now';
  };

  // Get salience tier color
  const getSalienceTierColor = (tier: string): string => {
    switch (tier.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 border-red-300 text-red-900';
      case 'high':
        return 'bg-orange-100 border-orange-300 text-orange-900';
      case 'medium':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'low':
        return 'bg-gray-100 border-gray-300 text-gray-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  // Get emotion color
  const getEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      joy: 'bg-yellow-100 text-yellow-900',
      sadness: 'bg-blue-100 text-blue-900',
      anger: 'bg-red-100 text-red-900',
      fear: 'bg-purple-100 text-purple-900',
      trust: 'bg-green-100 text-green-900',
      disgust: 'bg-orange-100 text-orange-900',
      surprise: 'bg-pink-100 text-pink-900',
      anticipation: 'bg-indigo-100 text-indigo-900',
    };
    return colors[emotion.toLowerCase()] || 'bg-gray-100 text-gray-900';
  };

  // Emotional dimension bar component
  const DimensionBar: React.FC<{
    label: string;
    value: number;
    color: string;
  }> = ({ label, value, color }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600 w-20">{label}</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.max(0, Math.min(100, (value + 1) * 50))}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">{value.toFixed(2)}</span>
    </div>
  );

  const conversationPreview = memory.messages?.[0]?.content?.substring(0, 200) || '';
  const timeAgo = formatTimeAgo(memory.created_at);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
      {/* Header with time and actions */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{timeAgo}</span>
            {memory.user_marked_important && (
              <span className="text-yellow-500">★</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onMarkImportant?.(memory.id)}
            className="text-sm px-2 py-1 text-gray-600 hover:text-gray-900 transition-colors"
            title="Mark as important"
          >
            {memory.user_marked_important ? '★' : '☆'}
          </button>
          <button
            onClick={() => onDelete?.(memory.id)}
            className="text-sm px-2 py-1 text-gray-600 hover:text-red-600 transition-colors"
            title="Delete memory"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Primary emotion and salience tier */}
      <div className="flex gap-2 items-center">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getEmotionColor(
            memory.primary_emotion
          )}`}
        >
          {memory.primary_emotion}
        </span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium border ${getSalienceTierColor(
            memory.salience_tier
          )}`}
        >
          {memory.salience_tier}
        </span>
      </div>

      {/* Conversation preview */}
      <div className="text-sm text-gray-700 line-clamp-2">{conversationPreview}</div>

      {/* Topics */}
      {memory.extracted_topics && memory.extracted_topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {memory.extracted_topics.map((topic, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Emotional dimensions */}
      <div className="space-y-1 border-t pt-2">
        <DimensionBar
          label="Valence"
          value={memory.valence}
          color="bg-gradient-to-r from-red-500 to-green-500"
        />
        <DimensionBar
          label="Arousal"
          value={memory.arousal}
          color="bg-orange-500"
        />
        <DimensionBar
          label="Dominance"
          value={memory.dominance}
          color="bg-purple-500"
        />
        <DimensionBar
          label="Novelty"
          value={memory.novelty}
          color="bg-pink-500"
        />
        <DimensionBar
          label="Self-rel"
          value={memory.self_relevance}
          color="bg-indigo-500"
        />
      </div>

      {/* Salience score bar */}
      <div className="border-t pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Emotional Salience</span>
          <span className="text-xs text-gray-500">
            {(memory.emotional_salience * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 via-red-500 to-red-600 transition-all"
            style={{ width: `${Math.min(100, memory.emotional_salience * 100)}%` }}
          />
        </div>
      </div>

      {/* Secondary emotions */}
      {memory.secondary_emotions && memory.secondary_emotions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t">
          {memory.secondary_emotions.map((emotion, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 text-xs rounded ${getEmotionColor(emotion)}`}
            >
              {emotion}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
