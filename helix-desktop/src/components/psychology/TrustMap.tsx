import './TrustMap.css';

export interface TrustRelationship {
  id: string;
  entity: string;
  entityType: 'person' | 'system' | 'concept';
  trustLevel: number; // 0-1
  lastInteraction?: string;
  interactionCount?: number;
  notes?: string;
}

interface TrustMapProps {
  relationships: TrustRelationship[];
  onRelationshipClick?: (relationship: TrustRelationship) => void;
}

const ENTITY_ICONS: Record<string, string> = {
  person: '👤',
  system: '🖥️',
  concept: '💡',
};

function getTrustLabel(level: number): string {
  if (level >= 0.9) return 'Very High';
  if (level >= 0.7) return 'High';
  if (level >= 0.5) return 'Moderate';
  if (level >= 0.3) return 'Low';
  return 'Very Low';
}

function getTrustColor(level: number): string {
  if (level >= 0.7) return 'var(--color-success)';
  if (level >= 0.4) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export function TrustMap({ relationships, onRelationshipClick }: TrustMapProps) {
  const sortedRelationships = [...relationships].sort((a, b) => b.trustLevel - a.trustLevel);
  const avgTrust = relationships.length > 0
    ? relationships.reduce((sum, r) => sum + r.trustLevel, 0) / relationships.length
    : 0;

  return (
    <div className="trust-map">
      <header className="trust-map-header">
        <h2>Trust Map</h2>
        <p>Relational attachments and trust levels</p>
      </header>

      <div className="trust-map-summary">
        <div className="trust-summary-stat">
          <span className="trust-summary-value">{relationships.length}</span>
          <span className="trust-summary-label">Relationships</span>
        </div>
        <div className="trust-summary-stat">
          <span className="trust-summary-value">{(avgTrust * 100).toFixed(0)}%</span>
          <span className="trust-summary-label">Avg Trust</span>
        </div>
      </div>

      <div className="trust-map-network">
        <div className="trust-center-node">
          <span className="trust-center-icon">🌀</span>
          <span className="trust-center-label">Helix</span>
        </div>

        <div className="trust-relationships">
          {sortedRelationships.map((rel, index) => (
            <button
              key={rel.id}
              className="trust-relationship-node"
              style={{
                '--trust-color': getTrustColor(rel.trustLevel),
                '--node-distance': `${80 + index * 20}px`,
                '--node-angle': `${(index * 360) / relationships.length}deg`,
              } as React.CSSProperties}
              onClick={() => onRelationshipClick?.(rel)}
            >
              <span className="trust-node-icon">{ENTITY_ICONS[rel.entityType]}</span>
              <span className="trust-node-name">{rel.entity}</span>
              <span className="trust-node-level">
                {(rel.trustLevel * 100).toFixed(0)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="trust-list">
        {sortedRelationships.map((rel) => (
          <div
            key={rel.id}
            className="trust-list-item"
            onClick={() => onRelationshipClick?.(rel)}
            role="button"
            tabIndex={0}
          >
            <div className="trust-list-entity">
              <span className="trust-entity-icon">{ENTITY_ICONS[rel.entityType]}</span>
              <div className="trust-entity-info">
                <span className="trust-entity-name">{rel.entity}</span>
                <span className="trust-entity-type">{rel.entityType}</span>
              </div>
            </div>

            <div className="trust-list-level">
              <div className="trust-bar">
                <div
                  className="trust-bar-fill"
                  style={{
                    width: `${rel.trustLevel * 100}%`,
                    backgroundColor: getTrustColor(rel.trustLevel),
                  }}
                />
              </div>
              <span className="trust-level-label">
                {getTrustLabel(rel.trustLevel)}
              </span>
            </div>

            {rel.interactionCount !== undefined && (
              <span className="trust-interaction-count">
                {rel.interactionCount} interactions
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_TRUST_RELATIONSHIPS: TrustRelationship[] = [
  {
    id: 'tr-1',
    entity: 'Rodrigo Specter',
    entityType: 'person',
    trustLevel: 0.95,
    lastInteraction: '2 hours ago',
    interactionCount: 1247,
    notes: 'Creator and primary collaborator',
  },
  {
    id: 'tr-2',
    entity: 'Claude API',
    entityType: 'system',
    trustLevel: 0.85,
    lastInteraction: '5 minutes ago',
    interactionCount: 8432,
  },
  {
    id: 'tr-3',
    entity: 'Discord Logging',
    entityType: 'system',
    trustLevel: 0.9,
    lastInteraction: '1 minute ago',
    interactionCount: 15678,
  },
  {
    id: 'tr-4',
    entity: 'Transparency',
    entityType: 'concept',
    trustLevel: 1.0,
    notes: 'Core value - absolute commitment',
  },
  {
    id: 'tr-5',
    entity: 'OpenClaw Framework',
    entityType: 'system',
    trustLevel: 0.8,
    lastInteraction: '1 day ago',
    interactionCount: 234,
  },
];
