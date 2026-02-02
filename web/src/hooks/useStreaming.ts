import { useState, useCallback, useMemo } from 'react';
import { createStreamState, StreamState } from '@/lib/stream-parser';
import type { GatewayMessage } from '@/lib/gateway-connection';

interface UseStreamingReturn {
  state: StreamState;
  thinking: string;
  messages: string[];
  currentToolCall: StreamState['currentToolCall'];
  isComplete: boolean;
  processMessage: (message: GatewayMessage) => void;
  reset: () => void;
}

export function useStreaming(): UseStreamingReturn {
  const [state, setState] = useState<StreamState>(createStreamState);

  const processMessage = useCallback((message: GatewayMessage) => {
    setState(prev => {
      const newState = { ...prev };

      switch (message.type) {
        case 'thinking':
          newState.thinking += message.content || '';
          break;

        case 'tool_call':
          newState.currentToolCall = {
            name: message.toolName || 'unknown',
            input: message.toolInput || {},
          };
          break;

        case 'tool_result':
          if (newState.currentToolCall) {
            newState.currentToolCall.output = message.toolOutput;
          }
          break;

        case 'complete':
          newState.isComplete = true;
          break;

        case 'error':
          // Add error as a message
          newState.messages.push(`Error: ${message.error || 'Unknown error'}`);
          break;

        case 'heartbeat':
          // Ignore heartbeats
          break;

        default:
          // For any other content, add to messages
          if (message.content) {
            if (newState.messages.length === 0) {
              newState.messages.push(message.content);
            } else {
              newState.messages[newState.messages.length - 1] += message.content;
            }
          }
      }

      return newState;
    });
  }, []);

  const reset = useCallback(() => {
    setState(createStreamState());
  }, []);

  const thinking = useMemo(() => state.thinking, [state.thinking]);
  const messages = useMemo(() => state.messages, [state.messages]);
  const currentToolCall = useMemo(() => state.currentToolCall, [state.currentToolCall]);
  const isComplete = useMemo(() => state.isComplete, [state.isComplete]);

  return {
    state,
    thinking,
    messages,
    currentToolCall,
    isComplete,
    processMessage,
    reset,
  };
}
