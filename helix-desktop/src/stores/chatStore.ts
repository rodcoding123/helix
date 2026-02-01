import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thinking?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  // Current session
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;

  // Streaming state
  isStreaming: boolean;
  currentThinking: string;
  pendingToolCalls: ToolCall[];

  // Actions
  createSession: (name?: string) => string;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;

  // Message actions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  clearMessages: () => void;

  // Streaming actions
  setStreaming: (isStreaming: boolean) => void;
  setThinking: (thinking: string) => void;
  addToolCall: (toolCall: Omit<ToolCall, 'status' | 'startTime'>) => void;
  updateToolCall: (toolCallId: string, updates: Partial<ToolCall>) => void;
  clearToolCalls: () => void;

  // Selectors
  getCurrentSession: () => ChatSession | null;
  getSessionList: () => { id: string; name: string; updatedAt: number }[];
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      currentSessionId: null,
      sessions: {},
      isStreaming: false,
      currentThinking: '',
      pendingToolCalls: [],

      createSession: (name?: string) => {
        const id = generateId();
        const session: ChatSession = {
          id,
          name: name || `Chat ${Object.keys(get().sessions).length + 1}`,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          currentSessionId: id,
        }));

        return id;
      },

      selectSession: (sessionId) => {
        if (get().sessions[sessionId]) {
          set({ currentSessionId: sessionId });
        }
      },

      deleteSession: (sessionId) => {
        const { [sessionId]: _deleted, ...rest } = get().sessions;
        const remainingSessions = Object.keys(rest);

        set({
          sessions: rest,
          currentSessionId:
            get().currentSessionId === sessionId
              ? remainingSessions[0] || null
              : get().currentSessionId,
        });
      },

      renameSession: (sessionId, name) => {
        const session = get().sessions[sessionId];
        if (session) {
          set((state) => ({
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, name, updatedAt: Date.now() },
            },
          }));
        }
      },

      addMessage: (message) => {
        const sessionId = get().currentSessionId;
        if (!sessionId) return;

        const fullMessage: Message = {
          ...message,
          id: generateId(),
          timestamp: Date.now(),
        };

        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: [...session.messages, fullMessage],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      updateMessage: (messageId, updates) => {
        const sessionId = get().currentSessionId;
        if (!sessionId) return;

        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      clearMessages: () => {
        const sessionId = get().currentSessionId;
        if (!sessionId) return;

        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: {
                ...session,
                messages: [],
                updatedAt: Date.now(),
              },
            },
          };
        });
      },

      setStreaming: (isStreaming) => set({ isStreaming }),

      setThinking: (thinking) => set({ currentThinking: thinking }),

      addToolCall: (toolCall) => {
        const fullToolCall: ToolCall = {
          ...toolCall,
          status: 'pending',
          startTime: Date.now(),
        };

        set((state) => ({
          pendingToolCalls: [...state.pendingToolCalls, fullToolCall],
        }));
      },

      updateToolCall: (toolCallId, updates) => {
        set((state) => ({
          pendingToolCalls: state.pendingToolCalls.map((tc) =>
            tc.id === toolCallId ? { ...tc, ...updates } : tc
          ),
        }));
      },

      clearToolCalls: () => set({ pendingToolCalls: [], currentThinking: '' }),

      getCurrentSession: () => {
        const { currentSessionId, sessions } = get();
        return currentSessionId ? sessions[currentSessionId] || null : null;
      },

      getSessionList: () => {
        return Object.values(get().sessions)
          .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },
    }),
    {
      name: 'helix-chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
