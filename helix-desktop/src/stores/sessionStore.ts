import { create } from 'zustand';

export interface GatewaySession {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startedAt: number;
  lastActivity: number;
  messageCount: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

export interface AgentSession {
  id: string;
  name: string;
  model: string;
  status: 'idle' | 'thinking' | 'executing' | 'waiting';
  currentTool?: string;
  startedAt: number;
}

interface SessionState {
  // Gateway connection
  gatewaySession: GatewaySession | null;
  gatewayPort: number | null;
  isGatewayRunning: boolean;

  // Agent sessions
  agentSessions: Record<string, AgentSession>;
  activeAgentId: string | null;

  // Connection state
  reconnectAttempts: number;
  maxReconnectAttempts: number;

  // Gateway actions
  setGatewaySession: (session: GatewaySession | null) => void;
  updateGatewaySession: (updates: Partial<GatewaySession>) => void;
  setGatewayPort: (port: number | null) => void;
  setGatewayRunning: (running: boolean) => void;

  // Agent actions
  createAgentSession: (session: Omit<AgentSession, 'startedAt'>) => void;
  updateAgentSession: (id: string, updates: Partial<AgentSession>) => void;
  removeAgentSession: (id: string) => void;
  setActiveAgent: (id: string | null) => void;

  // Reconnection
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  gatewaySession: null,
  gatewayPort: null,
  isGatewayRunning: false,
  agentSessions: {},
  activeAgentId: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,

  setGatewaySession: (session) => set({ gatewaySession: session }),

  updateGatewaySession: (updates) => {
    const current = get().gatewaySession;
    if (current) {
      set({ gatewaySession: { ...current, ...updates } });
    }
  },

  setGatewayPort: (port) => set({ gatewayPort: port }),

  setGatewayRunning: (running) => set({ isGatewayRunning: running }),

  createAgentSession: (session) => {
    const fullSession: AgentSession = {
      ...session,
      startedAt: Date.now(),
    };

    set((state) => ({
      agentSessions: { ...state.agentSessions, [session.id]: fullSession },
      activeAgentId: session.id,
    }));
  },

  updateAgentSession: (id, updates) => {
    set((state) => {
      const session = state.agentSessions[id];
      if (!session) return state;

      return {
        agentSessions: {
          ...state.agentSessions,
          [id]: { ...session, ...updates },
        },
      };
    });
  },

  removeAgentSession: (id) => {
    const { [id]: _deleted, ...rest } = get().agentSessions;
    set({
      agentSessions: rest,
      activeAgentId: get().activeAgentId === id ? null : get().activeAgentId,
    });
  },

  setActiveAgent: (id) => set({ activeAgentId: id }),

  incrementReconnectAttempts: () => {
    set((state) => ({
      reconnectAttempts: state.reconnectAttempts + 1,
    }));
  },

  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
}));
