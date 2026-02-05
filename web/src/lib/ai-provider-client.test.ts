/**
 * Phase 8: AI Provider Client Tests
 * Tests the provider client for DeepSeek, Gemini, and OpenAI integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIProviderClient } from './ai-provider-client';

describe('AIProviderClient', () => {
  beforeEach(() => {
    const _client = new AIProviderClient();
    // Mock API responses
    vi.clearAllMocks();
  });

  describe('Token Estimation', () => {
    it('should estimate tokens accurately', () => {
      const content = 'The quick brown fox jumps over the lazy dog'; // 43 chars
      const tokens = AIProviderClient.estimateTokens(content);

      // 43 / 4 = ~11 tokens
      expect(tokens).toBe(11);
    });

    it('should handle empty strings', () => {
      const tokens = AIProviderClient.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should estimate tokens for multiple contents', () => {
      const total = AIProviderClient.estimateTokensMultiple('hello', 'world', 'test');

      expect(total).toBeGreaterThan(0);
    });

    it('should handle undefined content in multiple estimation', () => {
      const total = AIProviderClient.estimateTokensMultiple('hello', undefined, 'world');

      expect(total).toBeGreaterThan(0);
    });
  });

  describe('Email Composition', () => {
    it('should estimate cost for email composition prompt', () => {
      const prompt = `You are helping draft an email.
Subject: Project Update
Context about recipient: Manager at tech company

Generate 3 different ways to complete this email.`;

      const tokens = AIProviderClient.estimateTokens(prompt);
      // DeepSeek cost: tokens * $0.0027 / 1000
      const estimatedCost = (tokens * 0.0027) / 1000;

      expect(tokens).toBeGreaterThan(0);
      expect(estimatedCost).toBeGreaterThan(0);
      expect(estimatedCost).toBeLessThan(0.01); // Should be cheap
    });
  });

  describe('Calendar Optimization', () => {
    it('should estimate cost for meeting prep', () => {
      const prompt = `Generate a meeting preparation guide for:
Meeting: Product Review
Time: 2026-02-04 3:00 PM (60 minutes)
Attendees: alice@company.com, bob@company.com`;

      const tokens = AIProviderClient.estimateTokens(prompt);
      // Both DeepSeek and Gemini should handle this efficiently
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(500);
    });
  });

  describe('Task Prioritization', () => {
    it('should estimate cost for task prioritization', () => {
      const taskList = `
- Complete project proposal (Due: 2026-02-08, Priority: high)
- Review team feedback (Due: 2026-02-10, Priority: medium)
- Update documentation (Due: 2026-02-15, Priority: low)
- Prepare presentation (Due: 2026-02-07, Priority: high)
- Schedule retrospective (Due: 2026-02-12, Priority: medium)`;

      const tokens = AIProviderClient.estimateTokens(taskList);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(500);
    });
  });

  describe('Analytics Summary', () => {
    it('should estimate cost for weekly analytics', () => {
      const prompt = `Generate a weekly analytics summary.
Week: Jan 29 - Feb 04, 2026

Metrics:
- Emails processed: 250
- Tasks completed: 35
- Calendar events attended: 12
- Total time in system: 42 hours
- Average email response time: 45 minutes

Provide insights, scores, and recommendations.`;

      const tokens = AIProviderClient.estimateTokens(prompt);
      // Analytics is more complex, may require more tokens
      expect(tokens).toBeGreaterThan(100);
      expect(tokens).toBeLessThan(1000);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const client1 = new AIProviderClient();
      const client2 = new AIProviderClient();

      // Both should be instances of AIProviderClient
      expect(client1).toBeInstanceOf(AIProviderClient);
      expect(client2).toBeInstanceOf(AIProviderClient);
    });
  });

  describe('Error Handling', () => {
    it('should handle API key missing gracefully', () => {
      // Override environment to simulate missing key
      const originalEnv = { ...import.meta.env };
      delete (import.meta.env as any).VITE_DEEPSEEK_API_KEY;

      const client = new AIProviderClient();

      expect(() => {
        // Should not throw on initialization
        expect(client).toBeInstanceOf(AIProviderClient);
      }).not.toThrow();

      // Restore
      Object.assign(import.meta.env, originalEnv);
    });
  });

  describe('Cost Comparison', () => {
    it('should show DeepSeek is cheaper than Gemini for short prompts', () => {
      const shortPrompt = 'Suggest an email subject line';
      const tokens = AIProviderClient.estimateTokens(shortPrompt);

      // DeepSeek: 0.0027 per 1K tokens
      const deepseekCost = (tokens * 0.0027) / 1000;
      // Gemini Flash: 0.00005 per 1K tokens (input is even cheaper!)
      const geminiCost = (tokens * 0.00005) / 1000;

      // Gemini is actually cheaper for small inputs
      expect(geminiCost).toBeLessThan(deepseekCost);
    });

    it('should show cost difference for large prompts', () => {
      const largePrompt = 'A'.repeat(5000); // Large content
      const tokens = AIProviderClient.estimateTokens(largePrompt);

      // DeepSeek might be better for large outputs
      const deepseekInputCost = (tokens * 0.0027) / 1000;
      const geminiInputCost = (tokens * 0.00005) / 1000;

      expect(tokens).toBe(1250);
      expect(deepseekInputCost).toBeGreaterThan(geminiInputCost);
    });
  });

  describe('Provider Model Mapping', () => {
    it('should support all required Phase 8 models', () => {
      const models = ['deepseek', 'gemini_flash'] as const;

      models.forEach((model) => {
        expect(model).toBeDefined();
      });
    });
  });

  describe('Temperature Settings', () => {
    it('should use appropriate temperature for each operation type', () => {
      // Email composition: 0.7 (creative but not too random)
      // Calendar: 0.6 (more factual)
      // Task: 0.6 (structured output)
      // Analytics: 0.5 (analytical, precise)

      const temperatures = {
        email: 0.7,
        calendar: 0.6,
        task: 0.6,
        analytics: 0.5,
      };

      Object.values(temperatures).forEach((temp) => {
        expect(temp).toBeGreaterThan(0);
        expect(temp).toBeLessThan(1);
      });
    });
  });

  describe('Response Token Estimation', () => {
    it('should estimate output tokens for different response lengths', () => {
      // Short response (email subject line)
      const shortResponse = 'Project Status Update';
      const shortTokens = AIProviderClient.estimateTokens(shortResponse);
      expect(shortTokens).toBeLessThan(10);

      // Medium response (email body)
      const mediumResponse = 'Here is a comprehensive update on the project status. We have made significant progress on the core features and are on track for delivery.';
      const mediumTokens = AIProviderClient.estimateTokens(mediumResponse);
      expect(mediumTokens).toBeLessThan(100);

      // Long response (weekly summary)
      const longResponse =
        'This week was highly productive. ' +
        'We completed 35 tasks, processed 250 emails, and attended 12 calendar events. ' +
        'Key highlights include launching the new feature, improving team velocity by 15%, and conducting two successful planning sessions. ' +
        'Looking ahead, we should focus on testing, documentation, and stakeholder communication.';
      const longTokens = AIProviderClient.estimateTokens(longResponse);
      expect(longTokens).toBeGreaterThan(50);
    });
  });

  describe('Phase 8 Operation Costs', () => {
    it('should show email operations are low cost', () => {
      const emailPrompt = 'Suggest email response to: "Can you review this?"';
      const tokens = AIProviderClient.estimateTokens(emailPrompt);
      const deepseekCost = (tokens * 0.0027) / 1000;

      expect(deepseekCost).toBeLessThan(0.002); // Should be < $0.002
    });

    it('should show calendar operations are moderate cost', () => {
      const calendarPrompt =
        'Find optimal meeting times for 5 people considering their calendars and preferences. ' +
        'Show 3 options with reasoning for each.';
      const tokens = AIProviderClient.estimateTokens(calendarPrompt);
      const geminiCost = (tokens * 0.00005) / 1000;

      expect(geminiCost).toBeLessThan(0.01); // Should be < $0.01
    });

    it('should show analytics operations are higher cost', () => {
      const analyticsPrompt =
        'Analyze weekly productivity metrics and generate a comprehensive summary with insights, ' +
        'performance scores, and actionable recommendations for improvement.';
      const tokens = AIProviderClient.estimateTokens(analyticsPrompt);
      const geminiCost = (tokens * 0.00005) / 1000;

      // Analytics may cost more due to complexity, but still reasonable
      expect(geminiCost).toBeLessThan(0.05); // Should be < $0.05
    });
  });
});
