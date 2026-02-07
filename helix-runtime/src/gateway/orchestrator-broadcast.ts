/**
 * Orchestrator Event Broadcasting
 *
 * Phase 2.3.2.6: Real-time event delivery to WebSocket subscribers
 *
 * Bridges MetricsEmitter and gateway WebSocket clients.
 * Sends orchestrator events to all subscribed clients in real-time.
 */

import { metricsEmitter, type OrchestratorEvent } from '../orchestration/metrics-emitter';
import type { Gateway } from './types';

export class OrchestratorBroadcaster {
  private gateway: Gateway | null = null;
  private subscriptions = new Map<string, Set<string>>(); // threadId -> clientIds

  /**
   * Initialize broadcaster with gateway reference
   */
  initialize(gateway: Gateway): void {
    this.gateway = gateway;

    // Subscribe to all metrics events
    metricsEmitter.subscribe((event: OrchestratorEvent) => {
      this.broadcastEvent(event);
    });
  }

  /**
   * Register client subscription to thread events
   */
  subscribe(threadId: string, clientId: string): void {
    if (!this.subscriptions.has(threadId)) {
      this.subscriptions.set(threadId, new Set());
    }
    this.subscriptions.get(threadId)?.add(clientId);
  }

  /**
   * Unregister client from thread events
   */
  unsubscribe(threadId: string, clientId: string): void {
    const clients = this.subscriptions.get(threadId);
    if (clients) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.subscriptions.delete(threadId);
      }
    }
  }

  /**
   * Broadcast event to all subscribed clients for a thread
   */
  private broadcastEvent(event: OrchestratorEvent): void {
    if (!this.gateway) return;

    const clientIds = this.subscriptions.get(event.threadId);
    if (!clientIds || clientIds.size === 0) return;

    // Transform event to WebSocket message format
    const message = {
      type: 'event',
      event: `orchestrator.${event.type}`,
      payload: {
        threadId: event.threadId,
        timestamp: event.timestamp,
        ...event.payload,
      },
    };

    // Send to all subscribed clients
    for (const clientId of clientIds) {
      try {
        this.gateway.sendToClient(clientId, message);
      } catch (err) {
        // Client may have disconnected; remove from subscriptions
        clientIds.delete(clientId);
        console.debug(`[broadcaster] Failed to send to client ${clientId}:`, err);
      }
    }
  }
}

// Global singleton broadcaster
export const orchestratorBroadcaster = new OrchestratorBroadcaster();
