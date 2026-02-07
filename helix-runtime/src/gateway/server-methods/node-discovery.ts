/**
 * Node Discovery Gateway Methods
 *
 * Exposes gateway methods for discovering and managing nodes on local network
 * via mDNS/Bonjour discovery.
 *
 * Phase H.4: Node Discovery Infrastructure
 */

import { NodeDiscoveryClient, type DiscoveredNode } from '../node-discovery-client';

let discoveryClient: NodeDiscoveryClient | null = null;

/**
 * Initialize discovery client
 * Called during gateway startup if discovery is enabled in config
 */
export function initializeDiscoveryClient(): NodeDiscoveryClient {
  if (!discoveryClient) {
    discoveryClient = new NodeDiscoveryClient();
    discoveryClient.start();
  }
  return discoveryClient;
}

/**
 * Get discovery client (lazy initialize if needed)
 */
function getDiscoveryClient(): NodeDiscoveryClient {
  if (!discoveryClient) {
    discoveryClient = initializeDiscoveryClient();
  }
  return discoveryClient;
}

/**
 * Stop discovery client
 */
export function stopDiscoveryClient(): void {
  if (discoveryClient) {
    discoveryClient.stop();
    discoveryClient = null;
  }
}

/**
 * node.discovery.list - Get currently discovered nodes
 *
 * Returns list of nodes that have been discovered on the local network
 * via mDNS since the client was started.
 *
 * @returns {Promise<{ok: true, nodes: DiscoveredNode[]}>} Discovered nodes
 * @throws {Error} If discovery client is not initialized
 */
export async function nodeDiscoveryList(): Promise<{
  ok: true;
  nodes: DiscoveredNode[];
}> {
  const client = getDiscoveryClient();
  const nodes = client.getDiscoveredNodes();

  return {
    ok: true,
    nodes,
  };
}

/**
 * node.discovery.trigger - Trigger manual network scan
 *
 * Performs an active mDNS scan to discover Helix nodes on the local network.
 * This is useful for prompting users when they want to pair a device.
 *
 * @returns {Promise<{ok: true, nodes: DiscoveredNode[], count: number}>} Discovered nodes
 * @throws {Error} If discovery client fails
 */
export async function nodeDiscoveryTrigger(): Promise<{
  ok: true;
  nodes: DiscoveredNode[];
  count: number;
}> {
  const client = getDiscoveryClient();
  const nodes = await client.triggerScan();

  return {
    ok: true,
    nodes,
    count: nodes.length,
  };
}

/**
 * node.discovery.get_node - Get details of a specific discovered node
 *
 * @param nodeId - Name or ID of the discovered node
 * @returns {Promise<{ok: true, node: DiscoveredNode} | {ok: false, error: string}>}
 */
export async function nodeDiscoveryGetNode(nodeId: string): Promise<
  | { ok: true; node: DiscoveredNode }
  | { ok: false; error: string }
> {
  const client = getDiscoveryClient();
  const node = client.getDiscoveredNode(nodeId);

  if (!node) {
    return {
      ok: false,
      error: `Node '${nodeId}' not found in discovered devices`,
    };
  }

  return {
    ok: true,
    node,
  };
}

/**
 * node.discovery.is_discovered - Check if a node is currently discovered
 *
 * @param nodeId - Name or ID of the node
 * @returns {Promise<{ok: true, discovered: boolean}>}
 */
export async function nodeDiscoveryIsDiscovered(nodeId: string): Promise<{
  ok: true;
  discovered: boolean;
}> {
  const client = getDiscoveryClient();
  const discovered = client.isNodeDiscovered(nodeId);

  return {
    ok: true,
    discovered,
  };
}

/**
 * node.discovery.stats - Get discovery statistics
 *
 * @returns {Promise<{ok: true, stats: {...}}>}
 */
export async function nodeDiscoveryStats(): Promise<{
  ok: true;
  stats: {
    discovered: number;
    lastDiscoveryTime: number;
    isActive: boolean;
  };
}> {
  const client = getDiscoveryClient();
  const stats = client.getStats();

  return {
    ok: true,
    stats,
  };
}
