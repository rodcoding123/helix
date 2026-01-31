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
    pending: <Clock className="h-3.5 w-3.5 text-slate-500" />,
    running: <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" />,
    success: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
    error: <XCircle className="h-3.5 w-3.5 text-rose-400" />,
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all',
        isCurrent ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 bg-slate-800/50'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcon[status]}
          <span className="font-mono text-sm text-slate-200">{tool.name}</span>
        </div>
        <span className="text-xs text-slate-500">
          {status === 'running' ? 'Running...' : status}
        </span>
      </div>

      {/* Input preview */}
      {Object.keys(tool.input).length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-slate-500 mb-1">Input:</p>
          <pre className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 overflow-x-auto">
            {JSON.stringify(tool.input, null, 2).slice(0, 500)}
            {JSON.stringify(tool.input, null, 2).length > 500 && '...'}
          </pre>
        </div>
      )}

      {/* Output preview */}
      {tool.output && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Output:</p>
          <pre className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 overflow-x-auto max-h-32">
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
        'flex flex-col rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-2 border-b border-slate-700 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-200">Terminal</span>
          {allToolCalls.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
              {allToolCalls.length} calls
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
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
            <div className="flex items-center justify-center h-24 text-slate-500">
              <p>No tool calls yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
