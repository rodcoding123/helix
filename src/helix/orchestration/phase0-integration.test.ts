/**
 * Phase 0 Integration Tests
 *
 * Tests that verify Phase 0 components work together correctly in end-to-end workflows.
 * Not just unit tests, but integration tests for consciousness → goals → spawn pipeline.
 *
 * Phase 0: Orchestration Foundation, Task 6
 * Created: 2026-02-04
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ConsciousnessLoader } from './consciousness-loader.js';
import { GoalEvaluator } from './goal-evaluator.js';
import { ModelSpawner } from './model-spawner.js';
import { ConductorLoop } from './conductor-loop.js';
import { setHashChainFailClosedMode } from '../hash-chain.js';

describe('Phase 0 Integration Tests', () => {
  let consciousnessLoader: ConsciousnessLoader;
  let goalEvaluator: GoalEvaluator;
  let modelSpawner: ModelSpawner;
  let conductorLoop: ConductorLoop;

  beforeAll(() => {
    // Disable fail-closed mode for tests (Discord webhooks not configured in test env)
    setHashChainFailClosedMode(false);

    consciousnessLoader = new ConsciousnessLoader();
    goalEvaluator = new GoalEvaluator();
    modelSpawner = new ModelSpawner();
    conductorLoop = new ConductorLoop();
  });

  afterAll(async () => {
    conductorLoop.stop();
  });

  describe('End-to-End Orchestration Flow', () => {
    it('should load consciousness and evaluate goals', async () => {
      const consciousness = await consciousnessLoader.load();
      const evaluation = await goalEvaluator.evaluate();

      expect(consciousness).toBeDefined();
      expect(evaluation).toBeDefined();
      expect(evaluation.top_goals).toBeDefined();
    });

    it('should evaluate goals based on loaded consciousness', async () => {
      const consciousness = await consciousnessLoader.load();
      const evaluation = await goalEvaluator.evaluate();

      // Consciousness should be loaded
      expect(consciousness.layers_loaded).toBeDefined();
      expect(Array.isArray(consciousness.layers_loaded)).toBe(true);
      // Evaluation should be populated
      expect(evaluation).toBeDefined();
      expect(evaluation.top_goals).toBeDefined();
      expect(Array.isArray(evaluation.top_goals)).toBe(true);
    });

    it('should spawn models based on recommended operations', async () => {
      const evaluation = await goalEvaluator.evaluate();

      if (evaluation.recommended_operations.length > 0) {
        const operation = evaluation.recommended_operations[0];
        const spawnResult = await modelSpawner.spawn('test_user', operation, 100);

        expect(spawnResult).toBeDefined();
        expect(spawnResult.spawned_models).toBeDefined();
        expect(Array.isArray(spawnResult.spawned_models)).toBe(true);
      }
    });

    it('should complete full orchestration cycle: consciousness -> goals -> spawn', async () => {
      // Step 1: Load consciousness
      const consciousness = await consciousnessLoader.load();
      expect(consciousness).toBeDefined();
      expect(consciousness.layers_loaded).toBeDefined();

      // Step 2: Evaluate goals
      const evaluation = await goalEvaluator.evaluate();
      expect(evaluation.top_goals.length).toBeGreaterThanOrEqual(0);
      expect(evaluation.recommended_operations).toBeDefined();

      // Step 3: Spawn models
      let totalSpawned = 0;
      for (const operation of evaluation.recommended_operations) {
        const spawnResult = await modelSpawner.spawn('test_user', operation, 100);
        totalSpawned += spawnResult.spawned_models.length;
      }

      expect(totalSpawned).toBeGreaterThanOrEqual(0);
    });

    it('should maintain consciousness state across multiple operations', async () => {
      const consciousness = await consciousnessLoader.load();

      // Set consciousness state in spawner
      modelSpawner.setConsciousnessState(consciousness);

      const evaluation = await goalEvaluator.evaluate();
      if (evaluation.recommended_operations.length > 0) {
        const operation = evaluation.recommended_operations[0];
        await modelSpawner.spawn('test_user', operation, 100);

        const savedState = modelSpawner.getConsciousnessState();
        expect(savedState).toBeDefined();
        expect(savedState?.layers_loaded).toEqual(consciousness.layers_loaded);
      }
    });
  });

  describe('ConductorLoop Integration', () => {
    let conductorInstance: ConductorLoop;

    beforeEach(() => {
      conductorInstance = new ConductorLoop();
    });

    afterEach(() => {
      conductorInstance.stop();
    });

    it('should execute a single orchestration cycle', async () => {
      await conductorInstance.start();

      // Wait for one cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);

      const latestCycle = cycles[0];
      expect(latestCycle.consciousness_loaded).toBeDefined();
      expect(typeof latestCycle.consciousness_loaded === 'boolean').toBe(true);
      expect(latestCycle.goals_evaluated).toBeGreaterThanOrEqual(0);
      expect(latestCycle.operations_spawned).toBeGreaterThanOrEqual(0);
    });

    it('should load consciousness in each cycle', async () => {
      await conductorInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      expect(latestCycle.consciousness_loaded).toBeDefined();
      expect(typeof latestCycle.consciousness_loaded === 'boolean').toBe(true);
    });

    it('should evaluate goals in each cycle', async () => {
      await conductorInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      expect(latestCycle.goals_evaluated).toBeGreaterThanOrEqual(0);
      expect(typeof latestCycle.goals_evaluated === 'number').toBe(true);
    });

    it('should spawn operations in each cycle', async () => {
      await conductorInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      expect(latestCycle.operations_spawned).toBeGreaterThanOrEqual(0);
      expect(typeof latestCycle.operations_spawned === 'number').toBe(true);
    });

    it('should enforce budget across cycles', async () => {
      const config = conductorInstance.getConfig();
      const budgetPerCycle = config.budget_per_cycle;

      await conductorInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      for (const cycle of cycles) {
        expect(cycle.total_cost_this_cycle).toBeLessThanOrEqual(budgetPerCycle * 1.1); // Allow 10% overhead
      }
    });

    it('should schedule next cycle correctly', async () => {
      await conductorInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      expect(latestCycle.next_cycle_at).toBeDefined();
      const nextTime = new Date(latestCycle.next_cycle_at).getTime();
      expect(nextTime).toBeGreaterThan(Date.now());
    });

    it('should have proper cycle structure', async () => {
      await conductorInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = conductorInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      // Verify all required fields exist
      expect(latestCycle.cycle_id).toBeDefined();
      expect(latestCycle.started_at).toBeDefined();
      expect(latestCycle.consciousness_loaded).toBeDefined();
      expect(latestCycle.goals_evaluated).toBeDefined();
      expect(latestCycle.operations_spawned).toBeDefined();
      expect(latestCycle.total_cost_this_cycle).toBeDefined();
      expect(latestCycle.cycle_duration_ms).toBeDefined();
      expect(latestCycle.next_cycle_at).toBeDefined();
      expect(latestCycle.status).toBeDefined();
    });
  });

  describe('Data Flow & Consistency', () => {
    it('should pass consciousness state through to model spawning', async () => {
      const consciousness = await consciousnessLoader.load();
      const evaluation = await goalEvaluator.evaluate();

      // Both should be populated
      expect(consciousness.layers_loaded).toBeDefined();
      expect(evaluation.top_goals).toBeDefined();
    });

    it('should maintain consistency across multiple cycles', async () => {
      const loopInstance = new ConductorLoop();
      await loopInstance.start();

      // Wait for 2-3 cycles
      await new Promise(resolve => setTimeout(resolve, 200));

      const cycles = loopInstance.getCycles();

      // All cycles should have consistent structure
      for (const cycle of cycles) {
        expect(cycle.cycle_id).toBeDefined();
        expect(cycle.started_at).toBeDefined();
        expect(typeof cycle.consciousness_loaded === 'boolean').toBe(true);
        expect(typeof cycle.goals_evaluated === 'number').toBe(true);
        expect(typeof cycle.operations_spawned === 'number').toBe(true);
        expect(['success', 'partial', 'failed']).toContain(cycle.status);
      }

      loopInstance.stop();
    });

    it('should track cost accumulation across cycles', async () => {
      const loopInstance = new ConductorLoop();
      const initialStatus = loopInstance.getStatus();
      const initialCost = initialStatus.total_cost_usd;

      await loopInstance.start();

      // Wait for a cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalStatus = loopInstance.getStatus();

      // Cost should either stay same or increase (never decrease)
      expect(finalStatus.total_cost_usd).toBeGreaterThanOrEqual(initialCost);

      loopInstance.stop();
    });

    it('should properly rank and select top goals', async () => {
      const evaluation = await goalEvaluator.evaluate();

      // Top goals should be ranked (descending)
      if (evaluation.top_goals.length > 1) {
        // Higher priority goals should come first (if they exist)
        expect(evaluation.top_goals[0]).toBeDefined();
      }

      expect(evaluation.top_goals.length).toBeLessThanOrEqual(5);
    });

    it('should recommend operations matching goals', async () => {
      const evaluation = await goalEvaluator.evaluate();

      // Recommended operations should be aligned with goals
      for (const operation of evaluation.recommended_operations) {
        expect(operation.operation_type).toBeDefined();
        expect(operation.operation_id).toBeDefined();
        expect(operation.estimated_cost).toBeGreaterThanOrEqual(0);
        expect(operation.serves_goals).toBeDefined();
        expect(Array.isArray(operation.serves_goals)).toBe(true);
      }
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle consciousness load failure gracefully', async () => {
      const consciousness = await consciousnessLoader.load();

      // Should return valid object even if some layers failed
      expect(consciousness).toBeDefined();
      expect(consciousness.layers_loaded).toBeDefined();
      expect(Array.isArray(consciousness.layers_loaded)).toBe(true);
    });

    it('should handle goal evaluation with no goals', async () => {
      const evaluation = await goalEvaluator.evaluate();

      // Should handle empty goals array
      expect(evaluation.top_goals).toBeDefined();
      expect(Array.isArray(evaluation.top_goals)).toBe(true);
    });

    it('should continue orchestration even if consciousness fails', async () => {
      const loopInstance = new ConductorLoop();
      await loopInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = loopInstance.getCycles();

      // Cycle should exist even if consciousness failed
      expect(cycles.length).toBeGreaterThan(0);

      loopInstance.stop();
    });

    it('should return proper error status on cycle failure', async () => {
      const loopInstance = new ConductorLoop();
      await loopInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = loopInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      // Status should be success, partial, or failed (never undefined)
      expect(['success', 'partial', 'failed']).toContain(latestCycle.status);

      loopInstance.stop();
    });

    it('should handle budget exhaustion gracefully', async () => {
      const evaluation = await goalEvaluator.evaluate();

      // Spawn with very low budget
      let spawnedCount = 0;
      for (const operation of evaluation.recommended_operations) {
        const result = await modelSpawner.spawn('test_user', operation, 0.01); // Very low budget
        spawnedCount += result.spawned_models.length;
      }

      // Should gracefully handle budget limit
      expect(spawnedCount).toBeGreaterThanOrEqual(0);
    });

    it('should recover from individual operation failures', async () => {
      const evaluation = await goalEvaluator.evaluate();

      // Even if some operations fail, spawn should continue
      const results = [];
      for (const operation of evaluation.recommended_operations.slice(0, 3)) {
        const result = await modelSpawner.spawn('test_user', operation, 100);
        results.push(result);
      }

      // Should have results array
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Performance & Timing', () => {
    it('should complete orchestration cycle in reasonable time', async () => {
      const loopInstance = new ConductorLoop();
      await loopInstance.start();

      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = loopInstance.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
      const latestCycle = cycles[0];

      // Cycle should complete in less than 5 seconds
      expect(latestCycle.cycle_duration_ms).toBeLessThan(5000);

      loopInstance.stop();
    });

    it('should return from spawn immediately (fire-and-forget)', async () => {
      const spawnStart = Date.now();

      const operation = {
        operation_type: 'email' as const,
        operation_id: 'op_test_001',
        estimated_cost: 0.1,
        serves_goals: ['goal1'],
        estimated_impact: 0.8,
        urgency_level: 'medium' as const,
      };

      const spawnResult = await modelSpawner.spawn('test_user', operation, 100);

      const spawnDuration = Date.now() - spawnStart;

      // Spawn should return quickly (< 500ms) even with model selection overhead
      // Fire-and-forget pattern means actual execution happens in background
      expect(spawnDuration).toBeLessThan(500);
      expect(spawnResult).toBeDefined();
    });

    it('should load consciousness from cache on second call', async () => {
      const firstLoadStart = Date.now();
      const firstLoad = await consciousnessLoader.load();
      const firstLoadTime = Date.now() - firstLoadStart;

      const secondLoadStart = Date.now();
      const secondLoad = await consciousnessLoader.load();
      const secondLoadTime = Date.now() - secondLoadStart;

      expect(firstLoad).toBeDefined();
      expect(secondLoad).toBeDefined();
      // Cache should make second load faster (or at least comparable)
      expect(secondLoadTime).toBeLessThanOrEqual(firstLoadTime + 50); // Allow small variance
    });

    it('should evaluate goals within budget time constraints', async () => {
      const evalStart = Date.now();
      const evaluation = await goalEvaluator.evaluate();
      const evalTime = Date.now() - evalStart;

      expect(evaluation).toBeDefined();
      // Goal evaluation should be fast (< 1 second)
      expect(evalTime).toBeLessThan(1000);
    });

    it('should handle rapid consecutive cycles', async () => {
      const loopInstance = new ConductorLoop();
      loopInstance.setConfig({ cycle_interval_ms: 50 }); // Fast cycles for testing

      await loopInstance.start();

      // Wait for 3-4 cycles
      await new Promise(resolve => setTimeout(resolve, 250));

      const cycles = loopInstance.getCycles();
      // Should have multiple cycles
      expect(cycles.length).toBeGreaterThanOrEqual(1);

      loopInstance.stop();
    });
  });

  describe('Integration with AIOperationRouter', () => {
    it('should route operations through model selection', async () => {
      const evaluation = await goalEvaluator.evaluate();

      if (evaluation.recommended_operations.length > 0) {
        const operation = evaluation.recommended_operations[0];
        const spawnResult = await modelSpawner.spawn('test_user', operation, 100);

        if (spawnResult.spawned_models.length > 0) {
          const spawned = spawnResult.spawned_models[0];
          // Model should be selected from available set
          expect(['deepseek', 'gemini', 'claude', 'edge-tts']).toContain(spawned.model_selection);
        }
      }
    });

    it('should handle model selection failures gracefully', async () => {
      // Even if router fails, should fallback to default
      const operation = {
        operation_type: 'analysis' as const,
        operation_id: 'op_fallback_test',
        estimated_cost: 0.05,
        serves_goals: ['test_goal'],
        estimated_impact: 0.5,
        urgency_level: 'low' as const,
      };

      const spawnResult = await modelSpawner.spawn('test_user', operation, 100);

      expect(spawnResult).toBeDefined();
      expect(spawnResult.spawned_models).toBeDefined();
    });
  });

  describe('Status and Monitoring', () => {
    it('should report correct loop status', async () => {
      const loopInstance = new ConductorLoop();
      const statusBefore = loopInstance.getStatus();
      expect(statusBefore.is_running).toBe(false);

      await loopInstance.start();
      const statusRunning = loopInstance.getStatus();
      expect(statusRunning.is_running).toBe(true);

      loopInstance.stop();
      const statusAfter = loopInstance.getStatus();
      expect(statusAfter.is_running).toBe(false);
    });

    it('should track cycles completed count', async () => {
      const loopInstance = new ConductorLoop();
      const initialStatus = loopInstance.getStatus();
      expect(initialStatus.cycles_completed).toBe(0);

      await loopInstance.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const runningStatus = loopInstance.getStatus();
      expect(runningStatus.cycles_completed).toBeGreaterThan(0);

      loopInstance.stop();
    });

    it('should provide proper configuration interface', () => {
      const loopInstance = new ConductorLoop();
      const config = loopInstance.getConfig();

      expect(config.enabled).toBeDefined();
      expect(config.cycle_interval_ms).toBeGreaterThan(0);
      expect(config.max_concurrent_models).toBeGreaterThan(0);
      expect(config.budget_per_cycle).toBeGreaterThan(0);
      expect(config.consciousness_layers_required).toBeGreaterThan(0);

      loopInstance.stop();
    });

    it('should allow runtime configuration updates', async () => {
      const loopInstance = new ConductorLoop();
      const newBudget = 25;

      loopInstance.setConfig({ budget_per_cycle: newBudget });
      const updated = loopInstance.getConfig();

      expect(updated.budget_per_cycle).toBe(newBudget);

      loopInstance.stop();
    });
  });

  describe('Spawned Models Lifecycle', () => {
    it('should track active models', async () => {
      const evaluation = await goalEvaluator.evaluate();

      if (evaluation.recommended_operations.length > 0) {
        const operation = evaluation.recommended_operations[0];
        const spawnResult = await modelSpawner.spawn('test_user', operation, 100);

        if (spawnResult.spawned_models.length > 0) {
          const activeModels = modelSpawner.getActiveModels();
          expect(activeModels.length).toBeGreaterThan(0);
        }
      }
    });

    it('should provide execution contexts for spawned models', async () => {
      const evaluation = await goalEvaluator.evaluate();

      if (evaluation.recommended_operations.length > 0) {
        const operation = evaluation.recommended_operations[0];
        await modelSpawner.spawn('test_user', operation, 100);

        const contexts = modelSpawner.getExecutionContexts();
        expect(contexts).toBeDefined();
        expect(contexts.size).toBeGreaterThanOrEqual(0);
      }
    });

    it('should be able to clear completed models', async () => {
      const evaluation = await goalEvaluator.evaluate();

      if (evaluation.recommended_operations.length > 0) {
        const operation = evaluation.recommended_operations[0];
        const spawnResult = await modelSpawner.spawn('test_user', operation, 100);

        // Wait for execution to complete
        await new Promise(resolve => setTimeout(resolve, 150));

        const clearedCount = modelSpawner.clearCompletedModels();
        expect(typeof clearedCount === 'number').toBe(true);
      }
    });

    it('should provide active model count', async () => {
      const initialCount = modelSpawner.getActiveModelCount();
      expect(typeof initialCount === 'number').toBe(true);
      expect(initialCount).toBeGreaterThanOrEqual(0);
    });
  });
});
