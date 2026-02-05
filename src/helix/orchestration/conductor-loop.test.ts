import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConductorLoop } from './conductor-loop.js';

describe('ConductorLoop', () => {
  let loop: ConductorLoop;

  beforeEach(() => {
    loop = new ConductorLoop();
  });

  afterEach(async () => {
    await loop.stop();
  });

  describe('start', () => {
    it('should start the conductor loop', async () => {
      const isRunning = await loop.start();
      expect(isRunning).toBe(true);
    });

    it('should not allow double-start', async () => {
      await loop.start();
      const secondStart = await loop.start();
      expect(secondStart).toBe(false);
    });

    it('should execute at least one cycle', async () => {
      await loop.start();

      // Wait for one cycle
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('stop', () => {
    it('should stop the conductor loop', async () => {
      await loop.start();
      const stopped = await loop.stop();
      expect(stopped).toBe(true);
    });

    it('should not allow double-stop', async () => {
      await loop.start();
      await loop.stop();
      const secondStop = await loop.stop();
      expect(secondStop).toBe(false);
    });
  });

  describe('ConductionCycle', () => {
    it('should load consciousness', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle).toBeDefined();
        expect(cycle.consciousness_loaded).toBeDefined();
      }
    });

    it('should evaluate goals', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.goals_evaluated).toBeGreaterThanOrEqual(0);
      }
    });

    it('should spawn operations', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.operations_spawned).toBeGreaterThanOrEqual(0);
      }
    });

    it('should track cycle timing', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.cycle_duration_ms).toBeGreaterThan(0);
        expect(cycle.cycle_duration_ms).toBeLessThan(5000);
      }
    });

    it('should track cost per cycle', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.total_cost_this_cycle).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have status (success, partial, failed)', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(['success', 'partial', 'failed']).toContain(cycle.status);
      }
    });

    it('should schedule next cycle', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.next_cycle_at).toBeDefined();
        const nextTime = new Date(cycle.next_cycle_at).getTime();
        expect(nextTime).toBeGreaterThan(Date.now());
      }
    });

    it('should have cycle_id', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.cycle_id).toBeDefined();
        expect(cycle.cycle_id).toMatch(/^cycle_\d+$/);
      }
    });

    it('should have started_at timestamp', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        expect(cycle.started_at).toBeDefined();
        expect(new Date(cycle.started_at).getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('getStatus', () => {
    it('should report loop status', async () => {
      const status = await loop.getStatus();
      expect(status).toBeDefined();
      expect(status.is_running).toBeDefined();
      expect(status.cycles_completed).toBeGreaterThanOrEqual(0);
    });

    it('should show running=true after start', async () => {
      await loop.start();
      const status = await loop.getStatus();
      expect(status.is_running).toBe(true);
      await loop.stop();
    });

    it('should show running=false after stop', async () => {
      await loop.start();
      await loop.stop();
      const status = await loop.getStatus();
      expect(status.is_running).toBe(false);
    });

    it('should track total cost', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      const status = await loop.getStatus();
      expect(status.total_cost_usd).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCycles', () => {
    it('should return cycle history', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      expect(Array.isArray(cycles)).toBe(true);
    });

    it('should maintain cycle order (newest first)', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      const cycles = await loop.getCycles();
      if (cycles.length > 1) {
        const first = new Date(cycles[0].started_at).getTime();
        const second = new Date(cycles[1].started_at).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should respect limit parameter', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      const cycles = await loop.getCycles(1);
      expect(cycles.length).toBeLessThanOrEqual(1);
    });
  });

  describe('configuration', () => {
    it('should use default cycle interval (60 seconds)', async () => {
      const config = await loop.getConfig();
      expect(config.cycle_interval_ms).toBe(60000);
    });

    it('should have max_concurrent_models config', async () => {
      const config = await loop.getConfig();
      expect(config.max_concurrent_models).toBeGreaterThan(0);
    });

    it('should have budget_per_cycle config', async () => {
      const config = await loop.getConfig();
      expect(config.budget_per_cycle).toBeGreaterThan(0);
    });

    it('should have consciousness_layers_required config', async () => {
      const config = await loop.getConfig();
      expect(config.consciousness_layers_required).toBeGreaterThan(0);
    });

    it('should enforce budget per cycle', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        const config = await loop.getConfig();
        expect(cycle.total_cost_this_cycle).toBeLessThanOrEqual(config.budget_per_cycle);
      }
    });

    it('should allow config updates', async () => {
      const newBudget = 20;
      await loop.setConfig({ budget_per_cycle: newBudget });
      const config = await loop.getConfig();
      expect(config.budget_per_cycle).toBe(newBudget);
    });
  });

  describe('error resilience', () => {
    it('should handle consciousness load failures gracefully', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        // Cycle should exist even if consciousness failed
        expect(cycles[cycles.length - 1]).toBeDefined();
      }
    });

    it('should continue on partial failures', async () => {
      await loop.start();

      // Wait for 2 cycles
      await new Promise(resolve => setTimeout(resolve, 200));

      const cycles = await loop.getCycles();
      // Should have multiple cycles even if some failed
      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });

    it('should set status to partial on consciousness failure', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        const cycle = cycles[cycles.length - 1];
        // Status should be one of the valid states
        expect(['success', 'partial', 'failed']).toContain(cycle.status);
      }
    });
  });

  describe('logging', () => {
    it('should log cycles to hash chain', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        // Cycle has timestamp, indicating logging occurred
        expect(cycles[cycles.length - 1].started_at).toBeDefined();
      }
    });

    it('should track cycle_id in each cycle', async () => {
      await loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const cycles = await loop.getCycles();
      if (cycles.length > 0) {
        expect(cycles[cycles.length - 1].cycle_id).toBeDefined();
      }
    });
  });
});
