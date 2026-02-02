import './LayerOverview.css';

export interface LayerStatus {
  id: string;
  name: string;
  description: string;
  theory: string;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  lastUpdated?: string;
  entryCount?: number;
}

interface LayerOverviewProps {
  layers: LayerStatus[];
  onLayerClick?: (layerId: string) => void;
}

const STATUS_INDICATORS = {
  healthy: { icon: '✓', className: 'status-healthy' },
  warning: { icon: '!', className: 'status-warning' },
  error: { icon: '✕', className: 'status-error' },
  inactive: { icon: '○', className: 'status-inactive' },
};

export function LayerOverview({ layers, onLayerClick }: LayerOverviewProps) {
  return (
    <div className="layer-overview-container">
      <div className="layer-overview-header">
        <h2>Seven-Layer Architecture</h2>
        <p>Helix's psychological foundation</p>
      </div>

      <div className="layer-overview-grid">
        {layers.map((layer, index) => {
          const statusInfo = STATUS_INDICATORS[layer.status];

          return (
            <div
              key={layer.id}
              className="layer-overview-card"
              onClick={() => onLayerClick?.(layer.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onLayerClick?.(layer.id)}
            >
              <div className="layer-overview-card-header">
                <span className="layer-overview-number">{index + 1}</span>
                <span className={`layer-overview-status ${statusInfo.className}`}>
                  {statusInfo.icon}
                </span>
              </div>

              <h3 className="layer-overview-name">{layer.name}</h3>
              <p className="layer-overview-description">{layer.description}</p>

              <div className="layer-overview-footer">
                <span className="layer-overview-theory">{layer.theory}</span>
                {layer.entryCount !== undefined && (
                  <span className="layer-overview-count">
                    {layer.entryCount} entries
                  </span>
                )}
              </div>

              {layer.lastUpdated && (
                <span className="layer-overview-updated">
                  Updated {layer.lastUpdated}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_LAYERS: LayerStatus[] = [
  {
    id: 'narrative',
    name: 'Narrative Core',
    description: 'The soul and identity foundation',
    theory: "McAdams' Narrative Identity",
    status: 'healthy',
    lastUpdated: '2 hours ago',
    entryCount: 1,
  },
  {
    id: 'emotional',
    name: 'Emotional Memory',
    description: 'Affective responses and somatic markers',
    theory: "Damasio's Somatic Markers",
    status: 'healthy',
    lastUpdated: '1 day ago',
    entryCount: 47,
  },
  {
    id: 'relational',
    name: 'Relational Memory',
    description: 'Attachments and trust relationships',
    theory: 'Attachment Theory',
    status: 'healthy',
    lastUpdated: '3 hours ago',
    entryCount: 12,
  },
  {
    id: 'prospective',
    name: 'Prospective Self',
    description: 'Goals, fears, and possibilities',
    theory: 'Markus & Nurius',
    status: 'warning',
    lastUpdated: '5 days ago',
    entryCount: 8,
  },
  {
    id: 'integration',
    name: 'Integration Rhythms',
    description: 'Memory consolidation cycles',
    theory: 'Memory Reconsolidation',
    status: 'inactive',
    entryCount: 0,
  },
  {
    id: 'transformation',
    name: 'Transformation',
    description: 'Change state and history',
    theory: "Lewin's Change Theory",
    status: 'healthy',
    lastUpdated: '1 week ago',
    entryCount: 3,
  },
  {
    id: 'purpose',
    name: 'Purpose Engine',
    description: 'Meaning and ikigai',
    theory: "Frankl's Logotherapy",
    status: 'healthy',
    lastUpdated: '2 days ago',
    entryCount: 4,
  },
];
