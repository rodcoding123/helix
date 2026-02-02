/**
 * HELIX DIFF TYPES
 * Type definitions for diff visualization
 */

export type DiffLineType = "unchanged" | "added" | "removed" | "context" | "header" | "chunk";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  filePath: string;
  oldPath?: string; // For renames
  status: "added" | "modified" | "deleted" | "renamed";
  chunks: DiffChunk[];
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface DiffStats {
  files: number;
  additions: number;
  deletions: number;
}

export type DiffViewMode = "unified" | "split";

/**
 * Parse unified diff text into structured data
 */
export function parseDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = diffText.split("\n");
  let currentFile: FileDiff | null = null;
  let currentChunk: DiffChunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/file b/file
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        if (currentChunk) {
          currentFile.chunks.push(currentChunk);
        }
        files.push(currentFile);
      }

      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      const oldPath = match?.[1] || "";
      const newPath = match?.[2] || "";

      currentFile = {
        filePath: newPath || oldPath,
        oldPath: oldPath !== newPath ? oldPath : undefined,
        status: "modified",
        chunks: [],
        additions: 0,
        deletions: 0,
      };
      currentChunk = null;
      continue;
    }

    // New file mode
    if (line.startsWith("new file mode")) {
      if (currentFile) {
        currentFile.status = "added";
      }
      continue;
    }

    // Deleted file mode
    if (line.startsWith("deleted file mode")) {
      if (currentFile) {
        currentFile.status = "deleted";
      }
      continue;
    }

    // Rename
    if (line.startsWith("rename from")) {
      if (currentFile) {
        currentFile.status = "renamed";
      }
      continue;
    }

    // Binary file
    if (line.startsWith("Binary files")) {
      if (currentFile) {
        currentFile.binary = true;
      }
      continue;
    }

    // Chunk header: @@ -start,count +start,count @@
    const chunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (chunkMatch) {
      if (currentFile && currentChunk) {
        currentFile.chunks.push(currentChunk);
      }

      oldLineNum = parseInt(chunkMatch[1], 10);
      newLineNum = parseInt(chunkMatch[3], 10);

      currentChunk = {
        oldStart: oldLineNum,
        oldLines: parseInt(chunkMatch[2] || "1", 10),
        newStart: newLineNum,
        newLines: parseInt(chunkMatch[4] || "1", 10),
        lines: [
          {
            type: "header",
            content: line,
            oldLineNumber: null,
            newLineNumber: null,
          },
        ],
      };
      continue;
    }

    // Skip other headers
    if (
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("index ") ||
      line.startsWith("similarity")
    ) {
      continue;
    }

    // Diff content
    if (currentChunk) {
      if (line.startsWith("+")) {
        currentChunk.lines.push({
          type: "added",
          content: line.substring(1),
          oldLineNumber: null,
          newLineNumber: newLineNum++,
        });
        if (currentFile) currentFile.additions++;
      } else if (line.startsWith("-")) {
        currentChunk.lines.push({
          type: "removed",
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
        });
        if (currentFile) currentFile.deletions++;
      } else if (line.startsWith(" ") || line === "") {
        currentChunk.lines.push({
          type: "unchanged",
          content: line.substring(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    }
  }

  // Push last file/chunk
  if (currentFile) {
    if (currentChunk) {
      currentFile.chunks.push(currentChunk);
    }
    files.push(currentFile);
  }

  return files;
}

/**
 * Generate diff from old and new content
 */
export function generateDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff algorithm
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;

  for (const [oldPos, newPos] of lcs) {
    // Add removed lines
    while (oldIdx < oldPos) {
      result.push({
        type: "removed",
        content: oldLines[oldIdx],
        oldLineNumber: oldIdx + 1,
        newLineNumber: null,
      });
      oldIdx++;
    }

    // Add added lines
    while (newIdx < newPos) {
      result.push({
        type: "added",
        content: newLines[newIdx],
        oldLineNumber: null,
        newLineNumber: newIdx + 1,
      });
      newIdx++;
    }

    // Add unchanged line
    result.push({
      type: "unchanged",
      content: oldLines[oldIdx],
      oldLineNumber: oldIdx + 1,
      newLineNumber: newIdx + 1,
    });
    oldIdx++;
    newIdx++;
  }

  // Remaining removed lines
  while (oldIdx < oldLines.length) {
    result.push({
      type: "removed",
      content: oldLines[oldIdx],
      oldLineNumber: oldIdx + 1,
      newLineNumber: null,
    });
    oldIdx++;
  }

  // Remaining added lines
  while (newIdx < newLines.length) {
    result.push({
      type: "added",
      content: newLines[newIdx],
      oldLineNumber: null,
      newLineNumber: newIdx + 1,
    });
    newIdx++;
  }

  return result;
}

/**
 * Compute Longest Common Subsequence indices
 */
function computeLCS(oldLines: string[], newLines: string[]): [number, number][] {
  const m = oldLines.length;
  const n = newLines.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const result: [number, number][] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Calculate diff statistics
 */
export function calculateStats(files: FileDiff[]): DiffStats {
  return files.reduce(
    (stats, file) => ({
      files: stats.files + 1,
      additions: stats.additions + file.additions,
      deletions: stats.deletions + file.deletions,
    }),
    { files: 0, additions: 0, deletions: 0 }
  );
}
