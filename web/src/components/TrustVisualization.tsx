/**
 * Trust Visualization Component
 *
 * Displays multi-dimensional trust profile as radar chart
 * Shows the 5 trust dimensions: competence, integrity, benevolence,
 * predictability, and vulnerability_safety
 *
 * Theory: McKnight's 5-dimensional trust model
 */

import { useMemo } from 'react';

interface TrustProfile {
  userId: string;
  compositeTrust: number;
  attachmentStage: string;
  trustDimensions: {
    competence: number;
    integrity: number;
    benevolence: number;
    predictability: number;
    vulnerability_safety: number;
  };
  totalInteractions: number;
  highSalienceInteractions: number;
  salienceMultiplier: number;
}

interface TrustVisualizationProps {
  profile: TrustProfile;
  width?: number;
  height?: number;
  showLabels?: boolean;
  interactive?: boolean;
}

const DIMENSION_COLORS: Record<string, string> = {
  competence: '#3b82f6', // Blue
  integrity: '#ef4444', // Red
  benevolence: '#10b981', // Green
  predictability: '#f59e0b', // Amber
  vulnerability_safety: '#8b5cf6', // Purple
};

const DIMENSION_LABELS: Record<string, string> = {
  competence: 'Competence\n(Can they do what they say?)',
  integrity: 'Integrity\n(Do they do what they say?)',
  benevolence: 'Benevolence\n(Do they care?)',
  predictability: 'Predictability\n(Are they consistent?)',
  vulnerability_safety: 'Vulnerability Safety\n(Can I be real with them?)',
};

/**
 * SVG Radar Chart for 5-dimensional trust
 */
function RadarChart({ profile, width = 300, height = 300 }: { profile: TrustProfile; width?: number; height?: number }): JSX.Element {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 40;

  const dimensions = [
    { key: 'competence', value: profile.trustDimensions.competence },
    { key: 'integrity', value: profile.trustDimensions.integrity },
    { key: 'benevolence', value: profile.trustDimensions.benevolence },
    { key: 'predictability', value: profile.trustDimensions.predictability },
    { key: 'vulnerability_safety', value: profile.trustDimensions.vulnerability_safety },
  ];

  const angleSlice = (Math.PI * 2) / dimensions.length;

  // Calculate points for the polygon
  const points = dimensions.map((dim, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = centerX + dim.value * maxRadius * Math.cos(angle);
    const y = centerY + dim.value * maxRadius * Math.sin(angle);
    return `${x},${y}`;
  });

  // Create grid circles
  const gridCircles = [0.2, 0.4, 0.6, 0.8, 1.0].map((level, i) => (
    <circle
      key={`grid-${i}`}
      cx={centerX}
      cy={centerY}
      r={level * maxRadius}
      fill="none"
      stroke="#e5e7eb"
      strokeWidth="1"
    />
  ));

  // Create axis lines
  const axes = dimensions.map((_, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = centerX + maxRadius * Math.cos(angle);
    const y = centerY + maxRadius * Math.sin(angle);
    return (
      <line key={`axis-${i}`} x1={centerX} y1={centerY} x2={x} y2={y} stroke="#d1d5db" strokeWidth="1" />
    );
  });

  // Create labels
  const labels = dimensions.map((dim, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const labelRadius = maxRadius + 25;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);
    return (
      <text
        key={`label-${i}`}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="500"
        fill="#374151"
      >
        {dim.key.replace(/_/g, ' ')}
      </text>
    );
  });

  // Create data points
  const dataPoints = dimensions.map((dim, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = centerX + dim.value * maxRadius * Math.cos(angle);
    const y = centerY + dim.value * maxRadius * Math.sin(angle);
    return (
      <circle
        key={`point-${i}`}
        cx={x}
        cy={y}
        r="4"
        fill={DIMENSION_COLORS[dim.key]}
        stroke="white"
        strokeWidth="2"
      />
    );
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid */}
      {gridCircles}

      {/* Axes */}
      {axes}

      {/* Data polygon */}
      <polygon
        points={points.join(' ')}
        fill={`url(#gradientRadar)`}
        fillOpacity="0.3"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      <defs>
        <linearGradient id="gradientRadar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Labels */}
      {labels}

      {/* Data points */}
      {dataPoints}

      {/* Center label */}
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fontWeight="bold"
        fill="#1f2937"
      >
        {(profile.compositeTrust * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

/**
 * Main Trust Visualization Component
 */
export function TrustVisualization({
  profile,
  width = 400,
  height = 500,
  showLabels = true,
  interactive = false,
}: TrustVisualizationProps): JSX.Element {
  const dimensionBars = useMemo(() => {
    const dims = [
      { key: 'competence', value: profile.trustDimensions.competence },
      { key: 'integrity', value: profile.trustDimensions.integrity },
      { key: 'benevolence', value: profile.trustDimensions.benevolence },
      { key: 'predictability', value: profile.trustDimensions.predictability },
      { key: 'vulnerability_safety', value: profile.trustDimensions.vulnerability_safety },
    ];

    return dims.map(dim => (
      <div key={dim.key} className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            {dim.key.replace(/_/g, ' ')}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            {(dim.value * 100).toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all duration-300"
            style={{
              width: `${dim.value * 100}%`,
              backgroundColor: DIMENSION_COLORS[dim.key],
            }}
          />
        </div>
      </div>
    ));
  }, [profile.trustDimensions]);

  return (
    <div
      className="bg-white rounded-lg shadow-lg p-6"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Trust Profile</h2>
        <p className="text-gray-600 text-sm mt-1">
          {profile.userId} • {profile.attachmentStage.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Composite Trust */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="text-center">
          <div className="text-4xl font-bold text-blue-600">
            {(profile.compositeTrust * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600 mt-1">Composite Trust</div>
          <div className="text-xs text-gray-500 mt-2">
            {profile.totalInteractions} interactions • {profile.highSalienceInteractions} high-salience
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="flex justify-center mb-6 bg-gray-50 rounded-lg p-4">
        <RadarChart profile={profile} width={300} height={300} />
      </div>

      {/* Dimension Bars */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Trust Dimensions
        </h3>
        {dimensionBars}
      </div>

      {/* Memory Encoding */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            Memory Encoding Multiplier
          </span>
          <span className="text-lg font-bold text-purple-600">
            {profile.salienceMultiplier.toFixed(2)}x
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Higher multiplier = stronger memory encoding
        </p>
      </div>

      {/* Stage Info */}
      <div className="mt-4 p-3 bg-amber-50 rounded-lg text-xs text-gray-700">
        <span className="font-semibold">Attachment Stage:</span> {profile.attachmentStage.replace(/_/g, ' ')}
      </div>
    </div>
  );
}

export default TrustVisualization;
