import { useEffect, useRef } from 'react';
import { Terminal, ChevronDown, ChevronUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status?: 'pending' | 'running' | 'success' | 'error';
}

interface TerminalPanelProps {
  toolCalls: ToolCall[];
  currentToolCall: ToolCall | null;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

function ToolCallItem({ tool, isCurrent }: { tool: ToolCall; isCurrent: boolean }) {
  const status = tool.status || (tool.output ? 'success' : isCurrent ? 'running' : 'pending');

  const statusIcon = {
    pending: <Clock className="h-3.5 w-3.5 text-text-tertiary" />,
    running: <Clock className="h-3.5 w-3.5 text-warning animate-spin" />,
    success: <CheckCircle className="h-3.5 w-3.5 text-success" />,
    error: <XCircle className="h-3.5 w-3.5 text-danger" />,
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-all',
        isCurrent
          ? 'border-warning/50 bg-warning/10'
          : 'border-white/5 bg-bg-tertiary/50 hover:border-white/10'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcon[status]}
          <span className="font-mono text-sm text-white">{tool.name}</span>
        </div>
        <span className="text-xs text-text-tertiary font-mono">
          {status === 'running' ? 'Running...' : status}
        </span>
      </div>

      {/* Input preview */}
      {Object.keys(tool.input).length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-text-tertiary mb-1.5">Input:</p>
          <pre className="text-xs text-text-secondary bg-void rounded-lg p-2.5 overflow-x-auto font-mono border border-white/5">
            {JSON.stringify(tool.input, null, 2).slice(0, 500)}
            {JSON.stringify(tool.input, null, 2).length > 500 && '...'}
          </pre>
        </div>
      )}

      {/* Output preview */}
      {tool.output && (
        <div>
          <p className="text-xs text-text-tertiary mb-1.5">Output:</p>
          <pre className="text-xs text-text-secondary bg-void rounded-lg p-2.5 overflow-x-auto max-h-32 font-mono border border-white/5">
            {tool.output.slice(0, 1000)}
            {tool.output.length > 1000 && '...'}
          </pre>
        </div>
      )}
    </div>
  );
}

export function TerminalPanel({
  toolCalls,
  currentToolCall,
  isExpanded = true,
  onToggle,
  className,
}: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new tool calls come in
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [toolCalls, currentToolCall, isExpanded]);

  const allToolCalls = currentToolCall ? [...toolCalls, currentToolCall] : toolCalls;

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-white/10 bg-bg-secondary/80 backdrop-blur-sm',
        'hover:border-success/30 transition-colors',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-success/10 border border-success/20">
            <Terminal className="h-3.5 w-3.5 text-success" />
          </div>
          <span className="text-sm font-display font-medium text-white">Terminal</span>
          {allToolCalls.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-success/20 text-success font-mono">
              {allToolCalls.length} calls
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ maxHeight: '400px' }}
        >
          {allToolCalls.length > 0 ? (
            allToolCalls.map((tool, index) => (
              <ToolCallItem
                key={index}
                tool={tool}
                isCurrent={currentToolCall !== null && index === allToolCalls.length - 1}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-24 text-text-tertiary">
              <p>No tool calls yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
