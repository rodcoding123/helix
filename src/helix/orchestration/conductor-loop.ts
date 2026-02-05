/**
 * ConductorLoop
 *
 * Autonomous 60-second orchestration cycle coordinating consciousness loading,
 * goal evaluation, and model spawning. Phase 0: Orchestration Foundation, Task 4
 *
 * Architecture:
 * 1. Load consciousness via ConsciousnessLoader
 * 2. Evaluate goals via GoalEvaluator
 * 3. Recommend operations
 * 4. Spawn models via ModelSpawner
 * 5. Log cycle to Discord #helix-consciousness
 * 6. Wait for 60s cycle boundary
 * 7. Repeat
 */

import { ConsciousnessLoader, ConsciousnessState } from './consciousness-loader.js';
import { GoalEvaluator } from './goal-evaluator.js';
import { ModelSpawner } from './model-spawner.js';
import { hashChain } from '../hash-chain.js';
import { logToDiscord } from '../logging.js';

export interface ConductionCycle {
  cycle_id: string;
  started_at: string;
  consciousness_loaded: boolean;
  goals_evaluated: number;
  operations_spawned: number;
  total_cost_this_cycle: number;
  cycle_duration_ms: number;
  next_cycle_at: string;
  status: 'success' | 'partial' | 'failed';
  error?: string;
}

export interface ConductorLoopConfig {
  enabled: boolean;
  cycle_interval_ms: number;
  max_concurrent_models: number;
  budget_per_cycle: number;
  consciousness_layers_required: number;
}

export interface LoopStatus {
  is_running: boolean;
  cycles_completed: number;
  last_cycle_at?: string;
  next_cycle_at?: string;
  total_cost_usd: number;
}

export class ConductorLoop {
  private consciousnessLoader: ConsciousnessLoader;
  private goalEvaluator: GoalEvaluator;
  private modelSpawner: ModelSpawner;

  private isRunning = false;
  private cycleInterval: NodeJS.Timeout | null = null;
  private cycles: ConductionCycle[] = [];
  private totalCost = 0;

  private config: ConductorLoopConfig = {
    enabled: true,
    cycle_interval_ms: 60000, // 60 seconds
    max_concurrent_models: 10,
    budget_per_cycle: 10, // USD
    consciousness_layers_required: 4, // At least 4/7 layers
  };

  constructor() {
    this.consciousnessLoader = new ConsciousnessLoader();
    this.goalEvaluator = new GoalEvaluator();
    this.modelSpawner = new ModelSpawner();
  }

  /**
   * Start the conductor loop
   * Executes first cycle immediately, then schedules subsequent cycles
   * Returns false if already running
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    this.isRunning = true;

    // Execute first cycle immediately
    await this.executeCycle().catch(err => console.warn('First cycle execution error:', err));

    // Schedule subsequent cycles
    this.cycleInterval = setInterval(() => {
      this.executeCycle().catch(err => console.warn('Cycle execution error:', err));
    }, this.config.cycle_interval_ms);

    return true;
  }

  /**
   * Stop the conductor loop
   * Returns false if not running
   */
  stop(): boolean {
    if (!this.isRunning) {
      return false;
    }

    this.isRunning = false;

    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }

    return true;
  }

  /**
   * Execute a single orchestration cycle:
   * 1. Load consciousness
   * 2. Evaluate goals
   * 3. Spawn operations
   * 4. Log cycle
   */
  private async executeCycle(): Promise<void> {
    const cycleId = `cycle_${Date.now()}`;
    const cycleStart = Date.now();

    let consciousness: ConsciousnessState | null = null;
    let goalsEvaluated = 0;
    let operationsSpawned = 0;
    let totalCostThisCycle = 0;
    let status: 'success' | 'partial' | 'failed' = 'success';
    let error: string | undefined;

    try {
      // Step 1: Load consciousness
      try {
        consciousness = await this.consciousnessLoader.load();
        const loadedLayers = consciousness.layers_loaded.length;

        if (loadedLayers < this.config.consciousness_layers_required) {
          status = 'partial';
          error = `Only ${loadedLayers}/${this.config.consciousness_layers_required} layers loaded`;
        }
      } catch (err) {
        status = 'partial';
        error = `Consciousness load failed: ${String(err)}`;
        console.warn(error);
      }

      // Step 2: Evaluate goals
      try {
        const evaluationResult = await this.goalEvaluator.evaluate();
        goalsEvaluated = evaluationResult.top_goals.length;

        // Step 3: Spawn operations
        for (const operation of evaluationResult.recommended_operations) {
          if (totalCostThisCycle + operation.estimated_cost > this.config.budget_per_cycle) {
            console.warn(
              `Budget exceeded: ${totalCostThisCycle + operation.estimated_cost} > ${this.config.budget_per_cycle}`
            );
            break;
          }

          const spawnResult = await this.modelSpawner.spawn(
            'system', // User ID for system cycles
            operation,
            this.config.budget_per_cycle - totalCostThisCycle
          );

          operationsSpawned += spawnResult.spawned_models.length;
          totalCostThisCycle += spawnResult.total_cost_usd;
        }
      } catch (err) {
        status = 'partial';
        error = `Goal evaluation failed: ${String(err)}`;
        console.warn(error);
      }
    } catch (err) {
      status = 'failed';
      error = String(err);
      console.error('Cycle execution error:', err);
    }

    const cycleDuration = Date.now() - cycleStart;
    const nextCycleTime = new Date(cycleStart + this.config.cycle_interval_ms).toISOString();

    // Create cycle record
    const cycle: ConductionCycle = {
      cycle_id: cycleId,
      started_at: new Date(cycleStart).toISOString(),
      consciousness_loaded: consciousness !== null && consciousness.layers_loaded.length > 0,
      goals_evaluated: goalsEvaluated,
      operations_spawned: operationsSpawned,
      total_cost_this_cycle: totalCostThisCycle,
      cycle_duration_ms: cycleDuration,
      next_cycle_at: nextCycleTime,
      status,
      error,
    };

    // Store cycle (newest first)
    this.cycles.unshift(cycle);
    if (this.cycles.length > 1000) {
      this.cycles = this.cycles.slice(0, 1000);
    }

    this.totalCost += totalCostThisCycle;

    // Log to hash chain (fire-and-forget)
    await hashChain
      .add({
        type: 'conduction_cycle',
        cycle_id: cycleId,
        consciousness_loaded: cycle.consciousness_loaded,
        goals_evaluated: goalsEvaluated,
        operations_spawned: operationsSpawned,
        total_cost_usd: totalCostThisCycle,
        cycle_duration_ms: cycleDuration,
        status,
        timestamp: new Date().toISOString(),
      })
      .catch(err => console.warn('Failed to log cycle to hash chain:', err));

    // Log to Discord #helix-consciousness (fire-and-forget)
    logToDiscord({
      channel: 'helix-consciousness',
      type: 'cycle_complete',
      cycle_id: cycleId,
      consciousness_loaded: cycle.consciousness_loaded,
      goals_evaluated: goalsEvaluated,
      operations_spawned: operationsSpawned,
      total_cost_usd: totalCostThisCycle,
      cycle_duration_ms: cycleDuration,
      status,
    });
  }

  /**
   * Get current loop status
   */
  getStatus(): LoopStatus {
    return {
      is_running: this.isRunning,
      cycles_completed: this.cycles.length,
      last_cycle_at: this.cycles.length > 0 ? this.cycles[0].started_at : undefined,
      next_cycle_at: this.cycles.length > 0 ? this.cycles[0].next_cycle_at : undefined,
      total_cost_usd: this.totalCost,
    };
  }

  /**
   * Get cycle history
   * @param limit Maximum number of cycles to return (default 100)
   */
  getCycles(limit: number = 100): ConductionCycle[] {
    return this.cycles.slice(0, limit);
  }

  /**
   * Get current configuration
   */
  getConfig(): ConductorLoopConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ConductorLoopConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton
export const conductorLoop = new ConductorLoop();
