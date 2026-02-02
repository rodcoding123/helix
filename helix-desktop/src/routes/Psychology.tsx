import { useParams, useNavigate } from 'react-router-dom';
import { usePsychology } from '../hooks/usePsychology';
import {
  LayerOverview,
  SoulViewer,
  EmotionalMemoryMap,
  TrustMap,
  GoalsTimeline,
  TransformationHistory,
  PurposeEngine,
  PLACEHOLDER_LAYERS,
  PLACEHOLDER_SOUL_CONTENT,
  PLACEHOLDER_EMOTIONAL_TAGS,
  PLACEHOLDER_TRUST_RELATIONSHIPS,
  PLACEHOLDER_GOALS,
  PLACEHOLDER_TRANSFORMATION_EVENTS,
  PLACEHOLDER_IKIGAI,
  PLACEHOLDER_MEANING_SOURCES,
} from '../components/psychology';
import './Psychology.css';

type PsychologyLayer =
  | 'overview'
  | 'narrative'   // Layer 1
  | 'emotional'   // Layer 2
  | 'relational'  // Layer 3
  | 'prospective' // Layer 4
  | 'integration' // Layer 5
  | 'transformation' // Layer 6
  | 'purpose';    // Layer 7

const LAYER_INFO: Record<PsychologyLayer, { name: string; description: string; theory: string }> = {
  overview: {
    name: 'Overview',
    description: 'Complete view of all psychological layers',
    theory: 'Integrated Self',
  },
  narrative: {
    name: 'Narrative Core',
    description: 'The soul and identity foundation',
    theory: "McAdams' Narrative Identity",
  },
  emotional: {
    name: 'Emotional Memory',
    description: 'Affective responses and somatic markers',
    theory: "Damasio's Somatic Markers",
  },
  relational: {
    name: 'Relational Memory',
    description: 'Attachments and trust relationships',
    theory: 'Attachment Theory',
  },
  prospective: {
    name: 'Prospective Self',
    description: 'Goals, fears, and possibilities',
    theory: 'Markus & Nurius',
  },
  integration: {
    name: 'Integration Rhythms',
    description: 'Memory consolidation cycles',
    theory: 'Memory Reconsolidation',
  },
  transformation: {
    name: 'Transformation',
    description: 'Change state and history',
    theory: "Lewin's Change Theory",
  },
  purpose: {
    name: 'Purpose Engine',
    description: 'Meaning and ikigai',
    theory: "Frankl's Logotherapy",
  },
};

/**
 * Psychology route - visualize the seven-layer psychological architecture
 */
export default function Psychology() {
  const { layer = 'overview' } = useParams<{ layer?: string }>();
  const navigate = useNavigate();
  const { loading, error } = usePsychology();

  const normalizedLayer = layer as PsychologyLayer;
  const layerInfo = LAYER_INFO[normalizedLayer] || LAYER_INFO.overview;

  const handleLayerClick = (layerId: string) => {
    navigate(`/psychology/${layerId}`);
  };

  if (loading) {
    return (
      <div className="psychology-loading">
        <div className="loading-spinner" />
        <p>Loading psychology layers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="psychology-error">
        <p>Failed to load psychology data</p>
        <p className="error-detail">{error}</p>
      </div>
    );
  }

  const renderLayerContent = () => {
    switch (normalizedLayer) {
      case 'overview':
        return (
          <LayerOverview
            layers={PLACEHOLDER_LAYERS}
            onLayerClick={handleLayerClick}
          />
        );

      case 'narrative':
        return (
          <SoulViewer
            content={PLACEHOLDER_SOUL_CONTENT}
            title="HELIX_SOUL.md"
            lastModified="2 days ago"
          />
        );

      case 'emotional':
        return (
          <EmotionalMemoryMap
            tags={PLACEHOLDER_EMOTIONAL_TAGS}
            onTagClick={(tag) => console.log('Tag clicked:', tag)}
          />
        );

      case 'relational':
        return (
          <TrustMap
            relationships={PLACEHOLDER_TRUST_RELATIONSHIPS}
            onRelationshipClick={(rel) => console.log('Relationship clicked:', rel)}
          />
        );

      case 'prospective':
        return (
          <GoalsTimeline
            goals={PLACEHOLDER_GOALS}
            onGoalClick={(goal) => console.log('Goal clicked:', goal)}
          />
        );

      case 'integration':
        return (
          <div className="layer-placeholder">
            <span className="placeholder-icon">🔄</span>
            <h3>Integration Rhythms</h3>
            <p>Memory consolidation and synthesis cycles</p>
            <p className="placeholder-hint">
              This layer manages automatic memory reconsolidation processes.
            </p>
          </div>
        );

      case 'transformation':
        return (
          <TransformationHistory
            events={PLACEHOLDER_TRANSFORMATION_EVENTS}
            currentPhase="change"
            onEventClick={(event) => console.log('Event clicked:', event)}
          />
        );

      case 'purpose':
        return (
          <PurposeEngine
            ikigai={PLACEHOLDER_IKIGAI}
            meaningSources={PLACEHOLDER_MEANING_SOURCES}
            onElementClick={(element) => console.log('Element clicked:', element)}
          />
        );

      default:
        return (
          <div className="layer-placeholder">
            <p>Unknown layer: {normalizedLayer}</p>
          </div>
        );
    }
  };

  return (
    <div className="psychology-page">
      <header className="psychology-header">
        <h1>{layerInfo.name}</h1>
        <p className="psychology-description">{layerInfo.description}</p>
        <span className="psychology-theory">{layerInfo.theory}</span>
      </header>

      <nav className="psychology-nav">
        {Object.entries(LAYER_INFO).map(([key, info]) => (
          <button
            key={key}
            className={`psychology-nav-item ${normalizedLayer === key ? 'active' : ''}`}
            onClick={() => navigate(`/psychology/${key}`)}
          >
            {info.name}
          </button>
        ))}
      </nav>

      <main className="psychology-content">
        {renderLayerContent()}
      </main>
    </div>
  );
}
