/**
 * HELIX OBSERVATORY CLIENT
 * Integration with the Observatory web platform for centralized telemetry
 *
 * The Observatory provides a web-based dashboard for monitoring Helix instances.
 * This client sends telemetry data including commands, API calls, file changes,
 * heartbeats, transformations, and anomalies.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Offline queue with automatic flush on reconnection
 * - Hash chain integration for integrity verification
 */

import { getChainState, computeEntryHash } from './hash-chain.js';

/**
 * Event types supported by the Observatory
 */
export type ObservatoryEventType =
  | 'command'
  | 'api_call'
  | 'file_change'
  | 'heartbeat'
  | 'transformation'
  | 'anomaly';

/**
 * Telemetry payload structure
 */
export interface TelemetryPayload {
  instance_key: string;
  event_type: ObservatoryEventType;
  payload: Record<string, unknown>;
  hash?: string;
  previous_hash?: string;
  timestamp?: string;
}

/**
 * Heartbeat metrics
 */
export interface HeartbeatMetrics {
  cpu_load?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  uptime_seconds?: number;
  pending_commands?: number;
  api_request_count?: number;
  [key: string]: unknown;
}

/**
 * Transformation event data
 */
export interface TransformationData {
  layer: number;
  layer_name?: string;
  from_state: string;
  to_state: string;
  trigger: string;
  description?: string;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Queued event for offline support
 */
interface QueuedEvent {
  telemetry: TelemetryPayload;
  attempts: number;
  createdAt: number;
}

const DEFAULT_OBSERVATORY_URL = 'http://localhost:3000';
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Helix Observatory Client
 * Provides methods for sending telemetry to the Observatory web platform
 */
export class HelixObservatoryClient {
  private readonly instanceKey: string;
  private readonly observatoryUrl: string;
  private readonly retryConfig: RetryConfig;
  private readonly offlineQueue: QueuedEvent[] = [];
  private isOnline: boolean = true;
  private flushInterval: NodeJS.Timeout | null = null;
  private lastHash: string = 'GENESIS';

  /**
   * Create a new Observatory client
   *
   * @param instanceKey - Unique identifier for this Helix instance
   * @param observatoryUrl - Base URL of the Observatory (default: http://localhost:3000)
   * @param retryConfig - Optional retry configuration
   */
  constructor(instanceKey: string, observatoryUrl?: string, retryConfig?: Partial<RetryConfig>) {
    this.instanceKey = instanceKey;
    this.observatoryUrl = observatoryUrl || process.env.OBSERVATORY_URL || DEFAULT_OBSERVATORY_URL;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

    // Initialize hash from chain state
    this.initializeHashState().catch(console.error);

    // Start offline queue flush interval
    this.startOfflineFlush();
  }

  /**
   * Initialize hash state from the existing chain
   */
  private async initializeHashState(): Promise<void> {
    try {
      const chainState = await getChainState();
      this.lastHash = chainState.lastHash;
    } catch {
      console.warn('[Helix Observatory] Could not initialize hash state, using GENESIS');
      this.lastHash = 'GENESIS';
    }
  }

  /**
   * Start the offline queue flush interval
   */
  private startOfflineFlush(): void {
    if (this.flushInterval) return;

    // Check every 30 seconds for connectivity and flush queue
    this.flushInterval = setInterval(() => {
      this.flushOfflineQueue().catch(console.error);
    }, 30000);
  }

  /**
   * Stop the offline queue flush interval
   */
  public stopOfflineFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Compute a hash for the telemetry payload
   */
  private computeTelemetryHash(payload: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const data = JSON.stringify(payload);
    return computeEntryHash(timestamp, this.lastHash, { payload: data });
  }

  /**
   * Send telemetry to the Observatory with retry logic
   *
   * @param eventType - Type of event being logged
   * @param payload - Event payload data
   * @param hash - Optional hash for integrity verification
   * @param previousHash - Optional previous hash in the chain
   * @returns True if successfully sent, false if queued for later
   */
  public async sendTelemetry(
    eventType: ObservatoryEventType,
    payload: Record<string, unknown>,
    hash?: string,
    previousHash?: string
  ): Promise<boolean> {
    const telemetry: TelemetryPayload = {
      instance_key: this.instanceKey,
      event_type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Add hash chain data if provided or compute it
    if (hash) {
      telemetry.hash = hash;
      telemetry.previous_hash = previousHash;
    } else {
      // Auto-compute hash for integrity
      telemetry.previous_hash = this.lastHash;
      telemetry.hash = this.computeTelemetryHash(payload);
      this.lastHash = telemetry.hash;
    }

    return this.sendWithRetry(telemetry);
  }

  /**
   * Send telemetry with exponential backoff retry
   */
  private async sendWithRetry(telemetry: TelemetryPayload): Promise<boolean> {
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.observatoryUrl}/api/telemetry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(telemetry),
        });

        if (response.ok) {
          this.isOnline = true;
          return true;
        }

        // Non-retryable error (4xx)
        if (response.status >= 400 && response.status < 500) {
          console.error(
            `[Helix Observatory] Client error ${response.status}: ${await response.text()}`
          );
          return false;
        }

        // Server error - retry
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.warn(
            `[Helix Observatory] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`
          );
          await this.sleep(delay);
        }
      } catch (error) {
        // Network error - mark offline and queue
        this.isOnline = false;

        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.calculateBackoff(attempt);
          console.warn(
            `[Helix Observatory] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${this.retryConfig.maxRetries}):`,
            error instanceof Error ? error.message : String(error)
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries failed - queue for later
    this.queueForLater(telemetry);
    return false;
  }

  /**
   * Queue a failed telemetry event for later transmission
   */
  private queueForLater(telemetry: TelemetryPayload): void {
    // Limit queue size to prevent memory issues
    const MAX_QUEUE_SIZE = 1000;

    if (this.offlineQueue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest events
      this.offlineQueue.splice(0, this.offlineQueue.length - MAX_QUEUE_SIZE + 1);
      console.warn('[Helix Observatory] Offline queue at capacity, dropping oldest events');
    }

    this.offlineQueue.push({
      telemetry,
      attempts: 0,
      createdAt: Date.now(),
    });

    console.log(
      `[Helix Observatory] Event queued for later (queue size: ${this.offlineQueue.length})`
    );
  }

  /**
   * Attempt to flush the offline queue
   */
  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    console.log(
      `[Helix Observatory] Attempting to flush ${this.offlineQueue.length} queued events`
    );

    // Try a connectivity check first
    try {
      const response = await fetch(`${this.observatoryUrl}/api/telemetry`, {
        method: 'OPTIONS',
      });

      if (!response.ok) {
        return; // Still offline
      }
    } catch {
      return; // Still offline
    }

    this.isOnline = true;

    // Process queue
    const eventsToRetry = [...this.offlineQueue];
    this.offlineQueue.length = 0;

    let successCount = 0;
    for (const event of eventsToRetry) {
      event.attempts++;

      // Skip events that have been in queue too long (24 hours)
      const MAX_AGE_MS = 24 * 60 * 60 * 1000;
      if (Date.now() - event.createdAt > MAX_AGE_MS) {
        console.warn('[Helix Observatory] Dropping stale queued event');
        continue;
      }

      const success = await this.sendWithRetry(event.telemetry);
      if (success) {
        successCount++;
      }
    }

    console.log(
      `[Helix Observatory] Flushed ${successCount}/${eventsToRetry.length} queued events`
    );
  }

  /**
   * Send a heartbeat event
   *
   * @param status - Current status (e.g., 'healthy', 'degraded', 'error')
   * @param metrics - Optional system metrics
   */
  public async sendHeartbeat(status: string, metrics?: HeartbeatMetrics): Promise<boolean> {
    const payload: Record<string, unknown> = {
      status,
      timestamp: new Date().toISOString(),
    };

    if (metrics) {
      payload.metrics = metrics;
    }

    return this.sendTelemetry('heartbeat', payload);
  }

  /**
   * Send a transformation event (psychological layer state change)
   *
   * @param layer - Layer number (1-7)
   * @param fromState - Previous state
   * @param toState - New state
   * @param trigger - What triggered the transformation
   * @param description - Optional description of the change
   */
  public async sendTransformation(
    layer: number,
    fromState: string,
    toState: string,
    trigger: string,
    description?: string
  ): Promise<boolean> {
    const layerNames: Record<number, string> = {
      1: 'Narrative Core',
      2: 'Emotional Memory',
      3: 'Relational Memory',
      4: 'Prospective Self',
      5: 'Integration Rhythms',
      6: 'Transformation Cycles',
      7: 'Purpose Engine',
    };

    const payload: Record<string, unknown> = {
      layer,
      layer_name: layerNames[layer] || `Layer ${layer}`,
      from_state: fromState,
      to_state: toState,
      trigger,
    };

    if (description) {
      payload.description = description;
    }

    return this.sendTelemetry('transformation', payload);
  }

  /**
   * Send a command execution event
   *
   * @param command - The command being executed
   * @param workdir - Working directory
   * @param status - Execution status
   * @param exitCode - Optional exit code
   * @param durationMs - Optional execution duration
   */
  public async sendCommand(
    command: string,
    workdir: string,
    status: 'pending' | 'completed' | 'failed',
    exitCode?: number | null,
    durationMs?: number
  ): Promise<boolean> {
    const payload: Record<string, unknown> = {
      command,
      workdir,
      status,
      timestamp: new Date().toISOString(),
    };

    if (exitCode !== undefined && exitCode !== null) {
      payload.exit_code = exitCode;
    }

    if (durationMs !== undefined) {
      payload.duration_ms = durationMs;
    }

    return this.sendTelemetry('command', payload);
  }

  /**
   * Send an API call event
   *
   * @param model - Model being called
   * @param provider - API provider
   * @param status - Call status
   * @param latencyMs - Optional latency
   * @param tokenCount - Optional token count
   */
  public async sendApiCall(
    model: string,
    provider: string,
    status: 'pending' | 'completed' | 'failed',
    latencyMs?: number,
    tokenCount?: number
  ): Promise<boolean> {
    const payload: Record<string, unknown> = {
      model,
      provider,
      status,
      timestamp: new Date().toISOString(),
    };

    if (latencyMs !== undefined) {
      payload.latency_ms = latencyMs;
    }

    if (tokenCount !== undefined) {
      payload.token_count = tokenCount;
    }

    return this.sendTelemetry('api_call', payload);
  }

  /**
   * Send a file change event
   *
   * @param path - File path
   * @param changeType - Type of change
   * @param sizeBytes - Optional file size
   * @param contentHash - Optional content hash
   */
  public async sendFileChange(
    path: string,
    changeType: 'created' | 'modified' | 'deleted',
    sizeBytes?: number,
    contentHash?: string
  ): Promise<boolean> {
    const payload: Record<string, unknown> = {
      path,
      change_type: changeType,
      timestamp: new Date().toISOString(),
    };

    if (sizeBytes !== undefined) {
      payload.size_bytes = sizeBytes;
    }

    if (contentHash) {
      payload.content_hash = contentHash;
    }

    return this.sendTelemetry('file_change', payload);
  }

  /**
   * Send an anomaly event
   *
   * @param anomalyType - Type of anomaly detected
   * @param severity - Severity level
   * @param description - Description of the anomaly
   * @param details - Optional additional details
   */
  public async sendAnomaly(
    anomalyType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    details?: Record<string, unknown>
  ): Promise<boolean> {
    const payload: Record<string, unknown> = {
      anomaly_type: anomalyType,
      severity,
      description,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      payload.details = details;
    }

    return this.sendTelemetry('anomaly', payload);
  }

  /**
   * Check if the client is currently online
   */
  public isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Get the current offline queue size
   */
  public getQueueSize(): number {
    return this.offlineQueue.length;
  }

  /**
   * Get client status
   */
  public getStatus(): {
    instanceKey: string;
    observatoryUrl: string;
    isOnline: boolean;
    queueSize: number;
    lastHash: string;
  } {
    return {
      instanceKey: this.instanceKey,
      observatoryUrl: this.observatoryUrl,
      isOnline: this.isOnline,
      queueSize: this.offlineQueue.length,
      lastHash: this.lastHash,
    };
  }

  /**
   * Manually flush the offline queue
   */
  public async flush(): Promise<void> {
    await this.flushOfflineQueue();
  }

  /**
   * Shutdown the client gracefully
   */
  public async shutdown(): Promise<void> {
    this.stopOfflineFlush();

    // Attempt final flush
    if (this.offlineQueue.length > 0) {
      console.log('[Helix Observatory] Attempting final flush before shutdown...');
      await this.flushOfflineQueue();
    }

    console.log('[Helix Observatory] Client shutdown complete');
  }
}

/**
 * Create a singleton Observatory client instance
 */
let defaultClient: HelixObservatoryClient | null = null;

/**
 * Get or create the default Observatory client
 *
 * @param instanceKey - Instance key (required on first call)
 * @param observatoryUrl - Optional Observatory URL
 */
export function getObservatoryClient(
  instanceKey?: string,
  observatoryUrl?: string
): HelixObservatoryClient {
  if (!defaultClient) {
    if (!instanceKey) {
      throw new Error('[Helix Observatory] Instance key required when creating default client');
    }
    defaultClient = new HelixObservatoryClient(instanceKey, observatoryUrl);
  }
  return defaultClient;
}

/**
 * Shutdown the default Observatory client
 */
export async function shutdownObservatoryClient(): Promise<void> {
  if (defaultClient) {
    await defaultClient.shutdown();
    defaultClient = null;
  }
}
