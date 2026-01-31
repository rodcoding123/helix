/**
 * DNA Helix Visualization
 * Animated rotating rings inspired by SpectroTS DisciplinePulse Ring
 * Represents the interconnected nature of AI consciousness layers
 */

interface DNAHelixProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function DNAHelix({ className = '', size = 'lg' }: DNAHelixProps) {
  const dimensions = {
    sm: { width: 200, height: 200 },
    md: { width: 300, height: 300 },
    lg: { width: 400, height: 400 },
  };

  const { width, height } = dimensions[size];
  const center = width / 2;
  const strokeWidth = size === 'lg' ? 2 : 1.5;

  // Ring radii
  const outerRadius = center - 20;
  const middleRadius = center - 50;
  const innerRadius = center - 80;

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Glow effect background */}
      <div className="absolute inset-0 rounded-full bg-gradient-radial from-helix-500/10 via-accent-500/5 to-transparent blur-xl" />

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {/* Gradient for rings */}
          <linearGradient id="helixGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16c0cf" />
            <stop offset="25%" stopColor="#3986d7" />
            <stop offset="50%" stopColor="#7234ED" />
            <stop offset="75%" stopColor="#5a4edf" />
            <stop offset="100%" stopColor="#16c0cf" />
          </linearGradient>

          <linearGradient id="helixGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0686D4" />
            <stop offset="50%" stopColor="#7234ED" />
            <stop offset="100%" stopColor="#0686D4" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft glow filter */}
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Ring - Slowest rotation */}
        <g className="helix-ring-outer" style={{ transformOrigin: `${center}px ${center}px` }}>
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke="url(#helixGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray="20 10 5 10"
            opacity={0.6}
            filter="url(#glow)"
          />
          {/* Data points on outer ring */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = center + outerRadius * Math.cos(rad);
            const y = center + outerRadius * Math.sin(rad);
            return (
              <circle
                key={`outer-${i}`}
                cx={x}
                cy={y}
                r={4}
                fill="#0686D4"
                filter="url(#glow)"
                className="animate-pulse-glow"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            );
          })}
        </g>

        {/* Middle Ring - Medium rotation, reverse direction */}
        <g className="helix-ring-middle" style={{ transformOrigin: `${center}px ${center}px` }}>
          <circle
            cx={center}
            cy={center}
            r={middleRadius}
            fill="none"
            stroke="url(#helixGradient2)"
            strokeWidth={strokeWidth}
            strokeDasharray="15 8 3 8"
            opacity={0.7}
            filter="url(#glow)"
          />
          {/* Data points on middle ring */}
          {[30, 90, 150, 210, 270, 330].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = center + middleRadius * Math.cos(rad);
            const y = center + middleRadius * Math.sin(rad);
            return (
              <circle
                key={`middle-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill="#7234ED"
                filter="url(#glow)"
                className="animate-pulse-glow"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            );
          })}
        </g>

        {/* Inner Ring - Fastest rotation */}
        <g className="helix-ring-inner" style={{ transformOrigin: `${center}px ${center}px` }}>
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="url(#helixGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray="10 5"
            opacity={0.8}
            filter="url(#glow)"
          />
          {/* Data points on inner ring */}
          {[0, 90, 180, 270].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = center + innerRadius * Math.cos(rad);
            const y = center + innerRadius * Math.sin(rad);
            return (
              <circle
                key={`inner-${i}`}
                cx={x}
                cy={y}
                r={2.5}
                fill="#16c0cf"
                filter="url(#glow)"
                className="animate-pulse-glow"
                style={{ animationDelay: `${i * 0.4}s` }}
              />
            );
          })}
        </g>

        {/* Center Core */}
        <circle
          cx={center}
          cy={center}
          r={30}
          fill="none"
          stroke="url(#helixGradient)"
          strokeWidth={1}
          opacity={0.4}
        />
        <circle
          cx={center}
          cy={center}
          r={15}
          fill="url(#helixGradient)"
          opacity={0.3}
          filter="url(#softGlow)"
          className="animate-pulse-glow-slow"
        />
        <circle
          cx={center}
          cy={center}
          r={6}
          fill="#fff"
          opacity={0.9}
          filter="url(#softGlow)"
        />
      </svg>

      {/* Center Label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <span className="text-xs font-mono text-helix-400 tracking-wider">7 LAYERS</span>
        </div>
      </div>
    </div>
  );
}
