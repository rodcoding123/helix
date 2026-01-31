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
        type === 'added' && 'bg-emerald-500/10',
        type === 'removed' && 'bg-rose-500/10'
      )}
    >
      <span className="w-10 flex-shrink-0 px-2 py-0.5 text-right text-slate-600 border-r border-slate-700 select-none">
        {lineNumber}
      </span>
      <span className="w-6 flex-shrink-0 px-1.5 py-0.5 text-center border-r border-slate-700">
        {type === 'added' && <Plus className="h-3 w-3 text-emerald-400 inline" />}
        {type === 'removed' && <Minus className="h-3 w-3 text-rose-400 inline" />}
      </span>
      <span
        className={cn(
          'flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto',
          type === 'added' && 'text-emerald-300',
          type === 'removed' && 'text-rose-300',
          type === 'unchanged' && 'text-slate-400'
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
          <FileCode className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-200">Diff</span>
          {fileName && <span className="text-xs text-slate-500 font-mono">{fileName}</span>}
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-emerald-400">+{stats.added}</span>
              <span className="text-rose-400">-{stats.removed}</span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
          {hasChanges ? (
            <div className="divide-y divide-slate-800">
              {diffLines.map((line, index) => (
                <DiffLine key={index} line={line} lineNumber={index + 1} />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-slate-500">
              <p>No changes to display</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
