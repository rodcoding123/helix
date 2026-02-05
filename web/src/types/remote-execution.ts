/**
 * Remote Execution Types for Web Client
 *
 * **Phase 1: OAuth Local Authority Foundation**
 *
 * TypeScript interfaces for the web application to interact with remote execution.
 * These types mirror the RemoteCommand schema but are designed for frontend use.
 *
 * **Relationship to Backend Schema**:
 * - Backend: `helix-runtime/src/gateway/protocol/schema/remote-command.ts` (TypeBox schema)
 * - Web: `web/src/types/remote-execution.ts` (TypeScript types)
 *
 * Both use the same logical structure but serve different purposes:
 * - Schema: Runtime validation, database storage
 * - Types: Development, IDE hints, component props
 */

/**
 * Result of remote command execution
 * Contains the output or error from the local device
 */
export interface RemoteCommandResult {
  /** success or error */
  status: 'success' | 'error';

  /** Command output or error message */
  output: string;

  /** When this command executed (Unix timestamp ms) */
  executedAt: number;

  /** Error details if status is error */
  error?: string;
}

/**
 * Remote command request from web client
 * Sent to local device for execution
 *
 * Minimal structure - only includes what's needed for execution.
 * Expanded in database with timestamps, status, etc.
 */
export interface RemoteCommandRequest {
  /** Unique command ID */
  commandId: string;

  /** Which agent to route to (main, secondary) */
  agentId: string;

  /**
   * Provider for execution (model-agnostic)
   * - anthropic: Claude via OAuth
   * - openai-codex: OpenAI via OAuth
   * - google-gemini: Future
   * - custom: User-configured providers
   */
  provider: 'anthropic' | 'openai-codex' | 'google-gemini' | string;

  /** Command/prompt to execute */
  content: string;

  /** Which session this belongs to */
  sessionId: string;

  /** Optional: conversation channel within session */
  channelId?: string;
}

/**
 * Complete remote command with execution state
 * Used internally by web app to track execution progress
 */
export interface RemoteCommand extends RemoteCommandRequest {
  /** Current execution status */
  status: 'pending' | 'executing' | 'completed' | 'failed';

  /** Source device ID (web, mobile, etc.) */
  sourceDeviceId: string;

  /** User who initiated command */
  sourceUserId: string;

  /** When created (Unix timestamp ms) */
  createdAt: number;

  /** When command expires (Unix timestamp ms) */
  expiresAt: number;

  /** Execution result (populated after execution) */
  result?: RemoteCommandResult;
}

/**
 * Execution state tracker
 * Tracks pending, executing, and completed commands
 *
 * Used by web components to manage execution queue visibility
 */
export interface CommandExecutionState {
  /** Commands waiting to execute on local device */
  pending: RemoteCommandRequest[];

  /** Commands currently executing */
  executing: Map<string, RemoteCommandRequest>;

  /** Completed commands (success or failure) */
  completed: Map<string, RemoteCommandResult>;

  /** Total commands processed */
  totalProcessed: number;
}

/**
 * Subscription to command status updates
 * Used to listen for real-time result updates from local device
 */
export interface CommandStatusSubscription {
  /** Command ID we're listening for */
  commandId: string;

  /** Callback when status changes */
  onStatusChange: (status: RemoteCommand['status']) => void;

  /** Callback when result arrives */
  onResult: (result: RemoteCommandResult) => void;

  /** Callback on error */
  onError: (error: Error) => void;
}

/**
 * Execution queue statistics
 * Displayed in admin dashboard and command interface
 */
export interface ExecutionQueueStats {
  /** Commands waiting */
  pendingCount: number;

  /** Commands currently executing */
  executingCount: number;

  /** Successfully completed */
  completedCount: number;

  /** Failed execution */
  failedCount: number;

  /** Average execution time (ms) */
  avgExecutionTime: number;

  /** Total commands processed since startup */
  totalProcessed: number;

  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * Configuration for command execution
 * Set by user in preferences/settings
 */
export interface RemoteExecutionConfig {
  /** Maximum commands to execute concurrently */
  maxConcurrent: number;

  /** Command timeout in milliseconds */
  commandTimeoutMs: number;

  /** Retry failed commands */
  retryOnFailure: boolean;

  /** Max retry attempts */
  maxRetries: number;

  /** Enable real-time progress updates to UI */
  enableRealtimeUpdates: boolean;

  /** Preferred provider (fallback if specified provider unavailable) */
  defaultProvider: string;
}

/**
 * Error from remote command execution
 * Represents failures at various stages
 */
export class RemoteExecutionError extends Error {
  constructor(
    message: string,
    public readonly commandId: string,
    public readonly stage: 'queuing' | 'executing' | 'timeout' | 'unknown' = 'unknown'
  ) {
    super(message);
    this.name = 'RemoteExecutionError';
  }
}
