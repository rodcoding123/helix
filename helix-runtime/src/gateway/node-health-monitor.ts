/**
 * Node Health Monitor
 *
 * Phase H.3: Tracks node/device connection health with:
 * - Periodic heartbeat checks (30s interval)
 * - Latency measurement
 * - Connection quality calculation
 * - Auto-disconnect after 3 missed heartbeats
 *
 * Broadcasts health updates to all connected clients
 */

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface NodeHealthMetrics {
  nodeId: string;
  lastHeartbeat: number;
  lastSeen: number;
  connectionQuality: ConnectionQuality;
  latencyMs: number;
  missedHeartbeats: number;
  uptime: number;
  totalHeartbeats: number;
  failureRate: number; // 0.0-1.0
}

interface NodeHealthState {
  metrics: NodeHealthMetrics;
  heartbeatTimer?: NodeJS.Timeout;
}

type BroadcasterFn = (event: string, data: unknown) => void;

/**
 * Tracks health metrics for nodes connected to the gateway
 */
export class NodeHealthMonitor {
  private nodes = new Map<string, NodeHealthState>();
  private heartbeatInterval = 30_000; // 30 seconds
  private maxMissedHeartbeats = 3;
  private broadcastFn?: BroadcasterFn;

  constructor(broadcastFn?: BroadcasterFn) {
    this.broadcastFn = broadcastFn;
  }

  /**
   * Start monitoring a node
   */
  startMonitoring(nodeId: string): void {
    if (this.nodes.has(nodeId)) {
      return; // Already monitoring
    }

    const metrics: NodeHealthMetrics = {
      nodeId,
      lastHeartbeat: Date.now(),
      lastSeen: Date.now(),
      connectionQuality: 'excellent',
      latencyMs: 0,
      missedHeartbeats: 0,
      uptime: 0,
      totalHeartbeats: 0,
      failureRate: 0,
    };

    const state: NodeHealthState = {
      metrics,
      heartbeatTimer: setTimeout(() => this.scheduleHeartbeat(nodeId), this.heartbeatInterval),
    };

    this.nodes.set(nodeId, state);

    // Broadcast initial health
    this.broadcastHealthUpdate(metrics);
  }

  /**
   * Stop monitoring a node
   */
  stopMonitoring(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    if (state.heartbeatTimer) {
      clearTimeout(state.heartbeatTimer);
    }

    this.nodes.delete(nodeId);
  }

  /**
   * Record a successful heartbeat
   */
  recordHeartbeat(nodeId: string, latencyMs: number): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    const now = Date.now();
    const { metrics } = state;

    metrics.lastHeartbeat = now;
    metrics.lastSeen = now;
    metrics.latencyMs = latencyMs;
    metrics.missedHeartbeats = 0;
    metrics.totalHeartbeats++;
    metrics.uptime = now - (metrics.lastHeartbeat - metrics.uptime);
    metrics.failureRate = 0; // Reset on successful heartbeat

    // Recalculate connection quality
    metrics.connectionQuality = this.calculateQuality(latencyMs, 0);

    // Clear any existing timer and schedule next heartbeat
    if (state.heartbeatTimer) {
      clearTimeout(state.heartbeatTimer);
    }
    state.heartbeatTimer = setTimeout(() => this.scheduleHeartbeat(nodeId), this.heartbeatInterval);

    this.broadcastHealthUpdate(metrics);
  }

  /**
   * Record a missed heartbeat
   */
  recordMissedHeartbeat(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    const { metrics } = state;

    metrics.missedHeartbeats++;
    metrics.lastSeen = Date.now();
    metrics.failureRate = metrics.missedHeartbeats / Math.max(1, metrics.totalHeartbeats);

    // Recalculate quality
    metrics.connectionQuality = this.calculateQuality(metrics.latencyMs, metrics.missedHeartbeats);

    // Auto-disconnect after 3 missed heartbeats
    if (metrics.missedHeartbeats >= this.maxMissedHeartbeats) {
      this.handleNodeDisconnect(nodeId);
      return;
    }

    // Schedule next heartbeat
    if (state.heartbeatTimer) {
      clearTimeout(state.heartbeatTimer);
    }
    state.heartbeatTimer = setTimeout(() => this.scheduleHeartbeat(nodeId), this.heartbeatInterval);

    this.broadcastHealthUpdate(metrics);
  }

  /**
   * Get health metrics for a specific node
   */
  getNodeHealth(nodeId: string): NodeHealthMetrics | undefined {
    return this.nodes.get(nodeId)?.metrics;
  }

  /**
   * Get health metrics for all nodes
   */
  getAllNodeHealth(): NodeHealthMetrics[] {
    return Array.from(this.nodes.values()).map((state) => state.metrics);
  }

  /**
   * Check if a node is considered healthy
   */
  isNodeHealthy(nodeId: string): boolean {
    const metrics = this.getNodeHealth(nodeId);
    if (!metrics) return false;

    // Healthy if: < 2 missed heartbeats AND quality is not 'poor'
    return metrics.missedHeartbeats < 2 && metrics.connectionQuality !== 'poor';
  }

  /**
   * Calculate connection quality based on latency and missed heartbeats
   */
  private calculateQuality(latencyMs: number, missed: number): ConnectionQuality {
    // Poor: 2+ missed or latency > 2000ms
    if (missed >= 2 || latencyMs > 2000) {
      return 'poor';
    }

    // Fair: 1 missed or latency > 1000ms
    if (missed >= 1 || latencyMs > 1000) {
      return 'fair';
    }

    // Good: latency > 300ms
    if (latencyMs > 300) {
      return 'good';
    }

    // Excellent: latency <= 300ms
    return 'excellent';
  }

  /**
   * Broadcast health update to all clients
   */
  private broadcastHealthUpdate(metrics: NodeHealthMetrics): void {
    if (!this.broadcastFn) return;

    this.broadcastFn('node.health.updated', {
      nodeId: metrics.nodeId,
      connectionQuality: metrics.connectionQuality,
      latencyMs: metrics.latencyMs,
      missedHeartbeats: metrics.missedHeartbeats,
      lastSeen: metrics.lastSeen,
      uptime: metrics.uptime,
      failureRate: metrics.failureRate,
    });
  }

  /**
   * Handle node disconnection
   */
  private handleNodeDisconnect(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    // Clear timer
    if (state.heartbeatTimer) {
      clearTimeout(state.heartbeatTimer);
    }

    // Broadcast disconnection event
    if (this.broadcastFn) {
      this.broadcastFn('node.health.disconnected', {
        nodeId,
        reason: 'missed_heartbeats',
        missedCount: state.metrics.missedHeartbeats,
      });
    }

    // Remove from tracking
    this.nodes.delete(nodeId);
  }

  /**
   * Schedule heartbeat check
   */
  private scheduleHeartbeat(nodeId: string): void {
    const state = this.nodes.get(nodeId);
    if (!state) return;

    // In production, this would send an actual heartbeat message
    // For now, we record a missed heartbeat
    // The actual heartbeat would come from the node invoking a gateway method
    this.recordMissedHeartbeat(nodeId);
  }

  /**
   * Update heartbeat interval
   */
  setHeartbeatInterval(intervalMs: number): void {
    this.heartbeatInterval = intervalMs;
  }

  /**
   * Get average latency across all nodes
   */
  getAverageLatency(): number {
    const metrics = this.getAllNodeHealth();
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => acc + m.latencyMs, 0);
    return Math.round(sum / metrics.length);
  }

  /**
   * Get node count by quality
   */
  getHealthStatistics(): Record<ConnectionQuality, number> {
    const stats: Record<ConnectionQuality, number> = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    };

    for (const metrics of this.getAllNodeHealth()) {
      stats[metrics.connectionQuality]++;
    }

    return stats;
  }

  /**
   * Cleanup: stop all monitoring
   */
  destroy(): void {
    for (const nodeId of this.nodes.keys()) {
      this.stopMonitoring(nodeId);
    }
    this.nodes.clear();
  }
}
