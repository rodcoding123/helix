import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceState } from '@/lib/webrtc-voice';

interface VoiceButtonProps {
  state: VoiceState;
  isMuted: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
  className?: string;
}

export function VoiceButton({
  state,
  isMuted,
  onConnect,
  onDisconnect,
  onToggleMute,
  className,
}: VoiceButtonProps) {
  const isConnected = state === 'connected' || state === 'speaking' || state === 'listening';
  const isConnecting = state === 'connecting';

  if (!isConnected && !isConnecting) {
    return (
      <button
        onClick={onConnect}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg',
          'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
          'transition-colors',
          className
        )}
        title="Start voice call"
      >
        <Phone className="h-4 w-4" />
        <span className="text-sm font-medium">Voice</span>
      </button>
    );
  }

  if (isConnecting) {
    return (
      <button
        disabled
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg',
          'bg-amber-500/20 text-amber-400',
          'transition-colors cursor-wait',
          className
        )}
      >
        <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Connecting...</span>
      </button>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Mute button */}
      <button
        onClick={onToggleMute}
        className={cn(
          'p-2 rounded-lg transition-colors',
          isMuted
            ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        )}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </button>

      {/* Hang up button */}
      <button
        onClick={onDisconnect}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg',
          'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30',
          'transition-colors'
        )}
        title="End voice call"
      >
        <PhoneOff className="h-4 w-4" />
        <span className="text-sm font-medium">End</span>
      </button>
    </div>
  );
}
