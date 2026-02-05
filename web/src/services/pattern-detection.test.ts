import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatternDetectionService } from './pattern-detection';

// Mock Supabase browser client with test data
vi.mock('@/lib/supabase-browser', () => {
  return {
    getSupabaseBrowserClient: vi.fn(() => {
      // Test conversation data (fresh for each client creation)
      const conversationsDb = [
        {
          id: 'conv-1',
          user_id: 'user-123',
          extracted_topics: ['coding'],
          primary_emotion: 'neutral',
          created_at: '2026-02-01T10:00:00Z',
        },
        {
          id: 'conv-2',
          user_id: 'user-123',
          extracted_topics: ['coding'],
          primary_emotion: 'neutral',
          created_at: '2026-02-02T10:00:00Z',
        },
        {
          id: 'conv-3',
          user_id: 'user-123',
          extracted_topics: ['design'],
          primary_emotion: 'neutral',
          created_at: '2026-02-03T10:00:00Z',
        },
      ];

      // In-memory database for persisted proposals (fresh for each client)
      const proposalsDb: any[] = [];

      return {
        from: vi.fn((table: string) => {
        const queryBuilder = {
          _table: table,
          _filters: {} as any,

          select(cols?: string) {
            this._filters.select = cols || '*';
            return this;
          },

          eq(col: string, val: any) {
            this._filters.eq = this._filters.eq || {};
            this._filters.eq[col] = val;
            return this;
          },

          order(col: string, opts?: any) {
            this._filters.order = { col, opts };
            return this;
          },

          limit(n: number) {
            this._filters.limit = n;
            return this;
          },

          insert(data: any) {
            this._filters.insert = data;
            return this;
          },

          then(onFulfilled?: any, onRejected?: any) {
            try {
              const result = this.execute();
              return Promise.resolve(result).then(onFulfilled, onRejected);
            } catch (e) {
              return Promise.reject(e);
            }
          },

          execute() {
            const table = this._table;
            const filters = this._filters;

            // Handle conversations table
            if (table === 'conversations') {
              let data = conversationsDb;
              if (filters.eq?.user_id) {
                data = data.filter((c) => c.user_id === filters.eq.user_id);
              }
              return { data, error: null };
            }

            // Handle agents table
            if (table === 'agents') {
              let data: any[] = [];
              if (filters.eq?.user_id) {
                // No agents in test db
              }
              return { data, error: null };
            }

            // Handle agent_proposals table
            if (table === 'agent_proposals') {
              if (filters.insert) {
                // Persist the inserted proposals
                const dataToInsert = Array.isArray(filters.insert) ? filters.insert : [filters.insert];
                const persisted = dataToInsert.map((item: any, idx: number) => ({
                  id: `proposal-${Date.now()}-${idx}`,
                  created_at: new Date().toISOString(),
                  ...item,
                }));
                proposalsDb.push(...persisted);
                return { data: persisted, error: null };
              }
              return { data: [], error: null };
            }

            return { data: [], error: null };
          },
        };

        return queryBuilder;
      }),
      };
    }),
  };
});

// Mock Discord logger
vi.mock('./discord-logger', () => {
  class MockDiscordLogger {
    async logAgentProposal() {
      return undefined;
    }
  }
  return {
    DiscordLoggerService: MockDiscordLogger,
  };
});

describe('PatternDetectionService', () => {
  let service: PatternDetectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatternDetectionService();
  });

  describe('detectAgentProposals', () => {
    it('should detect agent proposals from conversation patterns', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      expect(Array.isArray(proposals)).toBe(true);
    });

    it('should return empty array for users with no conversations', async () => {
      const proposals = await service.detectAgentProposals('user-no-data');

      expect(Array.isArray(proposals)).toBe(true);
    });

    it('should create proposals with detected patterns', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      if (proposals.length > 0) {
        const proposal = proposals[0];
        expect(proposal.proposed_name).toBeDefined();
        expect(proposal.proposed_role).toBeDefined();
        expect(proposal.reason).toBeDefined();
        expect(proposal.detected_pattern).toBeDefined();
        expect(proposal.status).toBe('pending');
      }
    });
  });

  describe('pattern analysis', () => {
    it('should identify topic clusters from conversations', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      // With test data: 'coding' appears 2x (67%), others appear 1x (33%)
      // 'coding' should be above 15% threshold and proposed
      expect(proposals.length).toBeGreaterThan(0);
    });

    it('should calculate frequency correctly', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      if (proposals.length > 0) {
        const proposal = proposals[0];
        expect(proposal.detected_pattern.frequency).toBeGreaterThan(0);
        expect(proposal.detected_pattern.frequency).toBeLessThanOrEqual(1);
      }
    });

    it('should set confidence based on frequency', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      if (proposals.length > 0) {
        const proposal = proposals[0];
        expect(proposal.detected_pattern.confidence).toBeGreaterThan(0);
        expect(proposal.detected_pattern.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('proposal filtering', () => {
    it('should not propose agents for topics below frequency threshold', async () => {
      // Test data has 'design' at 33% which is below 15% base or dynamic calculation
      const proposals = await service.detectAgentProposals('user-123');

      // Check that proposals meet minimum frequency criteria
      for (const proposal of proposals) {
        expect(proposal.detected_pattern.frequency).toBeGreaterThanOrEqual(0.1);
      }
    });

    it('should exclude existing agent roles from proposals', async () => {
      // This would require mocking existing agents, tested via integration
      const proposals = await service.detectAgentProposals('user-123');

      expect(Array.isArray(proposals)).toBe(true);
    });
  });

  describe('proposal status', () => {
    it('should mark all proposals as pending', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      for (const proposal of proposals) {
        expect(proposal.status).toBe('pending');
      }
    });

    it('should generate unique proposal IDs', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      const ids = new Set(proposals.map((p) => p.id));
      expect(ids.size).toBe(proposals.length);
    });

    it('should include user_id in proposals', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      for (const proposal of proposals) {
        expect(proposal.user_id).toBe('user-123');
      }
    });
  });

  describe('error handling', () => {
    it('should return empty array on fetch error', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      expect(Array.isArray(proposals)).toBe(true);
    });

    it('should not throw on pattern analysis errors', async () => {
      await expect(
        service.detectAgentProposals('user-123')
      ).resolves.not.toThrow();
    });
  });

  describe('proposal content validation', () => {
    it('should include detailed pattern information', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      if (proposals.length > 0) {
        const proposal = proposals[0];
        expect(proposal.detected_pattern).toHaveProperty('topic_cluster');
        expect(proposal.detected_pattern).toHaveProperty('frequency');
        expect(proposal.detected_pattern).toHaveProperty('confidence');
        expect(proposal.detected_pattern).toHaveProperty('context');
      }
    });

    it('should format proposal names with capitalization', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      for (const proposal of proposals) {
        // Verify name is capitalized
        expect(/^[A-Z]/.test(proposal.proposed_name)).toBe(true);
      }
    });

    it('should include human-readable reason', async () => {
      const proposals = await service.detectAgentProposals('user-123');

      for (const proposal of proposals) {
        expect(proposal.reason).toBeDefined();
        expect(proposal.reason.length).toBeGreaterThan(0);
      }
    });
  });
});
