/**
 * Living Architecture Visualization
 *
 * A cosmic consciousness visualization representing Helix's 7 psychological layers.
 * Each orbital ring represents a layer of the Living AI Architecture,
 * with particles orbiting to show active psychological processes.
 *
 * Auto-cycles through layers from outer to inner with timed animation.
 *
 * Layers (inside → out):
 * 1. Narrative Core (Soul) - Center
 * 2. Emotional Memory
 * 3. Relational Memory
 * 4. Prospective Self
 * 5. Integration Rhythms
 * 6. Transformation Cycles
 * 7. Purpose Engine
 */

import { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';

interface LivingArchitectureProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
}

interface Layer {
  id: number;
  name: string;
  shortName: string;
  radius: number;
  particles: number;
  speed: number;
  color: string;
  glowColor: string;
  tilt: number;
  offset: number;
}

const LAYERS: Layer[] = [
  {
    id: 1,
    name: 'Emotional Memory',
    shortName: 'EMOTION',
    radius: 0.28,
    particles: 3,
    speed: 25,
    color: '#16c0cf',
    glowColor: 'rgba(22, 192, 207, 0.6)',
    tilt: 15,
    offset: 0,
  },
  {
    id: 2,
    name: 'Relational Memory',
    shortName: 'RELATION',
    radius: 0.36,
    particles: 4,
    speed: 32,
    color: '#0686D4',
    glowColor: 'rgba(6, 134, 212, 0.5)',
    tilt: -10,
    offset: 45,
  },
  {
    id: 3,
    name: 'Prospective Self',
    shortName: 'PROSPECT',
    radius: 0.44,
    particles: 3,
    speed: 40,
    color: '#3986d7',
    glowColor: 'rgba(57, 134, 215, 0.5)',
    tilt: 8,
    offset: 90,
  },
  {
    id: 4,
    name: 'Integration Rhythms',
    shortName: 'INTEGRATE',
    radius: 0.52,
    particles: 5,
    speed: 50,
    color: '#5a4edf',
    glowColor: 'rgba(90, 78, 223, 0.5)',
    tilt: -5,
    offset: 135,
  },
  {
    id: 5,
    name: 'Transformation Cycles',
    shortName: 'TRANSFORM',
    radius: 0.6,
    particles: 4,
    speed: 60,
    color: '#7234ED',
    glowColor: 'rgba(114, 52, 237, 0.5)',
    tilt: 12,
    offset: 180,
  },
  {
    id: 6,
    name: 'Purpose Engine',
    shortName: 'PURPOSE',
    radius: 0.68,
    particles: 6,
    speed: 75,
    color: '#9333EA',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    tilt: -8,
    offset: 225,
  },
];

// Cycle order: outer to inner, then soul, then repeat
const CYCLE_ORDER = [6, 5, 4, 3, 2, 1, 0]; // 0 = soul

export function LivingArchitecture({ className = '', size = 'lg' }: LivingArchitectureProps) {
  const [time, setTime] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0); // Index in CYCLE_ORDER
  const [cycleProgress, setCycleProgress] = useState(0); // 0-1 progress within current layer

  const dimensions = {
    sm: 280,
    md: 360,
    lg: 440,
    xl: 520,
  };

  const dim = dimensions[size];
  const center = dim / 2;

  // Animation loop for particle positions
  useEffect(() => {
    let animationId: number;
    const startTime = Date.now();

    const animate = () => {
      setTime((Date.now() - startTime) / 1000);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Auto-cycle through layers
  useEffect(() => {
    const cycleDuration = 2500; // ms per layer
    const progressInterval = 50; // update progress every 50ms

    const progressTimer = setInterval(() => {
      setCycleProgress(prev => {
        const next = prev + progressInterval / cycleDuration;
        if (next >= 1) {
          setActiveIndex(current => (current + 1) % CYCLE_ORDER.length);
          return 0;
        }
        return next;
      });
    }, progressInterval);

    return () => clearInterval(progressTimer);
  }, []);

  const activeLayerId = CYCLE_ORDER[activeIndex];
  const isSoulActive = activeLayerId === 0;

  // Generate particle positions for each layer
  const particles = useMemo(() => {
    return LAYERS.map(layer => {
      const particlePositions = [];
      for (let i = 0; i < layer.particles; i++) {
        const baseAngle = (360 / layer.particles) * i + layer.offset;
        const angle = baseAngle + time * (360 / layer.speed);
        const rad = (angle * Math.PI) / 180;
        const radius = (layer.radius * dim) / 2;

        // Apply slight elliptical distortion for 3D effect
        const ellipseRatio = 0.85 + Math.sin((layer.tilt * Math.PI) / 180) * 0.15;

        const x = center + radius * Math.cos(rad);
        const y = center + radius * Math.sin(rad) * ellipseRatio;

        // Calculate trail positions (previous positions)
        const trailPositions = [];
        for (let t = 1; t <= 5; t++) {
          const trailAngle = angle - t * 8;
          const trailRad = (trailAngle * Math.PI) / 180;
          trailPositions.push({
            x: center + radius * Math.cos(trailRad),
            y: center + radius * Math.sin(trailRad) * ellipseRatio,
            opacity: 1 - t * 0.18,
          });
        }

        particlePositions.push({ x, y, angle, trailPositions });
      }
      return { layerId: layer.id, positions: particlePositions };
    });
  }, [time, dim, center]);

  // Get current layer info for display
  const currentLayerInfo = isSoulActive
    ? { name: 'Narrative Core', shortName: 'SOUL', color: '#ffffff' }
    : LAYERS.find(l => l.id === activeLayerId);

  return (
    <div className={clsx('relative', className)} style={{ width: dim, height: dim }}>
      {/* Ambient glow background */}
      <div
        className="absolute inset-0 rounded-full blur-[60px] transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle at center,
            rgba(114, 52, 237, 0.4) 0%,
            rgba(6, 134, 212, 0.3) 40%,
            rgba(22, 192, 207, 0.2) 70%,
            transparent 100%
          )`,
          opacity: 0.4,
        }}
      />

      <svg
        viewBox={`0 0 ${dim} ${dim}`}
        className="w-full h-full relative z-10"
        style={{ filter: 'drop-shadow(0 0 2px rgba(6, 134, 212, 0.3))' }}
      >
        <defs>
          {/* Gradients for each layer */}
          {LAYERS.map(layer => (
            <linearGradient
              key={`gradient-${layer.id}`}
              id={`layer-gradient-${layer.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={layer.color} stopOpacity="0.8" />
              <stop offset="50%" stopColor={layer.color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={layer.color} stopOpacity="0.8" />
            </linearGradient>
          ))}

          {/* Center soul gradient */}
          <radialGradient id="soul-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="30%" stopColor="#16c0cf" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#0686D4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7234ED" stopOpacity="0.2" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="soul-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="particle-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="active-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Orbital rings */}
        {LAYERS.map((layer, index) => {
          const radius = (layer.radius * dim) / 2;
          const ellipseRatio = 0.85 + Math.sin((layer.tilt * Math.PI) / 180) * 0.15;
          const isActive = activeLayerId === layer.id;

          return (
            <g key={layer.id}>
              {/* Active ring highlight */}
              {isActive && (
                <ellipse
                  cx={center}
                  cy={center}
                  rx={radius + 4}
                  ry={(radius + 4) * ellipseRatio}
                  fill="none"
                  stroke={layer.color}
                  strokeWidth={8}
                  opacity={0.15 + cycleProgress * 0.1}
                  filter="url(#active-glow)"
                  style={{
                    transform: `rotate(${layer.tilt}deg)`,
                    transformOrigin: 'center',
                  }}
                />
              )}

              {/* Ring path */}
              <ellipse
                cx={center}
                cy={center}
                rx={radius}
                ry={radius * ellipseRatio}
                fill="none"
                stroke={`url(#layer-gradient-${layer.id})`}
                strokeWidth={isActive ? 2.5 : 1}
                strokeDasharray={isActive ? 'none' : `${4 + index * 2} ${6 + index}`}
                opacity={isActive ? 1 : 0.35}
                filter={isActive ? 'url(#active-glow)' : 'url(#ring-glow)'}
                style={{
                  transition: 'opacity 0.5s ease, stroke-width 0.3s ease',
                  transform: `rotate(${layer.tilt}deg)`,
                  transformOrigin: 'center',
                }}
              />

              {/* Secondary ring for depth */}
              <ellipse
                cx={center}
                cy={center}
                rx={radius - 2}
                ry={(radius - 2) * ellipseRatio}
                fill="none"
                stroke={layer.color}
                strokeWidth={0.5}
                opacity={isActive ? 0.4 : 0.1}
                style={{
                  transition: 'opacity 0.5s ease',
                  transform: `rotate(${layer.tilt}deg)`,
                  transformOrigin: 'center',
                }}
              />
            </g>
          );
        })}

        {/* Particles with trails */}
        {particles.map(layerParticles => {
          const layer = LAYERS.find(l => l.id === layerParticles.layerId)!;
          const isActive = activeLayerId === layer.id;

          return layerParticles.positions.map((particle, pIndex) => (
            <g key={`particle-${layer.id}-${pIndex}`}>
              {/* Trail */}
              {particle.trailPositions.map((trail, tIndex) => (
                <circle
                  key={`trail-${tIndex}`}
                  cx={trail.x}
                  cy={trail.y}
                  r={3 - tIndex * 0.4}
                  fill={layer.color}
                  opacity={(isActive ? trail.opacity : trail.opacity * 0.4) * 0.5}
                  style={{ transition: 'opacity 0.3s ease' }}
                />
              ))}

              {/* Main particle */}
              <circle
                cx={particle.x}
                cy={particle.y}
                r={isActive ? 6 : 4}
                fill={layer.color}
                filter="url(#particle-glow)"
                opacity={isActive ? 1 : 0.6}
                style={{ transition: 'opacity 0.3s ease' }}
              />

              {/* Particle core */}
              <circle
                cx={particle.x}
                cy={particle.y}
                r={isActive ? 2.5 : 2}
                fill="#ffffff"
                opacity={isActive ? 1 : 0.5}
                style={{ transition: 'opacity 0.3s ease' }}
              />
            </g>
          ));
        })}

        {/* Center Soul */}
        <g className="soul-center">
          {/* Outer soul glow - pulses when active */}
          <circle
            cx={center}
            cy={center}
            r={dim * 0.12}
            fill="url(#soul-gradient)"
            opacity={isSoulActive ? 0.6 : 0.25}
            filter="url(#soul-glow)"
            style={{
              transition: 'opacity 0.5s ease',
              animation: isSoulActive
                ? 'pulse 1.5s ease-in-out infinite'
                : 'pulse 4s ease-in-out infinite',
            }}
          />

          {/* Middle soul ring */}
          <circle
            cx={center}
            cy={center}
            r={dim * 0.08}
            fill="none"
            stroke="url(#soul-gradient)"
            strokeWidth={isSoulActive ? 2 : 1}
            opacity={isSoulActive ? 0.8 : 0.4}
            style={{ transition: 'opacity 0.5s ease, stroke-width 0.3s ease' }}
          />

          {/* Inner soul core */}
          <circle
            cx={center}
            cy={center}
            r={dim * 0.05}
            fill="url(#soul-gradient)"
            filter="url(#soul-glow)"
            opacity={isSoulActive ? 1 : 0.7}
            style={{ transition: 'opacity 0.5s ease' }}
          />

          {/* Soul highlight */}
          <circle cx={center} cy={center} r={dim * 0.02} fill="#ffffff" opacity={0.95} />
        </g>
      </svg>

      {/* Current Layer Label - Always visible, shows current layer */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="text-center transition-all duration-500"
          style={{
            transform: `translateY(${dim * 0.18}px)`,
          }}
        >
          <span
            className="block text-[10px] font-mono tracking-[0.3em] uppercase transition-all duration-300"
            style={{
              color: currentLayerInfo?.color || '#ffffff',
              textShadow: `0 0 20px ${currentLayerInfo?.color || 'rgba(255,255,255,0.5)'}`,
              opacity: 0.9,
            }}
          >
            {isSoulActive ? 'NARRATIVE' : `LAYER ${activeLayerId}`}
          </span>
          <span
            className="block text-base font-display font-bold text-white mt-0.5 transition-all duration-300"
            style={{
              textShadow: `0 0 25px ${currentLayerInfo?.color || 'rgba(255,255,255,0.5)'}`,
            }}
          >
            {currentLayerInfo?.shortName || 'SOUL'}
          </span>
        </div>
      </div>

      {/* Layer indicator dots */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pb-2">
        {CYCLE_ORDER.map((layerId, idx) => {
          const isCurrentLayer = idx === activeIndex;
          const layer = layerId === 0 ? null : LAYERS.find(l => l.id === layerId);
          const color = layer?.color || '#ffffff';

          return (
            <div
              key={idx}
              className="relative transition-all duration-300"
              style={{
                width: isCurrentLayer ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: isCurrentLayer ? color : 'rgba(255,255,255,0.2)',
                boxShadow: isCurrentLayer ? `0 0 10px ${color}` : 'none',
              }}
            >
              {isCurrentLayer && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: color,
                    transform: `scaleX(${cycleProgress})`,
                    transformOrigin: 'left',
                    opacity: 0.5,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Export default for backward compatibility
export default LivingArchitecture;
