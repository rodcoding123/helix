import './DiffPanel.css';

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'context';
  lineNumber: {
    old?: number;
    new?: number;
  };
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  filePath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

interface DiffPanelProps {
  diff: FileDiff | null;
  onAccept?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export function DiffPanel({ diff, onAccept, onReject, showActions = true }: DiffPanelProps) {
  if (!diff) {
    return (
      <div className="diff-panel-empty">
        <p>No changes to display</p>
      </div>
    );
  }

  return (
    <div className="diff-panel">
      <div className="diff-header">
        <div className="diff-file-path">{diff.filePath}</div>
        <div className="diff-stats">
          <span className="diff-additions">+{diff.additions}</span>
          <span className="diff-deletions">-{diff.deletions}</span>
        </div>
      </div>

      <div className="diff-content">
        {diff.hunks.map((hunk, hunkIndex) => (
          <div key={hunkIndex} className="diff-hunk">
            <div className="diff-hunk-header">
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>

            <div className="diff-lines">
              {hunk.lines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={`diff-line diff-line-${line.type}`}
                >
                  <div className="diff-line-numbers">
                    <span className="diff-line-number old">
                      {line.lineNumber.old ?? ''}
                    </span>
                    <span className="diff-line-number new">
                      {line.lineNumber.new ?? ''}
                    </span>
                  </div>
                  <div className="diff-line-marker">
                    {line.type === 'added' && '+'}
                    {line.type === 'removed' && '-'}
                    {line.type === 'unchanged' && ' '}
                    {line.type === 'context' && ' '}
                  </div>
                  <pre className="diff-line-content">{line.content}</pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showActions && (onAccept || onReject) && (
        <div className="diff-actions">
          {onReject && (
            <button className="diff-button reject" onClick={onReject}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Reject
            </button>
          )}
          {onAccept && (
            <button className="diff-button accept" onClick={onAccept}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Accept
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Parse a unified diff string into structured data
 */
export function parseDiff(diffString: string): FileDiff | null {
  const lines = diffString.split('\n');
  let filePath = '';
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let additions = 0;
  let deletions = 0;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // File path
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      if (line.startsWith('+++ ')) {
        filePath = line.slice(4).replace(/^b\//, '');
      }
      continue;
    }

    // Hunk header
    const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      oldLineNum = parseInt(hunkMatch[1], 10);
      newLineNum = parseInt(hunkMatch[3], 10);

      currentHunk = {
        oldStart: oldLineNum,
        oldLines: parseInt(hunkMatch[2] || '1', 10),
        newStart: newLineNum,
        newLines: parseInt(hunkMatch[4] || '1', 10),
        lines: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    // Diff lines
    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'added',
        lineNumber: { new: newLineNum++ },
        content: line.slice(1),
      });
      additions++;
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'removed',
        lineNumber: { old: oldLineNum++ },
        content: line.slice(1),
      });
      deletions++;
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({
        type: 'unchanged',
        lineNumber: { old: oldLineNum++, new: newLineNum++ },
        content: line.slice(1),
      });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  if (!filePath && hunks.length === 0) {
    return null;
  }

  return {
    filePath,
    hunks,
    additions,
    deletions,
  };
}
