import { useRef, useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { ThinkingPanel } from './ThinkingPanel';
import { TerminalPanel } from './TerminalPanel';
import './PanelContainer.css';

interface PanelContainerProps {
  thinking?: string;
  currentToolCall?: {
    id: string;
    name: string;
    input: unknown;
    output?: unknown;
    status: string;
  } | null;
}

const PANEL_COMPONENTS: Record<string, React.ComponentType<{ thinking?: string; currentToolCall?: PanelContainerProps['currentToolCall'] }>> = {
  thinking: ThinkingPanel,
  terminal: TerminalPanel,
};

export function PanelContainer({ thinking, currentToolCall }: PanelContainerProps) {
  const { activePanel, panelWidth, setActivePanel, setPanelWidth } = useUiStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;

    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - moveEvent.clientX;
      setPanelWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth, setPanelWidth]);

  if (!activePanel) {
    return null;
  }

  const PanelComponent = PANEL_COMPONENTS[activePanel];
  if (!PanelComponent) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="panel-container"
      style={{ width: panelWidth }}
    >
      <div className="panel-resize-handle" onMouseDown={handleMouseDown} />

      <header className="panel-header">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${activePanel === 'thinking' ? 'active' : ''}`}
            onClick={() => setActivePanel('thinking')}
          >
            Thinking
          </button>
          <button
            className={`panel-tab ${activePanel === 'terminal' ? 'active' : ''}`}
            onClick={() => setActivePanel('terminal')}
          >
            Terminal
          </button>
        </div>

        <button
          className="panel-close-button"
          onClick={() => setActivePanel(null)}
          aria-label="Close panel"
        >
          ×
        </button>
      </header>

      <div className="panel-content">
        <PanelComponent thinking={thinking} currentToolCall={currentToolCall} />
      </div>
    </div>
  );
}

// Panel toggle button for use in chat interface
export function PanelToggleButton() {
  const { activePanel, togglePanel } = useUiStore();

  return (
    <div className="panel-toggle-buttons">
      <button
        className={`panel-toggle-button ${activePanel === 'thinking' ? 'active' : ''}`}
        onClick={() => togglePanel('thinking')}
        title="Toggle Thinking Panel"
      >
        💭
      </button>
      <button
        className={`panel-toggle-button ${activePanel === 'terminal' ? 'active' : ''}`}
        onClick={() => togglePanel('terminal')}
        title="Toggle Terminal Panel"
      >
        💻
      </button>
    </div>
  );
}
