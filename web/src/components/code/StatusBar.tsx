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
      color: 'text-success',
      bgColor: 'bg-success',
    },
    connecting: {
      icon: Activity,
      label: 'Connecting...',
      color: 'text-warning',
      bgColor: 'bg-warning',
    },
    disconnected: {
      icon: WifiOff,
      label: 'Disconnected',
      color: 'text-text-tertiary',
      bgColor: 'bg-text-tertiary',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      color: 'text-danger',
      bgColor: 'bg-danger',
    },
  };

  const status = statusConfig[connectionStatus];
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2.5',
        'bg-bg-secondary/80 backdrop-blur-sm',
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
          <span className={cn('text-sm font-medium', status.color)}>{status.label}</span>
        </div>

        {connectionStatus === 'connected' && (
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <span className="text-white/20">•</span>
            <span className="font-mono text-xs">{instanceName}</span>
          </div>
        )}
      </div>

      {/* Right: Session stats */}
      <div className="flex items-center gap-6">
        {/* Session duration */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Clock className="h-4 w-4 text-text-tertiary" />
          <span className="font-mono">{formatDuration(sessionDuration)}</span>
        </div>

        {/* Tokens used */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Cpu className="h-4 w-4 text-text-tertiary" />
          <span className="font-mono">{formatTokens(tokensUsed)} tokens</span>
        </div>
      </div>
    </div>
  );
}
