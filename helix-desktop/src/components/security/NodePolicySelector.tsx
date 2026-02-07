/**
 * Node Policy Selector
 *
 * UI for selecting a node and adding per-node exec policies.
 * Displays available paired nodes and prevents duplicate policy entries.
 *
 * Phase H.2: Device-specific execution control
 */

import { useState, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';

export interface NodePolicySelectorProps {
  existingNodeIds: string[];
  onAddNode: (nodeId: string, displayName: string) => void;
  disabled?: boolean;
}

interface PairedNode {
  id: string;
  displayName: string;
  platform: string;
  status: 'connected' | 'offline';
}

export function NodePolicySelector({ existingNodeIds, onAddNode, disabled }: NodePolicySelectorProps) {
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [availableNodes, setAvailableNodes] = useState<PairedNode[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAvailableNodes = useCallback(async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setAvailableNodes([]);
        return;
      }

      // Request list of paired devices/nodes
      const result = await client.request('device.pair.list', {});

      if (result && typeof result === 'object' && 'paired' in result) {
        const nodes: PairedNode[] = (result as any).paired.map((device: any) => ({
          id: device.id,
          displayName: device.displayName,
          platform: device.platform,
          status: device.status || 'offline',
        }));

        // Filter out nodes that already have policies
        const availableForNewPolicy = nodes.filter(
          (node) => !existingNodeIds.includes(node.id)
        );

        setAvailableNodes(availableForNewPolicy);
      }
    } catch (err) {
      console.error('[node-policy-selector] Failed to load available nodes:', err);
      setAvailableNodes([]);
    } finally {
      setLoading(false);
    }
  }, [existingNodeIds]);

  const handleAddPolicy = useCallback(() => {
    const nodeId = selectedNodeId.trim();
    if (!nodeId) return;

    const node = availableNodes.find((n) => n.id === nodeId);
    if (node) {
      onAddNode(nodeId, node.displayName);
      setSelectedNodeId('');
      // Reload available nodes to remove the one we just added
      loadAvailableNodes();
    }
  }, [selectedNodeId, availableNodes, onAddNode, loadAvailableNodes]);

  return (
    <div className="ead-node-selector">
      <div className="ead-node-selector-header">
        <h4 className="ead-node-selector-title">Add Node Policy</h4>
        <p className="ead-node-selector-desc">
          Configure command allowlists for a specific device
        </p>
      </div>

      <div className="ead-node-selector-controls">
        <select
          className="ead-select"
          value={selectedNodeId}
          onChange={(e) => setSelectedNodeId(e.target.value)}
          onFocus={loadAvailableNodes}
          disabled={disabled || loading || availableNodes.length === 0}
          aria-label="Select node"
        >
          <option value="">
            {loading
              ? 'Loading nodes...'
              : availableNodes.length === 0
                ? 'No available nodes'
                : 'Select a node...'}
          </option>
          {availableNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {node.displayName} ({node.platform})
              {node.status === 'offline' && ' - offline'}
            </option>
          ))}
        </select>

        <button
          className="ead-btn-sm ead-btn-secondary"
          onClick={handleAddPolicy}
          disabled={disabled || !selectedNodeId.trim() || loading}
        >
          {loading ? 'Loading...' : 'Add Policy'}
        </button>
      </div>

      {availableNodes.length === 0 && !loading && existingNodeIds.length === 0 && (
        <div className="ead-node-selector-empty">
          <p>No paired devices available. Pair devices in the Devices section first.</p>
        </div>
      )}

      {availableNodes.length === 0 && !loading && existingNodeIds.length > 0 && (
        <div className="ead-node-selector-empty">
          <p>All paired devices already have policies.</p>
        </div>
      )}
    </div>
  );
}
