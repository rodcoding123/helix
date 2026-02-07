/**
 * Node Discovery Client (mDNS Browser)
 *
 * Discovers available Helix nodes on the local network using mDNS/Bonjour.
 * Broadcasts discovery events to gateway clients for UI updates.
 *
 * Phase H.4: Node Discovery Infrastructure
 */

import { EventEmitter } from 'events';
import Bonjour, { Browser, Service } from 'bonjour-service';

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
 * NodeDiscoveryClient - mDNS browser for Helix nodes
 *
 * Listens for _openclaw._tcp services and maintains
 * a registry of discovered nodes on the local network.
 */
export class NodeDiscoveryClient extends EventEmitter {
  private bonjour: Bonjour;
  private browser: Browser | null = null;
  private discovered = new Map<string, DiscoveredNode>();
  private isActive = false;

  constructor() {
    super();
    this.bonjour = new Bonjour();
  }

  /**
   * Start listening for mDNS services
   * Discovers services with type _openclaw._tcp
   */
  start(): void {
    if (this.isActive) {
      console.debug('[node-discovery] Already listening for mDNS services');
      return;
    }

    console.info('[node-discovery] Starting mDNS browser for _openclaw._tcp services');
    this.isActive = true;

    try {
      this.browser = this.bonjour.find({ type: 'openclaw' });

      // Handle service appearing on network
      this.browser.on('up', (service: Service) => {
        this.handleServiceUp(service);
      });

      // Handle service disappearing from network
      this.browser.on('down', (service: Service) => {
        this.handleServiceDown(service);
      });

      // Handle service updates (e.g., IP change)
      this.browser.on('update', (service: Service) => {
        this.handleServiceUpdate(service);
      });
    } catch (err) {
      console.error('[node-discovery] Failed to start mDNS browser:', err);
      this.isActive = false;
    }
  }

  /**
   * Stop listening for mDNS services
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    console.info('[node-discovery] Stopping mDNS browser');
    this.isActive = false;

    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }

    this.discovered.clear();
  }

  /**
   * Manual discovery scan
   * Useful for prompting immediate rediscovery
   */
  async triggerScan(): Promise<DiscoveredNode[]> {
    console.debug('[node-discovery] Triggering manual discovery scan');

    // Clear current discovered nodes to simulate fresh scan
    const previousCount = this.discovered.size;
    this.discovered.clear();

    // Restart browser to force rescan
    if (this.isActive) {
      if (this.browser) {
        this.browser.stop();
      }

      // Small delay before restarting
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        this.browser = this.bonjour.find({ type: 'openclaw' });

        this.browser.on('up', (service: Service) => {
          this.handleServiceUp(service);
        });

        this.browser.on('down', (service: Service) => {
          this.handleServiceDown(service);
        });

        this.browser.on('update', (service: Service) => {
          this.handleServiceUpdate(service);
        });

        console.debug('[node-discovery] Browser restarted for fresh scan');
      } catch (err) {
        console.error('[node-discovery] Failed to restart browser:', err);
      }
    }

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
   * Handle service appearing on network
   */
  private handleServiceUp(service: Service): void {
    const node = this.parseService(service);

    console.info(`[node-discovery] Service discovered: ${node.name} (${node.host}:${node.port})`);
    this.discovered.set(service.name, node);

    // Emit discovery event to gateway broadcast
    this.emit('node:discovered', { type: 'discovered', node } as DiscoveryEvent);
  }

  /**
   * Handle service disappearing from network
   */
  private handleServiceDown(service: Service): void {
    const node = this.discovered.get(service.name);

    if (node) {
      console.info(`[node-discovery] Service lost: ${node.name}`);
      this.discovered.delete(service.name);

      // Emit lost event
      this.emit('node:lost', {
        type: 'lost',
        node: { name: service.name },
      } as DiscoveryEvent);
    }
  }

  /**
   * Handle service updates (e.g., IP address change)
   */
  private handleServiceUpdate(service: Service): void {
    const existingNode = this.discovered.get(service.name);
    const updatedNode = this.parseService(service);

    // Check if anything significant changed
    if (
      existingNode &&
      (existingNode.host !== updatedNode.host ||
        existingNode.port !== updatedNode.port)
    ) {
      console.info(
        `[node-discovery] Service updated: ${updatedNode.name} ` +
        `(${existingNode.host}:${existingNode.port} → ${updatedNode.host}:${updatedNode.port})`
      );

      this.discovered.set(service.name, updatedNode);
      this.emit('node:updated', { type: 'updated', node: updatedNode } as DiscoveryEvent);
    }
  }

  /**
   * Parse a Bonjour service into DiscoveredNode format
   */
  private parseService(service: Service): DiscoveredNode {
    const txt = service.txt || {};

    return {
      name: service.name,
      host: service.host || service.addresses?.[0] || 'unknown',
      port: service.port || 18789, // default OpenClaw port
      platform: (txt.platform as string) || 'unknown',
      version: (txt.version as string) || '0.0.0',
      cliPath: (txt.cliPath as string) || '',
      nodeId: (txt.nodeId as string) || undefined,
      discovered: Date.now(),
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.bonjour.destroy();
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
