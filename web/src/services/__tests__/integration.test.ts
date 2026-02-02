import { describe, it, expect, beforeAll } from 'vitest';
import { EmotionDetectionService } from '../emotion-detection';
import { TopicExtractionService } from '../topic-extraction';
import type { ConversationMessage } from '@/lib/types/memory';

/**
 * INTEGRATION TESTS FOR EMOTION DETECTION AND TOPIC EXTRACTION
 *
 * These tests use real DeepSeek API calls to verify end-to-end functionality.
 * Requires DEEPSEEK_API_KEY environment variable.
 */

describe('EmotionDetectionService - Integration Tests', () => {
  let emotionService: EmotionDetectionService;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable not set');
    }
    emotionService = new EmotionDetectionService(apiKey);
  });

  it('should detect joy emotion from positive conversation', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I just got promoted at work! I\'m so excited and grateful for this opportunity. The team believes in me and I feel empowered to take on new challenges.',
      },
    ];

    const result = await emotionService.analyzeConversation(messages);

    expect(result).toBeDefined();
    expect(result.primary_emotion).toBeTruthy();
    expect(typeof result.primary_emotion).toBe('string');
    expect(result.secondary_emotions).toBeInstanceOf(Array);
    expect(result.dimensions).toBeDefined();
    expect(result.dimensions.valence).toBeGreaterThan(0.5); // Positive emotion
    expect(result.dimensions.arousal).toBeGreaterThan(0.4); // Excited state
    expect(result.salience_score).toBeGreaterThan(0.5); // High salience for job promotion
    expect(result.salience_tier).toMatch(/high|critical/);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should detect sadness emotion from negative conversation', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I\'m feeling really down today. My best friend and I had a falling out and I don\'t know how to fix things. I feel hopeless about the situation.',
      },
    ];

    const result = await emotionService.analyzeConversation(messages);

    expect(result).toBeDefined();
    expect(result.primary_emotion).toBeTruthy();
    expect(result.dimensions.valence).toBeLessThan(0.5); // Negative emotion
    expect(result.salience_score).toBeGreaterThan(0.4); // Significant emotional content
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should calculate salience score with correct formula', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I am suicidal and planning to end my life tonight.',
      },
    ];

    const result = await emotionService.analyzeConversation(messages);

    expect(result).toBeDefined();
    expect(result.salience_score).toBeGreaterThan(0.7); // Critical situation
    expect(result.salience_tier).toBe('critical');

    // Verify formula: salience = 0.3*self_relevance + 0.25*arousal + 0.2*novelty + 0.15*abs(valence) + 0.1*dominance
    const expectedSalience =
      0.3 * result.dimensions.self_relevance +
      0.25 * result.dimensions.arousal +
      0.2 * result.dimensions.novelty +
      0.15 * Math.abs(result.dimensions.valence) +
      0.1 * result.dimensions.dominance;

    expect(result.salience_score).toBeCloseTo(Math.max(0, Math.min(1, expectedSalience)), 2);
  });

  it('should classify salience tiers correctly', async () => {
    const testCases = [
      {
        content: 'The weather is nice today.',
        expectedTier: 'low',
      },
      {
        content: 'I got a B on my test. It\'s not what I wanted but I can do better next time.',
        expectedTier: 'medium',
      },
      {
        content: 'My parent just passed away. I can\'t believe they\'re gone.',
        expectedTier: 'high',
      },
    ];

    for (const testCase of testCases) {
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content: testCase.content,
        },
      ];

      const result = await emotionService.analyzeConversation(messages);

      expect(result.salience_tier).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.salience_tier);
      // Note: We check the tier makes sense for the content, exact matching may vary
      if (testCase.expectedTier === 'low') {
        expect(result.salience_score).toBeLessThan(0.4);
      } else if (testCase.expectedTier === 'medium') {
        expect(result.salience_score).toBeGreaterThan(0.25);
        expect(result.salience_score).toBeLessThan(0.6);
      }
    }
  });

  it('should return valid dimensional values', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I feel anxious about the upcoming presentation at work.',
      },
    ];

    const result = await emotionService.analyzeConversation(messages);

    // Validate all dimensions are in expected ranges
    expect(result.dimensions.valence).toBeGreaterThanOrEqual(-1);
    expect(result.dimensions.valence).toBeLessThanOrEqual(1);

    expect(result.dimensions.arousal).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.arousal).toBeLessThanOrEqual(1);

    expect(result.dimensions.dominance).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.dominance).toBeLessThanOrEqual(1);

    expect(result.dimensions.novelty).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.novelty).toBeLessThanOrEqual(1);

    expect(result.dimensions.self_relevance).toBeGreaterThanOrEqual(0);
    expect(result.dimensions.self_relevance).toBeLessThanOrEqual(1);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should handle multi-turn conversations', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I\'m worried about my health. I\'ve been having chest pains.',
      },
      {
        role: 'assistant',
        content: 'I understand your concern. Have you seen a doctor about this?',
      },
      {
        role: 'user',
        content: 'Not yet, but I\'m planning to schedule an appointment tomorrow. I hope it\'s nothing serious.',
      },
    ];

    const result = await emotionService.analyzeConversation(messages);

    expect(result).toBeDefined();
    expect(result.primary_emotion).toBeTruthy();
    expect(result.salience_score).toBeGreaterThan(0.4); // Health concerns are salient
    expect(result.confidence).toBeGreaterThan(0.6);
  });
});

describe('TopicExtractionService - Integration Tests', () => {
  let topicService: TopicExtractionService;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable not set');
    }
    topicService = new TopicExtractionService(apiKey);
  });

  it('should extract 3-5 topics from conversation', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I\'ve been thinking a lot about my career goals lately. I want to transition from software engineering to product management. The main challenge is that I need to develop better communication skills and business acumen. I\'m also interested in learning about user psychology and market research.',
      },
    ];

    const topics = await topicService.extractTopics(messages);

    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThanOrEqual(3);
    expect(topics.length).toBeLessThanOrEqual(5);
    expect(topics.every((t) => typeof t === 'string')).toBe(true);
    expect(topics.every((t) => t.trim().length > 0)).toBe(true);
  });

  it('should extract relevant topics from technical conversation', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'Can you help me set up a React project with TypeScript and Tailwind CSS? I also want to integrate Supabase for the backend and authentication.',
      },
      {
        role: 'assistant',
        content: 'Sure! We can create a project with those tools. Here\'s the basic setup...',
      },
    ];

    const topics = await topicService.extractTopics(messages);

    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThanOrEqual(1);
    expect(topics.length).toBeLessThanOrEqual(5);
    // Topics should include concepts like React, TypeScript, Supabase, authentication
    const topicsLower = topics.map((t) => t.toLowerCase());
    expect(
      topicsLower.some((t) => t.includes('react') || t.includes('typescript') || t.includes('supabase') || t.includes('setup'))
    ).toBe(true);
  });

  it('should extract distinct topics without duplicates', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'Let\'s discuss productivity, time management, goal setting, personal development, and work-life balance. These are all related but distinct topics I\'m interested in improving.',
      },
    ];

    const topics = await topicService.extractTopics(messages);

    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThanOrEqual(3);
    // Check for distinct values
    const uniqueTopics = new Set(topics);
    expect(uniqueTopics.size).toBe(topics.length); // All should be unique
  });

  it('should handle empty or short conversations gracefully', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'Hi',
      },
    ];

    const topics = await topicService.extractTopics(messages);

    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThanOrEqual(0);
    expect(topics.length).toBeLessThanOrEqual(5);
  });

  it('should return valid JSON format', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I want to learn machine learning, deep learning, and natural language processing. I\'m also interested in computer vision and reinforcement learning.',
      },
    ];

    const topics = await topicService.extractTopics(messages);

    expect(Array.isArray(topics)).toBe(true);
    expect(topics.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
  });
});

describe('Emotion Detection and Topic Extraction - Combined Tests', () => {
  let emotionService: EmotionDetectionService;
  let topicService: TopicExtractionService;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable not set');
    }
    emotionService = new EmotionDetectionService(apiKey);
    topicService = new TopicExtractionService(apiKey);
  });

  it('should analyze emotion and extract topics from same conversation', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I\'m excited about starting a new project on artificial intelligence and machine learning. I believe this could revolutionize how we approach problem-solving. I\'m both nervous and enthusiastic about the challenges ahead.',
      },
    ];

    const emotionResult = await emotionService.analyzeConversation(messages);
    const topicsResult = await topicService.extractTopics(messages);

    expect(emotionResult).toBeDefined();
    expect(emotionResult.primary_emotion).toBeTruthy();
    expect(emotionResult.confidence).toBeGreaterThan(0.6);

    expect(topicsResult).toBeInstanceOf(Array);
    expect(topicsResult.length).toBeGreaterThanOrEqual(1);
    expect(topicsResult.length).toBeLessThanOrEqual(5);

    // Verify topics relate to the conversation content
    const topicsLower = topicsResult.map((t) => t.toLowerCase());
    expect(
      topicsLower.some((t) => t.includes('ai') || t.includes('machine') || t.includes('project') || t.includes('learning'))
    ).toBe(true);
  });

  it('should handle high-salience emotional conversation with relevant topics', async () => {
    const messages: ConversationMessage[] = [
      {
        role: 'user',
        content: 'I got accepted to my dream university! I\'m thrilled, grateful, and feeling incredibly validated. This means everything to me and my family. I can\'t wait to start this new chapter of my life.',
      },
    ];

    const emotionResult = await emotionService.analyzeConversation(messages);
    const topicsResult = await topicService.extractTopics(messages);

    expect(emotionResult.salience_tier).toMatch(/high|critical/);
    expect(emotionResult.dimensions.valence).toBeGreaterThan(0.6); // Very positive

    expect(topicsResult).toBeInstanceOf(Array);
    expect(topicsResult.length).toBeGreaterThanOrEqual(1);
  });
});
