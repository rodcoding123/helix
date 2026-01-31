import { Mic, Volume2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceState } from '@/lib/webrtc-voice';

interface VoiceIndicatorProps {
  state: VoiceState;
  className?: string;
}

export function VoiceIndicator({ state, className }: VoiceIndicatorProps) {
  const config = {
    idle: {
      icon: Radio,
      label: 'Voice Off',
      color: 'text-slate-500',
      bgColor: 'bg-slate-500/20',
      animate: false,
    },
    connecting: {
      icon: Radio,
      label: 'Connecting...',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      animate: true,
    },
    connected: {
      icon: Radio,
      label: 'Connected',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      animate: false,
    },
    speaking: {
      icon: Mic,
      label: 'Speaking',
      color: 'text-helix-400',
      bgColor: 'bg-helix-500/20',
      animate: true,
    },
    listening: {
      icon: Volume2,
      label: 'Listening',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      animate: true,
    },
    error: {
      icon: Radio,
      label: 'Error',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/20',
      animate: false,
    },
  };

  const current = config[state];
  const Icon = current.icon;

  return (
    <div
      className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full', current.bgColor, className)}
    >
      <Icon className={cn('h-3.5 w-3.5', current.color, current.animate && 'animate-pulse')} />
      <span className={cn('text-xs font-medium', current.color)}>{current.label}</span>
    </div>
  );
}
