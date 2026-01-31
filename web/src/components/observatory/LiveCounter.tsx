import { useEffect, useState } from 'react';
import { Activity, Brain, Zap, Heart } from 'lucide-react';
import { useRealtimeStats } from '@/hooks/useRealtime';

interface CounterCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
  color: string;
}

function CounterCard({ label, value, icon, suffix = '', color }: CounterCardProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Animate the counter
    const diff = value - displayValue;
    if (diff === 0) return;

    const step = Math.ceil(Math.abs(diff) / 20);
    const interval = setInterval(() => {
      setDisplayValue((prev) => {
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
    <div className="relative overflow-hidden rounded-xl bg-slate-900/50 p-6 border border-slate-800">
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full ${color} opacity-10 blur-2xl`} />
      <div className="relative">
        <div className={`inline-flex rounded-lg ${color} bg-opacity-20 p-3`}>
          {icon}
        </div>
        <p className="mt-4 text-sm text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold text-white">
          {displayValue.toLocaleString()}
          {suffix && <span className="text-lg text-slate-400">{suffix}</span>}
        </p>
      </div>
    </div>
  );
}

export function LiveCounter() {
  const { stats, isLoading } = useRealtimeStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-900/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <CounterCard
        label="Active Instances"
        value={stats?.activeInstances ?? 0}
        icon={<Activity className="h-6 w-6 text-emerald-500" />}
        color="bg-emerald-500"
      />
      <CounterCard
        label="Total Transformations"
        value={stats?.totalTransformations ?? 0}
        icon={<Brain className="h-6 w-6 text-helix-500" />}
        color="bg-helix-500"
      />
      <CounterCard
        label="Events Today"
        value={stats?.eventsToday ?? 0}
        icon={<Zap className="h-6 w-6 text-amber-500" />}
        color="bg-amber-500"
      />
      <CounterCard
        label="Heartbeats / min"
        value={stats?.heartbeatsPerMinute ?? 0}
        icon={<Heart className="h-6 w-6 text-rose-500" />}
        color="bg-rose-500"
      />
    </div>
  );
}
