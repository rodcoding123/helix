import './ThinkingPanel.css';

interface ThinkingPanelProps {
  thinking?: string;
  currentToolCall?: {
    id: string;
    name: string;
    input: unknown;
    output?: unknown;
    status: string;
  } | null;
}

export function ThinkingPanel({ thinking }: ThinkingPanelProps) {
  if (!thinking) {
    return (
      <div className="thinking-panel-empty">
        <p>Claude's thinking process will appear here during responses.</p>
      </div>
    );
  }

  return (
    <div className="thinking-panel">
      <div className="thinking-content">
        <div className="thinking-indicator">
          <div className="thinking-dot" />
          <span>Thinking...</span>
        </div>

        <pre className="thinking-text">{thinking}</pre>
      </div>
    </div>
  );
}
