import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, Loader2, Check, AlertTriangle, RefreshCw, ChevronDown, Terminal } from 'lucide-react';
import clsx from 'clsx';
import type { OnboardingData } from '../OnboardingWizard';

interface ConnectionVerifyStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'timeout';

interface TroubleshootingItem {
  title: string;
  steps: string[];
  command?: string;
}

const TROUBLESHOOTING: TroubleshootingItem[] = [
  {
    title: 'Helix not running',
    steps: [
      'Open a terminal window',
      'Run "helix start" to start the gateway',
      'Wait for "Gateway started" message',
    ],
    command: 'helix start',
  },
  {
    title: 'Wrong port or address',
    steps: [
      'Check your .env file has HELIX_GATEWAY_PORT=18789',
      'Ensure HELIX_GATEWAY_HOST=127.0.0.1',
      'Restart Helix after changing settings',
    ],
  },
  {
    title: 'Firewall blocking connection',
    steps: [
      'Allow localhost connections in your firewall',
      'Check antivirus isn\'t blocking port 18789',
      'Try temporarily disabling firewall to test',
    ],
  },
  {
    title: 'Instance key mismatch',
    steps: [
      'Verify your .env file has the correct HELIX_INSTANCE_KEY',
      'The key must match exactly (case-sensitive)',
      'Restart Helix after updating the key',
    ],
  },
];

export function ConnectionVerifyStep({ data, updateData }: ConnectionVerifyStepProps) {
  const [state, setState] = useState<ConnectionState>(data.connectionVerified ? 'connected' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const attemptConnection = useCallback(async () => {
    cleanup();
    setState('connecting');
    setErrorMessage(null);
    setAttempts(prev => prev + 1);

    // Set timeout (10 seconds)
    timeoutRef.current = setTimeout(() => {
      cleanup();
      setState('timeout');
      setErrorMessage('Connection timed out. Make sure Helix is running.');
    }, 10000);

    try {
      // First, try HTTP health check
      const healthResponse = await fetch('http://localhost:18789/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

      if (!healthResponse?.ok) {
        throw new Error('Gateway not responding. Run "helix start" in your terminal.');
      }

      // Then try WebSocket connection
      const ws = new WebSocket('ws://localhost:18789');
      wsRef.current = ws;

      ws.onopen = () => {
        // Send connect request (JSON-RPC 2.0)
        const connectRequest = {
          type: 'req',
          method: 'connect',
          id: crypto.randomUUID(),
          params: {
            minProtocol: 1,
            maxProtocol: 1,
            client: {
              id: 'helix.onboarding',
              mode: 'web',
              version: '1.0.0',
              displayName: 'Helix Onboarding',
              instanceId: data.instanceKey,
            },
            role: 'operator',
            scopes: ['operator.admin'],
          },
        };
        ws.send(JSON.stringify(connectRequest));
      };

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data);

          // Check for successful connection
          if (message.type === 'res' && message.ok) {
            cleanup();
            setState('connected');
            updateData({ connectionVerified: true });
            return;
          }

          // Check for error response
          if (message.type === 'res' && !message.ok) {
            throw new Error(message.error?.message || 'Connection rejected by gateway');
          }
        } catch (e) {
          // JSON parse error - ignore malformed messages
        }
      };

      ws.onerror = () => {
        cleanup();
        setState('error');
        setErrorMessage('WebSocket connection failed. Check if Helix is running.');
      };

      ws.onclose = event => {
        if (state !== 'connected') {
          cleanup();
          setState('error');
          setErrorMessage(
            event.reason || 'Connection closed unexpectedly. Gateway may have rejected the connection.'
          );
        }
      };
    } catch (error) {
      cleanup();
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown connection error');
    }
  }, [data.instanceKey, cleanup, state, updateData]);

  // Auto-start connection attempt when step is shown
  useEffect(() => {
    if (!data.connectionVerified && state === 'idle') {
      attemptConnection();
    }

    return cleanup;
  }, [data.connectionVerified, state, attemptConnection, cleanup]);

  // Start polling when in connecting state
  useEffect(() => {
    if (state === 'connecting' && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(() => {
        // Visual feedback - the actual connection attempt is already running
      }, 1000);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [state]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-display font-bold text-white">Verify Connection</h2>
        <p className="mt-2 text-text-secondary max-w-lg mx-auto">
          Let's make sure your local Helix can connect to this web interface.
        </p>
      </div>

      {/* Connection status card */}
      <div
        className={clsx(
          'rounded-xl border p-8 text-center transition-all',
          state === 'connected'
            ? 'border-success/30 bg-success/10'
            : state === 'error' || state === 'timeout'
              ? 'border-warning/30 bg-warning/10'
              : 'border-white/10 bg-bg-tertiary/50'
        )}
      >
        {/* Status icon */}
        <div className="mb-4">
          {state === 'idle' || state === 'connecting' ? (
            <div className="mx-auto h-20 w-20 rounded-full bg-helix-500/20 border border-helix-500/30 flex items-center justify-center">
              {state === 'connecting' ? (
                <Loader2 className="h-10 w-10 text-helix-400 animate-spin" />
              ) : (
                <Wifi className="h-10 w-10 text-helix-400" />
              )}
            </div>
          ) : state === 'connected' ? (
            <div className="mx-auto h-20 w-20 rounded-full bg-success/20 border border-success/30 flex items-center justify-center">
              <Check className="h-10 w-10 text-success" />
            </div>
          ) : (
            <div className="mx-auto h-20 w-20 rounded-full bg-warning/20 border border-warning/30 flex items-center justify-center">
              <WifiOff className="h-10 w-10 text-warning" />
            </div>
          )}
        </div>

        {/* Status text */}
        <h3 className="text-xl font-medium text-white mb-2">
          {state === 'idle' && 'Ready to Connect'}
          {state === 'connecting' && 'Connecting...'}
          {state === 'connected' && 'Connected!'}
          {state === 'error' && 'Connection Failed'}
          {state === 'timeout' && 'Connection Timeout'}
        </h3>

        <p className="text-text-secondary max-w-sm mx-auto">
          {state === 'idle' && 'Click the button below to verify your connection.'}
          {state === 'connecting' && 'Attempting to connect to your local Helix instance...'}
          {state === 'connected' &&
            'Your local Helix is connected to this web interface. You\'re all set!'}
          {(state === 'error' || state === 'timeout') && (
            <span className="text-warning">{errorMessage}</span>
          )}
        </p>

        {/* Action button */}
        {state !== 'connected' && (
          <button
            onClick={attemptConnection}
            disabled={state === 'connecting'}
            className="btn btn-primary mt-6 mx-auto flex items-center gap-2"
          >
            {state === 'connecting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {state === 'connecting' ? 'Connecting...' : 'Try Again'}
          </button>
        )}

        {/* Attempt counter */}
        {attempts > 1 && state !== 'connected' && (
          <p className="text-xs text-text-tertiary mt-2">Attempt {attempts}</p>
        )}
      </div>

      {/* Troubleshooting section */}
      {(state === 'error' || state === 'timeout' || attempts > 2) && (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="w-full flex items-center justify-between p-4 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <span className="font-medium text-white">Troubleshooting Guide</span>
            </div>
            <ChevronDown
              className={clsx(
                'h-5 w-5 text-text-tertiary transition-transform',
                showTroubleshooting && 'rotate-180'
              )}
            />
          </button>

          {showTroubleshooting && (
            <div className="p-4 border-t border-white/10 space-y-4">
              {TROUBLESHOOTING.map((item, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="font-medium text-white">{item.title}</h4>
                  <ul className="space-y-1 text-sm text-text-secondary pl-4">
                    {item.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start gap-2">
                        <span className="text-text-tertiary">•</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                  {item.command && (
                    <div className="flex items-center gap-2 mt-2">
                      <Terminal className="h-4 w-4 text-text-tertiary" />
                      <code className="px-2 py-1 rounded bg-bg-primary border border-white/10 text-helix-400 text-xs font-mono">
                        {item.command}
                      </code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual skip option */}
      {attempts > 3 && state !== 'connected' && (
        <div className="text-center">
          <button
            onClick={() => updateData({ connectionVerified: true })}
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Skip verification (I'll troubleshoot later)
          </button>
        </div>
      )}
    </div>
  );
}
