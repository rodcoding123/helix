/**
 * Operation Queue - Persistent storage for failed async operations
 *
 * When Discord webhooks or other external services become unavailable, this queue
 * persists failed operations to SQLite. When service recovers (detected via circuit breaker),
 * operations are replayed in FIFO order with exponential backoff.
 *
 * Purpose: Prevent loss of critical logging, command execution, or other operations
 * when external services temporarily fail.
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export interface QueuedOperation {
  id: string;
  operation: string; // 'discord_webhook', 'command', 'state_sync', etc.
  data: Record<string, unknown>;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  error?: string;
  priority: 'critical' | 'high' | 'normal' | 'low'; // critical = must not lose (hash chain), high = important (Discord), normal = regular logging, low = optional
}

export interface OperationQueueConfig {
  dbPath?: string;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  flushBatchSize?: number;
}

/**
 * Persistent queue for operations that fail when external services are unavailable
 */
export class OperationQueue {
  private db: Database.Database;
  private dbPath: string;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly flushBatchSize: number;
  private isProcessing = false;

  constructor(
    dbPath: string = '.helix-state/operation-queue.db',
    config: OperationQueueConfig = {}
  ) {
    this.dbPath = dbPath;
    this.maxRetries = config.maxRetries ?? 10;
    this.baseBackoffMs = config.baseBackoffMs ?? 1000;
    this.maxBackoffMs = config.maxBackoffMs ?? 300000; // 5 minutes
    this.flushBatchSize = config.flushBatchSize ?? 50;

    // Initialize database
    this.db = this.initializeDatabase();
  }

  /**
   * Initialize SQLite database with operation queue table
   */
  private initializeDatabase(): Database.Database {
    const db = new Database(this.dbPath);

    // Enable foreign keys and WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Create operations table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS queued_operations (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at INTEGER NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at INTEGER,
        next_retry_at INTEGER,
        error TEXT,
        processed_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_next_retry_at ON queued_operations(next_retry_at);
      CREATE INDEX IF NOT EXISTS idx_priority ON queued_operations(priority);
      CREATE INDEX IF NOT EXISTS idx_created_at ON queued_operations(created_at);

      CREATE TABLE IF NOT EXISTS operation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        error TEXT,
        duration_ms INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (operation_id) REFERENCES queued_operations(id)
      );
    `);

    return db;
  }

  /**
   * Add an operation to the queue
   */
  async enqueue(
    id: string,
    operation: string,
    data: Record<string, unknown>,
    priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO queued_operations
      (id, operation, data, priority, created_at, attempt_count)
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        operation = excluded.operation,
        data = excluded.data,
        priority = excluded.priority,
        attempt_count = CASE WHEN processed_at IS NULL THEN attempt_count ELSE 0 END
    `);

    stmt.run(id, operation, JSON.stringify(data), priority, Date.now());

    console.log(`[OperationQueue] Enqueued ${operation} (priority: ${priority})`);
  }

  /**
   * Get next operation to process (respecting retry timing and priority)
   */
  getNextOperation(): QueuedOperation | null {
    const stmt = this.db.prepare(`
      SELECT id, operation, data, priority, created_at, attempt_count, last_attempt_at, next_retry_at, error
      FROM queued_operations
      WHERE processed_at IS NULL
        AND (next_retry_at IS NULL OR next_retry_at <= ?)
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
        END,
        created_at ASC
      LIMIT 1
    `);

    const row = stmt.get(Date.now()) as any;

    if (!row) return null;

    return {
      id: row.id,
      operation: row.operation,
      data: JSON.parse(row.data),
      priority: row.priority,
      createdAt: row.created_at,
      attemptCount: row.attempt_count,
      lastAttemptAt: row.last_attempt_at,
      nextRetryAt: row.next_retry_at,
      error: row.error,
    };
  }

  /**
   * Mark operation as successfully processed
   */
  async markProcessed(operationId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE queued_operations
      SET processed_at = ?, attempt_count = attempt_count + 1, last_attempt_at = ?
      WHERE id = ?
    `);

    const now = Date.now();
    stmt.run(now, now, operationId);

    // Log to history
    this.logHistory(operationId, 'success', null);

    console.log(`[OperationQueue] Processed operation ${operationId}`);
  }

  /**
   * Mark operation as failed (schedules retry)
   */
  async markFailed(operationId: string, error: string): Promise<void> {
    const op = this.db
      .prepare('SELECT attempt_count FROM queued_operations WHERE id = ?')
      .get(operationId) as any;

    if (!op) return;

    const attemptCount = op.attempt_count + 1;
    const shouldRetry = attemptCount < this.maxRetries;

    if (shouldRetry) {
      // Calculate next retry time with exponential backoff + jitter
      const backoffMs = Math.min(
        this.baseBackoffMs * Math.pow(2, attemptCount - 1),
        this.maxBackoffMs
      );
      const jitter = Math.random() * backoffMs * 0.1; // ±10% jitter
      const nextRetryAt = Date.now() + backoffMs + jitter;

      const stmt = this.db.prepare(`
        UPDATE queued_operations
        SET
          error = ?,
          attempt_count = attempt_count + 1,
          last_attempt_at = ?,
          next_retry_at = ?
        WHERE id = ?
      `);

      stmt.run(error, Date.now(), nextRetryAt, operationId);

      console.warn(
        `[OperationQueue] Operation ${operationId} failed (attempt ${attemptCount}/${this.maxRetries}), ` +
          `retrying in ${Math.round(backoffMs / 1000)}s`
      );
    } else {
      // Max retries exceeded - mark as dead letter
      const stmt = this.db.prepare(`
        UPDATE queued_operations
        SET
          error = ?,
          processed_at = ?,
          attempt_count = attempt_count + 1
        WHERE id = ?
      `);

      stmt.run(error, Date.now(), operationId);

      console.error(
        `[OperationQueue] Operation ${operationId} exceeded max retries (${this.maxRetries}). ` +
          `Marking as dead letter. Error: ${error}`
      );
    }

    this.logHistory(operationId, 'failed', error);
  }

  /**
   * Flush queued operations (called when service recovers via circuit breaker)
   */
  async flush(
    executor: (op: QueuedOperation) => Promise<void>
  ): Promise<{ processed: number; failed: number }> {
    if (this.isProcessing) {
      console.log('[OperationQueue] Flush already in progress');
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    let processed = 0;
    let failed = 0;

    try {
      let operation = this.getNextOperation();

      while (operation && processed + failed < this.flushBatchSize) {
        try {
          const startTime = Date.now();
          await executor(operation);
          const duration = Date.now() - startTime;

          await this.markProcessed(operation.id);
          console.log(`[OperationQueue] Flushed ${operation.operation} in ${duration}ms`);
          processed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          await this.markFailed(operation.id, errorMsg);
          failed++;
        }

        operation = this.getNextOperation();
      }

      if (processed > 0 || failed > 0) {
        console.log(
          `[OperationQueue] Flush completed: ${processed} processed, ${failed} scheduled for retry`
        );
      }
    } finally {
      this.isProcessing = false;
    }

    return { processed, failed };
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processed: number;
    deadLetters: number;
    oldestOperation?: { id: string; operation: string; createdAt: number; age: number };
  } {
    const totals = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN processed_at IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN processed_at IS NOT NULL THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN processed_at IS NOT NULL AND attempt_count >= ? THEN 1 ELSE 0 END) as dead_letters
      FROM queued_operations
    `
      )
      .get(this.maxRetries) as any;

    const oldest = this.db
      .prepare(
        `
      SELECT id, operation, created_at
      FROM queued_operations
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
    `
      )
      .get() as any;

    return {
      total: totals.total || 0,
      pending: totals.pending || 0,
      processed: totals.processed || 0,
      deadLetters: totals.dead_letters || 0,
      oldestOperation: oldest
        ? {
            id: oldest.id,
            operation: oldest.operation,
            createdAt: oldest.created_at,
            age: Date.now() - oldest.created_at,
          }
        : undefined,
    };
  }

  /**
   * Get operations by status for monitoring
   */
  getOperations(
    status: 'pending' | 'processed' | 'all' = 'pending',
    limit: number = 100
  ): QueuedOperation[] {
    let query = `
      SELECT id, operation, data, priority, created_at, attempt_count, last_attempt_at, next_retry_at, error
      FROM queued_operations
    `;

    if (status === 'pending') {
      query += ' WHERE processed_at IS NULL';
    } else if (status === 'processed') {
      query += ' WHERE processed_at IS NOT NULL';
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      operation: row.operation,
      data: JSON.parse(row.data),
      priority: row.priority,
      createdAt: row.created_at,
      attemptCount: row.attempt_count,
      lastAttemptAt: row.last_attempt_at,
      nextRetryAt: row.next_retry_at,
      error: row.error,
    }));
  }

  /**
   * Clear processed operations older than specified time
   */
  async clearProcessed(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffTime = Date.now() - olderThanMs;

    // First delete from history table (respects foreign key constraint)
    const historyStmt = this.db.prepare(`
      DELETE FROM operation_history
      WHERE operation_id IN (
        SELECT id FROM queued_operations
        WHERE processed_at IS NOT NULL AND created_at < ?
      )
    `);
    historyStmt.run(cutoffTime);

    // Then delete from operations table
    const stmt = this.db.prepare(`
      DELETE FROM queued_operations
      WHERE processed_at IS NOT NULL AND created_at < ?
    `);

    const result = stmt.run(cutoffTime);
    console.log(`[OperationQueue] Cleared ${result.changes} old operations`);
    return result.changes;
  }

  /**
   * Log operation attempt to history
   */
  private logHistory(
    operationId: string,
    status: 'success' | 'failed',
    error: string | null
  ): void {
    const op = this.db
      .prepare('SELECT operation, attempt_count FROM queued_operations WHERE id = ?')
      .get(operationId) as any;

    if (!op) return;

    const stmt = this.db.prepare(`
      INSERT INTO operation_history (operation_id, operation, status, attempt_number, error, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(operationId, op.operation, status, op.attempt_count + 1, error, Date.now());
  }

  /**
   * Clean up database resources
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Global operation queue instance
 */
export const operationQueue = new OperationQueue();

/**
 * Ensure queue database directory exists
 */
export async function initializeOperationQueue(
  dbPath: string = '.helix-state/operation-queue.db'
): Promise<void> {
  try {
    await mkdir(dirname(dbPath), { recursive: true });
  } catch (error) {
    console.error(`Failed to create operation queue directory: ${error}`);
  }
}
