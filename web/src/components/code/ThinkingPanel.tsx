import { useEffect, useRef } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingPanelProps {
  thinking: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function ThinkingPanel({
  thinking,
  isExpanded = true,
  onToggle,
  className,
}: ThinkingPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom as new content comes in
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking, isExpanded]);

  const lines = thinking.split('\n');
  const hasContent = thinking.trim().length > 0;

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
          <Brain className="h-4 w-4 text-helix-400" />
          <span className="text-sm font-medium text-slate-200">Thinking</span>
          {hasContent && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-helix-500/20 text-helix-400">
              {lines.length} lines
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
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
          style={{ maxHeight: '300px' }}
        >
          {hasContent ? (
            <div className="space-y-1">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    'text-slate-300',
                    line.startsWith('##') && 'text-helix-400 font-semibold mt-2',
                    line.startsWith('-') && 'text-slate-400 pl-4',
                    line.startsWith('*') && 'text-amber-400'
                  )}
                >
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-slate-500">
              <p>Waiting for Helix to think...</p>
            </div>
          )}
        </div>
      )}

      {/* Streaming indicator */}
      {hasContent && !thinking.endsWith('\n\n') && (
        <div className="px-4 py-2 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-helix-400 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-helix-400 animate-pulse delay-100" />
              <span className="h-1.5 w-1.5 rounded-full bg-helix-400 animate-pulse delay-200" />
            </div>
            <span className="text-xs text-slate-500">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
