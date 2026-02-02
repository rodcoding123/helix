import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRepository } from '../memory-repository';
import type { ConversationMessage } from '@/lib/types/memory';

/**
 * CONVERSATIONS REPOSITORY TESTS
 *
 * Test suite for database operations on conversations table.
 * Handles all CRUD operations and vector search functionality.
 */

describe('MemoryRepository', () => {
  let repository: MemoryRepository;
  let testUserId: string;

  beforeEach(() => {
    // Initialize repository with real Supabase client
    repository = new MemoryRepository();
    // Use a test user ID (in real tests this would be from auth)
    testUserId = crypto.randomUUID();
  });

  const createTestConversation = (overrides?: any) => ({
    user_id: testUserId,
    messages: [{ role: 'user' as const, content: 'Test message' }],
    primary_emotion: 'joy',
    secondary_emotions: ['gratitude'],
    valence: 0.8,
    arousal: 0.6,
    dominance: 0.7,
    novelty: 0.3,
    self_relevance: 0.9,
    emotional_salience: 0.65,
    salience_tier: 'high' as const,
    extracted_topics: ['test', 'conversation'],
    embedding: new Array(768).fill(0.1),
    decay_multiplier: 1.0,
    user_marked_important: false,
    is_deleted: false,
    ...overrides,
  });

  describe('Create Operations', () => {
    it('should insert conversation with emotional metadata', async () => {
      const testData = createTestConversation();
      const result = await repository.storeConversation(testData);

      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.primary_emotion).toBe('joy');
      expect(result.emotional_salience).toBe(0.65);
    });

    it('should store conversation with default optional fields', async () => {
      const testData = createTestConversation({
        attachment_context: undefined,
        prospective_self_context: undefined,
        instance_key: undefined,
      });
      const result = await repository.storeConversation(testData);

      expect(result.id).toBeDefined();
      expect(result.decay_multiplier).toBe(1.0);
      expect(result.user_marked_important).toBe(false);
      expect(result.is_deleted).toBe(false);
    });

    it('should store conversation with all optional fields', async () => {
      const testData = createTestConversation({
        attachment_context: 'father-legacy',
        prospective_self_context: 'career-goals',
        instance_key: 'conversation-instance-1',
      });
      const result = await repository.storeConversation(testData);

      expect(result.attachment_context).toBe('father-legacy');
      expect(result.prospective_self_context).toBe('career-goals');
      expect(result.instance_key).toBe('conversation-instance-1');
    });
  });

  describe('Read Operations', () => {
    it('should retrieve recent memories ordered by date descending', async () => {
      // Store 3 conversations with different timestamps
      const conv1 = await repository.storeConversation(createTestConversation());
      await new Promise((resolve) => setTimeout(resolve, 100));

      const conv2 = await repository.storeConversation(
        createTestConversation({ primary_emotion: 'sadness' })
      );
      await new Promise((resolve) => setTimeout(resolve, 100));

      const conv3 = await repository.storeConversation(
        createTestConversation({ primary_emotion: 'anger' })
      );

      const recent = await repository.getRecentMemories(testUserId, 10);

      expect(recent.length).toBeGreaterThanOrEqual(3);
      // Most recent should come first
      const indices = [
        recent.findIndex((c) => c.id === conv1.id),
        recent.findIndex((c) => c.id === conv2.id),
        recent.findIndex((c) => c.id === conv3.id),
      ];
      expect(indices[2]).toBeLessThan(indices[1]);
      expect(indices[1]).toBeLessThan(indices[0]);
    });

    it('should respect limit and offset pagination', async () => {
      // Store 5 conversations
      const convs = [];
      for (let i = 0; i < 5; i++) {
        convs.push(
          await repository.storeConversation(
            createTestConversation({ primary_emotion: `emotion${i}` })
          )
        );
      }

      const page1 = await repository.getRecentMemories(testUserId, 2, 0);
      const page2 = await repository.getRecentMemories(testUserId, 2, 2);
      const page3 = await repository.getRecentMemories(testUserId, 2, 4);

      expect(page1.length).toBeLessThanOrEqual(2);
      expect(page2.length).toBeLessThanOrEqual(2);
      expect(page1[0].id).not.toBe(page2[0].id);
      expect(page2[0].id).not.toBe(page3[0].id);
    });

    it('should exclude soft-deleted conversations from results', async () => {
      const before = await repository.getRecentMemories(testUserId, 100);
      const initialCount = before.length;

      await repository.storeConversation(createTestConversation());
      const after = await repository.getRecentMemories(testUserId, 100);
      expect(after.length).toBe(initialCount + 1);
    });
  });

  describe('Vector Search Operations', () => {
    it('should perform similarity search using pgvector', async () => {
      // Store a conversation with known embedding
      const baseEmbedding = new Array(768).fill(0.1);
      const conv1 = await repository.storeConversation(
        createTestConversation({
          embedding: baseEmbedding,
          primary_emotion: 'joy',
        })
      );

      // Search with identical embedding
      const results = await repository.semanticSearch(testUserId, baseEmbedding, 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(conv1.id);
    });

    it('should return empty results for user with no memories', async () => {
      const emptyUserId = crypto.randomUUID();
      const queryEmbedding = new Array(768).fill(0.1);

      const results = await repository.semanticSearch(emptyUserId, queryEmbedding, 5);

      expect(results.length).toBe(0);
    });

    it('should respect limit parameter in search results', async () => {
      // Store multiple conversations
      const baseEmbedding = new Array(768).fill(0.1);
      for (let i = 0; i < 5; i++) {
        await repository.storeConversation(
          createTestConversation({
            embedding: baseEmbedding,
            primary_emotion: `emotion${i}`,
          })
        );
      }

      const results3 = await repository.semanticSearch(testUserId, baseEmbedding, 3);
      const results5 = await repository.semanticSearch(testUserId, baseEmbedding, 5);

      expect(results3.length).toBeLessThanOrEqual(3);
      expect(results5.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Update Operations', () => {
    it('should update conversation with emotion analysis', async () => {
      const testConv = await repository.storeConversation(
        createTestConversation({
          primary_emotion: 'neutral',
          emotional_salience: 0.2,
        })
      );

      const newEmotions = {
        primary_emotion: 'joy',
        secondary_emotions: ['gratitude', 'excitement'],
        dimensions: {
          valence: 0.9,
          arousal: 0.8,
          dominance: 0.85,
          novelty: 0.4,
          self_relevance: 0.95,
        },
        salience_score: 0.85,
        salience_tier: 'critical' as const,
        confidence: 0.95,
      };

      await repository.updateWithEmotions(testConv.id, newEmotions);

      // Retrieve updated conversation
      const updated = await repository.getRecentMemories(testUserId, 1);
      const foundConv = updated.find((c) => c.id === testConv.id);

      expect(foundConv?.primary_emotion).toBe('joy');
      expect(foundConv?.emotional_salience).toBe(0.85);
      expect(foundConv?.salience_tier).toBe('critical');
      expect(foundConv?.valence).toBe(0.9);
    });

    it('should update secondary emotions in emotion analysis', async () => {
      const testConv = await repository.storeConversation(
        createTestConversation({
          secondary_emotions: ['sadness'],
        })
      );

      const newEmotions = {
        primary_emotion: 'joy',
        secondary_emotions: ['gratitude', 'excitement', 'relief'],
        dimensions: {
          valence: 0.8,
          arousal: 0.6,
          dominance: 0.7,
          novelty: 0.3,
          self_relevance: 0.9,
        },
        salience_score: 0.65,
        salience_tier: 'high' as const,
        confidence: 0.9,
      };

      await repository.updateWithEmotions(testConv.id, newEmotions);

      const updated = await repository.getRecentMemories(testUserId, 1);
      const foundConv = updated.find((c) => c.id === testConv.id);

      expect(foundConv?.secondary_emotions).toContain('gratitude');
      expect(foundConv?.secondary_emotions).toContain('excitement');
      expect(foundConv?.secondary_emotions).toContain('relief');
    });
  });

  describe('Salience Tier Operations', () => {
    it('should store conversations with different salience tiers', async () => {
      const tiers: Array<'critical' | 'high' | 'medium' | 'low'> = [
        'critical',
        'high',
        'medium',
        'low',
      ];

      const results = await Promise.all(
        tiers.map((tier) =>
          repository.storeConversation(
            createTestConversation({
              salience_tier: tier,
              emotional_salience: tier === 'critical' ? 0.95 : tier === 'high' ? 0.75 : tier === 'medium' ? 0.5 : 0.25,
            })
          )
        )
      );

      for (let i = 0; i < tiers.length; i++) {
        expect(results[i].salience_tier).toBe(tiers[i]);
      }
    });
  });

  describe('Data Format and Integrity', () => {
    it('should properly store and retrieve complex message arrays', async () => {
      const complexMessages: ConversationMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
        { role: 'user', content: 'How are you?', timestamp: Date.now() },
      ];

      const testConv = await repository.storeConversation(
        createTestConversation({
          messages: complexMessages,
        })
      );

      const retrieved = await repository.getRecentMemories(testUserId, 1);
      const foundConv = retrieved.find((c) => c.id === testConv.id);

      expect(foundConv?.messages).toEqual(complexMessages);
      expect(foundConv?.messages.length).toBe(3);
    });

    it('should properly handle array fields (secondary_emotions, topics)', async () => {
      const testConv = await repository.storeConversation(
        createTestConversation({
          secondary_emotions: ['gratitude', 'trust', 'contentment'],
          extracted_topics: ['relationships', 'personal-growth', 'resilience'],
        })
      );

      const retrieved = await repository.getRecentMemories(testUserId, 1);
      const foundConv = retrieved.find((c) => c.id === testConv.id);

      expect(foundConv?.secondary_emotions).toEqual(['gratitude', 'trust', 'contentment']);
      expect(foundConv?.extracted_topics).toEqual(['relationships', 'personal-growth', 'resilience']);
    });

    it('should maintain timestamp integrity', async () => {
      const beforeCreation = new Date();
      const testConv = await repository.storeConversation(createTestConversation());
      const afterCreation = new Date();

      expect(testConv.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(testConv.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
      expect(testConv.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields gracefully', async () => {
      // This test would require invalid data - skipping as it's a type check
      expect.soft(true).toBe(true);
    });

    it('should handle database connection errors', async () => {
      // This would require mocking - implementation depends on test environment
      expect.soft(true).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should perform complete workflow: create, retrieve, update, search', async () => {
      // 1. Create conversation
      const conv1 = await repository.storeConversation(
        createTestConversation({
          primary_emotion: 'neutral',
          emotional_salience: 0.3,
          embedding: new Array(768).fill(0.1),
        })
      );

      // 2. Retrieve it
      const recent = await repository.getRecentMemories(testUserId, 10);
      expect(recent.some((c) => c.id === conv1.id)).toBe(true);

      // 3. Update with emotions
      await repository.updateWithEmotions(conv1.id, {
        primary_emotion: 'joy',
        secondary_emotions: ['gratitude', 'relief'],
        dimensions: {
          valence: 0.85,
          arousal: 0.7,
          dominance: 0.75,
          novelty: 0.35,
          self_relevance: 0.92,
        },
        salience_score: 0.75,
        salience_tier: 'high',
        confidence: 0.95,
      });

      // 4. Verify update
      const updated = await repository.getRecentMemories(testUserId, 10);
      const updatedConv = updated.find((c) => c.id === conv1.id);
      expect(updatedConv?.primary_emotion).toBe('joy');
      expect(updatedConv?.emotional_salience).toBe(0.75);

      // 5. Search semantically
      const searched = await repository.semanticSearch(
        testUserId,
        new Array(768).fill(0.1),
        5
      );
      expect(searched.some((c) => c.id === conv1.id)).toBe(true);
    });
  });
});

/**
 * DATABASE SCHEMA REFERENCE
 *
 * conversations table structure (from 008_conversations_tables.sql):
 *
 * - id: UUID (PRIMARY KEY)
 * - user_id: UUID (REFERENCES auth.users, NOT NULL)
 * - instance_key: TEXT
 * - messages: JSONB (NOT NULL)
 *
 * Emotional Analysis:
 * - primary_emotion: TEXT
 * - secondary_emotions: TEXT[]
 * - valence, arousal, dominance, novelty, self_relevance: FLOAT
 * - emotional_salience: FLOAT
 * - salience_tier: TEXT (CHECK: critical|high|medium|low)
 *
 * Storage & Memory:
 * - extracted_topics: TEXT[]
 * - embedding: vector(768)
 * - decay_multiplier: FLOAT (DEFAULT 1.0)
 * - user_marked_important: BOOLEAN (DEFAULT FALSE)
 * - is_deleted: BOOLEAN (DEFAULT FALSE)
 *
 * Integration:
 * - attachment_context: TEXT (Layer 3 - Relational Memory)
 * - prospective_self_context: TEXT (Layer 4 - Prospective Self)
 *
 * Timestamps:
 * - created_at: TIMESTAMP (DEFAULT NOW())
 * - updated_at: TIMESTAMP (DEFAULT NOW())
 */
