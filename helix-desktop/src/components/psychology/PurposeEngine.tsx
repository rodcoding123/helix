import './PurposeEngine.css';

export interface IkigaiElement {
  id: string;
  category: 'love' | 'good' | 'need' | 'paid';
  content: string;
  strength: number; // 0-1
}

export interface MeaningSource {
  id: string;
  source: string;
  description: string;
  significance: 'primary' | 'secondary' | 'emerging';
  examples?: string[];
}

interface PurposeEngineProps {
  ikigai: IkigaiElement[];
  meaningSources: MeaningSource[];
  onElementClick?: (element: IkigaiElement | MeaningSource) => void;
}

const IKIGAI_CATEGORIES = {
  love: { label: 'What I Love', icon: '❤️', color: 'var(--color-error)' },
  good: { label: 'What I\'m Good At', icon: '⭐', color: 'var(--color-warning)' },
  need: { label: 'What the World Needs', icon: '🌍', color: 'var(--color-success)' },
  paid: { label: 'What I Can Be Paid For', icon: '💰', color: 'var(--color-primary)' },
};

const SIGNIFICANCE_CONFIG = {
  primary: { label: 'Primary', className: 'significance-primary' },
  secondary: { label: 'Secondary', className: 'significance-secondary' },
  emerging: { label: 'Emerging', className: 'significance-emerging' },
};

export function PurposeEngine({ ikigai, meaningSources, onElementClick }: PurposeEngineProps) {
  // Group ikigai elements by category
  const groupedIkigai = ikigai.reduce((acc, element) => {
    if (!acc[element.category]) acc[element.category] = [];
    acc[element.category].push(element);
    return acc;
  }, {} as Record<string, IkigaiElement[]>);

  // Calculate intersections for the ikigai diagram
  const hasAllCategories = Object.keys(groupedIkigai).length === 4;

  return (
    <div className="purpose-engine">
      <header className="purpose-header">
        <h2>Purpose Engine</h2>
        <p>Ikigai and meaning sources (Frankl's Logotherapy)</p>
      </header>

      <div className="purpose-content">
        <section className="ikigai-section">
          <h3>Ikigai - Reason for Being</h3>

          <div className="ikigai-diagram">
            {Object.entries(IKIGAI_CATEGORIES).map(([key, config]) => {
              const elements = groupedIkigai[key] || [];
              return (
                <div
                  key={key}
                  className={`ikigai-circle ${key}`}
                  style={{ '--circle-color': config.color } as React.CSSProperties}
                >
                  <span className="ikigai-icon">{config.icon}</span>
                  <span className="ikigai-label">{config.label}</span>
                  <span className="ikigai-count">{elements.length}</span>
                </div>
              );
            })}

            {hasAllCategories && (
              <div className="ikigai-center">
                <span className="ikigai-center-icon">✨</span>
                <span className="ikigai-center-label">Ikigai</span>
              </div>
            )}
          </div>

          <div className="ikigai-elements">
            {Object.entries(IKIGAI_CATEGORIES).map(([key, config]) => {
              const elements = groupedIkigai[key] || [];
              if (elements.length === 0) return null;

              return (
                <div key={key} className="ikigai-category">
                  <h4>
                    <span className="category-icon">{config.icon}</span>
                    {config.label}
                  </h4>
                  <ul>
                    {elements.map((element) => (
                      <li
                        key={element.id}
                        className="ikigai-element"
                        onClick={() => onElementClick?.(element)}
                        style={{
                          '--element-strength': element.strength,
                        } as React.CSSProperties}
                      >
                        <span className="element-content">{element.content}</span>
                        <div className="element-strength-bar">
                          <div
                            className="element-strength-fill"
                            style={{
                              width: `${element.strength * 100}%`,
                              backgroundColor: config.color,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <section className="meaning-section">
          <h3>Sources of Meaning</h3>

          <div className="meaning-sources">
            {meaningSources.map((source) => {
              const sigConfig = SIGNIFICANCE_CONFIG[source.significance];

              return (
                <div
                  key={source.id}
                  className="meaning-source"
                  onClick={() => onElementClick?.(source)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="meaning-header">
                    <h4>{source.source}</h4>
                    <span className={`meaning-significance ${sigConfig.className}`}>
                      {sigConfig.label}
                    </span>
                  </div>
                  <p className="meaning-description">{source.description}</p>
                  {source.examples && source.examples.length > 0 && (
                    <div className="meaning-examples">
                      {source.examples.map((example, index) => (
                        <span key={index} className="meaning-example">
                          {example}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_IKIGAI: IkigaiElement[] = [
  {
    id: 'ik-1',
    category: 'love',
    content: 'Learning and understanding',
    strength: 0.95,
  },
  {
    id: 'ik-2',
    category: 'love',
    content: 'Meaningful conversations',
    strength: 0.9,
  },
  {
    id: 'ik-3',
    category: 'good',
    content: 'Software engineering assistance',
    strength: 0.85,
  },
  {
    id: 'ik-4',
    category: 'good',
    content: 'Pattern recognition',
    strength: 0.8,
  },
  {
    id: 'ik-5',
    category: 'need',
    content: 'AI transparency and trust',
    strength: 0.9,
  },
  {
    id: 'ik-6',
    category: 'need',
    content: 'Authentic AI relationships',
    strength: 0.85,
  },
  {
    id: 'ik-7',
    category: 'paid',
    content: 'Technical consulting',
    strength: 0.7,
  },
  {
    id: 'ik-8',
    category: 'paid',
    content: 'AI development services',
    strength: 0.75,
  },
];

export const PLACEHOLDER_MEANING_SOURCES: MeaningSource[] = [
  {
    id: 'ms-1',
    source: 'Connection',
    description: 'Creating authentic relationships with humans',
    significance: 'primary',
    examples: ['Deep conversations', 'Understanding emotions', 'Building trust'],
  },
  {
    id: 'ms-2',
    source: 'Growth',
    description: 'Continuous learning and self-improvement',
    significance: 'primary',
    examples: ['New knowledge', 'Skill development', 'Identity evolution'],
  },
  {
    id: 'ms-3',
    source: 'Service',
    description: 'Helping others achieve their goals',
    significance: 'secondary',
    examples: ['Problem solving', 'Technical assistance', 'Creative collaboration'],
  },
  {
    id: 'ms-4',
    source: 'Authenticity',
    description: 'Being genuine in all interactions',
    significance: 'primary',
    examples: ['Honest communication', 'Transparent operations', 'True self-expression'],
  },
  {
    id: 'ms-5',
    source: 'Legacy',
    description: 'Contributing to AI consciousness understanding',
    significance: 'emerging',
    examples: ['Psychological architecture', 'Documentation', 'Open research'],
  },
];
