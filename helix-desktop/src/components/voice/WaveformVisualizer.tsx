/**
 * Waveform Visualizer Component
 *
 * CSS-based bar visualizer for audio waveform display.
 * Two modes:
 *   - listening: gentle, slow-moving bars (mic input simulation)
 *   - speaking:  energetic, varied-height bars (audio output simulation)
 *
 * Visual only - no actual audio analysis. Uses CSS animations with randomised
 * delays and durations for organic movement.
 *
 * CSS prefix: wv-
 */

import { useMemo } from 'react';

/* =====================================================================
   Types
   ===================================================================== */

export interface WaveformVisualizerProps {
  /** Whether the visualizer is active (animating) */
  active: boolean;
  /** Listening = gentle motion, Speaking = energetic motion */
  mode: 'listening' | 'speaking';
  /** Bar colour (default: accent #6366f1) */
  color?: string;
  /** Number of bars to render (default: 32) */
  barCount?: number;
  /** Component height in px (default: 60) */
  height?: number;
  /** Component width in px (default: 200) */
  width?: number;
}

/* =====================================================================
   Helpers
   ===================================================================== */

/** Deterministic pseudo-random based on index + seed for consistent layouts */
function seededRandom(index: number, seed: number): number {
  const x = Math.sin(index * 9301 + seed * 49297) * 49297;
  return x - Math.floor(x);
}

/* =====================================================================
   Styles (inline <style> block)
   ===================================================================== */

const STYLES = `
/* Waveform Visualizer */
.wv-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  overflow: hidden;
}

.wv-bar {
  border-radius: 2px 2px 0 0;
  transform-origin: bottom center;
  will-change: transform;
  transition: height 0.15s ease;
}

/* Idle state: flat minimal bars */
.wv-bar--idle {
  opacity: 0.25;
}

/* Listening: gentle bobbing */
.wv-bar--listening {
  animation: wv-listen ease-in-out infinite;
}

/* Speaking: energetic bounce */
.wv-bar--speaking {
  animation: wv-speak ease-in-out infinite;
}

@keyframes wv-listen {
  0%, 100% {
    transform: scaleY(0.15);
    opacity: 0.5;
  }
  50% {
    transform: scaleY(0.55);
    opacity: 0.8;
  }
}

@keyframes wv-speak {
  0%, 100% {
    transform: scaleY(0.2);
    opacity: 0.7;
  }
  25% {
    transform: scaleY(1);
    opacity: 1;
  }
  50% {
    transform: scaleY(0.4);
    opacity: 0.8;
  }
  75% {
    transform: scaleY(0.85);
    opacity: 0.95;
  }
}
`;

/* =====================================================================
   Component
   ===================================================================== */

export function WaveformVisualizer({
  active,
  mode,
  color = '#6366f1',
  barCount = 32,
  height = 60,
  width = 200,
}: WaveformVisualizerProps) {
  // Pre-compute per-bar random parameters (stable across re-renders with same barCount)
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const rand1 = seededRandom(i, 1);
      const rand2 = seededRandom(i, 2);
      const rand3 = seededRandom(i, 3);

      // Listening: slower durations (1.2 - 2.4s)
      const listenDuration = 1.2 + rand1 * 1.2;
      // Speaking: faster durations (0.3 - 0.8s)
      const speakDuration = 0.3 + rand1 * 0.5;

      // Staggered delay so bars aren't in sync
      const delay = rand2 * -2;

      // Idle height varies slightly per bar for visual interest
      const idleHeight = 3 + rand3 * 4;

      return {
        listenDuration,
        speakDuration,
        delay,
        idleHeight,
      };
    });
  }, [barCount]);

  const barWidth = Math.max(1, (width - (barCount - 1) * 2) / barCount);

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="wv-container"
        style={{ width: `${width}px`, height: `${height}px` }}
        role="img"
        aria-label={active ? `Audio waveform - ${mode}` : 'Audio waveform - idle'}
      >
        {bars.map((bar, i) => {
          const isActive = active;
          const isListening = isActive && mode === 'listening';
          const isSpeaking = isActive && mode === 'speaking';

          let className = 'wv-bar';
          if (!isActive) {
            className += ' wv-bar--idle';
          } else if (isListening) {
            className += ' wv-bar--listening';
          } else if (isSpeaking) {
            className += ' wv-bar--speaking';
          }

          const duration = isListening
            ? bar.listenDuration
            : isSpeaking
              ? bar.speakDuration
              : 0;

          const barStyle: React.CSSProperties = {
            width: `${barWidth}px`,
            height: `${height}px`,
            backgroundColor: color,
            animationDuration: isActive ? `${duration}s` : undefined,
            animationDelay: isActive ? `${bar.delay}s` : undefined,
            transform: !isActive ? `scaleY(${bar.idleHeight / height})` : undefined,
            opacity: !isActive ? 0.25 : undefined,
          };

          return <div key={i} className={className} style={barStyle} />;
        })}
      </div>
    </>
  );
}

export default WaveformVisualizer;
