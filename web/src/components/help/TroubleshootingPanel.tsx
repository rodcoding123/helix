import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Terminal,
  Wifi,
  WifiOff,
  Key,
  Settings,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import clsx from 'clsx';

/**
 * Gateway error codes for troubleshooting
 */
export type GatewayErrorCode =
  | 'CONNECTION_FAILED'
  | 'AUTH_REJECTED'
  | 'PROTOCOL_MISMATCH'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'GATEWAY_OFFLINE';

interface TroubleshootingItem {
  id: string;
  title: string;
  description: string;
  steps: string[];
  command?: string;
  icon: typeof AlertTriangle;
}

const TROUBLESHOOTING_ITEMS: Record<GatewayErrorCode | 'general', TroubleshootingItem[]> = {
  CONNECTION_FAILED: [
    {
      id: 'helix-not-running',
      title: 'Helix not running',
      description: 'The local Helix runtime needs to be started before connecting.',
      steps: [
        'Open a terminal window',
        'Run "helix start" to start the gateway',
        'Wait for "Gateway started on 127.0.0.1:18789" message',
        'Refresh this page',
      ],
      command: 'helix start',
      icon: Terminal,
    },
    {
      id: 'firewall-blocking',
      title: 'Firewall blocking connection',
      description: 'Your firewall may be blocking localhost connections.',
      steps: [
        'Check Windows Firewall or macOS Firewall settings',
        'Allow connections to localhost:18789',
        'Try temporarily disabling firewall to test',
      ],
      icon: WifiOff,
    },
  ],
  AUTH_REJECTED: [
    {
      id: 'token-expired',
      title: 'Session expired',
      description: 'Your authentication token may have expired.',
      steps: [
        'Refresh this page to get a new session token',
        'If that fails, log out and log back in',
        'Check your .env file has the correct HELIX_INSTANCE_KEY',
      ],
      icon: Key,
    },
    {
      id: 'key-mismatch',
      title: 'Instance key mismatch',
      description: 'The instance key in your .env file must match your account.',
      steps: [
        'Open your Helix .env file',
        'Verify HELIX_INSTANCE_KEY matches your account',
        'Restart Helix after making changes',
      ],
      command: 'helix restart',
      icon: Key,
    },
  ],
  PROTOCOL_MISMATCH: [
    {
      id: 'version-mismatch',
      title: 'Version mismatch',
      description: 'Your local Helix version may be outdated.',
      steps: [
        'Update Helix to the latest version',
        'Restart Helix after updating',
        'Refresh this page',
      ],
      command: 'npm update -g @helix-ai/cli',
      icon: RefreshCw,
    },
  ],
  TIMEOUT: [
    {
      id: 'slow-startup',
      title: 'Helix still starting',
      description: 'Helix may take a moment to fully initialize.',
      steps: [
        'Wait 10-15 seconds for Helix to fully start',
        'Check terminal for "Gateway ready" message',
        'Try clicking "Retry" below',
      ],
      icon: RefreshCw,
    },
    {
      id: 'network-issues',
      title: 'Network latency',
      description: 'High network latency may cause timeouts.',
      steps: [
        'Check your internet connection',
        'Try closing other bandwidth-heavy applications',
        'Restart your network connection if needed',
      ],
      icon: Wifi,
    },
  ],
  NETWORK_ERROR: [
    {
      id: 'no-internet',
      title: 'Network unavailable',
      description: 'Check your internet connection.',
      steps: [
        'Verify you are connected to the internet',
        'Try opening another website to confirm',
        'Check if using VPN that might block local connections',
      ],
      icon: WifiOff,
    },
  ],
  GATEWAY_OFFLINE: [
    {
      id: 'gateway-crashed',
      title: 'Gateway crashed',
      description: 'The Helix gateway may have crashed unexpectedly.',
      steps: [
        'Check your terminal for error messages',
        'Restart Helix with "helix start"',
        'If crashes persist, check logs in ~/.helix/logs/',
      ],
      command: 'helix start',
      icon: AlertTriangle,
    },
  ],
  general: [
    {
      id: 'reinstall',
      title: 'Reinstall Helix',
      description: 'As a last resort, try reinstalling Helix.',
      steps: [
        'Uninstall current version',
        'Download latest version from helix-project.org',
        'Follow installation instructions',
        'Reconfigure your .env file',
      ],
      icon: Settings,
    },
  ],
};

interface TroubleshootingPanelProps {
  /** Error code to show specific troubleshooting for */
  errorCode?: GatewayErrorCode;
  /** Whether to show as expandable section */
  expandable?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Callback when user clicks retry */
  onRetry?: () => void;
  /** Additional className */
  className?: string;
}

export function TroubleshootingPanel({
  errorCode,
  expandable = true,
  defaultExpanded = false,
  onRetry,
  className,
}: TroubleshootingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Get relevant troubleshooting items
  const items = errorCode
    ? [...(TROUBLESHOOTING_ITEMS[errorCode] || []), ...TROUBLESHOOTING_ITEMS.general]
    : TROUBLESHOOTING_ITEMS.general;

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const content = (
    <div className="space-y-3">
      {items.map(item => {
        const Icon = item.icon;
        const isItemExpanded = expandedItems.has(item.id);

        return (
          <div
            key={item.id}
            className="rounded-lg border border-white/10 bg-bg-tertiary/50 overflow-hidden"
          >
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
            >
              <Icon className="h-5 w-5 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white text-sm">{item.title}</h4>
                <p className="text-xs text-text-tertiary truncate">{item.description}</p>
              </div>
              <ChevronRight
                className={clsx(
                  'h-4 w-4 text-text-tertiary transition-transform',
                  isItemExpanded && 'rotate-90'
                )}
              />
            </button>

            {isItemExpanded && (
              <div className="px-3 pb-3 pt-0">
                <ol className="space-y-2 text-sm text-text-secondary pl-8">
                  {item.steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-helix-400 font-mono text-xs mt-0.5">
                        {index + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {item.command && (
                  <div className="mt-3 flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-white/10 text-helix-400 text-xs font-mono">
                      {item.command}
                    </code>
                    <button
                      onClick={() => copyCommand(item.command!)}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        copiedCommand === item.command
                          ? 'bg-success/20 text-success'
                          : 'bg-bg-tertiary hover:bg-white/10 text-text-tertiary hover:text-white'
                      )}
                    >
                      {copiedCommand === item.command ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full btn btn-secondary flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </button>
      )}

      {/* Docs link */}
      <a
        href="https://docs.helix-project.org/troubleshooting"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-helix-400 hover:text-helix-300 transition-colors"
      >
        <ExternalLink className="h-4 w-4" />
        View full troubleshooting guide
      </a>
    </div>
  );

  if (!expandable) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={clsx('rounded-xl border border-white/10 overflow-hidden', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <span className="font-medium text-white">Troubleshooting Guide</span>
        </div>
        <ChevronDown
          className={clsx(
            'h-5 w-5 text-text-tertiary transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && <div className="p-4 border-t border-white/10">{content}</div>}
    </div>
  );
}

/**
 * Export troubleshooting guide data for use in other components
 */
export { TROUBLESHOOTING_ITEMS };
export type { TroubleshootingItem };
