// Stream parser for handling Claude's streaming output

export interface ParsedChunk {
  type: 'thinking' | 'text' | 'tool_use' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface StreamState {
  thinking: string;
  messages: string[];
  currentToolCall: {
    name: string;
    input: Record<string, unknown>;
    output?: string;
  } | null;
  isComplete: boolean;
}

export function createStreamState(): StreamState {
  return {
    thinking: '',
    messages: [],
    currentToolCall: null,
    isComplete: false,
  };
}

export function parseStreamChunk(chunk: string, state: StreamState): StreamState {
  const newState = { ...state };

  try {
    const data = JSON.parse(chunk);

    switch (data.type) {
      case 'thinking':
        newState.thinking += data.content || '';
        break;

      case 'text':
        if (newState.messages.length === 0) {
          newState.messages.push(data.content || '');
        } else {
          newState.messages[newState.messages.length - 1] += data.content || '';
        }
        break;

      case 'tool_use':
        newState.currentToolCall = {
          name: data.name,
          input: data.input || {},
        };
        break;

      case 'tool_result':
        if (newState.currentToolCall) {
          newState.currentToolCall.output = data.content;
        }
        break;

      case 'complete':
        newState.isComplete = true;
        break;
    }
  } catch {
    // If not JSON, treat as raw text
    newState.thinking += chunk;
  }

  return newState;
}

export function formatDiff(oldContent: string, newContent: string): string[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      diff.push(`+ ${newLines[j]}`);
      j++;
    } else if (j >= newLines.length) {
      diff.push(`- ${oldLines[i]}`);
      i++;
    } else if (oldLines[i] === newLines[j]) {
      diff.push(`  ${oldLines[i]}`);
      i++;
      j++;
    } else {
      diff.push(`- ${oldLines[i]}`);
      diff.push(`+ ${newLines[j]}`);
      i++;
      j++;
    }
  }

  return diff;
}
