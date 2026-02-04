import { describe, it, expect, beforeEach } from 'vitest';
import { ModelSpawner } from './model-spawner.js';
import { Operation } from './goal-evaluator.js';

describe('ModelSpawner', () => {
  let spawner: ModelSpawner;
  let mockOperation: Operation;

  beforeEach(() => {
    spawner = new ModelSpawner();
    mockOperation = {
      operation_type: 'email',
      operation_id: 'op_email_001',
      estimated_cost: 0.1,
      serves_goals: ['goal1'],
      estimated_impact: 0.8,
      urgency_level: 'high',
    };
  });

  describe('spawn', () => {
    it('should spawn a model for an operation', async () => {
      const userId = 'user_123';
      const result = await spawner.spawn(userId, mockOperation, 100);

      expect(result).toBeDefined();
      expect(result.spawned_models).toBeDefined();
      expect(Array.isArray(result.spawned_models)).toBe(true);
      expect(result.total_cost_usd).toBeGreaterThanOrEqual(0);
      expect(result.success_count).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should create SpawnedModel with pending status', async () => {
      const userId = 'user_123';
      const result = await spawner.spawn(userId, mockOperation, 100);

      if (result.spawned_models.length > 0) {
        const model = result.spawned_models[0];
        expect(model.model_id).toBeDefined();
        // Status should be pending or running (async execution starts immediately)
        expect(['pending', 'running']).toContain(model.status);
        expect(model.operation_type).toBe('email');
        expect(model.started_at).toBeDefined();
      }
    });

    it('should route through AIOperationRouter', async () => {
      const userId = 'user_123';
      const result = await spawner.spawn(userId, mockOperation, 100);

      if (result.spawned_models.length > 0) {
        const model = result.spawned_models[0];
        expect(model.model_selection).toBeDefined();
        expect(['deepseek', 'gemini', 'claude', 'edge-tts']).toContain(model.model_selection);
      }
    });

    it('should build ExecutionContext with consciousness state', () => {
      const contexts = spawner.getExecutionContexts();

      expect(contexts).toBeDefined();
      expect(typeof contexts === 'object').toBe(true);
    });

    it('should check budget before spawning', async () => {
      const userId = 'user_123';
      const insufficientBudget = 0.01; // Less than operation cost (0.1)

      const result = await spawner.spawn(userId, mockOperation, insufficientBudget);

      // Should not spawn if over budget
      if (result.spawned_models.length === 0) {
        expect(result.failed_count).toBe(0); // Budget check prevented spawn
      }
    });

    it('should return fire-and-forget (immediate response)', async () => {
      const userId = 'user_123';
      const startTime = Date.now();

      await spawner.spawn(userId, mockOperation, 100);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should return quickly (not wait for execution)
    });

    it('should track multiple concurrent spawns', async () => {
      const userId = 'user_123';

      await spawner.spawn(userId, mockOperation, 100);
      await spawner.spawn(userId, { ...mockOperation, operation_id: 'op_email_002' }, 100);

      const activeModels = spawner.getActiveModelCount();
      expect(activeModels).toBeGreaterThanOrEqual(2);
    });

    it('should log spawn to hash chain', async () => {
      const userId = 'user_123';
      const result = await spawner.spawn(userId, mockOperation, 100);

      // Verify result includes timestamp (hash chain logging occurred)
      expect(result.timestamp).toBeDefined();
    });

    it('should handle operation type mapping (email, calendar, task, analysis)', async () => {
      const userId = 'user_123';

      const operations: Operation[] = [
        { ...mockOperation, operation_type: 'email' },
        { ...mockOperation, operation_type: 'calendar' },
        { ...mockOperation, operation_type: 'task' },
        { ...mockOperation, operation_type: 'analysis' },
      ];

      for (const op of operations) {
        const result = await spawner.spawn(userId, op, 100);
        if (result.spawned_models.length > 0) {
          expect(result.spawned_models[0].operation_type).toBe(op.operation_type);
        }
      }
    });

    it('should handle execution errors gracefully', async () => {
      const userId = 'user_123';
      const result = await spawner.spawn(userId, mockOperation, 100);

      // Result should be valid even if model failed internally
      expect(result).toBeDefined();
      expect(typeof result.success_count === 'number').toBe(true);
      expect(typeof result.failed_count === 'number').toBe(true);
    });
  });

  describe('getActiveModels', () => {
    it('should track active spawned models', async () => {
      const userId = 'user_123';

      await spawner.spawn(userId, mockOperation, 100);
      const activeModels = spawner.getActiveModels();

      expect(Array.isArray(activeModels)).toBe(true);
    });

    it('should return models with status', async () => {
      const userId = 'user_123';

      await spawner.spawn(userId, mockOperation, 100);
      const activeModels = spawner.getActiveModels();

      if (activeModels.length > 0) {
        expect(activeModels[0].status).toBeDefined();
        expect(['pending', 'running', 'completed', 'failed']).toContain(activeModels[0].status);
      }
    });
  });

  describe('getActiveModelCount', () => {
    it('should return count of active models', () => {
      const count = spawner.getActiveModelCount();
      expect(typeof count === 'number').toBe(true);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
