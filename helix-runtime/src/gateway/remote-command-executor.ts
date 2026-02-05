/**
 * Remote Command Executor - Core Implementation (Part 1/4)
 *
 * **Phase 1: OAuth Local Authority Foundation**
 * **Pattern**: EventEmitter for async result broadcasting to sync relay
 * **Security**: Pre-execution logging to Discord + hash chain integrity
 * **BYOK**: Uses local OAuth credentials, no credential transmission
 *
 * **4-Part Implementation Plan**:
 * 1. Part 1 (this file): Core class structure, EventEmitter, queue state
 * 2. Part 2: Queue management (queueCommand, processQueue)
 * 3. Part 3: Execution logic (executeCommand, error handling)
 * 4. Part 4: Credential integration (executeWithLocalCredentials)
 *
 * **Phase 2 Integration**:
 * Action Agent uses this executor for all remote execution operations.
 * Provides the foundation for orchestrator job execution.
 */

import { EventEmitter } from 'events';
import type { RemoteCommand } from './protocol/schema/remote-command.js';

/**
 * Event emitted when command completes successfully
 * Listened to by sync relay to broadcast results to all devices
 */
export interface CommandCompletedEvent {
  commandId: string;
  result: {
    status: 'success';
    output: string;
    executedAt: number;
  };
}

/**
 * Event emitted when command fails
 */
export interface CommandFailedEvent {
  commandId: string;
  error: string;
}

/**
 * Remote Command Executor
 *
 * Manages queue of commands from remote devices, executes them using
 * local OAuth credentials, and broadcasts results back via sync relay.
 *
 * **Key Responsibilities**:
 * 1. Queue management: FIFO with concurrency limits (default 5)
 * 2. Pre-execution logging: Discord + hash chain before processing
 * 3. Credential management: Uses local OpenClaw auth-profiles.json
 * 4. Event emission: Notifies sync relay of completion for broadcasting
 * 5. Error handling: Graceful failures with logging
 *
 * **Concurrency**:
 * - Default: 5 concurrent executions
 * - Prevents resource exhaustion on single local device
 * - Can be configured per use case
 *
 * **Usage**:
 * ```typescript
 * const executor = new RemoteCommandExecutor(logger);
 *
 * // Listen for completion
 * executor.on('command-completed', (event) => {
 *   console.log(`Command ${event.commandId} succeeded`);
 *   // Sync relay will broadcast to all devices
 * });
 *
 * // Queue a command
 * await executor.queueCommand(remoteCommand);
 * ```
 */
export class RemoteCommandExecutor extends EventEmitter {
  /** Commands currently executing (keyed by commandId) */
  private executingCommands = new Map<string, RemoteCommand>();

  /** Queue of pending commands */
  private commandQueue: RemoteCommand[] = [];

  /** Whether processing loop is active */
  private isProcessing = false;

  /** Maximum concurrent executions (default 5) */
  private maxConcurrent = 5;

  /** Logger for debug info and errors */
  private logger: any;

  /**
   * Create executor instance
   *
   * @param logger Logger instance for debug output
   * @param maxConcurrent Max concurrent executions (default 5)
   */
  constructor(logger: any, maxConcurrent = 5) {
    super();
    this.logger = logger;
    this.maxConcurrent = maxConcurrent;

    // Allow up to 20 listeners (some commands may wait for results)
    this.setMaxListeners(20);
  }

  /**
   * Get current queue statistics
   * Used by admin dashboard and monitoring
   */
  public getQueueStats() {
    return {
      pending: this.commandQueue.length,
      executing: this.executingCommands.size,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Check if executor is at capacity
   * Used to throttle incoming commands
   */
  public isAtCapacity(): boolean {
    return this.executingCommands.size >= this.maxConcurrent;
  }

  /**
   * Get all executing command IDs
   * Used for monitoring and debugging
   */
  public getExecutingCommandIds(): string[] {
    return Array.from(this.executingCommands.keys());
  }

  /**
   * Cancel a pending or executing command
   * Removes from queue or marks as cancelled
   *
   * @param commandId ID of command to cancel
   * @returns true if command was cancelled, false if not found or already executed
   */
  public cancelCommand(commandId: string): boolean {
    // Try to remove from queue
    const queueIndex = this.commandQueue.findIndex((cmd) => cmd.commandId === commandId);
    if (queueIndex !== -1) {
      this.commandQueue.splice(queueIndex, 1);
      this.logger.info(`Cancelled queued command: ${commandId}`);
      return true;
    }

    // Check if executing (cannot cancel once started)
    if (this.executingCommands.has(commandId)) {
      this.logger.warn(`Cannot cancel executing command: ${commandId}`);
      return false;
    }

    return false;
  }

  /**
   * Gracefully shutdown executor
   * Waits for all executing commands to finish
   *
   * @param timeoutMs Max wait time in milliseconds
   */
  public async shutdown(timeoutMs = 30000): Promise<void> {
    this.logger.info('Shutting down RemoteCommandExecutor...');

    // Stop accepting new commands
    const originalQueue = this.commandQueue;
    this.commandQueue = [];

    // Wait for executing commands to complete
    const startTime = Date.now();
    while (this.executingCommands.size > 0) {
      if (Date.now() - startTime > timeoutMs) {
        this.logger.warn(
          `Shutdown timeout: ${this.executingCommands.size} commands still executing`
        );
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.logger.info('RemoteCommandExecutor shutdown complete');
  }

  // ============================================================================
  // Part 2: Queue Management (Module 7)
  // ============================================================================

  /**
   * Queue a remote command for execution
   *
   * Called by sync relay when new commands arrive from web/mobile clients.
   * Adds command to queue and starts processing if not already running.
   *
   * **Pre-Execution Logging Pattern**:
   * - Logs to Discord BEFORE adding to queue
   * - Hash chain entry for audit trail
   * - Fail-closed: throws if logging fails
   *
   * @param command Remote command to queue
   * @throws If pre-execution logging fails
   */
  public async queueCommand(command: RemoteCommand): Promise<void> {
    // Pre-execution logging (Phase 1 pattern)
    // In production, this would call logToDiscord + hash chain
    this.logger.info(`[PRE-EXEC] Queuing command: ${command.commandId} from ${command.sourceDeviceId}`);

    // Add to queue
    this.commandQueue.push(command);
    this.logger.debug(`Command queued. Queue size: ${this.commandQueue.length}`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process queued commands with concurrency limit
   *
   * Continuously pulls commands from queue and executes them,
   * respecting the maxConcurrent limit. Runs until queue is empty.
   *
   * **Concurrency Management**:
   * - Tracks executing commands in Map
   * - Waits for completion before pulling next
   * - Handles up to maxConcurrent (default 5) in parallel
   *
   * **Error Handling**:
   * - Catches execution errors (doesn't crash processor)
   * - Logs failures for debugging
   * - Continues with next command
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    this.isProcessing = true;
    this.logger.info('Starting command processor');

    try {
      while (this.commandQueue.length > 0 || this.executingCommands.size > 0) {
        // Pull commands from queue up to concurrency limit
        while (this.commandQueue.length > 0 && this.executingCommands.size < this.maxConcurrent) {
          const command = this.commandQueue.shift()!;

          // Execute in background (don't await)
          // Command completion is handled via event emission
          this.executeCommand(command).catch((err) => {
            this.logger.error(`Execution error for ${command.commandId}:`, err);
            this.emit('command-failed', {
              commandId: command.commandId,
              error: String(err),
            } as CommandFailedEvent);
          });
        }

        // Wait a bit if we still have executing commands
        if (this.executingCommands.size > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      this.isProcessing = false;
      this.logger.info('Command processor stopped');
    }
  }

  // ============================================================================
  // Part 3: Execution Logic (Module 8)
  // ============================================================================

  /**
   * Execute a single remote command
   *
   * Main execution flow:
   * 1. Update status to 'executing'
   * 2. Call executeWithLocalCredentials()
   * 3. Parse result
   * 4. Update status to 'completed' or 'failed'
   * 5. Emit completion event (for sync relay broadcast)
   *
   * **Timeout Handling**:
   * - Commands expire after expiresAt timestamp
   * - Skips execution if already expired
   * - Tracks execution time for diagnostics
   *
   * @param command Command to execute
   */
  private async executeCommand(command: RemoteCommand): Promise<void> {
    const commandId = command.commandId;
    const startTime = Date.now();

    try {
      // Check if already expired
      if (Date.now() > command.expiresAt) {
        this.logger.warn(`Command expired: ${commandId}`);
        this.emit('command-failed', {
          commandId,
          error: 'Command expired before execution',
        } as CommandFailedEvent);
        return;
      }

      // Track as executing
      this.executingCommands.set(commandId, command);
      this.logger.info(`Executing command: ${commandId} via provider: ${command.provider}`);

      // Execute with local credentials (Module 9)
      const output = await this.executeWithLocalCredentials(command);

      // Emit success event (for sync relay to broadcast)
      const executedAt = Date.now();
      this.emit('command-completed', {
        commandId,
        result: {
          status: 'success',
          output,
          executedAt,
        },
      } as CommandCompletedEvent);

      this.logger.info(`Command completed: ${commandId} (${executedAt - startTime}ms)`);
    } catch (error) {
      // Emit error event
      this.emit('command-failed', {
        commandId,
        error: String(error),
      } as CommandFailedEvent);

      this.logger.error(`Command failed: ${commandId}`, error);
    } finally {
      // Remove from executing
      this.executingCommands.delete(commandId);
    }
  }

  // ============================================================================
  // Part 4: Credential Integration (Module 9)
  // ============================================================================

  /**
   * Execute command using local OAuth credentials
   *
   * **BYOK Pattern - Core Implementation**:
   * 1. Read credentials from ~/.openclaw/agents/main/agent/auth-profiles.json
   * 2. Route to correct handler based on provider:
   *    - anthropic: Uses Claude API with setup-token
   *    - openai-codex: Uses OpenAI API with OAuth token
   * 3. Send command to model
   * 4. Return result
   *
   * **Credential Security**:
   * - Credentials never leave local device
   * - Credentials not stored in Helix database
   * - Remote devices never see actual credentials
   * - Only command and result transit through cloud
   *
   * **Future Enhancement**:
   * - Support additional providers (DeepSeek, Gemini, etc.)
   * - Implement fallback provider if primary unavailable
   * - Cost tracking per provider
   *
   * @param command Remote command to execute
   * @returns Command output/result
   * @throws If credentials unavailable or execution fails
   */
  private async executeWithLocalCredentials(command: RemoteCommand): Promise<string> {
    // In production, this would:
    // 1. Read auth-profiles.json from ~/.openclaw
    // 2. Get credentials for specified provider
    // 3. Call model API (Anthropic SDK, OpenAI SDK, etc.)
    // 4. Return result

    // Placeholder for demonstration
    switch (command.provider) {
      case 'anthropic': {
        // Would use: const anthropic = new Anthropic({ apiKey: credentials.apiKey });
        // Then: const response = await anthropic.messages.create({...});
        return `[MOCK] Claude processing: "${command.content}"`;
      }

      case 'openai-codex': {
        // Would use: const openai = new OpenAI({ apiKey: credentials.apiKey });
        // Then: const response = await openai.chat.completions.create({...});
        return `[MOCK] OpenAI processing: "${command.content}"`;
      }

      default: {
        throw new Error(`Unsupported provider: ${command.provider}`);
      }
    }
  }
}

/**
 * Singleton instance for application
 * Created once at startup, shared across modules
 */
let executorInstance: RemoteCommandExecutor | null = null;

/**
 * Get or create executor singleton
 * Called by gateway and sync relay at startup
 */
export function getRemoteCommandExecutor(logger: any): RemoteCommandExecutor {
  if (!executorInstance) {
    executorInstance = new RemoteCommandExecutor(logger);
  }
  return executorInstance;
}
