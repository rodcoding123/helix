/**
 * Phase 9B: Batch Executor Service
 * Manages execution of batched AI operations with parallelism support
 * Integrates with Phase 0.5 AI Operations Control Plane for cost tracking
 */

import { createClient } from '@supabase/supabase-js';
import { aiRouter } from '../intelligence/router-client';
import { EventEmitter } from 'events';

export interface BatchOperation {
  operation_id: string;
  parameters: Record<string, unknown>;
  sequence_order?: number;
  depends_on?: string;
}

export interface BatchConfig {
  user_id: string;
  name: string;
  operations: BatchOperation[];
  batch_type: 'parallel' | 'sequential' | 'conditional';
  max_concurrent?: number;
  max_cost_usd?: number;
}

export interface BatchStatus {
  id: string;
  user_id: string;
  name: string;
  batch_type: string;
  status: 'draft' | 'queued' | 'running' | 'completed' | 'failed';
  total_operations: number;
  completed_operations: number;
  failed_operations: number;
  total_cost_estimated: number;
  total_cost_actual?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * BatchExecutor manages batch execution of AI operations
 * Supports parallel, sequential, and conditional execution modes
 */
export class BatchExecutor extends EventEmitter {
  private db = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );

  /**
   * Create a new batch with operations
   */
  async createBatch(config: BatchConfig): Promise<string> {
    try {
      const totalCostEstimated = await this.estimateTotalCost(config.operations);

      const { data: batch, error } = await this.db
        .from('operation_batches')
        .insert({
          user_id: config.user_id,
          name: config.name,
          batch_type: config.batch_type,
          total_operations: config.operations.length,
          total_cost_estimated: totalCostEstimated,
        })
        .select('id')
        .single();

      if (error || !batch) {
        throw new Error(`Failed to create batch: ${error?.message}`);
      }

      const batchId = batch.id;

      // Insert individual operations
      for (let i = 0; i < config.operations.length; i++) {
        const op = config.operations[i];
        const { error: opError } = await this.db.from('batch_operations').insert({
          batch_id: batchId,
          operation_id: op.operation_id,
          parameters: op.parameters || {},
          sequence_order: op.sequence_order ?? i,
          depends_on: op.depends_on,
        });

        if (opError) {
          console.error(`Failed to insert operation: ${opError.message}`);
        }
      }

      return batchId;
    } catch (error) {
      console.error('Batch creation error:', error);
      throw error;
    }
  }

  /**
   * Execute a batch by ID
   */
  async executeBatch(batchId: string): Promise<void> {
    try {
      const { data: batch, error: batchError } = await this.db
        .from('operation_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError || !batch) {
        throw new Error(`Batch not found: ${batchError?.message}`);
      }

      // Update batch status to running
      await this.db
        .from('operation_batches')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', batchId);

      this.emit('batch:started', { batchId });

      // Fetch operations for batch
      const { data: operations, error: opsError } = await this.db
        .from('batch_operations')
        .select('*')
        .eq('batch_id', batchId)
        .order('sequence_order', { ascending: true });

      if (opsError || !operations) {
        throw new Error(`Failed to fetch operations: ${opsError?.message}`);
      }

      // Execute based on batch type
      switch (batch.batch_type) {
        case 'parallel':
          await this.executeParallel(batchId, operations);
          break;
        case 'sequential':
          await this.executeSequential(batchId, operations);
          break;
        case 'conditional':
          await this.executeConditional(batchId, operations);
          break;
        default:
          throw new Error(`Unknown batch type: ${batch.batch_type}`);
      }

      // Mark batch complete
      const totalCost = await this.calculateTotalCost(batchId);
      await this.db
        .from('operation_batches')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_cost_actual: totalCost,
        })
        .eq('id', batchId);

      this.emit('batch:completed', { batchId, totalCost });
    } catch (error) {
      await this.db
        .from('operation_batches')
        .update({ status: 'failed' })
        .eq('id', batchId);

      this.emit('batch:failed', { batchId, error });
    }
  }

  /**
   * Execute operations in parallel
   */
  private async executeParallel(
    batchId: string,
    operations: any[]
  ): Promise<void> {
    const maxConcurrent = 5;
    const queue = [...operations];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill execution slots
      while (executing.length < maxConcurrent && queue.length > 0) {
        const op = queue.shift();
        const promise = this.executeOperation(batchId, op);
        executing.push(promise);
      }

      if (executing.length > 0) {
        await Promise.race(executing);
        const idx = executing.findIndex(p => !p);
        if (idx >= 0) {
          executing.splice(idx, 1);
        }
      }
    }
  }

  /**
   * Execute operations sequentially
   */
  private async executeSequential(
    batchId: string,
    operations: any[]
  ): Promise<void> {
    for (const op of operations) {
      await this.executeOperation(batchId, op);
    }
  }

  /**
   * Execute operations with dependency tracking
   */
  private async executeConditional(
    batchId: string,
    operations: any[]
  ): Promise<void> {
    const results = new Map<string, any>();

    for (const op of operations) {
      if (op.depends_on) {
        const parentResult = results.get(op.depends_on);
        if (!parentResult?.success) {
          // Skip if dependency failed
          await this.db
            .from('batch_operations')
            .update({ status: 'skipped' })
            .eq('id', op.id);
          continue;
        }
      }

      const result = await this.executeOperation(batchId, op);
      results.set(op.id, result);
    }
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(batchId: string, op: any): Promise<any> {
    const executionId = op.id;
    const startTime = Date.now();

    try {
      // Update status to running
      await this.db
        .from('batch_operations')
        .update({ status: 'running' })
        .eq('id', executionId);

      // Execute via Phase 0.5 router
      const result = await aiRouter.execute(op.operation_id, op.parameters);

      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      // Get cost from AI operation log
      const { data: lastOp } = await this.db
        .from('ai_operation_log')
        .select('cost_usd')
        .eq('operation_id', op.operation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const cost = lastOp?.cost_usd || 0;

      // Update operation with success
      await this.db
        .from('batch_operations')
        .update({
          status: 'success',
          result,
          cost_usd: cost,
          executed_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Increment completed count
      await this.db.rpc('increment_batch_completed', {
        batch_id: batchId,
      });

      this.emit('operation:completed', { batchId, operationId: executionId });

      return { success: true, result, cost };
    } catch (error) {
      const endTime = Date.now();
      const latencyMs = endTime - startTime;

      // Update operation with failure
      await this.db
        .from('batch_operations')
        .update({
          status: 'failed',
          result: { error: error instanceof Error ? error.message : String(error) },
          executed_at: new Date().toISOString(),
        })
        .eq('id', executionId);

      // Increment failed count
      await this.db.rpc('increment_batch_failed', {
        batch_id: batchId,
      });

      this.emit('operation:failed', { batchId, operationId: executionId, error });

      return { success: false, error };
    }
  }

  /**
   * Estimate total cost for all operations in batch
   */
  private async estimateTotalCost(operations: BatchOperation[]): Promise<number> {
    let totalCost = 0;

    for (const op of operations) {
      try {
        // Get operation cost info
        const costs = await aiRouter.getOperationCosts(op.operation_id);
        totalCost += costs.estimated || 0.01;
      } catch {
        // Default estimate if lookup fails
        totalCost += 0.01;
      }
    }

    return totalCost;
  }

  /**
   * Calculate actual total cost for completed batch
   */
  private async calculateTotalCost(batchId: string): Promise<number> {
    const { data } = await this.db
      .from('batch_operations')
      .select('cost_usd')
      .eq('batch_id', batchId);

    return (data || []).reduce((sum, op) => sum + (op.cost_usd || 0), 0);
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<BatchStatus | null> {
    const { data } = await this.db
      .from('operation_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    return (data as BatchStatus) || null;
  }

  /**
   * Get batch execution history for user
   */
  async getBatchHistory(userId: string, limit: number = 10): Promise<BatchStatus[]> {
    const { data } = await this.db
      .from('operation_batches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data as BatchStatus[]) || [];
  }
}

/**
 * Singleton instance of batch executor
 */
let executorInstance: BatchExecutor | null = null;

/**
 * Get or create batch executor instance
 */
export function getBatchExecutor(): BatchExecutor {
  if (!executorInstance) {
    executorInstance = new BatchExecutor();
  }
  return executorInstance;
}
