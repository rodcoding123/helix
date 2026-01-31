import { useMemo } from 'react';
import { FileCode, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDiff } from '@/lib/stream-parser';

interface DiffPanelProps {
  oldContent?: string;
  newContent?: string;
  diffLines?: string[];
  fileName?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

function DiffLine({ line, lineNumber }: { line: string; lineNumber: number }) {
  const type = line.startsWith('+') ? 'added' : line.startsWith('-') ? 'removed' : 'unchanged';

  return (
    <div
      className={cn(
        'flex font-mono text-xs',
        type === 'added' && 'bg-success/10',
        type === 'removed' && 'bg-danger/10'
      )}
    >
      <span className="w-10 flex-shrink-0 px-2 py-0.5 text-right text-text-tertiary border-r border-white/5 select-none">
        {lineNumber}
      </span>
      <span className="w-6 flex-shrink-0 px-1.5 py-0.5 text-center border-r border-white/5">
        {type === 'added' && <Plus className="h-3 w-3 text-success inline" />}
        {type === 'removed' && <Minus className="h-3 w-3 text-danger inline" />}
      </span>
      <span
        className={cn(
          'flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto',
          type === 'added' && 'text-success',
          type === 'removed' && 'text-danger',
          type === 'unchanged' && 'text-text-secondary'
        )}
      >
        {line.slice(2)}
      </span>
    </div>
  );
}

export function DiffPanel({
  oldContent,
  newContent,
  diffLines: providedDiffLines,
  fileName = 'file',
  isExpanded = true,
  onToggle,
  className,
}: DiffPanelProps) {
  const diffLines = useMemo(() => {
    if (providedDiffLines) return providedDiffLines;
    if (oldContent !== undefined && newContent !== undefined) {
      return formatDiff(oldContent, newContent);
    }
    return [];
  }, [oldContent, newContent, providedDiffLines]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffLines.forEach(line => {
      if (line.startsWith('+')) added++;
      else if (line.startsWith('-')) removed++;
    });
    return { added, removed };
  }, [diffLines]);

  const hasChanges = diffLines.length > 0;

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-white/10 bg-bg-secondary/80 backdrop-blur-sm',
        'hover:border-warning/30 transition-colors',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-warning/10 border border-warning/20">
            <FileCode className="h-3.5 w-3.5 text-warning" />
          </div>
          <span className="text-sm font-display font-medium text-white">Diff</span>
          {fileName && (
            <span className="text-xs text-text-tertiary font-mono px-2 py-0.5 rounded-md bg-bg-tertiary/50">
              {fileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-success">+{stats.added}</span>
              <span className="text-danger">-{stats.removed}</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-tertiary" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
          {hasChanges ? (
            <div className="divide-y divide-white/5">
              {diffLines.map((line, index) => (
                <DiffLine key={index} line={line} lineNumber={index + 1} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-text-tertiary">
              <p>No changes to display</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
