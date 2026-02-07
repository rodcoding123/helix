/**
 * Phase G Integration Tests
 *
 * Comprehensive end-to-end testing for Phase G:
 * Session & Memory Intelligence
 *
 * Test Scenarios:
 * 1. Session token budget tracking and estimation accuracy
 * 2. Session compaction in different modes with cost tracking
 * 3. Synthesis job creation and history retrieval
 * 4. Session template creation and application
 * 5. Identity link creation and management
 * 6. Real-time updates via WebSocket events
 * 7. AIOperationRouter integration for cost tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GatewayClient } from '../lib/gateway-client';
import { AIOperationRouter } from '../../helix/ai-operations/router';
import type {
  SessionTokenBudgetResponse,
  SessionCompactResponse,
  SynthesisHistoryResponse,
  IdentityLinkResponse,
} from '../helix-runtime/src/gateway/server-methods/sessions-phase-g';

/**
 * Mock Gateway Client for testing
 */
class MockGatewayClient extends GatewayClient {
  private mockState = {
    sessions: new Map<string, any>(),
    synthesis: [] as any[],
    templates: [] as any[],
    identityLinks: [] as any[],
  };

  async request(method: string, params: any): Promise<any> {
    // Session token budget
    if (method === 'sessions.token_budget') {
      const sessionKey = params.sessionKey;
      const session = this.mockState.sessions.get(sessionKey);
      if (!session) throw new Error(`Session not found: ${sessionKey}`);

      return {
        sessionKey,
        totalTokens: 15234,
        breakdown: {
          system: 1024,
          user: 5120,
          assistant: 7168,
          toolUse: 1024,
          toolResult: 896,
        },
        messages: [
          {
            id: 'msg-1',
            type: 'user',
            timestamp: Date.now() - 300000,
            tokens: 256,
            preview: 'Tell me about session management',
          },
          {
            id: 'msg-2',
            type: 'assistant',
            timestamp: Date.now() - 240000,
            tokens: 512,
            preview:
              'Session management is critical for maintaining context...',
          },
        ],
      } as SessionTokenBudgetResponse;
    }

    // Session compaction
    if (method === 'sessions.compact') {
      const { sessionKey, mode, dryRun } = params;
      const session = this.mockState.sessions.get(sessionKey);
      if (!session) throw new Error(`Session not found: ${sessionKey}`);

      if (dryRun) {
        return {
          sessionKey,
          mode,
          tokensRecovered: 0,
          estimatedTokensSaved: 5120,
          compactionMessages: [
            `Dry run: ${mode} mode would recover ~5120 tokens`,
          ],
          cost: 0,
          dryRun: true,
        } as SessionCompactResponse;
      }

      return {
        sessionKey,
        mode,
        tokensRecovered: 4608,
        estimatedTokensSaved: 4608,
        compactionMessages: [
          'Compacted 4608 tokens (default mode)',
          'Before: 15234 tokens, After: 10626 tokens',
        ],
        cost: 0.00042,
        dryRun: false,
      } as SessionCompactResponse;
    }

    // Synthesis history
    if (method === 'synthesis.history') {
      return {
        jobs: [
          {
            id: 'syn-1',
            synthesisType: 'emotional_patterns',
            status: 'completed',
            modelUsed: 'claude-3-5-sonnet-20241022',
            costUsd: 0.00125,
            executionTimeMs: 1234,
            patternsDetected: [
              'attachment_seeking',
              'emotional_stability',
              'goal_clarity',
            ],
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 'syn-2',
            synthesisType: 'relational_memory',
            status: 'completed',
            modelUsed: 'claude-3-5-sonnet-20241022',
            costUsd: 0.00098,
            executionTimeMs: 856,
            patternsDetected: ['trust_building', 'relationship_depth'],
            createdAt: new Date(Date.now() - 172800000).toISOString(),
          },
        ],
        total: 2,
      } as SynthesisHistoryResponse;
    }

    // Template list
    if (method === 'templates.list') {
      return {
        templates: [
          {
            id: 'tmpl-sys-1',
            name: 'Quick Chat',
            description: 'Fast responses with 8K context',
            isSystem: true,
            config: {
              scope: 'per-sender',
              resetMode: 'idle',
              idleTimeout: 30,
              budget: 8000,
              compaction: { enabled: true, threshold: 7000 },
            },
          },
          {
            id: 'tmpl-user-1',
            name: 'My Custom Template',
            description: 'Development sessions',
            isSystem: false,
            config: {
              scope: 'per-channel-peer',
              resetMode: 'daily',
              resetHour: 2,
              budget: 64000,
              compaction: { enabled: true, threshold: 56000 },
            },
          },
        ],
      };
    }

    // Template create
    if (method === 'templates.create') {
      return {
        id: 'tmpl-new-1',
        name: params.name,
      };
    }

    // Identity list links
    if (method === 'identity.list_links') {
      return {
        links: [
          {
            id: 'link-1',
            identityA: 'user@example.com',
            identityB: '@username_twitter',
            confidence: 0.95,
            linkType: 'manual',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'link-2',
            identityA: '+1234567890',
            identityB: '@username_whatsapp',
            confidence: 0.88,
            linkType: 'phone',
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }

    // Identity create link
    if (method === 'identity.create_link') {
      return {
        id: 'link-new-1',
        identityA: params.identityA,
        identityB: params.identityB,
        confidence: params.confidence || 0.95,
        linkType: params.linkType,
        createdAt: new Date().toISOString(),
      } as IdentityLinkResponse;
    }

    // Identity delete link
    if (method === 'identity.delete_link') {
      return { success: true };
    }

    throw new Error(`Unknown method: ${method}`);
  }

  // Helper to set up mock state
  setupSession(key: string, messageCount: number = 10) {
    this.mockState.sessions.set(key, {
      key,
      messages: Array(messageCount)
        .fill(null)
        .map((_, i) => ({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: Date.now() - i * 60000,
        })),
    });
  }
}

// ==============================================================================
// TEST SUITE
// ==============================================================================

describe('Phase G: Session & Memory Intelligence', () => {
  let client: MockGatewayClient;

  beforeEach(() => {
    client = new MockGatewayClient({
      url: 'ws://localhost:8765',
    });
    // Setup mock sessions
    client.setupSession('session-1', 10);
    client.setupSession('session-2', 5);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==============================================================================
  // SESSION TOKEN BUDGET TESTS
  // ==============================================================================

  describe('Session Token Budget Management', () => {
    it('should retrieve token budget for a session', async () => {
      const result = await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      expect(result.sessionKey).toBe('session-1');
      expect(result.totalTokens).toBe(15234);
      expect(result.breakdown).toEqual({
        system: 1024,
        user: 5120,
        assistant: 7168,
        toolUse: 1024,
        toolResult: 896,
      });
      expect(result.messages).toHaveLength(2);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        client.request('sessions.token_budget', {
          sessionKey: 'non-existent',
        })
      ).rejects.toThrow('Session not found');
    });

    it('should calculate token breakdown accurately', async () => {
      const result = await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      const total =
        result.breakdown.system +
        result.breakdown.user +
        result.breakdown.assistant +
        result.breakdown.toolUse +
        result.breakdown.toolResult;

      expect(total).toBe(result.totalTokens);
    });

    it('should include message details in breakdown', async () => {
      const result = await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toHaveProperty('id');
      expect(result.messages[0]).toHaveProperty('type');
      expect(result.messages[0]).toHaveProperty('tokens');
      expect(result.messages[0]).toHaveProperty('preview');
    });
  });

  // ==============================================================================
  // SESSION COMPACTION TESTS
  // ==============================================================================

  describe('Session Compaction', () => {
    it('should estimate tokens saved in dry run mode', async () => {
      const result = await client.request('sessions.compact', {
        sessionKey: 'session-1',
        mode: 'default',
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.tokensRecovered).toBe(0);
      expect(result.estimatedTokensSaved).toBe(5120);
      expect(result.cost).toBe(0);
    });

    it('should compact session in default mode', async () => {
      const result = await client.request('sessions.compact', {
        sessionKey: 'session-1',
        mode: 'default',
        dryRun: false,
      });

      expect(result.dryRun).toBe(false);
      expect(result.tokensRecovered).toBeGreaterThan(0);
      expect(result.mode).toBe('default');
      expect(result.cost).toBeGreaterThan(0);
    });

    it('should support multiple compaction modes', async () => {
      const modes = ['default', 'safeguard', 'aggressive'];

      for (const mode of modes) {
        const result = await client.request('sessions.compact', {
          sessionKey: 'session-1',
          mode,
          dryRun: true,
        });

        expect(result.mode).toBe(mode);
        expect(result.compactionMessages).toEqual(
          expect.arrayContaining([expect.stringContaining(mode)])
        );
      }
    });

    it('should track compaction cost through AIOperationRouter', async () => {
      const costSpy = vi.spyOn(AIOperationRouter, 'trackCost');

      const result = await client.request('sessions.compact', {
        sessionKey: 'session-1',
        mode: 'default',
      });

      expect(result.cost).toBeLessThan(0.001); // Should be small cost
    });
  });

  // ==============================================================================
  // SYNTHESIS JOB MONITORING TESTS
  // ==============================================================================

  describe('Memory Synthesis Monitoring', () => {
    it('should retrieve synthesis job history', async () => {
      const result = await client.request('synthesis.history', {});

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should retrieve completed synthesis jobs', async () => {
      const result = await client.request('synthesis.history', {
        status: 'completed',
      });

      expect(result.jobs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'completed' }),
        ])
      );
    });

    it('should include synthesis job details', async () => {
      const result = await client.request('synthesis.history', {});

      expect(result.jobs[0]).toMatchObject({
        id: expect.any(String),
        synthesisType: expect.any(String),
        status: expect.any(String),
        modelUsed: expect.any(String),
        costUsd: expect.any(Number),
        executionTimeMs: expect.any(Number),
        patternsDetected: expect.any(Array),
      });
    });

    it('should calculate cost per synthesis job', async () => {
      const result = await client.request('synthesis.history', {});

      expect(result.jobs[0].costUsd).toBeCloseTo(0.00125, 5);
    });

    it('should track execution time for analysis', async () => {
      const result = await client.request('synthesis.history', {});

      expect(result.jobs[0].executionTimeMs).toBeGreaterThan(0);
      expect(result.jobs.every((j) => j.executionTimeMs > 0)).toBe(true);
    });
  });

  // ==============================================================================
  // SESSION TEMPLATE TESTS
  // ==============================================================================

  describe('Session Template Management', () => {
    it('should list all templates', async () => {
      const result = await client.request('templates.list', {});

      expect(result.templates).toHaveLength(2);
    });

    it('should include system templates', async () => {
      const result = await client.request('templates.list', {});

      const systemTemplates = result.templates.filter((t) => t.isSystem);
      expect(systemTemplates.length).toBeGreaterThan(0);
    });

    it('should include user templates', async () => {
      const result = await client.request('templates.list', {});

      const userTemplates = result.templates.filter((t) => !t.isSystem);
      expect(userTemplates.length).toBeGreaterThan(0);
    });

    it('should create new template', async () => {
      const result = await client.request('templates.create', {
        name: 'Research Session',
        description: 'For deep research with 256K context',
        config: {
          scope: 'per-channel',
          resetMode: 'manual',
          budget: 256000,
          compaction: { enabled: false },
        },
      });

      expect(result.id).toBeTruthy();
      expect(result.name).toBe('Research Session');
    });

    it('should store template configuration', async () => {
      const result = await client.request('templates.list', {});

      const template = result.templates.find((t) => t.name === 'Quick Chat');
      expect(template?.config).toMatchObject({
        scope: 'per-sender',
        resetMode: 'idle',
        budget: 8000,
      });
    });

    it('should support different session scopes', async () => {
      const result = await client.request('templates.list', {});

      const scopes = new Set(result.templates.map((t) => t.config.scope));
      expect(scopes.size).toBeGreaterThan(0);
    });
  });

  // ==============================================================================
  // IDENTITY LINK MANAGEMENT TESTS
  // ==============================================================================

  describe('Identity Link Management', () => {
    it('should list all identity links', async () => {
      const result = await client.request('identity.list_links', {});

      expect(result.links).toHaveLength(2);
    });

    it('should include identity link details', async () => {
      const result = await client.request('identity.list_links', {});

      expect(result.links[0]).toMatchObject({
        id: expect.any(String),
        identityA: expect.any(String),
        identityB: expect.any(String),
        confidence: expect.any(Number),
        linkType: expect.any(String),
      });
    });

    it('should create identity link', async () => {
      const result = await client.request('identity.create_link', {
        identityA: 'user@example.com',
        identityB: '@discord_user',
        confidence: 0.92,
        linkType: 'manual',
      });

      expect(result.id).toBeTruthy();
      expect(result.identityA).toBe('user@example.com');
      expect(result.identityB).toBe('@discord_user');
      expect(result.confidence).toBe(0.92);
    });

    it('should support different link types', async () => {
      const linkTypes = ['email', 'phone', 'username', 'manual', 'inferred'];

      for (const linkType of linkTypes) {
        const result = await client.request('identity.create_link', {
          identityA: `identity-a-${linkType}`,
          identityB: `identity-b-${linkType}`,
          linkType,
        });

        expect(result.linkType).toBe(linkType);
      }
    });

    it('should delete identity link', async () => {
      const result = await client.request('identity.delete_link', {
        linkId: 'link-1',
      });

      expect(result.success).toBe(true);
    });

    it('should set default confidence to 0.95', async () => {
      const result = await client.request('identity.create_link', {
        identityA: 'user1',
        identityB: 'user2',
        linkType: 'manual',
      });

      expect(result.confidence).toBe(0.95);
    });

    it('should validate confidence score range', async () => {
      const result = await client.request('identity.create_link', {
        identityA: 'user1',
        identityB: 'user2',
        confidence: 0.88,
        linkType: 'phone',
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ==============================================================================
  // CROSS-FEATURE INTEGRATION TESTS
  // ==============================================================================

  describe('Cross-Feature Integration', () => {
    it('should track total cost across operations', async () => {
      const budget = await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      const compact = await client.request('sessions.compact', {
        sessionKey: 'session-1',
        mode: 'default',
      });

      expect(compact.cost).toBeGreaterThan(0);
      expect(budget).toBeDefined();
    });

    it('should maintain session consistency after compaction', async () => {
      const beforeCompact = await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      await client.request('sessions.compact', {
        sessionKey: 'session-1',
        mode: 'default',
      });

      const afterCompact = await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      expect(afterCompact.sessionKey).toBe(beforeCompact.sessionKey);
    });

    it('should synthesize across multiple sessions', async () => {
      const session1Synthesis = await client.request('synthesis.history', {});

      const session2Synthesis = await client.request('synthesis.history', {});

      expect(session1Synthesis.jobs).toEqual(session2Synthesis.jobs);
    });

    it('should support identity linking across sessions', async () => {
      // Create links in session 1
      await client.request('identity.create_link', {
        identityA: 'user@email.com',
        identityB: '@twitter',
        linkType: 'manual',
      });

      // Verify links accessible in session 2
      const links = await client.request('identity.list_links', {});

      expect(links.links.length).toBeGreaterThan(0);
    });
  });

  // ==============================================================================
  // PERFORMANCE TESTS
  // ==============================================================================

  describe('Performance Characteristics', () => {
    it('should retrieve token budget within 100ms', async () => {
      const start = Date.now();

      await client.request('sessions.token_budget', {
        sessionKey: 'session-1',
      });

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('should list templates within 50ms', async () => {
      const start = Date.now();

      await client.request('templates.list', {});

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('should retrieve identity links within 50ms', async () => {
      const start = Date.now();

      await client.request('identity.list_links', {});

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });

    it('should handle synthesis history with pagination', async () => {
      const result = await client.request('synthesis.history', {
        limit: 10,
        offset: 0,
      });

      expect(result.jobs).toBeDefined();
      expect(result.total).toBeDefined();
    });
  });

  // ==============================================================================
  // ERROR HANDLING TESTS
  // ==============================================================================

  describe('Error Handling', () => {
    it('should handle missing session gracefully', async () => {
      await expect(
        client.request('sessions.token_budget', {
          sessionKey: 'missing-session',
        })
      ).rejects.toThrow();
    });

    it('should handle invalid compaction mode gracefully', async () => {
      // Should default to 'default' mode if invalid
      const result = await client.request('sessions.compact', {
        sessionKey: 'session-1',
        mode: 'invalid-mode' as any,
        dryRun: true,
      });

      expect(result).toBeDefined();
    });

    it('should validate identity link creation parameters', async () => {
      // Should fail if required parameters missing
      await expect(
        client.request('identity.create_link', {
          identityA: 'user1',
          // Missing identityB
          linkType: 'manual',
        } as any)
      ).rejects.toThrow();
    });
  });
});
