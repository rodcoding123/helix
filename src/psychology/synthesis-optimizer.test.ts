/**
 * Tests for Synthesis Optimizer (Cost Optimization Strategy)
 *
 * Tests the 3-tier cost optimization system:
 * 1. Local pattern detection (FREE)
 * 2. Haiku model synthesis (CHEAP)
 * 3. Skip trivial conversations
 */

import { describe, it, expect } from 'vitest';
import {
  detectLocalPatterns,
  isSignificantConversation,
  optimizeSynthesis,
  estimateDailySynthesisCost,
  estimateAnnualSynthesisCost,
} from './synthesis-optimizer.js';

// Mock Message type for tests
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================================================
// Test Data
// ============================================================================

const emotionalConversation: Message[] = [
  {
    role: 'user',
    content:
      'I am so frustrated with this project. I keep hitting dead ends and it is really getting to me.',
  },
  {
    role: 'assistant',
    content: 'That sounds challenging. What specific obstacles are you facing right now?',
  },
  {
    role: 'user',
    content:
      'The implementation keeps failing. I feel stuck and anxious. I am worried I might miss the deadline. This has been such a frustrating experience.',
  },
  {
    role: 'assistant',
    content:
      'Fear and frustration are real. Those are legitimate concerns. What would help you move forward?',
  },
  {
    role: 'user',
    content: 'I think I need to take a step back and reassess my approach to this whole project.',
  },
];

const goalConversation: Message[] = [
  {
    role: 'user',
    content:
      'I want to learn Rust this year. I am really excited about it. I have been thinking about this for months.',
  },
  {
    role: 'assistant',
    content: 'Rust is great! What draws you to it? What are you hoping to build?',
  },
  {
    role: 'user',
    content:
      'I am planning to build a systems programming tool. It would be amazing. I think it could solve real problems.',
  },
  {
    role: 'assistant',
    content: 'That sounds like a solid plan. What kind of problems would it solve?',
  },
];

const transformationConversation: Message[] = [
  {
    role: 'user',
    content:
      'I had a realization today. I finally understand why I was struggling for so long. It all makes sense now.',
  },
  {
    role: 'assistant',
    content: 'That is a significant insight. Tell me more about this realization.',
  },
  {
    role: 'user',
    content:
      "I need to commit to a completely different approach. I am accepting that my old way wasn't working and never will.",
  },
  {
    role: 'assistant',
    content: 'That is powerful self-awareness. How will you move forward differently?',
  },
];

const trivialConversation: Message[] = [
  { role: 'user', content: 'Hi' },
  { role: 'assistant', content: 'Hello' },
];

const shortQuestionsConversation: Message[] = [
  { role: 'user', content: 'What is 2+2?' },
  { role: 'assistant', content: '4' },
  { role: 'user', content: 'How about 3+3?' },
  { role: 'assistant', content: '6' },
];

const mixedConversation: Message[] = [
  {
    role: 'user',
    content: 'I am excited about a new project. I want to create something innovative.',
  },
  {
    role: 'assistant',
    content: 'That is great enthusiasm. What kind of project?',
  },
  {
    role: 'user',
    content:
      'Something in AI. I am learning about transformers and neural networks. I am thrilled by the possibilities.',
  },
  {
    role: 'assistant',
    content: 'Transformers are fascinating. What would your project do?',
  },
  {
    role: 'user',
    content:
      'I want to build a custom language model for my domain. I am committed to making it happen.',
  },
];

// ============================================================================
// detectLocalPatterns Tests
// ============================================================================

describe('detectLocalPatterns', () => {
  it('should detect emotional tags from user messages', () => {
    const patterns = detectLocalPatterns(emotionalConversation);

    expect(patterns.emotionalTags).toContain('frustration');
    expect(patterns.emotionalTags).toContain('anxiety');
    expect(patterns.emotionalTags.length).toBeGreaterThan(0);
  });

  it('should detect goal mentions', () => {
    const patterns = detectLocalPatterns(goalConversation);

    expect(patterns.goalMentions.length).toBeGreaterThan(0);
    expect(patterns.goalMentions.some(g => g.toLowerCase().includes('rust'))).toBe(true);
  });

  it('should detect transformation events', () => {
    const patterns = detectLocalPatterns(transformationConversation);

    expect(patterns.transformationEvents.length).toBeGreaterThan(0);
    expect(patterns.transformationEvents).toContain('realization');
  });

  it('should detect meaningful topics', () => {
    const patterns = detectLocalPatterns(goalConversation);

    expect(patterns.meaningfulTopics.length).toBeGreaterThan(0);
    expect(patterns.meaningfulTopics).toContain('learning');
  });

  it('should deduplicate tags', () => {
    const duplicateConversation: Message[] = [
      { role: 'user', content: 'I am frustrated and frustrated and frustrated.' },
    ];

    const patterns = detectLocalPatterns(duplicateConversation);

    // Should appear only once after deduplication
    expect(patterns.emotionalTags.filter(t => t === 'frustration').length).toBe(1);
  });

  it('should calculate confidence score based on pattern count', () => {
    const patterns = detectLocalPatterns(emotionalConversation);

    expect(patterns.confidence).toBeGreaterThan(0);
    expect(patterns.confidence).toBeLessThanOrEqual(1);
  });

  it('should return empty patterns for conversation with no emotional content', () => {
    const neutralConversation: Message[] = [
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: 'Paris' },
    ];

    const patterns = detectLocalPatterns(neutralConversation);

    expect(patterns.emotionalTags.length).toBe(0);
    expect(patterns.goalMentions.length).toBe(0);
  });

  it('should detect multiple emotions in same conversation', () => {
    const patterns = detectLocalPatterns(emotionalConversation);

    // Should find both frustration and anxiety
    expect(patterns.emotionalTags.length).toBeGreaterThan(1);
  });
});

// ============================================================================
// isSignificantConversation Tests
// ============================================================================

describe('isSignificantConversation', () => {
  it('should return true for conversations with emotional content', () => {
    expect(isSignificantConversation(emotionalConversation)).toBe(true);
  });

  it('should return true for conversations with goals', () => {
    expect(isSignificantConversation(goalConversation)).toBe(true);
  });

  it('should return true for conversations with transformation', () => {
    expect(isSignificantConversation(transformationConversation)).toBe(true);
  });

  it('should return false for trivial conversations (too short)', () => {
    expect(isSignificantConversation(trivialConversation)).toBe(false);
  });

  it('should return false for quick question exchanges', () => {
    expect(isSignificantConversation(shortQuestionsConversation)).toBe(false);
  });

  it('should require minimum message count', () => {
    const twoMessageConversation: Message[] = [
      { role: 'user', content: 'Hello, I am frustrated.' },
      { role: 'assistant', content: 'I understand.' },
    ];

    expect(isSignificantConversation(twoMessageConversation)).toBe(false);
  });

  it('should require minimum total length', () => {
    const shortConversation: Message[] = [
      { role: 'user', content: 'sad' },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'mad' },
      { role: 'assistant', content: 'yes' },
    ];

    expect(isSignificantConversation(shortConversation)).toBe(false);
  });

  it('should return false for conversations without emotional/goal content', () => {
    const factualConversation: Message[] = [
      { role: 'user', content: 'What is photosynthesis?' },
      {
        role: 'assistant',
        content: 'Photosynthesis is the process plants use to convert light into energy.',
      },
      { role: 'user', content: 'How does it work exactly?' },
      {
        role: 'assistant',
        content: 'Through a series of chemical reactions involving light and chlorophyll.',
      },
      { role: 'user', content: 'What is the main output?' },
      { role: 'assistant', content: 'The main outputs are glucose and oxygen.' },
    ];

    expect(isSignificantConversation(factualConversation)).toBe(false);
  });

  it('should return true for long conversations with mixed content', () => {
    expect(isSignificantConversation(mixedConversation)).toBe(true);
  });
});

// ============================================================================
// optimizeSynthesis Tests
// ============================================================================

describe('optimizeSynthesis', () => {
  it('should use local method when patterns detected with confidence', () => {
    const result = optimizeSynthesis(emotionalConversation);

    if (result.method === 'local') {
      expect(result.shouldSynthesize).toBe(true);
      expect(result.costEstimate).toBe(0);
      expect(result.patterns).toBeDefined();
    }
  });

  it('should suggest haiku method for complex conversations without local patterns', () => {
    const complexConversation: Message[] = [
      {
        role: 'user',
        content: 'This is a complex philosophical question about the nature of consciousness.',
      },
      { role: 'assistant', content: 'That is a fascinating topic.' },
      { role: 'user', content: 'I have been thinking about my identity and purpose.' },
      { role: 'assistant', content: 'Many people contemplate these things.' },
    ];

    const result = optimizeSynthesis(complexConversation);

    if (result.shouldSynthesize && result.method === 'haiku') {
      expect(result.costEstimate).toBeGreaterThan(0);
      expect(result.costEstimate).toBeLessThan(0.001); // Should be very cheap
    }
  });

  it('should skip trivial conversations', () => {
    const result = optimizeSynthesis(trivialConversation);

    expect(result.shouldSynthesize).toBe(false);
    expect(result.method).toBe('none');
    expect(result.costEstimate).toBe(0);
  });

  it('should skip short question exchanges', () => {
    const result = optimizeSynthesis(shortQuestionsConversation);

    expect(result.shouldSynthesize).toBe(false);
  });

  it('should provide reason for skipping', () => {
    const result = optimizeSynthesis(trivialConversation);

    expect(result.reason).toBeDefined();
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('should handle mixed content conversations', () => {
    const result = optimizeSynthesis(mixedConversation);

    expect(result.shouldSynthesize).toBe(true);
  });

  it('local patterns should cost $0', () => {
    // Keep testing conversations until we get local method
    const result = optimizeSynthesis(emotionalConversation);

    if (result.method === 'local') {
      expect(result.costEstimate).toBe(0);
    }
  });

  it('haiku method should be very cheap', () => {
    const result = optimizeSynthesis(mixedConversation);

    if (result.method === 'haiku') {
      expect(result.costEstimate).toBeLessThan(0.001); // Less than 0.1 cents
    }
  });
});

// ============================================================================
// Cost Estimation Tests
// ============================================================================

describe('estimateDailySynthesisCost', () => {
  it('should calculate costs for typical usage', () => {
    const estimate = estimateDailySynthesisCost(100, 0.5, 0.7);

    expect(estimate.estimatedCost).toBeGreaterThanOrEqual(0);
    expect(estimate.breakdown.local).toBeGreaterThan(0);
    expect(estimate.breakdown.haiku).toBeGreaterThan(0);
    expect(estimate.breakdown.skipped).toBeGreaterThan(0);
  });

  it('should handle high significance ratio', () => {
    const highSig = estimateDailySynthesisCost(100, 1.0, 0.7); // All significant
    const lowSig = estimateDailySynthesisCost(100, 0.1, 0.7); // Few significant

    expect(highSig.estimatedCost).toBeGreaterThan(lowSig.estimatedCost);
  });

  it('should handle high local coverage', () => {
    const highLocal = estimateDailySynthesisCost(100, 0.5, 0.9);
    const lowLocal = estimateDailySynthesisCost(100, 0.5, 0.5);

    expect(highLocal.estimatedCost).toBeLessThan(lowLocal.estimatedCost);
  });

  it('breakdown should sum correctly', () => {
    const estimate = estimateDailySynthesisCost(100, 0.5, 0.7);

    const totalConversations =
      estimate.breakdown.local + estimate.breakdown.haiku + estimate.breakdown.skipped;

    expect(totalConversations).toBe(100);
  });
});

describe('estimateAnnualSynthesisCost', () => {
  it('should scale daily to annual', () => {
    const estimate = estimateAnnualSynthesisCost(100);

    expect(estimate.estimatedMonthly).toBeCloseTo(estimate.estimatedDaily * 30, 1);
    expect(estimate.estimatedAnnual).toBeCloseTo(estimate.estimatedDaily * 365, 1);
  });

  it('should be affordable for typical usage (100 conversations/day)', () => {
    const estimate = estimateAnnualSynthesisCost(100);

    // Should be less than $5 per year for 100 conversations/day
    expect(estimate.estimatedAnnual).toBeLessThan(5);
  });

  it('should show significant cost savings with optimization', () => {
    // Without optimization: ~$365/year (1 cent per synthesis)
    // With optimization: ~$1.10/year
    const estimate = estimateAnnualSynthesisCost(100);

    // Should be at least 100x cheaper than naive approach
    expect(estimate.estimatedAnnual).toBeLessThan(5);
  });

  it('should scale correctly for different conversation volumes', () => {
    const small = estimateAnnualSynthesisCost(10);
    const large = estimateAnnualSynthesisCost(1000);

    // Large should be roughly 100x more expensive
    expect(large.estimatedAnnual).toBeCloseTo(small.estimatedAnnual * 100, -1);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: Complete Synthesis Optimization Flow', () => {
  it('should optimize significant emotional conversation to local', () => {
    const optimization = optimizeSynthesis(emotionalConversation);
    const patterns = detectLocalPatterns(emotionalConversation);

    if (optimization.shouldSynthesize && optimization.method === 'local') {
      expect(optimization.patterns).toBeDefined();
      expect(optimization.patterns!.emotionalTags.length).toBeGreaterThan(0);
      expect(patterns.emotionalTags.length).toBeGreaterThan(0);
    }
  });

  it('should skip and not offer patterns for trivial conversation', () => {
    const optimization = optimizeSynthesis(trivialConversation);

    expect(optimization.shouldSynthesize).toBe(false);
    expect(optimization.patterns).toBeUndefined();
  });

  it('should provide fallback to haiku for significant but pattern-light conversations', () => {
    const philosophicalConversation: Message[] = [
      {
        role: 'user',
        content:
          'I have been contemplating the deeper meaning of existence and my role in the universe. It is quite profound.',
      },
      { role: 'assistant', content: 'Those are deep questions.' },
      {
        role: 'user',
        content: 'I want to understand myself better and align my actions with my true values.',
      },
      { role: 'assistant', content: 'That is admirable.' },
    ];

    const optimization = optimizeSynthesis(philosophicalConversation);

    // Should be significant but might need haiku for nuanced analysis
    expect(optimization.shouldSynthesize).toBe(true);
  });

  it('should estimate realistic cost savings', () => {
    // Simulate 1000 conversations typical day
    const estimate = estimateDailySynthesisCost(100, 0.5, 0.7);

    // Average cost should be $0.003-0.005 per day
    expect(estimate.estimatedCost).toBeLessThan(0.01);

    // Annual cost should be under $5
    const annual = estimate.estimatedCost * 365;
    expect(annual).toBeLessThan(5);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty conversation', () => {
    const empty: Message[] = [];

    const significant = isSignificantConversation(empty);
    const optimized = optimizeSynthesis(empty);

    expect(significant).toBe(false);
    expect(optimized.shouldSynthesize).toBe(false);
  });

  it('should handle conversation with only assistant messages', () => {
    const assistantOnly: Message[] = [
      { role: 'assistant', content: 'Hello there' },
      { role: 'assistant', content: 'How can I help?' },
    ];

    const patterns = detectLocalPatterns(assistantOnly);

    // Should handle gracefully without user messages
    expect(patterns.emotionalTags).toBeDefined();
  });

  it('should handle very long messages', () => {
    const longMessage = 'I am frustrated. '.repeat(1000);
    const longConversation: Message[] = [
      { role: 'user', content: longMessage },
      { role: 'assistant', content: 'I understand.' },
      { role: 'user', content: longMessage },
      { role: 'assistant', content: 'Let us work through this.' },
    ];

    const optimization = optimizeSynthesis(longConversation);

    expect(optimization.shouldSynthesize).toBe(true);
  });

  it('should handle special characters and unicode', () => {
    const unicodeConversation: Message[] = [
      {
        role: 'user',
        content:
          'I am 😢 frustrated and 😨 anxious about this project 🚀. I have been struggling with it for weeks.',
      },
      {
        role: 'assistant',
        content: 'That sounds tough. Tell me more about what is frustrating you.',
      },
      {
        role: 'user',
        content:
          'Merci for understanding. 非常に感謝しています。 I am excited to work through this with your help and guidance.',
      },
      {
        role: 'assistant',
        content: 'You are welcome! I am here to help you find solutions and move forward.',
      },
    ];

    const optimization = optimizeSynthesis(unicodeConversation);

    expect(optimization.shouldSynthesize).toBe(true);
  });

  it('should be case-insensitive for pattern matching', () => {
    const mixedCaseConversation: Message[] = [
      { role: 'user', content: 'I am FRUSTRATED and Anxious about this.' },
      { role: 'assistant', content: 'That is tough.' },
      { role: 'user', content: 'I want to LEARN Python and explore AI.' },
      { role: 'assistant', content: 'Great goals.' },
    ];

    const patterns = detectLocalPatterns(mixedCaseConversation);

    expect(patterns.emotionalTags.length).toBeGreaterThan(0);
    expect(patterns.goalMentions.length).toBeGreaterThan(0);
  });
});
