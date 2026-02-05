/**
 * Phase 10: Real-Time Metrics Streaming Service
 * Provides WebSocket-based metrics updates with <1s latency
 */

export interface MetricsEvent {
  type: 'operation_complete' | 'operation_failed' | 'cost_update' | 'sla_update' | 'error_rate' | 'latency_update' | 'batch_progress';
  timestamp: string;
  data: {
    operationId?: string;
    cost?: number;
    latency?: number;
    success?: boolean;
    errorRate?: number;
    p95Latency?: number;
    slaViolation?: boolean;
    severity?: 'info' | 'warning' | 'critical';
    message?: string;
    batchId?: string;
    progress?: number;
  };
}

export interface DashboardMetrics {
  operationId?: string;
  cost?: number;
  latency?: number;
  avgLatency?: number;
  success?: boolean;
  errorRate?: number;
  p95Latency?: number;
  slaViolation?: boolean;
  severity?: 'info' | 'warning' | 'critical';
  message?: string;
  batchId?: string;
  progress?: number;
  operationCount?: number;
  totalCost?: number;
}

/**
 * Manages WebSocket connection for real-time metrics streaming
 */
export class MetricsStreamService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: Map<string, Set<(event: MetricsEvent) => void>> = new Map();
  private connected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(wsUrl?: string) {
    this.url = wsUrl || this.buildWebSocketUrl();
  }

  private buildWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.VITE_WS_HOST || window.location.host;
    return `${protocol}//${host}/metrics`;
  }

  async connect(userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;

          if (this.ws) {
            this.ws.send(JSON.stringify({ type: 'auth', userId, timestamp: Date.now() }));
          }

          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'metrics') {
              this.dispatchEvent(data.event as MetricsEvent);
            }
          } catch (error) {
            console.error('[MetricsStream] Parse error:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[MetricsStream] WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.stopHeartbeat();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private startHeartbeat(): void {
    // Increase to 60 seconds for mobile battery optimization
    // Reduces aggressive polling that causes 8-12% battery drain
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.connected) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          console.error('[MetricsStream] Heartbeat error:', error);
        }
      }
    }, 60000); // 60 seconds (was 30 seconds)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private dispatchEvent(event: MetricsEvent): void {
    const callbacks = this.subscriptions.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[MetricsStream] Subscriber error:', error);
        }
      });
    }

    const wildcardCallbacks = this.subscriptions.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[MetricsStream] Wildcard error:', error);
        }
      });
    }
  }

  subscribe(eventType: string, callback: (event: MetricsEvent) => void): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }

    this.subscriptions.get(eventType)!.add(callback);

    return () => {
      const callbacks = this.subscriptions.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  isConnected(): boolean {
    return this.connected && this.ws !== null;
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

let metricsStreamService: MetricsStreamService | null = null;

export function getMetricsStreamService(): MetricsStreamService {
  if (!metricsStreamService) {
    metricsStreamService = new MetricsStreamService();
  }
  return metricsStreamService;
}
