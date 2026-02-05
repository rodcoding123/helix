/**
 * Phase 10 Week 3: Real-Time Metrics Streaming Service
 * Streams operation metrics from backend to frontend via WebSocket
 */

import { io, Socket } from 'socket.io-client';

export interface MetricsEvent {
  type: 'operation_complete' | 'operation_failed' | 'cost_update' | 'sla_update' | 'batch_progress';
  timestamp: string;
  data: {
    operationId?: string;
    cost?: number;
    latency?: number;
    success?: boolean;
    slaViolation?: boolean;
    progress?: number;
    batchId?: string;
  };
}

export interface DashboardMetrics {
  operationCount: number;
  errorRate: number;
  avgLatency: number;
  totalCost: number;
}

export class MetricsStreamService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(event: MetricsEvent) => void>> = new Map();
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Connect to metrics streaming WebSocket
   */
  connect(userId: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:3001';

        this.socket = io(wsUrl, {
          auth: {
            userId,
            token: token || localStorage.getItem('auth_token'),
          },
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
        });

        this.socket.on('connect', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.log('[MetricsStream] Connected to metrics server');
          resolve();
        });

        this.socket.on('metrics', (event: MetricsEvent) => {
          this.handleMetricsEvent(event);
        });

        this.socket.on('disconnect', () => {
          this.connected = false;
          console.warn('[MetricsStream] Disconnected from metrics server');
        });

        this.socket.on('connect_error', (error) => {
          console.error('[MetricsStream] Connection error:', error);
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(new Error('Failed to connect to metrics stream after max attempts'));
          }
        });

        // Timeout after 10 seconds
        const timeout = setTimeout(() => {
          reject(new Error('Metrics stream connection timeout'));
        }, 10_000);

        // Clear timeout on successful connection
        this.socket.once('connect', () => clearTimeout(timeout));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to specific event types
   * Returns unsubscribe function
   */
  subscribe(
    eventType: string,
    callback: (event: MetricsEvent) => void
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Subscribe to multiple event types at once
   */
  subscribeMultiple(
    eventTypes: string[],
    callback: (event: MetricsEvent) => void
  ): () => void {
    const unsubscribers = eventTypes.map(type => this.subscribe(type, callback));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Handle incoming metrics event
   */
  private handleMetricsEvent(event: MetricsEvent): void {
    const listeners = this.listeners.get(event.type) || new Set();
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error(`[MetricsStream] Error in listener for ${event.type}:`, error);
      }
    });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  /**
   * Emit a metrics request to server
   */
  emitMetricsRequest(
    request: 'get_last_hour' | 'get_today' | 'get_week'
  ): void {
    if (!this.isConnected()) {
      console.warn('[MetricsStream] Cannot emit request, not connected');
      return;
    }

    this.socket?.emit('metrics_request', { type: request });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }

  /**
   * Get all registered listeners for debugging
   */
  getListenerCount(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [type, listeners] of this.listeners) {
      counts[type] = listeners.size;
    }
    return counts;
  }
}

/**
 * Singleton instance
 */
let metricsStreamService: MetricsStreamService | null = null;

export function getMetricsStreamService(): MetricsStreamService {
  if (!metricsStreamService) {
    metricsStreamService = new MetricsStreamService();
  }
  return metricsStreamService;
}
