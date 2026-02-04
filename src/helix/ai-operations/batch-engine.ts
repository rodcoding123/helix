/**
 * Batch Operation Engine - Phase 4
 *
 * Groups related operations for efficient execution and cost optimization.
 * Supports parallel execution with concurrency limits and failure isolation.
 */

export interface BatchItem {
  id: string;
  data: unknown;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: Error;
  result?: unknown;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxConcurrency?: number;
  timeoutMs?: number;
}

export interface Batch {
  id: string;
  operationType: string;
  maxBatchSize: number;
  items: BatchItem[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
  createdAt: string;
  executedAt?: string;
}

export interface BatchExecutionResult {
  batchId: string;
  successful: number;
  failed: number;
  totalTime: number;
  itemResults: Array<{
    itemId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface BatchStats {
  totalBatches: number;
  completedBatches: number;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  averageBatchSize: number;
}

export class BatchOperationEngine {
  private batches: Map<string, Batch> = new Map();
  private batchCounters: Map<string, number> = new Map();
  private nextItemId = 0;

  /**
   * Create a new batch
   */
  createBatch(operationType: string, maxBatchSize: number): Batch {
    const id = `batch_${operationType}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const batch: Batch = {
      id,
      operationType,
      maxBatchSize,
      items: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.batches.set(id, batch);
    return batch;
  }

  /**
   * Add item to batch (returns null if batch is full)
   */
  addToBatch(batchId: string, data: unknown): string | null {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.items.length >= batch.maxBatchSize) {
      return null; // Batch is full
    }

    const itemId = `item_${this.nextItemId++}`;
    const item: BatchItem = {
      id: itemId,
      data,
      status: 'pending',
    };

    batch.items.push(item);
    return itemId;
  }

  /**
   * Get or create batch (creates new if current is full)
   */
  getOrCreateBatch(operationType: string, maxBatchSize: number): Batch {
    // Find existing batch
    for (const batch of this.batches.values()) {
      if (
        batch.operationType === operationType &&
        batch.status === 'pending' &&
        batch.items.length < batch.maxBatchSize
      ) {
        return batch;
      }
    }

    // Create new batch
    return this.createBatch(operationType, maxBatchSize);
  }

  /**
   * Get batch by ID
   */
  getBatch(batchId: string): Batch | undefined {
    return this.batches.get(batchId);
  }

  /**
   * Execute batch items
   */
  async executeBatch(
    batchId: string,
    executor: (item: unknown) => Promise<void>,
    options: { maxConcurrency?: number; timeoutMs?: number } = {}
  ): Promise<BatchExecutionResult> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const maxConcurrency = options.maxConcurrency || 5;
    const startTime = Date.now();
    const itemResults: BatchExecutionResult['itemResults'] = [];
    let successful = 0;
    let failed = 0;

    // Mark batch as executing
    batch.status = 'executing';
    batch.executedAt = new Date().toISOString();

    // Execute with concurrency limit
    const queue = [...batch.items];
    const executing: Promise<void>[] = [];

    while (queue.length > 0 || executing.length > 0) {
      // Fill up to maxConcurrency
      while (executing.length < maxConcurrency && queue.length > 0) {
        const item = queue.shift()!;
        item.status = 'executing';

        const promise = executor(item.data)
          .then(() => {
            item.status = 'completed';
            successful++;
            itemResults.push({ itemId: item.id, success: true });
          })
          .catch(error => {
            item.status = 'failed';
            item.error = error as Error;
            failed++;
            itemResults.push({
              itemId: item.id,
              success: false,
              error: (error as Error).message,
            });
          })
          .finally(() => {
            const index = executing.indexOf(promise);
            void executing.splice(index, 1);
          });

        void executing.push(promise);
      }

      // Wait for at least one to complete
      if (executing.length > 0) {
        await Promise.race(executing);
      }
    }

    batch.status = successful === batch.items.length ? 'completed' : 'failed';

    return {
      batchId,
      successful,
      failed,
      totalTime: Date.now() - startTime,
      itemResults,
    };
  }

  /**
   * Calculate cost for batch operation
   */
  calculateBatchCost(batchId: string, _inputTokens: number, _outputTokens: number): number {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return 0;
    }

    // Simplified: assume $0.001 per item average
    const baselineCost = batch.items.length * 0.001;

    // Batch discount: 10% discount per batch
    const batchDiscount = 0.9;

    return baselineCost * batchDiscount;
  }

  /**
   * Get batch status
   */
  getBatchStatus(batchId: string): Batch | undefined {
    return this.batches.get(batchId);
  }

  /**
   * Mark batch as executing
   */
  markBatchExecuting(batchId: string): void {
    const batch = this.batches.get(batchId);
    if (batch) {
      batch.status = 'executing';
      batch.executedAt = new Date().toISOString();
    }
  }

  /**
   * Get batch statistics
   */
  getBatchStats(): BatchStats {
    const batches = Array.from(this.batches.values());

    const totalBatches = batches.length;
    const completedBatches = batches.filter(b => b.status === 'completed').length;
    const totalItems = batches.reduce((sum, b) => sum + b.items.length, 0);
    const completedItems = batches.reduce(
      (sum, b) => sum + b.items.filter(i => i.status === 'completed').length,
      0
    );
    const failedItems = batches.reduce(
      (sum, b) => sum + b.items.filter(i => i.status === 'failed').length,
      0
    );

    return {
      totalBatches,
      completedBatches,
      totalItems,
      completedItems,
      failedItems,
      averageBatchSize: totalBatches > 0 ? totalItems / totalBatches : 0,
    };
  }

  /**
   * Clear all batches (for testing)
   */
  clear(): void {
    this.batches.clear();
    this.batchCounters.clear();
    this.nextItemId = 0;
  }
}
