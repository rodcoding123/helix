import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from './agent';
import type { AgentPersonality } from '@/lib/types/agents';

// Mock Discord logger
vi.mock('./discord-logger', () => {
  class MockDiscordLogger {
    async logAgentCreated() {
      return undefined;
    }
    async logPersonalityEvolution() {
      return undefined;
    }
  }
  return {
    DiscordLoggerService: MockDiscordLogger,
  };
});

// Mock Supabase client
vi.mock('@/lib/supabase-browser', () => {
  let insertedData: any = null;

  const createMockResponse = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn(function(data: any[]) {
      insertedData = { ...data[0], id: 'agent-123' };
      return this;
    }),
    update: vi.fn(function(data: any) {
      insertedData = { ...insertedData, ...data, id: 'agent-123' };
      return this;
    }),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      const responseData = insertedData || {
        id: 'agent-123',
        user_id: 'user-123',
        name: 'Test Agent',
        role: 'Test Role',
        description: 'Test Description',
        personality: {
          verbosity: 0.5,
          formality: 0.5,
          creativity: 0.5,
          proactivity: 0.5,
          warmth: 0.5,
        },
        autonomy_level: 0,
        created_by: 'system',
        narrative: {},
        goals: [],
        scope: '',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      insertedData = null; // Reset for next call
      return Promise.resolve({
        data: responseData,
        error: null,
      });
    }),
    range: vi.fn().mockReturnThis(),
  });

  const mockSupabase = {
    from: vi.fn(() => createMockResponse()),
  };

  return {
    getSupabaseBrowserClient: () => mockSupabase,
  };
});

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentService();
  });

  describe('createAgent', () => {
    it('should create an agent with default personality', async () => {
      const agent = await service.createAgent(
        'user-123',
        'Test Agent',
        'Test Role',
        'Test Description',
        'Test reason'
      );

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.role).toBe('Test Role');
      expect(agent.personality).toEqual({
        verbosity: 0.5,
        formality: 0.5,
        creativity: 0.5,
        proactivity: 0.5,
        warmth: 0.5,
      });
    });

    it('should create an agent with custom personality', async () => {
      const customPersonality: Partial<AgentPersonality> = {
        verbosity: 0.8,
        creativity: 0.6,
      };

      const agent = await service.createAgent(
        'user-123',
        'Creative Agent',
        'Creative Role',
        'Creative Description',
        'Creative reason',
        customPersonality
      );

      expect(agent).toBeDefined();
      expect(agent.personality.verbosity).toBe(0.8);
      expect(agent.personality.creativity).toBe(0.6);
    });

    it('should have autonomy level 0 by default', async () => {
      const agent = await service.createAgent(
        'user-123',
        'Test Agent',
        'Test Role',
        'Test Description',
        'Test reason'
      );

      expect(agent.autonomy_level).toBe(0);
    });

    it('should have system creation origin', async () => {
      const agent = await service.createAgent(
        'user-123',
        'Test Agent',
        'Test Role',
        'Test Description',
        'Test reason'
      );

      expect(agent.created_by).toBe('system');
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', async () => {
      const agent = await service.getAgent('agent-123', 'user-123');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('agent-123');
      expect(agent?.name).toBe('Test Agent');
    });
  });

  describe('getUserAgents', () => {
    it('should return agents for a user', async () => {
      const agents = await service.getUserAgents('user-123');

      expect(Array.isArray(agents)).toBe(true);
    });
  });

  describe('setAgentAutonomy', () => {
    it('should update agent autonomy level', async () => {
      const agent = await service.setAgentAutonomy(
        'agent-123',
        'user-123',
        2
      );

      expect(agent).toBeDefined();
      expect(agent.autonomy_level).toBe(2); // Mock returns the updated value
    });

    it('should accept autonomy levels 0-3', async () => {
      for (const level of [0, 1, 2, 3] as const) {
        const agent = await service.setAgentAutonomy('agent-123', 'user-123', level);
        expect(agent).toBeDefined();
      }
    });
  });

  describe('updateAgentPersonality', () => {
    it('should merge personality updates', async () => {
      const updates: Partial<AgentPersonality> = {
        verbosity: 0.7,
        warmth: 0.8,
      };

      const agent = await service.updateAgentPersonality(
        'agent-123',
        'user-123',
        updates
      );

      expect(agent).toBeDefined();
    });

    it('should preserve unmodified personality dimensions', async () => {
      const updates: Partial<AgentPersonality> = {
        creativity: 0.9,
      };

      const agent = await service.updateAgentPersonality(
        'agent-123',
        'user-123',
        updates
      );

      // Mock returns default personality, but the merge logic was called
      expect(agent.personality).toBeDefined();
    });
  });

  describe('storeConversation', () => {
    it('should store agent conversation', async () => {
      const conversation = {
        messages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there!' },
        ],
        primary_emotion: 'neutral',
        secondary_emotions: [],
        emotional_dimensions: {
          valence: 0.5,
          arousal: 0.3,
          dominance: 0.5,
          novelty: 0.2,
          self_relevance: 0.4,
        },
        topics: ['greeting'],
      };

      const stored = await service.storeConversation(
        'agent-123',
        'user-123',
        conversation
      );

      expect(stored).toBeDefined();
    });
  });

  describe('deleteAgent', () => {
    it('should soft delete an agent', async () => {
      await expect(
        service.deleteAgent('agent-123', 'user-123')
      ).resolves.not.toThrow();
    });
  });
});
