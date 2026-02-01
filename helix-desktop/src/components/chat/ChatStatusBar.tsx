/**
 * Chat Status Bar - Activity status, thinking level, usage display
 */

import { useEffect, useState } from 'react';
import './ChatStatusBar.css';

export type ActivityStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'sending'
  | 'waiting'
  | 'streaming'
  | 'thinking'
  | 'tool_use'
  | 'error'
  | 'aborted';

interface ChatStatusBarProps {
  status: ActivityStatus;
  thinkingLevel: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  tokensInput?: number;
  tokensOutput?: number;
  modelName?: string;
  onThinkingChange?: (level: string) => void;
  onStatusClick?: () => void;
  startTime?: number;
  toolName?: string;
}

const THINKING_LABELS: Record<string, string> = {
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Max',
};

const STATUS_LABELS: Record<ActivityStatus, string> = {
  idle: 'Ready',
  connecting: 'Connecting...',
  connected: 'Connected',
  disconnected: 'Disconnected',
  sending: 'Sending...',
  waiting: 'Waiting...',
  streaming: 'Streaming...',
  thinking: 'Thinking...',
  tool_use: 'Using tool...',
  error: 'Error',
  aborted: 'Aborted',
};

const WAITING_MESSAGES = [
  'Pondering...',
  'Considering...',
  'Thinking deeply...',
  'Processing...',
  'Formulating...',
  'Analyzing...',
];

function getRandomWaitingMessage(): string {
  return WAITING_MESSAGES[Math.floor(Math.random() * WAITING_MESSAGES.length)];
}

function formatElapsed(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m ${secs}s`;
}

export function ChatStatusBar({
  status,
  thinkingLevel,
  tokensInput,
  tokensOutput,
  modelName,
  onThinkingChange,
  onStatusClick,
  startTime,
  toolName,
}: ChatStatusBarProps) {
  const [elapsedDisplay, setElapsedDisplay] = useState('');
  const [waitingMessage, setWaitingMessage] = useState(getRandomWaitingMessage());

  // Update elapsed time
  useEffect(() => {
    if (!startTime || status === 'idle' || status === 'connected' || status === 'disconnected') {
      setElapsedDisplay('');
      return;
    }

    const interval = setInterval(() => {
      setElapsedDisplay(formatElapsed(startTime));
    }, 1000);

    setElapsedDisplay(formatElapsed(startTime));
    return () => clearInterval(interval);
  }, [startTime, status]);

  // Change waiting message periodically
  useEffect(() => {
    if (status !== 'waiting') return;

    const interval = setInterval(() => {
      setWaitingMessage(getRandomWaitingMessage());
    }, 3000);

    return () => clearInterval(interval);
  }, [status]);

  const isBusy = ['sending', 'waiting', 'streaming', 'thinking', 'tool_use'].includes(status);

  const getStatusText = (): string => {
    if (status === 'waiting') return waitingMessage;
    if (status === 'tool_use' && toolName) return `Using ${toolName}...`;
    return STATUS_LABELS[status];
  };

  return (
    <div className={`chat-status-bar ${isBusy ? 'busy' : ''}`}>
      <div className="status-left">
        <button
          className={`activity-status ${status}`}
          onClick={onStatusClick}
        >
          {isBusy && <span className="activity-spinner" />}
          <span className="activity-text">{getStatusText()}</span>
          {elapsedDisplay && <span className="activity-elapsed">{elapsedDisplay}</span>}
        </button>
      </div>

      <div className="status-center">
        {modelName && (
          <span className="model-name">{modelName}</span>
        )}
      </div>

      <div className="status-right">
        <div className="thinking-selector">
          <span className="selector-label">Thinking:</span>
          <select
            value={thinkingLevel}
            onChange={(e) => onThinkingChange?.(e.target.value)}
            className="thinking-select"
          >
            {Object.entries(THINKING_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {(tokensInput !== undefined || tokensOutput !== undefined) && (
          <div className="token-usage">
            <span className="token-icon">📊</span>
            <span className="token-count">
              {tokensInput !== undefined && <span className="tokens-in">{tokensInput}</span>}
              {tokensInput !== undefined && tokensOutput !== undefined && ' / '}
              {tokensOutput !== undefined && <span className="tokens-out">{tokensOutput}</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
