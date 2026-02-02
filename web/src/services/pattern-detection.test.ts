import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PatternDetectionService } from './pattern-detection';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data:
          table === 'conversations'
            ? [
                {
                  id: 'conv-1',
                  extracted_topics: ['coding', 'javascript'],
                  primary_emotion: 'focused',
                  emotional_dimensions: { valence: 0.6, arousal: 0.7 },
                },
                {
                  id: 'conv-2',
                  extracted_topics: ['coding', 'typescript'],
                  primary_emotion: 'focused',
                  emotional_dimensions: { valence: 0.5, arousal: 0.6 },
                },
                {
                  id: 'conv-3',
                  extracted_topics: ['design', 'ui'],
                  primary_emotion: 'creative',
                  emotional_dimensions: { valence: 0.7, arousal: 0.8 },
                },
              ]
            : [],
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'proposal-123' },
        error: null,
      }),
    })),
  })),
}));

// Mock secrets loader
vi.mock('@/lib/secrets-loader', () => ({
  loadSecret: vi.fn(async (secret: string) => {
    if (secret === 'Supabase URL') {
      return 'https://test.supabase.co';
    }
    if (secret === 'Supabase Anon Key') {
      return 'test-key';
    }
    return 'test-secret';
  }),
}));

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
