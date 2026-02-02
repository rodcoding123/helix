import { useChatStore } from '../../stores/chatStore';
import './TerminalPanel.css';

interface TerminalPanelProps {
  thinking?: string;
  currentToolCall?: {
    id: string;
    name: string;
    input: unknown;
    output?: unknown;
    status: string;
  } | null;
}

export function TerminalPanel({ currentToolCall }: TerminalPanelProps) {
  const { pendingToolCalls } = useChatStore();

  // Combine current tool call with pending ones
  const allToolCalls = [...pendingToolCalls];
  if (currentToolCall && !pendingToolCalls.find(tc => tc.id === currentToolCall.id)) {
    allToolCalls.unshift({
      ...currentToolCall,
      status: currentToolCall.status as 'pending' | 'running' | 'completed' | 'error',
      startTime: Date.now(),
    });
  }

  if (allToolCalls.length === 0) {
    return (
      <div className="terminal-panel-empty">
        <p>Tool executions will appear here as Claude uses them.</p>
      </div>
    );
  }

  return (
    <div className="terminal-panel">
      <div className="terminal-entries">
        {allToolCalls.map((toolCall) => (
          <ToolCallEntry key={toolCall.id} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}

interface ToolCallEntryProps {
  toolCall: {
    id: string;
    name: string;
    input: unknown;
    output?: unknown;
    status: string;
    startTime: number;
    endTime?: number;
  };
}

function ToolCallEntry({ toolCall }: ToolCallEntryProps) {
  const duration = toolCall.endTime
    ? `${((toolCall.endTime - toolCall.startTime) / 1000).toFixed(2)}s`
    : null;

  return (
    <div className={`tool-call-entry ${toolCall.status}`}>
      <header className="tool-call-header">
        <span className="tool-call-name">{toolCall.name}</span>
        <div className="tool-call-meta">
          <span className={`tool-call-status ${toolCall.status}`}>
            {getStatusIcon(toolCall.status)} {toolCall.status}
          </span>
          {duration && <span className="tool-call-duration">{duration}</span>}
        </div>
      </header>

      {toolCall.input !== undefined && toolCall.input !== null && (
        <div className="tool-call-section">
          <span className="tool-call-section-label">Input</span>
          <pre className="tool-call-code">
            {typeof toolCall.input === 'string'
              ? toolCall.input
              : JSON.stringify(toolCall.input, null, 2)}
          </pre>
        </div>
      )}

      {toolCall.output !== undefined && toolCall.output !== null && (
        <div className="tool-call-section">
          <span className="tool-call-section-label">Output</span>
          <pre className="tool-call-code">
            {typeof toolCall.output === 'string'
              ? toolCall.output
              : JSON.stringify(toolCall.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '🔄';
    case 'completed':
      return '✅';
    case 'error':
      return '❌';
    default:
      return '•';
  }
}
