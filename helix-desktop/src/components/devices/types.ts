/**
 * Device Management Component Types
 *
 * Shared type definitions for device management UI components.
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
