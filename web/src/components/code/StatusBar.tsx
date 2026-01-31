import { Wifi, WifiOff, Clock, Cpu, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/lib/gateway-connection';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
  instanceName?: string;
  sessionDuration?: number;
  tokensUsed?: number;
  className?: string;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function StatusBar({
  connectionStatus,
  instanceName = 'Helix',
  sessionDuration = 0,
  tokensUsed = 0,
  className,
}: StatusBarProps) {
  const statusConfig = {
    connected: {
      icon: Wifi,
      label: 'Connected',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400',
    },
    connecting: {
      icon: Activity,
      label: 'Connecting...',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400',
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      color: 'text-slate-500',
      bgColor: 'bg-slate-500',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      color: 'text-rose-400',
      bgColor: 'bg-rose-400',
    },
  };

  const status = statusConfig[connectionStatus];
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 rounded-lg',
        'bg-slate-900/80 border border-slate-700 backdrop-blur',
        className
      )}
    >
      {/* Left: Connection status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={cn('relative flex h-2 w-2')}>
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                status.bgColor,
                connectionStatus === 'connecting' && 'animate-ping'
              )}
            />
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', status.bgColor)} />
          </span>
          <StatusIcon className={cn('h-4 w-4', status.color)} />
          <span className={cn('text-sm', status.color)}>{status.label}</span>
        </div>

        {connectionStatus === 'connected' && (
          <div className="flex items-center gap-1 text-sm text-slate-400">
            <span className="text-slate-600">•</span>
            <span>{instanceName}</span>
          </div>
        )}
      </div>

      {/* Right: Session stats */}
      <div className="flex items-center gap-4">
        {/* Session duration */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(sessionDuration)}</span>
        </div>

        {/* Tokens used */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Cpu className="h-4 w-4" />
          <span>{formatTokens(tokensUsed)} tokens</span>
        </div>
      </div>
    </div>
  );
}
