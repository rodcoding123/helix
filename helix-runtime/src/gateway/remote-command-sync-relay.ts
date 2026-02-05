/**
 * Remote Command Sync Relay - Phase 1 Module 10
 *
 * Specializes the sync relay for remote command result broadcasting.
 * Listens to RemoteCommandExecutor events and broadcasts results to Supabase,
 * triggering real-time updates to all connected devices.
 *
 * **Distinct from generic SyncRelay**:
 * - Generic SyncRelay: Coordinates delta changes across devices (CRDTs)
 * - RemoteCommandSyncRelay: Broadcasts specific command execution results
 * - Works together: Sync relay handles state, this handles command output
 *
 * **Architecture**:
 * RemoteCommandExecutor (emits command-completed)
 *   → RemoteCommandSyncRelay (listens)
 *   → Supabase remote_commands table (update result column)
 *   → Real-time subscriptions (all devices notified)
 *
 * **Real-Time Flow**:
 * 1. Web client calls: await submitRemoteCommand(cmd)
 * 2. Inserts pending row to remote_commands table
 * 3. Local device sees change via Supabase subscription
 * 4. RemoteCommandExecutor processes and completes
 * 5. Emits 'command-completed' event
 * 6. SyncRelay updates row with result
 * 7. All devices see update via WebSocket
 * 8. Web/Mobile UI updates immediately
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteCommandExecutor } from './remote-command-executor.js';
import type { CommandCompletedEvent, CommandFailedEvent } from './remote-command-executor.js';

/**
 * Remote Command Result for Supabase storage
 * Stored in remote_commands table result column (JSONB)
 */
export interface StoredCommandResult {
  status: 'success' | 'error';
  output: string;
  executedAt: number;
  error?: string;
}

/**
 * Configuration for remote command sync relay
 */
export interface RemoteCommandSyncRelayConfig {
  /** Max broadcast history size (default: 5000) */
  maxHistorySize: number;

  /** How long to wait for Supabase update (ms, default: 5000) */
  updateTimeoutMs: number;

  /** Whether to log every broadcast (default: false) */
  verbose: boolean;

  /** Supabase table name for commands (default: remote_commands) */
  tableName: string;
}

/**
 * Remote Command Sync Relay
 *
 * **Key Features**:
 * - Listens to executor events (command-completed, command-failed)
 * - Updates Supabase with result and completion timestamp
 * - Triggers real-time subscriptions for all connected devices
 * - Tracks broadcast success/failures for diagnostics
 * - Handles timeouts and connection failures gracefully
 *
 * **Event Propagation**:
 * ```
 * Local Device                    Web/Mobile Clients
 * ─────────────────              ──────────────────
 * Executor emits                  Real-time subscription
 * command-completed               listening to remote_commands
 *     ↓                                 ↑
 * SyncRelay updates DB                 │
 * (status='completed')                 │
 *     ↓                                 │
 * Supabase notifies                    │
 * connected WebSockets ────────────→ Receives update
 *                                   UI updates immediately
 * ```
 */
export class RemoteCommandSyncRelay {
  private supabase: SupabaseClient;
  private executor: RemoteCommandExecutor;
  private logger: any;
  private config: RemoteCommandSyncRelayConfig;

  /** Track broadcast attempts for debugging */
  private broadcastAttempts: Map<
    string,
    { timestamp: number; attempt: number; lastError?: string }
  > = new Map();

  private isActive = false;

  constructor(
    supabase: SupabaseClient,
    executor: RemoteCommandExecutor,
    logger: any,
    config: Partial<RemoteCommandSyncRelayConfig> = {}
  ) {
    this.supabase = supabase;
    this.executor = executor;
    this.logger = logger;
    this.config = {
      maxHistorySize: 5000,
      updateTimeoutMs: 5000,
      verbose: false,
      tableName: 'remote_commands',
      ...config,
    };
  }

  /**
   * Start listening for executor events
   * Must be called after executor is created
   */
  public start(): void {
    if (this.isActive) {
      this.logger.warn('RemoteCommandSyncRelay already active');
      return;
    }

    this.isActive = true;
    this.logger.info('Starting RemoteCommandSyncRelay');

    // Listen for command completion
    this.executor.on('command-completed', (event: CommandCompletedEvent) => {
      this.onCommandCompleted(event);
    });

    // Listen for command failures
    this.executor.on('command-failed', (event: CommandFailedEvent) => {
      this.onCommandFailed(event);
    });
  }

  /**
   * Stop listening for events
   */
  public stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.executor.removeAllListeners('command-completed');
    this.executor.removeAllListeners('command-failed');
    this.logger.info('Stopped RemoteCommandSyncRelay');
  }

  /**
   * Handle command completion
   * Updates Supabase and broadcasts to subscribed clients
   */
  private async onCommandCompleted(event: CommandCompletedEvent): Promise<void> {
    const { commandId, result } = event;

    if (this.config.verbose) {
      this.logger.debug(`Syncing completed command: ${commandId}`);
    }

    try {
      this.recordAttempt(commandId);

      // Convert result to storage format
      const storedResult: StoredCommandResult = {
        status: result.status,
        output: result.output,
        executedAt: result.executedAt,
      };

      // Update Supabase with timeout
      const updatePromise = this.supabase
        .from(this.config.tableName)
        .update({
          status: 'completed',
          result: storedResult,
          updated_at: new Date().toISOString(),
        })
        .eq('command_id', commandId);

      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Supabase update timeout')), this.config.updateTimeoutMs)
      );

      const { error } = (await Promise.race([updatePromise, timeoutPromise])) as any;

      if (error) {
        this.recordAttemptError(commandId, error.message);
        this.logger.error(`Failed to sync command result ${commandId}:`, error);
        return;
      }

      if (this.config.verbose) {
        this.logger.debug(`Command result synced: ${commandId}`);
      }
    } catch (err) {
      this.recordAttemptError(commandId, String(err));
      this.logger.error(`Error syncing command ${commandId}:`, err);
    }
  }

  /**
   * Handle command failure
   * Updates Supabase with error status
   */
  private async onCommandFailed(event: CommandFailedEvent): Promise<void> {
    const { commandId, error } = event;

    if (this.config.verbose) {
      this.logger.debug(`Syncing failed command: ${commandId} - ${error}`);
    }

    try {
      this.recordAttempt(commandId);

      const storedResult: StoredCommandResult = {
        status: 'error',
        output: '',
        executedAt: Date.now(),
        error,
      };

      const { error: updateError } = await this.supabase
        .from(this.config.tableName)
        .update({
          status: 'failed',
          result: storedResult,
          updated_at: new Date().toISOString(),
        })
        .eq('command_id', commandId);

      if (updateError) {
        this.recordAttemptError(commandId, updateError.message);
        this.logger.error(`Failed to sync command error ${commandId}:`, updateError);
        return;
      }

      if (this.config.verbose) {
        this.logger.debug(`Command error synced: ${commandId}`);
      }
    } catch (err) {
      this.recordAttemptError(commandId, String(err));
      this.logger.error(`Error syncing command failure ${commandId}:`, err);
    }
  }

  /**
   * Get relay statistics for monitoring
   */
  public getStats() {
    const attempts = Array.from(this.broadcastAttempts.values());
    const successCount = attempts.filter((a) => !a.lastError).length;
    const failedCount = attempts.filter((a) => a.lastError).length;

    return {
      isActive: this.isActive,
      totalAttempts: attempts.length,
      successCount,
      failedCount,
      historySizeBytes: new Blob([JSON.stringify(this.broadcastAttempts)]).size,
    };
  }

  /**
   * Get status of a specific command broadcast
   */
  public getCommandStatus(commandId: string) {
    return this.broadcastAttempts.get(commandId);
  }

  /**
   * Record a broadcast attempt
   */
  private recordAttempt(commandId: string): void {
    const existing = this.broadcastAttempts.get(commandId);
    this.broadcastAttempts.set(commandId, {
      timestamp: Date.now(),
      attempt: (existing?.attempt ?? 0) + 1,
      lastError: undefined,
    });

    // Trim history if too large
    if (this.broadcastAttempts.size > this.config.maxHistorySize) {
      const firstKey = this.broadcastAttempts.keys().next().value;
      if (firstKey) {
        this.broadcastAttempts.delete(firstKey);
      }
    }
  }

  /**
   * Record an error for a broadcast attempt
   */
  private recordAttemptError(commandId: string, error: string): void {
    const existing = this.broadcastAttempts.get(commandId) || {
      timestamp: Date.now(),
      attempt: 1,
    };
    this.broadcastAttempts.set(commandId, {
      ...existing,
      lastError: error,
    });
  }
}

/**
 * Singleton instance
 */
let relayInstance: RemoteCommandSyncRelay | null = null;

/**
 * Get or create relay singleton
 */
export function getRemoteCommandSyncRelay(
  supabase: SupabaseClient,
  executor: RemoteCommandExecutor,
  logger: any
): RemoteCommandSyncRelay {
  if (!relayInstance) {
    relayInstance = new RemoteCommandSyncRelay(supabase, executor, logger);
  }
  return relayInstance;
}
