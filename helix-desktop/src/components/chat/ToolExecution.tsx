/**
 * Tool Execution - Display tool calls and results
 */

import { useState } from 'react';
import './ToolExecution.css';

export interface ToolExecutionData {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  error?: string;
}

interface ToolExecutionProps {
  tool: ToolExecutionData;
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✍️',
  Edit: '✏️',
  Bash: '💻',
  Glob: '🔍',
  Grep: '🔎',
  Task: '🤖',
  WebFetch: '🌐',
  WebSearch: '🔍',
  TodoWrite: '📋',
  AskUserQuestion: '❓',
  mcp__memory__: '🧠',
  mcp__playwright__: '🎭',
  default: '🔧',
};

function getToolIcon(name: string): string {
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (name.startsWith(key) || name.includes(key)) {
      return icon;
    }
  }
  return TOOL_ICONS.default;
}

function formatInput(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function formatOutput(output: unknown): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output;
  try {
    const str = JSON.stringify(output, null, 2);
    // Truncate very long outputs
    if (str.length > 2000) {
      return str.slice(0, 2000) + '\n... (truncated)';
    }
    return str;
  } catch {
    return String(output);
  }
}

function formatDuration(startTime: number, endTime?: number): string {
  const duration = (endTime || Date.now()) - startTime;
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
}

export function ToolExecution({ tool }: ToolExecutionProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = getToolIcon(tool.name);
  const inputStr = formatInput(tool.input);
  const outputStr = formatOutput(tool.output);
  const duration = formatDuration(tool.startTime, tool.endTime);

  // Get summary for collapsed view
  const getSummary = (): string => {
    if (tool.name === 'Read' && typeof tool.input === 'object' && tool.input !== null) {
      const inp = tool.input as { file_path?: string };
      if (inp.file_path) {
        const parts = inp.file_path.split(/[/\\]/);
        return parts[parts.length - 1] || inp.file_path;
      }
    }
    if (tool.name === 'Bash' && typeof tool.input === 'object' && tool.input !== null) {
      const inp = tool.input as { command?: string };
      if (inp.command) {
        return inp.command.slice(0, 50) + (inp.command.length > 50 ? '...' : '');
      }
    }
    if (tool.name === 'Glob' && typeof tool.input === 'object' && tool.input !== null) {
      const inp = tool.input as { pattern?: string };
      if (inp.pattern) return inp.pattern;
    }
    if (tool.name === 'Grep' && typeof tool.input === 'object' && tool.input !== null) {
      const inp = tool.input as { pattern?: string };
      if (inp.pattern) return `"${inp.pattern}"`;
    }
    return '';
  };

  const summary = getSummary();

  return (
    <div className={`tool-execution ${tool.status}`}>
      <button
        className="tool-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="tool-icon">{icon}</span>
        <span className="tool-name">{tool.name}</span>
        {summary && <span className="tool-summary">{summary}</span>}
        <span className="tool-status-indicator">
          {tool.status === 'pending' && <span className="status-dot pending" />}
          {tool.status === 'running' && <span className="spinner-mini" />}
          {tool.status === 'completed' && <span className="status-icon success">✓</span>}
          {tool.status === 'error' && <span className="status-icon error">✕</span>}
        </span>
        <span className="tool-duration">{duration}</span>
        <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M7 10l5 5 5-5z" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="tool-details">
          {inputStr && (
            <div className="tool-section">
              <span className="section-label">Input</span>
              <pre className="tool-content">{inputStr}</pre>
            </div>
          )}
          {tool.error && (
            <div className="tool-section error">
              <span className="section-label">Error</span>
              <pre className="tool-content">{tool.error}</pre>
            </div>
          )}
          {outputStr && !tool.error && (
            <div className="tool-section">
              <span className="section-label">Output</span>
              <pre className="tool-content">{outputStr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
