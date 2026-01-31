import { useEffect, useState } from 'react';
import { Activity, Brain, Zap, Heart } from 'lucide-react';
import { useRealtimeStats } from '@/hooks/useRealtime';
import clsx from 'clsx';

interface CounterCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
  color: 'helix' | 'accent' | 'success' | 'warning' | 'danger';
}

const colorClasses = {
  helix: {
    bg: 'bg-helix-500/10',
    glow: 'bg-helix-500/30',
    text: 'text-helix-400',
    border: 'border-helix-500/20',
  },
  accent: {
    bg: 'bg-accent-500/10',
    glow: 'bg-accent-500/30',
    text: 'text-accent-400',
    border: 'border-accent-500/20',
  },
  success: {
    bg: 'bg-success/10',
    glow: 'bg-success/30',
    text: 'text-success',
    border: 'border-success/20',
  },
  warning: {
    bg: 'bg-warning/10',
    glow: 'bg-warning/30',
    text: 'text-warning',
    border: 'border-warning/20',
  },
  danger: {
    bg: 'bg-danger/10',
    glow: 'bg-danger/30',
    text: 'text-danger',
    border: 'border-danger/20',
  },
};

function CounterCard({ label, value, icon, suffix = '', color }: CounterCardProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const colors = colorClasses[color];

  useEffect(() => {
    // Animate the counter
    const diff = value - displayValue;
    if (diff === 0) return;

    const step = Math.ceil(Math.abs(diff) / 20);
    const interval = setInterval(() => {
      setDisplayValue(prev => {
        if (diff > 0) {
          return Math.min(prev + step, value);
        } else {
          return Math.max(prev - step, value);
        }
      });
    }, 30);

    return () => clearInterval(interval);
  }, [value, displayValue]);

  return (
    <div
      className={clsx(
        'group relative overflow-hidden rounded-xl p-6',
        'bg-bg-secondary/50 backdrop-blur-sm',
        'border border-white/5 hover:border-white/10',
        'transition-all duration-300'
      )}
    >
      {/* Glow effect */}
      <div
        className={clsx(
          'absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl transition-opacity duration-300',
          colors.glow,
          'opacity-20 group-hover:opacity-40'
        )}
      />

      <div className="relative">
        {/* Icon */}
        <div className={clsx('inline-flex rounded-xl p-3', colors.bg, colors.border, 'border')}>
          <div className={colors.text}>{icon}</div>
        </div>

        {/* Label */}
        <p className="mt-4 text-sm text-text-tertiary uppercase tracking-wide">{label}</p>

        {/* Value */}
        <p className="mt-1 text-3xl font-display font-bold text-white">
          {displayValue.toLocaleString()}
          {suffix && <span className="text-lg text-text-tertiary ml-1">{suffix}</span>}
        </p>
      </div>

      {/* Pulse indicator */}
      <div className="absolute top-4 right-4">
        <div
          className={clsx(
            'h-2 w-2 rounded-full',
            colors.text.replace('text-', 'bg-'),
            'animate-pulse'
          )}
        />
      </div>
    </div>
  );
}

interface LiveCounterProps {
  inline?: boolean;
}

export function LiveCounter({ inline = false }: LiveCounterProps) {
  const { stats, isLoading } = useRealtimeStats();

  // Inline mode: just render the active count as a span
  if (inline) {
    if (isLoading) {
      return <span className="inline-block w-8 h-4 bg-white/10 rounded animate-pulse" />;
    }
    return (
      <span className="font-bold text-helix-400">
        {(stats?.active_instances ?? 0).toLocaleString()}
      </span>
    );
  }

  // Full mode: render the grid of counter cards
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-xl bg-bg-secondary/50 border border-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <CounterCard
        label="Active Instances"
        value={stats?.active_instances ?? 0}
        icon={<Activity className="h-6 w-6" />}
        color="success"
      />
      <CounterCard
        label="Transformations"
        value={stats?.total_transformations ?? 0}
        icon={<Brain className="h-6 w-6" />}
        color="helix"
      />
      <CounterCard
        label="Total Sessions"
        value={stats?.total_sessions ?? 0}
        icon={<Zap className="h-6 w-6" />}
        color="warning"
      />
      <CounterCard
        label="Heartbeats"
        value={stats?.total_heartbeats ?? 0}
        icon={<Heart className="h-6 w-6" />}
        color="danger"
      />
    </div>
  );
}
