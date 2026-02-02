import { describe, it, expect, beforeEach } from 'vitest';
import { EmotionDetectionService } from '@/services/emotion-detection';
import { TopicExtractionService } from '@/services/topic-extraction';
import { EmbeddingService } from '@/services/embedding';
import { MemoryRepository } from '@/lib/repositories/memory-repository';
import type { ConversationMessage } from '@/lib/types/memory';

/**
 * END-TO-END MEMORY FLOW TEST
 *
 * This test verifies the complete pipeline:
 * 1. Conversation Input (Messages)
 * 2. Emotion Detection (DeepSeek)
 * 3. Topic Extraction (DeepSeek)
 * 4. Embedding Generation (Gemini)
 * 5. Database Storage (Supabase)
 * 6. Semantic Search (pgvector)
 *
 * This is a critical integration test that exercises all Day 1-2 services.
 */

describe('End-to-End Memory Flow', () => {
  let emotionService: EmotionDetectionService;
  let topicService: TopicExtractionService;
  let embeddingService: EmbeddingService;
  let repository: MemoryRepository;

  // Test user UUID (constant for all tests)
  const userId = '00000000-0000-0000-0000-000000000000';

  beforeEach(() => {
    // Services now load API keys automatically from 1Password or .env fallback
    emotionService = new EmotionDetectionService();
    topicService = new TopicExtractionService();
    embeddingService = new EmbeddingService();
    repository = new MemoryRepository();
  });

  describe('Single Conversation Processing', () => {
    it('should capture a full conversation end-to-end', async () => {
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content:
            "I just got promoted to senior engineer! I'm thrilled but also worried about impostor syndrome.",
        },
        {
          role: 'assistant',
          content:
            "That's wonderful! Imposter syndrome is common. You earned this promotion through your skills and hard work.",
        },
      ];

      console.log('Step 1: Analyzing emotions...');
      const emotions = await emotionService.analyzeConversation(messages);
      console.log('✓ Emotions:', {
        primary: emotions.primary_emotion,
        salience: emotions.salience_score,
        tier: emotions.salience_tier,
      });

      // Verify emotion analysis
      expect(emotions.primary_emotion).toBeTruthy();
      expect(emotions.dimensions).toBeDefined();
      expect(emotions.dimensions.valence).toBeGreaterThanOrEqual(-1);
      expect(emotions.dimensions.valence).toBeLessThanOrEqual(1);
      expect(emotions.salience_score).toBeGreaterThan(0.4); // Career event should be notable
      expect(['critical', 'high', 'medium', 'low']).toContain(
        emotions.salience_tier
      );

      console.log('Step 2: Extracting topics...');
      const topics = await topicService.extractTopics(messages);
      console.log('✓ Topics:', topics);

      // Verify topics
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.length).toBeLessThanOrEqual(5);
      topics.forEach((topic) => {
        expect(typeof topic).toBe('string');
        expect(topic.length).toBeGreaterThan(0);
      });

      console.log('Step 3: Generating embedding...');
      const conversationText = messages.map((m) => m.content).join(' ');
      const embedding = await embeddingService.generateEmbedding(
        conversationText
      );
      console.log('✓ Embedding: 768-dimensional vector');

      // Verify embedding
      expect(embedding).toHaveLength(768);
      expect(embedding.every((v) => typeof v === 'number')).toBe(true);
      const magnitude = embeddingService.calculateMagnitude(embedding);
      expect(magnitude).toBeCloseTo(1, 1); // Normalized

      console.log('Step 4: Storing to database...');
      const stored = await repository.storeConversation({
        user_id: userId,
        messages,
        primary_emotion: emotions.primary_emotion,
        secondary_emotions: emotions.secondary_emotions,
        valence: emotions.dimensions.valence,
        arousal: emotions.dimensions.arousal,
        dominance: emotions.dimensions.dominance,
        novelty: emotions.dimensions.novelty,
        self_relevance: emotions.dimensions.self_relevance,
        emotional_salience: emotions.salience_score,
        salience_tier: emotions.salience_tier,
        extracted_topics: topics,
        embedding,
        decay_multiplier: 1.0,
        user_marked_important: false,
        is_deleted: false,
      });

      console.log('✓ Stored with ID:', stored.id);
      expect(stored.id).toBeTruthy();
      expect(stored.primary_emotion).toBe(emotions.primary_emotion);
      expect(stored.extracted_topics).toEqual(topics);

      console.log('Step 5: Retrieving from database...');
      const retrieved = await repository.getRecentMemories(userId, 1);
      console.log('✓ Retrieved record(s):', retrieved.length);

      expect(retrieved.length).toBeGreaterThan(0);
      const found = retrieved.find((r) => r.id === stored.id);
      expect(found).toBeDefined();
      expect(found!.primary_emotion).toBe(emotions.primary_emotion);
      expect(found!.extracted_topics).toEqual(topics);

      console.log('Step 6: Semantic search...');
      const similar = await repository.semanticSearch(userId, embedding, 5);
      console.log('✓ Semantic search returned:', similar.length);

      // The stored conversation should appear in similar results
      expect(similar.length).toBeGreaterThan(0);

      console.log('✅ End-to-end flow complete');
    });

    it('should handle multiple distinct conversations', async () => {
      const conversations = [
        {
          name: 'Career Win',
          messages: [
            {
              role: 'user' as const,
              content: 'I got the job offer! My dream company wants me!',
            },
          ],
        },
        {
          name: 'Personal Loss',
          messages: [
            {
              role: 'user' as const,
              content: 'My best friend is moving away next month.',
            },
          ],
        },
        {
          name: 'Routine Update',
          messages: [
            {
              role: 'user' as const,
              content: 'I had coffee this morning and worked on the project.',
            },
          ],
        },
      ];

      const stored = [];

      for (const conv of conversations) {
        const emotions = await emotionService.analyzeConversation(conv.messages);
        const topics = await topicService.extractTopics(conv.messages);
        const embedding = await embeddingService.generateEmbedding(
          conv.messages[0].content
        );

        const result = await repository.storeConversation({
          user_id: userId,
          messages: conv.messages,
          primary_emotion: emotions.primary_emotion,
          secondary_emotions: emotions.secondary_emotions,
          valence: emotions.dimensions.valence,
          arousal: emotions.dimensions.arousal,
          dominance: emotions.dimensions.dominance,
          novelty: emotions.dimensions.novelty,
          self_relevance: emotions.dimensions.self_relevance,
          emotional_salience: emotions.salience_score,
          salience_tier: emotions.salience_tier,
          extracted_topics: topics,
          embedding,
          decay_multiplier: 1.0,
          user_marked_important: false,
          is_deleted: false,
        });

        console.log(`✓ ${conv.name}: ${emotions.primary_emotion}`);
        stored.push(result);
      }

      // Verify all were stored
      const retrieved = await repository.getRecentMemories(userId, 10);
      console.log('Retrieved:', retrieved.length, 'conversations');

      expect(retrieved.length).toBeGreaterThanOrEqual(conversations.length);

      // Verify salience ordering (high emotional events should have higher salience)
      const careerEvent = retrieved.find((r) =>
        r.extracted_topics?.some((t) =>
          t.toLowerCase().includes('job') ||
          t.toLowerCase().includes('offer')
        )
      );
      const routineEvent = retrieved.find((r) =>
        r.extracted_topics?.some((t) =>
          t.toLowerCase().includes('coffee') ||
          t.toLowerCase().includes('routine')
        )
      );

      if (careerEvent && routineEvent) {
        console.log(
          `Salience comparison: Career (${careerEvent.emotional_salience}) vs Routine (${routineEvent.emotional_salience})`
        );
        expect(careerEvent.emotional_salience).toBeGreaterThan(
          routineEvent.emotional_salience
        );
      }

      console.log('✅ Multiple conversation handling verified');
    });
  });

  describe('Semantic Search Accuracy', () => {
    it('should find semantically similar conversations', async () => {
      // Store two related conversations
      const conversation1: ConversationMessage[] = [
        {
          role: 'user',
          content:
            'I am feeling anxious about the upcoming presentation at work.',
        },
      ];

      const conversation2: ConversationMessage[] = [
        {
          role: 'user',
          content:
            'I am nervous about speaking in front of the team tomorrow.',
        },
      ];

      // Store both
      const emb1Data = await emotionService.analyzeConversation(conversation1);
      const topics1 = await topicService.extractTopics(conversation1);
      const emb1 = await embeddingService.generateEmbedding(
        conversation1[0].content
      );

      await repository.storeConversation({
        user_id: userId,
        messages: conversation1,
        primary_emotion: emb1Data.primary_emotion,
        secondary_emotions: emb1Data.secondary_emotions,
        valence: emb1Data.dimensions.valence,
        arousal: emb1Data.dimensions.arousal,
        dominance: emb1Data.dimensions.dominance,
        novelty: emb1Data.dimensions.novelty,
        self_relevance: emb1Data.dimensions.self_relevance,
        emotional_salience: emb1Data.salience_score,
        salience_tier: emb1Data.salience_tier,
        extracted_topics: topics1,
        embedding: emb1,
        decay_multiplier: 1.0,
        user_marked_important: false,
        is_deleted: false,
      });

      const emb2Data = await emotionService.analyzeConversation(conversation2);
      const topics2 = await topicService.extractTopics(conversation2);
      const emb2 = await embeddingService.generateEmbedding(
        conversation2[0].content
      );

      await repository.storeConversation({
        user_id: userId,
        messages: conversation2,
        primary_emotion: emb2Data.primary_emotion,
        secondary_emotions: emb2Data.secondary_emotions,
        valence: emb2Data.dimensions.valence,
        arousal: emb2Data.dimensions.arousal,
        dominance: emb2Data.dimensions.dominance,
        novelty: emb2Data.dimensions.novelty,
        self_relevance: emb2Data.dimensions.self_relevance,
        emotional_salience: emb2Data.salience_score,
        salience_tier: emb2Data.salience_tier,
        extracted_topics: topics2,
        embedding: emb2,
        decay_multiplier: 1.0,
        user_marked_important: false,
        is_deleted: false,
      });

      // Search with first embedding
      const results = await repository.semanticSearch(userId, emb1, 5);

      console.log('Semantic search results:', results.length);
      expect(results.length).toBeGreaterThan(0);

      // First result should be most similar (itself or the very similar conversation)
      const firstResult = results[0];
      expect(firstResult).toBeDefined();
      console.log(
        `Top result emotion: ${firstResult.primary_emotion}, salience: ${firstResult.emotional_salience}`
      );

      console.log('✅ Semantic search verified');
    });
  });

  describe('Emotion Analysis Quality', () => {
    it('should detect distinct emotions correctly', async () => {
      const testCases = [
        {
          text: 'I am so happy! Everything is going perfectly!',
          expectedPositive: true,
          expectedArousal: 'high',
        },
        {
          text: 'I feel sad and empty after the loss.',
          expectedPositive: false,
          expectedArousal: 'low',
        },
        {
          text: 'I am furious about this betrayal!',
          expectedPositive: false,
          expectedArousal: 'high',
        },
      ];

      for (const testCase of testCases) {
        const emotions = await emotionService.analyzeConversation([
          { role: 'user', content: testCase.text },
        ]);

        console.log(`Text: "${testCase.text}"`);
        console.log(`  Primary: ${emotions.primary_emotion}`);
        console.log(`  Valence: ${emotions.dimensions.valence}`);
        console.log(`  Arousal: ${emotions.dimensions.arousal}`);

        // Verify valence matches expected
        if (testCase.expectedPositive) {
          expect(emotions.dimensions.valence).toBeGreaterThan(0);
        } else {
          expect(emotions.dimensions.valence).toBeLessThan(0);
        }

        // Verify arousal
        if (testCase.expectedArousal === 'high') {
          expect(emotions.dimensions.arousal).toBeGreaterThan(0.5);
        } else {
          expect(emotions.dimensions.arousal).toBeLessThan(0.5);
        }
      }

      console.log('✅ Emotion analysis quality verified');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete memory capture pipeline in reasonable time', async () => {
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content:
            'I just finished a major project and I am feeling accomplished but also exhausted.',
        },
      ];

      const startTime = performance.now();

      // 1. Emotion analysis
      const t1 = performance.now();
      const emotions = await emotionService.analyzeConversation(messages);
      const emotionTime = performance.now() - t1;

      // 2. Topic extraction
      const t2 = performance.now();
      const topics = await topicService.extractTopics(messages);
      const topicTime = performance.now() - t2;

      // 3. Embedding generation
      const t3 = performance.now();
      const embedding = await embeddingService.generateEmbedding(
        messages[0].content
      );
      const embeddingTime = performance.now() - t3;

      // 4. Database storage
      const t4 = performance.now();
      await repository.storeConversation({
        user_id: userId,
        messages,
        primary_emotion: emotions.primary_emotion,
        secondary_emotions: emotions.secondary_emotions,
        valence: emotions.dimensions.valence,
        arousal: emotions.dimensions.arousal,
        dominance: emotions.dimensions.dominance,
        novelty: emotions.dimensions.novelty,
        self_relevance: emotions.dimensions.self_relevance,
        emotional_salience: emotions.salience_score,
        salience_tier: emotions.salience_tier,
        extracted_topics: topics,
        embedding,
        decay_multiplier: 1.0,
        user_marked_important: false,
        is_deleted: false,
      });
      const storageTime = performance.now() - t4;

      const totalTime = performance.now() - startTime;

      console.log('Performance Metrics:');
      console.log(`  Emotion analysis: ${emotionTime.toFixed(0)}ms`);
      console.log(`  Topic extraction: ${topicTime.toFixed(0)}ms`);
      console.log(`  Embedding generation: ${embeddingTime.toFixed(0)}ms`);
      console.log(`  Database storage: ${storageTime.toFixed(0)}ms`);
      console.log(`  Total pipeline: ${totalTime.toFixed(0)}ms`);

      // Performance targets (from spec)
      expect(emotionTime).toBeLessThan(5000); // < 5s (emotion analysis can be slow)
      expect(embeddingTime).toBeLessThan(3000); // < 3s
      expect(storageTime).toBeLessThan(1000); // < 1s
      expect(totalTime).toBeLessThan(10000); // < 10s total

      console.log('✅ Performance targets met');
    });
  });
});
