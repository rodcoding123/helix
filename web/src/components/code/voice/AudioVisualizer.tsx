import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export function AudioVisualizer({
  audioLevel,
  isActive,
  barCount = 5,
  className,
}: AudioVisualizerProps) {
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!isActive) return;

    barsRef.current.forEach((bar, index) => {
      if (!bar) return;

      // Create variation based on bar position
      const variation = Math.sin(Date.now() / 100 + index) * 0.3;
      const baseHeight = audioLevel * 100;
      const height = Math.max(10, Math.min(100, baseHeight + variation * baseHeight));

      bar.style.height = `${height}%`;
    });
  }, [audioLevel, isActive]);

  return (
    <div
      className={cn(
        'flex items-end justify-center gap-1 h-8',
        className
      )}
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) barsRef.current[index] = el;
          }}
          className={cn(
            'w-1 rounded-full transition-all duration-75',
            isActive ? 'bg-helix-400' : 'bg-slate-600'
          )}
          style={{
            height: isActive ? `${Math.max(10, audioLevel * 100)}%` : '10%',
            transitionDelay: `${index * 20}ms`,
          }}
        />
      ))}
    </div>
  );
}

// Alternative circular visualizer
interface CircularVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  size?: number;
  className?: string;
}

export function CircularVisualizer({
  audioLevel,
  isActive,
  size = 48,
  className,
}: CircularVisualizerProps) {
  const scale = isActive ? 1 + audioLevel * 0.3 : 1;

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        className
      )}
      style={{ width: size, height: size }}
    >
      {/* Outer ring */}
      <div
        className={cn(
          'absolute inset-0 rounded-full border-2 transition-all duration-100',
          isActive ? 'border-helix-400' : 'border-slate-600'
        )}
        style={{
          transform: `scale(${scale})`,
          opacity: isActive ? 0.5 + audioLevel * 0.5 : 0.3,
        }}
      />

      {/* Middle ring */}
      <div
        className={cn(
          'absolute rounded-full border-2 transition-all duration-100',
          isActive ? 'border-helix-500' : 'border-slate-700'
        )}
        style={{
          width: size * 0.7,
          height: size * 0.7,
          transform: `scale(${1 + audioLevel * 0.2})`,
          opacity: isActive ? 0.6 + audioLevel * 0.4 : 0.4,
        }}
      />

      {/* Inner circle */}
      <div
        className={cn(
          'rounded-full transition-all duration-100',
          isActive ? 'bg-helix-500' : 'bg-slate-700'
        )}
        style={{
          width: size * 0.4,
          height: size * 0.4,
          transform: `scale(${1 + audioLevel * 0.15})`,
        }}
      />
    </div>
  );
}
