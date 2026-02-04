import { describe, it, expect, beforeEach } from 'vitest';
import { AIOperationRouter } from './router.js';
import { ProviderHealthMonitor } from './provider-health.js';
import { ProviderOrchestrator } from './provider-orchestrator.js';
import { OperationScheduler } from './operation-scheduler.js';
import { BatchOperationEngine } from './batch-engine.js';

describe('Phase 4: Advanced Orchestration Integration', () => {
  let router: AIOperationRouter;
  let healthMonitor: ProviderHealthMonitor;
  let orchestrator: ProviderOrchestrator;
  let scheduler: OperationScheduler;
  let batchEngine: BatchOperationEngine;

  beforeEach(() => {
    // Mock Supabase environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';

    healthMonitor = new ProviderHealthMonitor();
    orchestrator = new ProviderOrchestrator(healthMonitor);
    scheduler = new OperationScheduler();
    batchEngine = new BatchOperationEngine();
    router = new AIOperationRouter();
  });

  describe('Integrated Routing with Orchestrator', () => {
    it('gets health monitor from router', () => {
      const monitor = router.getHealthMonitor();
      expect(monitor).toBeDefined();
      expect(monitor).toBeInstanceOf(ProviderHealthMonitor);
    });

    it('updates health metrics after operation', () => {
      // Record successful operation
      healthMonitor.recordSuccess('anthropic', 150);

      const health = healthMonitor.getProviderHealth('anthropic');
      expect(health.successCount).toBe(1);
      expect(health.avgLatencyMs).toBe(150);
    });
  });

  describe('Scheduling with Batching', () => {
    it('batches operations by type', () => {
      const batch = batchEngine.createBatch('email_analysis', 10);

      batchEngine.addToBatch(batch.id, { emailId: 'email1' });
      batchEngine.addToBatch(batch.id, { emailId: 'email2' });
      batchEngine.addToBatch(batch.id, { emailId: 'email3' });

      const retrieved = batchEngine.getBatch(batch.id);
      expect(retrieved!.items).toHaveLength(3);
    });

    it('respects scheduled triggers', () => {
      scheduler.registerSchedule('daily_summary', {
        type: 'cron',
        pattern: '0 9 * * *', // 9 AM daily
        timezone: 'UTC',
      });

      const schedule = scheduler.getSchedule('daily_summary');
      expect(schedule).toBeDefined();
      expect(schedule?.trigger.type).toBe('cron');
    });

    it('enforces SLA windows', () => {
      const slaWindow = {
        startTime: '08:00',
        endTime: '09:00',
        timezone: 'UTC',
      };

      const within = scheduler.isWithinSLAWindow(slaWindow, new Date('2026-02-04T08:30:00Z'));
      expect(within).toBe(true);
    });
  });

  describe('Cost Optimization', () => {
    it('selects cheapest provider when all healthy', () => {
      const selected = orchestrator.selectProviderByCost(
        'email_analysis',
        ['anthropic', 'gemini'],
        100,
        50
      );

      // Gemini should be cheaper (0.0002 per 1K tokens vs Anthropic 0.018 per 1K tokens)
      expect(selected).toBe('gemini');
    });

    it('calculates batch cost savings', () => {
      const batch = batchEngine.createBatch('email_analysis', 10);

      for (let i = 0; i < 10; i++) {
        batchEngine.addToBatch(batch.id, { emailId: `email${i}` });
      }

      const batchCost = batchEngine.calculateBatchCost(batch.id, 100, 50);
      const individualCost = 10 * 0.001;

      expect(batchCost).toBeLessThan(individualCost);
    });
  });

  describe('End-to-End Workflow', () => {
    it('executes complete orchestration workflow', async () => {
      // 1. Register scheduled operation
      scheduler.registerSchedule('weekly_emails', {
        type: 'cron',
        pattern: '0 8 * * 0',
        timezone: 'UTC',
      });

      // 2. Create batch for emails
      const batch = batchEngine.createBatch('email_analysis', 50);
      for (let i = 0; i < 5; i++) {
        batchEngine.addToBatch(batch.id, { emailId: `email${i}` });
      }

      // 3. Select provider with orchestrator
      const provider = orchestrator.selectProviderByCost(
        'email_analysis',
        ['anthropic', 'gemini'],
        500,
        250
      );

      expect(provider).toBeDefined();

      // 4. Execute batch
      let executed = 0;
      const result = await batchEngine.executeBatch(
        batch.id,
        () => {
          executed++;
          return Promise.resolve();
        },
        { maxConcurrency: 2 }
      );

      expect(result.successful).toBe(5);
      expect(executed).toBe(5);
    });
  });
});
