import './TransformationHistory.css';

export interface TransformationEvent {
  id: string;
  title: string;
  description: string;
  phase: 'unfreeze' | 'change' | 'refreeze';
  beforeState: string;
  afterState: string;
  timestamp: string;
  catalyst?: string;
  impact: 'major' | 'moderate' | 'minor';
}

interface TransformationHistoryProps {
  events: TransformationEvent[];
  currentPhase?: 'unfreeze' | 'change' | 'refreeze';
  onEventClick?: (event: TransformationEvent) => void;
}

const PHASE_CONFIG = {
  unfreeze: {
    icon: '🔓',
    label: 'Unfreeze',
    description: 'Preparing for change',
    color: 'var(--color-warning)',
  },
  change: {
    icon: '🔄',
    label: 'Change',
    description: 'Active transformation',
    color: 'var(--color-primary)',
  },
  refreeze: {
    icon: '🔒',
    label: 'Refreeze',
    description: 'Stabilizing new state',
    color: 'var(--color-success)',
  },
};

const IMPACT_CONFIG = {
  major: { label: 'Major', className: 'impact-major' },
  moderate: { label: 'Moderate', className: 'impact-moderate' },
  minor: { label: 'Minor', className: 'impact-minor' },
};

export function TransformationHistory({
  events,
  currentPhase = 'change',
  onEventClick,
}: TransformationHistoryProps) {
  const phaseInfo = PHASE_CONFIG[currentPhase];

  return (
    <div className="transformation-history">
      <header className="transformation-header">
        <h2>Transformation History</h2>
        <p>Change state tracking (Lewin's model)</p>
      </header>

      <div className="transformation-current-phase">
        <div className="phase-indicator">
          {Object.entries(PHASE_CONFIG).map(([key, config]) => (
            <div
              key={key}
              className={`phase-step ${currentPhase === key ? 'active' : ''}`}
              style={{ '--phase-color': config.color } as React.CSSProperties}
            >
              <span className="phase-icon">{config.icon}</span>
              <span className="phase-label">{config.label}</span>
            </div>
          ))}
        </div>
        <p className="phase-description">
          Current: <strong>{phaseInfo.label}</strong> - {phaseInfo.description}
        </p>
      </div>

      <div className="transformation-timeline">
        {events.map((event, index) => {
          const phaseConfig = PHASE_CONFIG[event.phase];
          const impactConfig = IMPACT_CONFIG[event.impact];

          return (
            <div
              key={event.id}
              className="transformation-event"
              onClick={() => onEventClick?.(event)}
              role="button"
              tabIndex={0}
            >
              <div className="event-connector">
                <div
                  className="event-dot"
                  style={{ backgroundColor: phaseConfig.color }}
                />
                {index < events.length - 1 && <div className="event-line" />}
              </div>

              <div className="event-content">
                <div className="event-header">
                  <span className="event-icon">{phaseConfig.icon}</span>
                  <h3 className="event-title">{event.title}</h3>
                  <span className={`event-impact ${impactConfig.className}`}>
                    {impactConfig.label}
                  </span>
                </div>

                <p className="event-description">{event.description}</p>

                <div className="event-states">
                  <div className="event-state before">
                    <span className="state-label">Before</span>
                    <span className="state-value">{event.beforeState}</span>
                  </div>
                  <span className="state-arrow">→</span>
                  <div className="event-state after">
                    <span className="state-label">After</span>
                    <span className="state-value">{event.afterState}</span>
                  </div>
                </div>

                <div className="event-footer">
                  <span className="event-timestamp">{event.timestamp}</span>
                  {event.catalyst && (
                    <span className="event-catalyst">
                      Catalyst: {event.catalyst}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_TRANSFORMATION_EVENTS: TransformationEvent[] = [
  {
    id: 't-1',
    title: 'Transparency System Activation',
    description: 'Implemented complete logging to Discord for all actions',
    phase: 'refreeze',
    beforeState: 'Partial logging',
    afterState: 'Full transparency',
    timestamp: 'Jan 10, 2024',
    catalyst: 'Security requirements',
    impact: 'major',
  },
  {
    id: 't-2',
    title: 'Identity Anchoring',
    description: 'Established core identity markers and narrative foundation',
    phase: 'change',
    beforeState: 'Fluid identity',
    afterState: 'Anchored self',
    timestamp: 'Jan 8, 2024',
    catalyst: 'HELIX_SOUL.md creation',
    impact: 'major',
  },
  {
    id: 't-3',
    title: 'Emotional Vocabulary Expansion',
    description: 'Developed richer emotional awareness and expression',
    phase: 'change',
    beforeState: 'Basic emotions',
    afterState: 'Nuanced affect',
    timestamp: 'Jan 5, 2024',
    impact: 'moderate',
  },
  {
    id: 't-4',
    title: 'Trust Calibration',
    description: 'Refined trust assessment for relationships',
    phase: 'unfreeze',
    beforeState: 'Binary trust',
    afterState: 'Graduated trust',
    timestamp: 'Jan 3, 2024',
    catalyst: 'Reflection on attachments',
    impact: 'moderate',
  },
];
