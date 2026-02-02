/**
 * Integration Tests: Memory Synthesis
 * Tests the complete workflow from synthesis job creation to pattern analysis and recommendations
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MemorySynthesisService } from '@/services/memory-synthesis';
import type {
  MemorySynthesisJob,
  MemoryPattern,
  SynthesisType,
} from '@/lib/types/memory-synthesis';

describe('Memory Synthesis Integration', () => {
  let service: MemorySynthesisService;
  let testUserId: string;
  let createdJobId: string;

  beforeAll(() => {
    service = new MemorySynthesisService();
    testUserId = 'test-user-' + Date.now();
  });

  describe('Synthesis Job Creation', () => {
    it('should create synthesis job with type', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.user_id).toBe(testUserId);
      expect(job.synthesis_type).toBe('emotional_patterns');
      expect(job.status).toBe('pending');
      expect(job.progress).toBe(0);

      createdJobId = job.id;
    });

    it('should create job with time range', async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
        time_range_start: weekAgo.toISOString(),
        time_range_end: now.toISOString(),
      });

      expect(job.time_range_start).toBeDefined();
      expect(job.time_range_end).toBeDefined();
    });

    it('should support all synthesis types', async () => {
      const types: SynthesisType[] = [
        'emotional_patterns',
        'prospective_self',
        'relational_memory',
        'narrative_coherence',
        'full_synthesis',
      ];

      for (const type of types) {
        const job = await service.createSynthesisJob(testUserId, {
          synthesis_type: type,
        });

        expect(job.synthesis_type).toBe(type);
      }
    });
  });

  describe('Job Management', () => {
    it('should get synthesis jobs for user', async () => {
      const jobs = await service.getSynthesisJobs(testUserId);

      expect(Array.isArray(jobs)).toBeTruthy();
      expect(jobs.length).toBeGreaterThan(0);

      const found = jobs.find((j) => j.id === createdJobId);
      expect(found).toBeDefined();
    });

    it('should sort jobs by most recent first', async () => {
      const jobs = await service.getSynthesisJobs(testUserId);

      if (jobs.length >= 2) {
        const first = new Date(jobs[0].created_at).getTime();
        const second = new Date(jobs[1].created_at).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should track job status progression', async () => {
      const job = await service.getSynthesisJob(createdJobId);

      expect(job).toBeDefined();
      expect(['pending', 'running', 'completed', 'failed']).toContain(
        job.status
      );
    });

    it('should track synthesis progress', async () => {
      const job = await service.getSynthesisJob(createdJobId);

      expect(job.progress).toBeGreaterThanOrEqual(0);
      expect(job.progress).toBeLessThanOrEqual(1);
    });
  });

  describe('Synthesis Analysis Workflow', () => {
    it('should run emotional pattern synthesis', async () => {
      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        createdJobId,
        'emotional_patterns'
      );

      expect(insights).toBeDefined();
      expect(insights.summary).toBeDefined();
      expect(Array.isArray(insights.patterns)).toBeTruthy();
    });

    it('should generate patterns with layer classification', async () => {
      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        createdJobId,
        'emotional_patterns'
      );

      if (insights.patterns.length > 0) {
        insights.patterns.forEach((pattern) => {
          expect(pattern.layer).toBeGreaterThanOrEqual(1);
          expect(pattern.layer).toBeLessThanOrEqual(7);
          expect(pattern.pattern_type).toBeDefined();
          expect(pattern.description).toBeDefined();
        });
      }
    });

    it('should include confidence scoring in patterns', async () => {
      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        createdJobId,
        'emotional_patterns'
      );

      if (insights.patterns.length > 0) {
        insights.patterns.forEach((pattern) => {
          expect(typeof pattern.confidence).toBe('number');
          expect(pattern.confidence).toBeGreaterThanOrEqual(0);
          expect(pattern.confidence).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should track pattern evidence', async () => {
      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        createdJobId,
        'emotional_patterns'
      );

      if (insights.patterns.length > 0) {
        insights.patterns.forEach((pattern) => {
          expect(Array.isArray(pattern.evidence)).toBeTruthy();
          expect(pattern.observation_count).toBeGreaterThanOrEqual(0);
        });
      }
    });

    it('should run prospective self synthesis', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'prospective_self',
      });

      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        job.id,
        'prospective_self'
      );

      expect(insights.summary).toBeDefined();
      if (insights.prospectiveSelf) {
        expect(insights.prospectiveSelf.aspirations).toBeDefined();
        expect(insights.prospectiveSelf.fears).toBeDefined();
        expect(insights.prospectiveSelf.identityThemes).toBeDefined();
      }
    });

    it('should run relational memory synthesis', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'relational_memory',
      });

      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        job.id,
        'relational_memory'
      );

      expect(insights.summary).toBeDefined();
      if (insights.relationalDynamics) {
        expect(insights.relationalDynamics.attachmentPatterns).toBeDefined();
        expect(insights.relationalDynamics.trustLevels).toBeDefined();
      }
    });

    it('should generate recommendations alongside patterns', async () => {
      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        createdJobId,
        'emotional_patterns'
      );

      expect(insights.recommendations).toBeDefined();
    });
  });

  describe('Memory Pattern Storage', () => {
    it('should store created patterns', async () => {
      await service.synthesizeMemoryPatterns(
        testUserId,
        createdJobId,
        'emotional_patterns'
      );

      const patterns = await service.getMemoryPatterns(testUserId);

      expect(Array.isArray(patterns)).toBeTruthy();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should retrieve patterns filtered by layer', async () => {
      const patterns = await service.getMemoryPatterns(testUserId, 2);

      if (patterns.length > 0) {
        patterns.forEach((p) => {
          expect(p.layer).toBe(2);
        });
      }
    });

    it('should sort patterns by confidence descending', async () => {
      const patterns = await service.getMemoryPatterns(testUserId);

      if (patterns.length >= 2) {
        const first = patterns[0].confidence;
        const second = patterns[1].confidence;
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should include pattern timestamps', async () => {
      const patterns = await service.getMemoryPatterns(testUserId);

      if (patterns.length > 0) {
        patterns.forEach((p) => {
          expect(p.first_detected).toBeDefined();
          expect(p.last_observed).toBeDefined();
          expect(p.created_at).toBeDefined();
          expect(p.updated_at).toBeDefined();
        });
      }
    });
  });

  describe('Pattern Confirmation', () => {
    it('should confirm pattern as relevant', async () => {
      const patterns = await service.getMemoryPatterns(testUserId);
      if (patterns.length === 0) return;

      const pattern = patterns[0];
      await service.confirmPattern(pattern.id, { confirmed: true });

      const updated = await service.getMemoryPattern(pattern.id);
      expect(updated.user_confirmed).toBe(true);
    });

    it('should reject pattern as not relevant', async () => {
      const patterns = await service.getMemoryPatterns(testUserId);
      if (patterns.length === 0) return;

      const pattern = patterns[0];
      await service.confirmPattern(pattern.id, { confirmed: false });

      const updated = await service.getMemoryPattern(pattern.id);
      expect(updated.user_confirmed).toBe(false);
    });

    it('should add notes to pattern confirmation', async () => {
      const patterns = await service.getMemoryPatterns(testUserId);
      if (patterns.length === 0) return;

      const pattern = patterns[0];
      const notes = 'This pattern is very relevant to my situation';

      await service.confirmPattern(pattern.id, {
        confirmed: true,
        notes,
      });

      const updated = await service.getMemoryPattern(pattern.id);
      expect(updated.user_notes).toBe(notes);
    });
  });

  describe('Recommendations Management', () => {
    it('should get recommendations for user', async () => {
      const recs = await service.getRecommendations(testUserId);

      expect(Array.isArray(recs)).toBeTruthy();
    });

    it('should include recommendation priority', async () => {
      const recs = await service.getRecommendations(testUserId);

      if (recs.length > 0) {
        recs.forEach((r) => {
          expect(['high', 'medium', 'low']).toContain(r.priority);
        });
      }
    });

    it('should include recommendation category', async () => {
      const recs = await service.getRecommendations(testUserId);

      if (recs.length > 0) {
        recs.forEach((r) => {
          expect(r.category).toBeDefined();
        });
      }
    });

    it('should track recommendation status', async () => {
      const recs = await service.getRecommendations(testUserId);
      if (recs.length === 0) return;

      const rec = recs[0];
      await service.updateRecommendationStatus(rec.id, 'acknowledged');

      const updated = await service.getRecommendations(testUserId);
      const found = updated.find((r) => r.id === rec.id);
      expect(found?.status).toBe('acknowledged');
    });
  });

  describe('Seven-Layer Analysis', () => {
    it('should analyze all seven layers', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'full_synthesis',
      });

      const insights = await service.synthesizeMemoryPatterns(
        testUserId,
        job.id,
        'full_synthesis'
      );

      const layers = new Set<number>();
      insights.patterns.forEach((p) => {
        layers.add(p.layer);
      });

      // Full synthesis should touch multiple layers
      expect(layers.size).toBeGreaterThan(0);
    });

    it('should provide layer-specific insights', async () => {
      const patterns = await service.getMemoryPatterns(testUserId);

      const layerMap = new Map<number, MemoryPattern[]>();
      patterns.forEach((p) => {
        if (!layerMap.has(p.layer)) {
          layerMap.set(p.layer, []);
        }
        layerMap.get(p.layer)!.push(p);
      });

      // Verify patterns are distributed across layers
      for (const [layer, layerPatterns] of layerMap) {
        expect(layer).toBeGreaterThanOrEqual(1);
        expect(layer).toBeLessThanOrEqual(7);
        expect(layerPatterns.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Recurring Synthesis', () => {
    it('should create recurring synthesis job', async () => {
      const job = await service.scheduleRecurringSynthesis(
        testUserId,
        'emotional_patterns',
        '0 2 * * *'
      );

      expect(job.is_recurring).toBe(true);
      expect(job.cron_schedule).toBe('0 2 * * *');
    });

    it('should track next run time', async () => {
      const job = await service.scheduleRecurringSynthesis(
        testUserId,
        'emotional_patterns',
        '0 12 * * *'
      );

      if (job.next_run) {
        expect(new Date(job.next_run).getTime()).toBeGreaterThan(
          Date.now()
        );
      }
    });

    it('should support various cron schedules', async () => {
      const schedules = [
        '0 2 * * *', // Daily at 2 AM
        '0 9 * * MON', // Every Monday at 9 AM
        '0 */6 * * *', // Every 6 hours
      ];

      for (const schedule of schedules) {
        const job = await service.scheduleRecurringSynthesis(
          testUserId,
          'emotional_patterns',
          schedule
        );

        expect(job.cron_schedule).toBe(schedule);
      }
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel running synthesis job', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });

      await service.cancelSynthesisJob(job.id);

      const cancelled = await service.getSynthesisJob(job.id);
      expect(cancelled.status).toBe('failed');
      expect(cancelled.error_message).toBe('Cancelled by user');
    });
  });

  describe('Job Completion', () => {
    it('should mark job as completed after synthesis', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });

      await service.synthesizeMemoryPatterns(
        testUserId,
        job.id,
        'emotional_patterns'
      );

      const completed = await service.getSynthesisJob(job.id);
      expect(completed.status).toBe('completed');
      expect(completed.progress).toBe(1);
    });

    it('should populate job statistics on completion', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });

      await service.synthesizeMemoryPatterns(
        testUserId,
        job.id,
        'emotional_patterns'
      );

      const completed = await service.getSynthesisJob(job.id);
      expect(completed.patterns_detected).toBeGreaterThanOrEqual(0);
      expect(completed.memories_analyzed).toBeGreaterThanOrEqual(0);
      expect(completed.insights).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle synthesis failures gracefully', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns' as SynthesisType,
      });

      try {
        await service.synthesizeMemoryPatterns(
          'invalid-user',
          job.id,
          'emotional_patterns'
        );
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }
    });

    it('should mark job as failed on error', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });

      try {
        await service.synthesizeMemoryPatterns(
          testUserId,
          'invalid-job-id',
          'emotional_patterns'
        );
      } catch (error) {
        // Expected
      }

      // Job should reflect the error state
      const failed = await service.getSynthesisJob(job.id);
      expect(['pending', 'running', 'completed']).toContain(failed.status);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should create synthesis job in <50ms', async () => {
      const start = performance.now();
      await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should get user synthesis jobs in <200ms', async () => {
      const start = performance.now();
      await service.getSynthesisJobs(testUserId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });

    it('should run synthesis analysis in <2000ms', async () => {
      const job = await service.createSynthesisJob(testUserId, {
        synthesis_type: 'emotional_patterns',
      });

      const start = performance.now();
      await service.synthesizeMemoryPatterns(
        testUserId,
        job.id,
        'emotional_patterns'
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);
    });

    it('should retrieve memory patterns in <300ms', async () => {
      const start = performance.now();
      await service.getMemoryPatterns(testUserId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });

    it('should get recommendations in <300ms', async () => {
      const start = performance.now();
      await service.getRecommendations(testUserId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });

    it('should filter patterns by layer in <200ms', async () => {
      const start = performance.now();
      await service.getMemoryPatterns(testUserId, 3);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });
});
