/**
 * Node Discovery Client (mDNS Browser)
 *
 * Discovers available Helix nodes on the local network using mDNS/Bonjour.
 * Broadcasts discovery events to gateway clients for UI updates.
 *
 * Phase H.4: Node Discovery Infrastructure
 */

import { EventEmitter } from 'events';

/**
 * mDNS discovery requires installation of bonjour-service:
 * npm install bonjour-service
 *
 * For now, we provide a mock implementation that tracks
 * manually registered nodes and can be extended with mDNS support.
 */

export interface DiscoveredNode {
  name: string;
  host: string;
  port: number;
  platform: string;
  version: string;
  cliPath: string;
  nodeId?: string;
  discovered: number; // timestamp
}

export interface DiscoveryEvent {
  type: 'discovered' | 'lost' | 'updated';
  node: DiscoveredNode | { name: string }; // lost events only have name
}

/**
 * NodeDiscoveryClient - Network node discovery
 *
 * Provides discovery of Helix nodes on the local network.
 * Currently provides a foundation that can be extended with mDNS support.
 *
 * To enable mDNS discovery:
 * npm install bonjour-service
 */
export class NodeDiscoveryClient extends EventEmitter {
  private discovered = new Map<string, DiscoveredNode>();
  private isActive = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Start discovery service
   * Currently provides manual registration support
   */
  start(): void {
    if (this.isActive) {
      console.debug('[node-discovery] Discovery service already active');
      return;
    }

    console.info('[node-discovery] Starting node discovery service');
    this.isActive = true;

    // Placeholder for future mDNS integration
    // When bonjour-service is available, implement actual mDNS scanning
  }

  /**
   * Stop discovery service
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    console.info('[node-discovery] Stopping node discovery service');
    this.isActive = false;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.discovered.clear();
  }

  /**
   * Manually register a discovered node
   * Used for testing or manual node registration
   */
  registerNode(node: DiscoveredNode): void {
    this.discovered.set(node.name, node);
    this.emit('node:discovered', { type: 'discovered', node } as DiscoveryEvent);
  }

  /**
   * Manual discovery scan
   * Returns currently registered nodes
   */
  async triggerScan(): Promise<DiscoveredNode[]> {
    console.debug('[node-discovery] Triggering discovery scan');
    // In future: perform actual mDNS scan
    return Array.from(this.discovered.values());
  }

  /**
   * Get all currently discovered nodes
   */
  getDiscoveredNodes(): DiscoveredNode[] {
    return Array.from(this.discovered.values());
  }

  /**
   * Get a specific discovered node by name
   */
  getDiscoveredNode(name: string): DiscoveredNode | undefined {
    return this.discovered.get(name);
  }

  /**
   * Check if a node is currently discovered
   */
  isNodeDiscovered(name: string): boolean {
    return this.discovered.has(name);
  }

  /**
   * Get discovery statistics
   */
  getStats(): {
    discovered: number;
    lastDiscoveryTime: number;
    isActive: boolean;
  } {
    const nodes = Array.from(this.discovered.values());
    const lastDiscoveryTime = nodes.length > 0
      ? Math.max(...nodes.map(n => n.discovered))
      : 0;

    return {
      discovered: nodes.length,
      lastDiscoveryTime,
      isActive: this.isActive,
    };
  }

  /**
   * Remove a discovered node
   */
  removeNode(name: string): void {
    if (this.discovered.has(name)) {
      this.discovered.delete(name);
      this.emit('node:lost', {
        type: 'lost',
        node: { name },
      } as DiscoveryEvent);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.discovered.clear();
  }
}

// Singleton instance for gateway
let discoveryClient: NodeDiscoveryClient | null = null;

export function getDiscoveryClient(): NodeDiscoveryClient {
  if (!discoveryClient) {
    discoveryClient = new NodeDiscoveryClient();
  }
  return discoveryClient;
}

export function createDiscoveryClient(): NodeDiscoveryClient {
  return new NodeDiscoveryClient();
}
