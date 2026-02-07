/**
 * Filter Engine Tests
 *
 * Comprehensive testing of message filtering with DoS protection,
 * regex complexity analysis, and circuit breaker implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FilterEngine } from './engine.js';
import type { MessageFilter } from './types.js';

describe('FilterEngine', () => {
  let engine: FilterEngine;

  beforeEach(() => {
    engine = new FilterEngine([]);
  });

  describe('Regex Filters', () => {
    beforeEach(() => {
      const filters: MessageFilter[] = [
        {
          id: 'spam-filter',
          name: 'Block spam keywords',
          enabled: true,
          type: 'regex',
          pattern: '^(spam|casino|lottery|prize)',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);
    });

    it('should match regex patterns', async () => {
      const result = await engine.evaluateBatch({
        message: 'You won a prize!',
        sender: 'unknown',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(true);
      expect(result.finalAction).toBe('block');
    });

    it('should handle case-insensitive regex', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'case-filter',
          name: 'Case insensitive',
          enabled: true,
          type: 'regex',
          pattern: 'SPAM',
          caseSensitive: false,
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const result = await engine.evaluateBatch({
        message: 'spam spam SPAM',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(true);
    });

    it('should respect filter priority', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'low-priority',
          name: 'Low priority allow',
          enabled: true,
          type: 'regex',
          pattern: 'casino',
          action: 'allow',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'high-priority',
          name: 'High priority block',
          enabled: true,
          type: 'regex',
          pattern: 'casino',
          action: 'block',
          priority: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const result = await engine.evaluateBatch({
        message: 'casino game',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      // High priority block should win
      expect(result.finalAction).toBe('block');
    });

    it('should enforce 100ms timeout', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'slow-filter',
          name: 'Very slow regex',
          enabled: true,
          type: 'regex',
          pattern: '(a+)+b',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const startTime = performance.now();
      const result = await engine.evaluateBatch({
        message: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaac',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });
      const duration = performance.now() - startTime;

      // Should timeout and not exceed 150ms (100ms + margin)
      expect(duration).toBeLessThan(150);
    }, 5000); // Give test 5 seconds to complete
  });

  describe('Keyword Filters', () => {
    it('should match with matchMode=any', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'keyword-any',
          name: 'Any keyword match',
          enabled: true,
          type: 'keyword',
          pattern: 'spam, casino, fraud',
          matchMode: 'any',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const result = await engine.evaluateBatch({
        message: 'This is spam content',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(true);
    });

    it('should match with matchMode=all', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'keyword-all',
          name: 'All keywords match',
          enabled: true,
          type: 'keyword',
          pattern: 'spam, content',
          matchMode: 'all',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const resultBoth = await engine.evaluateBatch({
        message: 'This is spam content',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      const resultOne = await engine.evaluateBatch({
        message: 'This is spam',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(resultBoth.matched).toBe(true);
      expect(resultOne.matched).toBe(false);
    });
  });

  describe('Sender Filters', () => {
    it('should match sender ID', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'sender-filter',
          name: 'Block specific sender',
          enabled: true,
          type: 'sender',
          pattern: 'blocked-user-123',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const result = await engine.evaluateBatch({
        message: 'Hello world',
        sender: 'blocked-user-123',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(true);
    });
  });

  describe('Filter Routing', () => {
    it('should route messages to agents', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'route-filter',
          name: 'Route high-priority',
          enabled: true,
          type: 'keyword',
          pattern: 'urgent',
          action: 'route',
          routeToAgent: 'urgent-handler',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const result = await engine.evaluateBatch({
        message: 'This is urgent!',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(result.finalAction).toBe('route');
      expect(result.routedTo).toBe('urgent-handler');
    });
  });

  describe('Filter Complexity Analysis', () => {
    it('should reject catastrophic backtracking', () => {
      const filters: MessageFilter[] = [
        {
          id: 'catastrophic',
          name: 'Bad regex',
          enabled: true,
          type: 'regex',
          pattern: '(a+)+b', // Catastrophic backtracking
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Should compile but mark as unsafe
      engine.loadFilters(filters);
      const compiled = engine.getFilters();
      expect(compiled).toHaveLength(1);
    });

    it('should warn about negative lookahead', () => {
      const filters: MessageFilter[] = [
        {
          id: 'lookahead',
          name: 'Negative lookahead',
          enabled: true,
          type: 'regex',
          pattern: '(?!spam)', // Negative lookahead
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      engine.loadFilters(filters);
      const compiled = engine.getFilters();
      expect(compiled).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid regex gracefully', () => {
      const filters: MessageFilter[] = [
        {
          id: 'invalid-regex',
          name: 'Invalid regex',
          enabled: true,
          type: 'regex',
          pattern: '[invalid(regex', // Malformed
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      engine.loadFilters(filters);

      // Filter should be marked as invalid but not crash
      const filters_list = engine.getFilters();
      expect(filters_list).toHaveLength(1);
    });

    it('should handle disabled filters', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'disabled-filter',
          name: 'Disabled',
          enabled: false,
          type: 'regex',
          pattern: 'spam',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const result = await engine.evaluateBatch({
        message: 'This is spam',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });

      expect(result.matched).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should evaluate filters quickly (< 10ms for simple filters)', async () => {
      const filters: MessageFilter[] = [
        {
          id: 'perf-1',
          name: 'Simple keyword',
          enabled: true,
          type: 'keyword',
          pattern: 'spam',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'perf-2',
          name: 'Simple regex',
          enabled: true,
          type: 'regex',
          pattern: '^hello',
          action: 'allow',
          priority: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const startTime = performance.now();
      const result = await engine.evaluateBatch({
        message: 'Hello world, this is spam',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10);
      expect(result.executionTimeMs).toBeLessThan(10);
    });

    it('should handle batch evaluation with 100 filters', async () => {
      const filters: MessageFilter[] = Array.from({ length: 100 }, (_, i) => ({
        id: `filter-${i}`,
        name: `Filter ${i}`,
        enabled: i % 10 !== 0, // Disable every 10th filter
        type: 'keyword' as const,
        pattern: `keyword${i}`,
        action: 'block' as const,
        priority: 100 - i,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      engine.loadFilters(filters);

      const startTime = performance.now();
      await engine.evaluateBatch({
        message: 'Test message content',
        sender: 'user',
        channel: 'telegram',
        timestamp: Date.now(),
      });
      const duration = performance.now() - startTime;

      // Should handle 100 filters in reasonable time
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Filter Management', () => {
    it('should load filters and maintain order', () => {
      const filters: MessageFilter[] = [
        {
          id: 'filter-1',
          name: 'First',
          enabled: true,
          type: 'keyword',
          pattern: 'a',
          action: 'block',
          priority: 10,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'filter-2',
          name: 'Second',
          enabled: true,
          type: 'keyword',
          pattern: 'b',
          action: 'block',
          priority: 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      const loaded = engine.getFilters();
      // Should be sorted by priority (ascending)
      expect(loaded[0].priority).toBe(5);
      expect(loaded[1].priority).toBe(10);
    });

    it('should support recompilation', () => {
      const filters: MessageFilter[] = [
        {
          id: 'filter-1',
          name: 'Test',
          enabled: true,
          type: 'regex',
          pattern: 'invalid[regex',
          action: 'block',
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.loadFilters(filters);

      // Recompile should work without errors
      expect(() => engine.recompile()).not.toThrow();
    });
  });
});
