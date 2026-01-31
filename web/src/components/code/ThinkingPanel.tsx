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
        'flex flex-col rounded-xl border border-white/10 bg-bg-secondary/80 backdrop-blur-sm',
        'hover:border-helix-500/30 transition-colors',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-helix-500/10 border border-helix-500/20">
            <Brain className="h-3.5 w-3.5 text-helix-400" />
          </div>
          <span className="text-sm font-display font-medium text-white">Thinking</span>
          {hasContent && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-helix-500/20 text-helix-400 font-mono">
              {lines.length} lines
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
          className="flex-1 overflow-y-auto p-4 font-mono text-sm"
          style={{ maxHeight: '300px' }}
        >
          {hasContent ? (
            <div className="space-y-1">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    'text-text-secondary',
                    line.startsWith('##') && 'text-helix-400 font-semibold mt-3',
                    line.startsWith('-') && 'text-text-tertiary pl-4',
                    line.startsWith('*') && 'text-warning'
                  )}
                >
                  {line || '\u00A0'}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-text-tertiary">
              <p>Waiting for Helix to think...</p>
            </div>
          )}
        </div>
      )}

      {/* Streaming indicator */}
      {hasContent && !thinking.endsWith('\n\n') && (
        <div className="px-4 py-2.5 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-helix-400 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-helix-400 animate-pulse [animation-delay:100ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-helix-400 animate-pulse [animation-delay:200ms]" />
            </div>
            <span className="text-xs text-text-tertiary">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
