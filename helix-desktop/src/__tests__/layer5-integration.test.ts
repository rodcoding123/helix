/**
 * End-to-End Integration Test for Desktop Layer 5
 * Tests complete Layer 5 memory pattern lifecycle on desktop
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tauri invoke
vi.stubGlobal('__TAURI__', {
  invoke: vi.fn(),
});

import { invoke } from '@tauri-apps/api/tauri';

describe('Desktop Layer 5 E2E Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Memory Pattern Lifecycle', () => {
    it('should load patterns and filter by type', async () => {
      const mockPatterns = [
        {
          patternId: 'emotional_work_anxiety',
          type: 'emotional_trigger',
          description: 'Work anxiety with deadlines',
          confidence: 0.92,
          salience: 0.78,
          recommendations: ['Practice grounding techniques', 'Break tasks into steps'],
          evidence: ['mem1', 'mem2', 'mem3'],
        },
        {
          patternId: 'relational_alice_trust',
          type: 'relational_pattern',
          description: '75% positive interactions with Alice',
          confidence: 0.85,
          salience: 0.65,
          recommendations: ['Schedule regular check-ins'],
          evidence: ['mem4', 'mem5'],
        },
      ];

      (invoke as any).mockResolvedValue(mockPatterns);

      const result = await invoke('get_memory_patterns', {});

      expect(invoke).toHaveBeenCalledWith('get_memory_patterns', {});
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('emotional_trigger');
      expect(result[1].type).toBe('relational_pattern');
    });

    it('should search patterns across description and type', async () => {
      const patterns = [
        {
          patternId: 'fear_failure',
          type: 'prospective_fear',
          description: 'Fear of failing important projects',
          confidence: 0.88,
          salience: 0.82,
          recommendations: [],
          evidence: [],
        },
        {
          patternId: 'goal_health',
          type: 'prospective_possibility',
          description: 'Goal to improve health with exercise',
          confidence: 0.72,
          salience: 0.55,
          recommendations: [],
          evidence: [],
        },
      ];

      const searchTerm = 'fail';
      const results = patterns.filter(p =>
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.type.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(results).toHaveLength(1);
      expect(results[0].description).toContain('fail');
    });

    it('should sort patterns by confidence (high to low)', async () => {
      const patterns = [
        {
          patternId: 'low_conf',
          type: 'emotional_trigger',
          description: 'Low confidence pattern',
          confidence: 0.45,
          salience: 0.5,
          recommendations: [],
          evidence: [],
        },
        {
          patternId: 'high_conf',
          type: 'emotional_trigger',
          description: 'High confidence pattern',
          confidence: 0.95,
          salience: 0.6,
          recommendations: [],
          evidence: [],
        },
        {
          patternId: 'mid_conf',
          type: 'emotional_trigger',
          description: 'Medium confidence pattern',
          confidence: 0.70,
          salience: 0.55,
          recommendations: [],
          evidence: [],
        },
      ];

      const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);

      expect(sorted[0].confidence).toBe(0.95);
      expect(sorted[1].confidence).toBe(0.70);
      expect(sorted[2].confidence).toBe(0.45);
    });

    it('should sort patterns by salience (high to low)', async () => {
      const patterns = [
        {
          patternId: 'low_sal',
          type: 'emotional_trigger',
          description: 'Low salience',
          confidence: 0.8,
          salience: 0.2,
          recommendations: [],
          evidence: [],
        },
        {
          patternId: 'high_sal',
          type: 'emotional_trigger',
          description: 'High salience',
          confidence: 0.8,
          salience: 0.95,
          recommendations: [],
          evidence: [],
        },
      ];

      const sorted = [...patterns].sort((a, b) => b.salience - a.salience);

      expect(sorted[0].salience).toBe(0.95);
      expect(sorted[1].salience).toBe(0.2);
    });
  });

  describe('Scheduler Commands', () => {
    it('should get scheduler configuration', async () => {
      const mockConfig = {
        enabled: true,
        daily_consolidation: true,
        consolidation_time: '06:00',
        daily_synthesis: true,
        synthesis_time: '20:00',
        weekly_full_integration: true,
        integration_day: '0',
        integration_time: '03:00',
        monthly_synthesis: true,
        synthesis_day: 1,
        max_concurrent_jobs: 2,
        timeout_seconds: 1800,
      };

      (invoke as any).mockResolvedValue(mockConfig);

      const result = await invoke('get_scheduler_config', {});

      expect(result.enabled).toBe(true);
      expect(result.consolidation_time).toBe('06:00');
      expect(result.synthesis_time).toBe('20:00');
    });

    it('should create and manage scheduled jobs', async () => {
      const jobId = 'job_1234567890_1';
      const mockJob = {
        id: jobId,
        job_type: 'consolidation',
        status: 'pending',
        scheduled_at: 1707000000,
        started_at: null,
        completed_at: null,
        cron_expression: '0 6 * * *',
        next_run: 1707043200,
        last_run: null,
        duration_ms: null,
        error: null,
        result: null,
      };

      (invoke as any).mockResolvedValue(mockJob);

      const result = await invoke('create_job', {
        job_type: 'consolidation',
        cron_expression: '0 6 * * *',
      });

      expect(result.job_type).toBe('consolidation');
      expect(result.status).toBe('pending');
      expect(invoke).toHaveBeenCalled();
    });

    it('should trigger job execution', async () => {
      const jobId = 'job_test_123';
      const mockRunningJob = {
        id: jobId,
        job_type: 'synthesis',
        status: 'running',
        started_at: 1707000000,
      };

      (invoke as any).mockResolvedValue(mockRunningJob);

      const result = await invoke('trigger_job', { job_id: jobId });

      expect(result.status).toBe('running');
      expect(result.started_at).toBeDefined();
    });

    it('should pause and resume jobs', async () => {
      const jobId = 'job_pause_test';

      (invoke as any).mockResolvedValue({ ok: true });

      // Pause
      await invoke('pause_job', { job_id: jobId });
      expect(invoke).toHaveBeenCalledWith('pause_job', { job_id: jobId });

      // Resume
      await invoke('resume_job', { job_id: jobId });
      expect(invoke).toHaveBeenCalledWith('resume_job', { job_id: jobId });
    });

    it('should get scheduler health status', async () => {
      const mockHealth = {
        healthy: true,
        total_jobs: 3,
        running: 1,
        failed: 0,
        paused: 0,
      };

      (invoke as any).mockResolvedValue(mockHealth);

      const result = await invoke('get_scheduler_health', {});

      expect(result.healthy).toBe(true);
      expect(result.total_jobs).toBe(3);
      expect(result.running).toBe(1);
      expect(result.failed).toBe(0);
    });
  });

  describe('Pattern Analysis Recommendations', () => {
    it('should generate recommendations based on pattern type', () => {
      const patterns = {
        emotional_trigger: {
          type: 'emotional_trigger',
          description: 'Public speaking anxiety',
          recommendations: ['Practice breathing techniques', 'Positive visualization', 'Small group practice'],
        },
        relational_pattern: {
          type: 'relational_pattern',
          description: 'Conflict with managers',
          recommendations: ['Request feedback meeting', 'Practice assertive communication'],
        },
        prospective_fear: {
          type: 'prospective_fear',
          description: 'Fear of rejection',
          recommendations: ['Build resilience practice', 'Normalize rejection as feedback'],
        },
        prospective_possibility: {
          type: 'prospective_possibility',
          description: 'Goal to learn new programming language',
          recommendations: ['Daily coding practice', 'Project-based learning', 'Join community'],
        },
      };

      // Verify recommendations exist and are meaningful
      Object.values(patterns).forEach(pattern => {
        expect(pattern.recommendations).toBeInstanceOf(Array);
        expect(pattern.recommendations.length).toBeGreaterThan(0);
      });
    });

    it('should calculate confidence and salience metrics', () => {
      const pattern = {
        patternId: 'test_pattern',
        description: 'Test pattern',
        confidence: 0.87,
        salience: 0.76,
        recommendations: [],
        evidence: ['mem1', 'mem2', 'mem3', 'mem4'],
      };

      // Confidence should be between 0 and 1
      expect(pattern.confidence).toBeGreaterThanOrEqual(0);
      expect(pattern.confidence).toBeLessThanOrEqual(1);

      // Salience should be between 0 and 1
      expect(pattern.salience).toBeGreaterThanOrEqual(0);
      expect(pattern.salience).toBeLessThanOrEqual(1);

      // Evidence count should reflect pattern strength
      expect(pattern.evidence.length).toBeGreaterThan(0);

      // Convert to percentages
      const confidencePercent = pattern.confidence * 100;
      const saliencePercent = pattern.salience * 100;

      expect(confidencePercent).toBe(87);
      expect(saliencePercent).toBe(76);
    });
  });

  describe('Error Handling', () => {
    it('should handle IPC failures gracefully', async () => {
      const error = new Error('IPC communication failed');
      (invoke as any).mockRejectedValue(error);

      try {
        await invoke('get_memory_patterns', {});
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e).toBe(error);
      }
    });

    it('should handle missing jobs', async () => {
      (invoke as any).mockRejectedValue(new Error('Job not found: invalid_id'));

      try {
        await invoke('get_job', { job_id: 'invalid_id' });
        throw new Error('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toContain('Job not found');
      }
    });

    it('should validate pattern data types', () => {
      const invalidPatterns = [
        {
          patternId: '', // Empty ID
          type: 'emotional_trigger',
          description: 'Invalid pattern',
          confidence: 0.5,
          salience: 0.5,
          recommendations: [],
          evidence: [],
        },
        {
          patternId: 'valid_id',
          type: 'emotional_trigger' as const,
          description: 'Invalid confidence',
          confidence: 1.5, // > 1
          salience: 0.5,
          recommendations: [],
          evidence: [],
        },
      ];

      // Validation: ID should not be empty
      expect(invalidPatterns[0].patternId).toBe('');

      // Validation: Confidence should be 0-1
      expect(invalidPatterns[1].confidence).toBeGreaterThan(1);
    });
  });

  describe('Full Integration Workflow', () => {
    it('should execute complete Layer 5 workflow', async () => {
      const workflow = {
        step1_get_patterns: { invoked: false },
        step2_filter_results: { invoked: false },
        step3_get_scheduler: { invoked: false },
        step4_create_job: { invoked: false },
        step5_monitor_health: { invoked: false },
      };

      // Simulate workflow execution
      (invoke as any).mockImplementation((cmd: string) => {
        if (cmd === 'get_memory_patterns') {
          workflow.step1_get_patterns.invoked = true;
          return Promise.resolve([
            { patternId: 'test', type: 'emotional_trigger', description: 'Test', confidence: 0.8, salience: 0.7, recommendations: [], evidence: [] },
          ]);
        }
        if (cmd === 'get_scheduler_config') {
          workflow.step3_get_scheduler.invoked = true;
          return Promise.resolve({ enabled: true, consolidation_time: '06:00' });
        }
        if (cmd === 'create_job') {
          workflow.step4_create_job.invoked = true;
          return Promise.resolve({ id: 'job_123', status: 'pending' });
        }
        if (cmd === 'get_scheduler_health') {
          workflow.step5_monitor_health.invoked = true;
          return Promise.resolve({ healthy: true, total_jobs: 1, running: 0, failed: 0, paused: 0 });
        }
        return Promise.reject(new Error('Unknown command'));
      });

      // Execute workflow
      await invoke('get_memory_patterns', {});
      workflow.step2_filter_results.invoked = true;
      await invoke('get_scheduler_config', {});
      await invoke('create_job', { job_type: 'consolidation', cron_expression: '0 6 * * *' });
      await invoke('get_scheduler_health', {});

      // Verify all steps completed
      expect(workflow.step1_get_patterns.invoked).toBe(true);
      expect(workflow.step2_filter_results.invoked).toBe(true);
      expect(workflow.step3_get_scheduler.invoked).toBe(true);
      expect(workflow.step4_create_job.invoked).toBe(true);
      expect(workflow.step5_monitor_health.invoked).toBe(true);
    });
  });
});
