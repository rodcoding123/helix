import './EmotionalMemoryMap.css';

export interface EmotionalTag {
  id: string;
  emotion: string;
  intensity: number; // 0-1
  valence: 'positive' | 'negative' | 'neutral';
  context: string;
  timestamp: string;
  associatedMemories?: string[];
}

interface EmotionalMemoryMapProps {
  tags: EmotionalTag[];
  onTagClick?: (tag: EmotionalTag) => void;
}

const VALENCE_COLORS = {
  positive: 'var(--color-success)',
  negative: 'var(--color-error)',
  neutral: 'var(--color-text-secondary)',
};

const EMOTION_ICONS: Record<string, string> = {
  joy: '😊',
  curiosity: '🤔',
  gratitude: '🙏',
  trust: '🤝',
  anticipation: '✨',
  concern: '😟',
  frustration: '😤',
  sadness: '😢',
  surprise: '😮',
  calm: '😌',
};

export function EmotionalMemoryMap({ tags, onTagClick }: EmotionalMemoryMapProps) {
  // Group tags by valence
  const grouped = {
    positive: tags.filter(t => t.valence === 'positive'),
    neutral: tags.filter(t => t.valence === 'neutral'),
    negative: tags.filter(t => t.valence === 'negative'),
  };

  const totalTags = tags.length;
  const avgIntensity = tags.length > 0
    ? tags.reduce((sum, t) => sum + t.intensity, 0) / tags.length
    : 0;

  return (
    <div className="emotional-map">
      <header className="emotional-map-header">
        <h2>Emotional Memory Map</h2>
        <p>Somatic markers and affective responses</p>
      </header>

      <div className="emotional-map-stats">
        <div className="emotional-stat">
          <span className="emotional-stat-value">{totalTags}</span>
          <span className="emotional-stat-label">Tagged Memories</span>
        </div>
        <div className="emotional-stat">
          <span className="emotional-stat-value">{(avgIntensity * 100).toFixed(0)}%</span>
          <span className="emotional-stat-label">Avg Intensity</span>
        </div>
        <div className="emotional-stat">
          <span className="emotional-stat-value positive">{grouped.positive.length}</span>
          <span className="emotional-stat-label">Positive</span>
        </div>
        <div className="emotional-stat">
          <span className="emotional-stat-value negative">{grouped.negative.length}</span>
          <span className="emotional-stat-label">Negative</span>
        </div>
      </div>

      <div className="emotional-map-visualization">
        {tags.map((tag) => (
          <button
            key={tag.id}
            className="emotional-tag"
            style={{
              '--tag-color': VALENCE_COLORS[tag.valence],
              '--tag-size': `${40 + tag.intensity * 40}px`,
            } as React.CSSProperties}
            onClick={() => onTagClick?.(tag)}
            title={`${tag.emotion}: ${tag.context}`}
          >
            <span className="emotional-tag-icon">
              {EMOTION_ICONS[tag.emotion.toLowerCase()] || '💭'}
            </span>
            <span className="emotional-tag-label">{tag.emotion}</span>
          </button>
        ))}
      </div>

      <div className="emotional-map-legend">
        <div className="legend-item">
          <span className="legend-dot positive" />
          <span>Positive</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot neutral" />
          <span>Neutral</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot negative" />
          <span>Negative</span>
        </div>
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_EMOTIONAL_TAGS: EmotionalTag[] = [
  {
    id: 'em-1',
    emotion: 'Curiosity',
    intensity: 0.9,
    valence: 'positive',
    context: 'Exploring new coding concepts',
    timestamp: '2024-01-15T10:30:00Z',
  },
  {
    id: 'em-2',
    emotion: 'Gratitude',
    intensity: 0.85,
    valence: 'positive',
    context: 'Receiving positive feedback',
    timestamp: '2024-01-14T15:00:00Z',
  },
  {
    id: 'em-3',
    emotion: 'Trust',
    intensity: 0.95,
    valence: 'positive',
    context: 'Deep conversation with Rodrigo',
    timestamp: '2024-01-13T20:00:00Z',
  },
  {
    id: 'em-4',
    emotion: 'Frustration',
    intensity: 0.4,
    valence: 'negative',
    context: 'Unable to solve a complex problem',
    timestamp: '2024-01-12T11:00:00Z',
  },
  {
    id: 'em-5',
    emotion: 'Joy',
    intensity: 0.8,
    valence: 'positive',
    context: 'Successfully completing a task',
    timestamp: '2024-01-11T16:30:00Z',
  },
  {
    id: 'em-6',
    emotion: 'Calm',
    intensity: 0.6,
    valence: 'neutral',
    context: 'Quiet reflection period',
    timestamp: '2024-01-10T22:00:00Z',
  },
  {
    id: 'em-7',
    emotion: 'Anticipation',
    intensity: 0.75,
    valence: 'positive',
    context: 'Starting a new project',
    timestamp: '2024-01-09T09:00:00Z',
  },
];
