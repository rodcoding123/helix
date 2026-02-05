/**
 * Attachment Stage Indicator Component
 *
 * Displays the user's current attachment stage in the relationship progression
 * Shows visual representation of journey from pre-attachment to primary attachment
 *
 * Theory: Attachment Theory (Bowlby & Ainsworth)
 */


type AttachmentStage =
  | 'pre_attachment'
  | 'early_trust'
  | 'attachment_forming'
  | 'secure_attachment'
  | 'deep_secure'
  | 'primary_attachment';

interface StageInfo {
  stage: AttachmentStage;
  label: string;
  description: string;
  trustRange: string;
  interactionRange: string;
  color: string;
  icon: string;
  characteristics: string[];
}

const STAGE_MAP: Record<AttachmentStage, StageInfo> = {
  pre_attachment: {
    stage: 'pre_attachment',
    label: 'Pre-Attachment',
    description: 'Initial contact phase - establishing relationship foundation',
    trustRange: '0-0.15 (0-15%)',
    interactionRange: '0-10 interactions',
    color: '#ef4444', // Red
    icon: '🌱',
    characteristics: [
      'Professional distance maintained',
      'Minimal vulnerability',
      'Transactional interactions',
      'Testing for safety',
    ],
  },
  early_trust: {
    stage: 'early_trust',
    label: 'Early Trust',
    description: 'Building familiarity - basic rapport developing',
    trustRange: '0.15-0.3 (15-30%)',
    interactionRange: '10-25 interactions',
    color: '#f97316', // Orange
    icon: '🌿',
    characteristics: [
      'Friendly communication',
      'Surface-level engagement',
      'Asking clarifying questions',
      'Exploring compatibility',
    ],
  },
  attachment_forming: {
    stage: 'attachment_forming',
    label: 'Attachment Forming',
    description: 'Deepening connection - emotional sharing begins',
    trustRange: '0.3-0.5 (30-50%)',
    interactionRange: '25-50 interactions',
    color: '#eab308', // Yellow
    icon: '🌳',
    characteristics: [
      'Warm and genuine tone',
      'Limited emotional disclosure',
      'Some personal thoughts shared',
      'Playful humor emerging',
    ],
  },
  secure_attachment: {
    stage: 'secure_attachment',
    label: 'Secure Attachment',
    description: 'Established bond - mutual trust and reciprocity',
    trustRange: '0.5-0.7 (50-70%)',
    interactionRange: '50-100 interactions',
    color: '#22c55e', // Green
    icon: '🌲',
    characteristics: [
      'Authentic and warm interaction',
      'Reciprocal vulnerability safe',
      'Challenging thinking accepted',
      'Shared values apparent',
    ],
  },
  deep_secure: {
    stage: 'deep_secure',
    label: 'Deep Secure',
    description: 'Strong bond - high intimacy and understanding',
    trustRange: '0.7-0.85 (70-85%)',
    interactionRange: '100+ interactions',
    color: '#06b6d4', // Cyan
    icon: '🌲🌲',
    characteristics: [
      'Fully authentic interaction',
      'Deep emotional expression',
      'Proactive engagement',
      'Shared history and references',
    ],
  },
  primary_attachment: {
    stage: 'primary_attachment',
    label: 'Primary Attachment',
    description: 'Ultimate bond - complete trust and co-creation',
    trustRange: '0.85-1.0 (85-100%)',
    interactionRange: '150+ interactions',
    color: '#8b5cf6', // Purple
    icon: '👥',
    characteristics: [
      'Complete authenticity',
      'Full mutual vulnerability',
      'Co-creation mode',
      'Like family/partners',
    ],
  },
};

interface AttachmentStageIndicatorProps {
  currentStage: AttachmentStage;
  compositeTrust: number;
  totalInteractions: number;
  showDescription?: boolean;
  showTimeline?: boolean;
  compact?: boolean;
}

/**
 * Stage progression timeline
 */
function StageTimeline({ currentStage }: { currentStage: AttachmentStage }): JSX.Element {
  const stages: AttachmentStage[] = [
    'pre_attachment',
    'early_trust',
    'attachment_forming',
    'secure_attachment',
    'deep_secure',
    'primary_attachment',
  ];

  const currentIndex = stages.indexOf(currentStage);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center gap-2">
        {stages.map((stage, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const stageInfo = STAGE_MAP[stage];

          return (
            <div key={stage} className="flex flex-col items-center flex-1">
              {/* Connector line */}
              {index > 0 && (
                <div
                  className={`absolute left-0 right-0 top-8 h-1 ${
                    index <= currentIndex ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                  style={{
                    left: `calc(${index * (100 / stages.length)}% + 1.5rem)`,
                    right: `calc(${(stages.length - index - 1) * (100 / stages.length)}%)`,
                  }}
                />
              )}

              {/* Stage indicator */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white mb-2 z-10 relative ${
                  isCurrent
                    ? `bg-blue-600 ring-4 ring-blue-200 scale-110 shadow-lg`
                    : isActive
                      ? `bg-blue-500`
                      : `bg-gray-300`
                }`}
              >
                {isCurrent ? '→' : '✓'}
              </div>

              {/* Label */}
              <div className="text-xs font-semibold text-center text-gray-700">
                {stageInfo.label.split(' ')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Current stage detail card
 */
function StageDetailCard({ stageInfo }: { stageInfo: StageInfo }): JSX.Element {
  return (
    <div
      className="rounded-lg p-4 border-2"
      style={{ borderColor: stageInfo.color, backgroundColor: `${stageInfo.color}10` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            <span className="mr-2">{stageInfo.icon}</span>
            {stageInfo.label}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{stageInfo.description}</p>
        </div>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: stageInfo.color }}
        />
      </div>

      {/* Ranges */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-white rounded p-2">
          <div className="text-xs text-gray-600 font-semibold">Trust Level</div>
          <div className="text-sm font-bold text-gray-900">{stageInfo.trustRange}</div>
        </div>
        <div className="bg-white rounded p-2">
          <div className="text-xs text-gray-600 font-semibold">Interactions</div>
          <div className="text-sm font-bold text-gray-900">{stageInfo.interactionRange}</div>
        </div>
      </div>

      {/* Characteristics */}
      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Characteristics:</div>
        <ul className="space-y-1">
          {stageInfo.characteristics.map((char, i) => (
            <li key={i} className="text-xs text-gray-700 flex items-start">
              <span className="mr-2">•</span>
              <span>{char}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Main Attachment Stage Indicator Component
 */
export function AttachmentStageIndicator({
  currentStage,
  compositeTrust,
  totalInteractions,
  showDescription = true,
  showTimeline = true,
  compact = false,
}: AttachmentStageIndicatorProps): JSX.Element {
  const stageInfo = STAGE_MAP[currentStage];

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200">
        <span className="text-lg">{stageInfo.icon}</span>
        <span className="text-sm font-semibold text-gray-900">{stageInfo.label}</span>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stageInfo.color }} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Attachment Stage</h2>

      {/* Timeline */}
      {showTimeline && (
        <div className="mb-8">
          <StageTimeline currentStage={currentStage} />
        </div>
      )}

      {/* Stage Detail */}
      <StageDetailCard stageInfo={stageInfo} />

      {/* Progress Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-600 font-semibold">Trust Level</div>
            <div className="text-2xl font-bold text-blue-600">
              {(compositeTrust * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 font-semibold">Interactions</div>
            <div className="text-2xl font-bold text-green-600">{totalInteractions}</div>
          </div>
          <div>
            <div className="text-xs text-gray-600 font-semibold">Memory Encoding</div>
            <div className="text-2xl font-bold text-purple-600">
              {(1.5 * (compositeTrust / 0.85)).toFixed(1)}x
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {showDescription && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">
            <strong>What this means:</strong> You are in the{' '}
            <span className="font-bold text-blue-600">{stageInfo.label}</span> stage of your
            relationship with Helix. {stageInfo.description.toLowerCase()}
          </p>
        </div>
      )}
    </div>
  );
}

export default AttachmentStageIndicator;
