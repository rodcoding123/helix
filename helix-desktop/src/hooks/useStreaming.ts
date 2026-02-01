import { useCallback, useRef } from 'react';
import { useChatStore, type ToolCall } from '../stores/chatStore';

export interface GatewayMessage {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'complete' | 'stream';
  content?: string;
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: string;
}

interface StreamingState {
  isComplete: boolean;
  currentContent: string;
  thinking: string;
  currentToolCall: ToolCall | null;
  error: string | null;
}

/**
 * Hook to process streaming messages from the gateway
 * and update the chat store accordingly
 */
export function useStreaming() {
  const {
    addMessage,
    updateMessage,
    setStreaming,
    setThinking,
    addToolCall,
    updateToolCall,
    clearToolCalls,
    currentThinking,
    pendingToolCalls,
    isStreaming,
  } = useChatStore();

  const currentMessageIdRef = useRef<string | null>(null);
  const contentBufferRef = useRef<string>('');

  const reset = useCallback(() => {
    currentMessageIdRef.current = null;
    contentBufferRef.current = '';
    clearToolCalls();
    setStreaming(false);
  }, [clearToolCalls, setStreaming]);

  const processMessage = useCallback(
    (message: GatewayMessage) => {
      switch (message.type) {
        case 'thinking':
          setStreaming(true);
          setThinking(message.content || '');
          break;

        case 'stream':
          // Streaming content chunks
          contentBufferRef.current += message.content || '';

          if (!currentMessageIdRef.current) {
            // Create new message
            addMessage({
              role: 'assistant',
              content: contentBufferRef.current,
            });
            // Note: We'd need to get the message ID from the store after creation
            // For now, we'll update based on the last message
          } else {
            updateMessage(currentMessageIdRef.current, {
              content: contentBufferRef.current,
            });
          }
          break;

        case 'message':
          // Complete message
          setStreaming(false);
          if (message.content) {
            if (currentMessageIdRef.current) {
              updateMessage(currentMessageIdRef.current, {
                content: message.content,
                thinking: currentThinking || undefined,
              });
            } else {
              addMessage({
                role: 'assistant',
                content: message.content,
                thinking: currentThinking || undefined,
              });
            }
          }
          break;

        case 'tool_call':
          if (message.toolName && message.toolCallId) {
            addToolCall({
              id: message.toolCallId,
              name: message.toolName,
              input: message.toolInput,
            });
            updateToolCall(message.toolCallId, { status: 'running' });
          }
          break;

        case 'tool_result':
          if (message.toolCallId) {
            updateToolCall(message.toolCallId, {
              status: 'completed',
              output: message.toolOutput,
              endTime: Date.now(),
            });
          }
          break;

        case 'error':
          setStreaming(false);
          if (message.toolCallId) {
            updateToolCall(message.toolCallId, {
              status: 'error',
              output: message.error,
              endTime: Date.now(),
            });
          }
          break;

        case 'complete':
          setStreaming(false);
          setThinking('');
          break;
      }
    },
    [addMessage, updateMessage, setStreaming, setThinking, addToolCall, updateToolCall, currentThinking]
  );

  const processMessages = useCallback(
    (messages: GatewayMessage[]) => {
      messages.forEach(processMessage);
    },
    [processMessage]
  );

  const state: StreamingState = {
    isComplete: !isStreaming,
    currentContent: contentBufferRef.current,
    thinking: currentThinking,
    currentToolCall: pendingToolCalls.find((tc) => tc.status === 'running') || null,
    error: null,
  };

  return {
    state,
    isStreaming,
    thinking: currentThinking,
    currentToolCall: state.currentToolCall,
    isComplete: !isStreaming,
    processMessage,
    processMessages,
    reset,
  };
}
