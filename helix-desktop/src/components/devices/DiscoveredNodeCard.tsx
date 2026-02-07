/**
 * Discovered Node Card
 *
 * Displays a node discovered via mDNS on the local network.
 * Shows platform, IP address, version, and provides a quick pair button.
 *
 * Phase H.4: Node Discovery UI
 */

import { useCallback, useState } from 'react';
import { Wifi } from 'lucide-react';
import type { DiscoveredNode } from './types';

export interface DiscoveredNodeCardProps {
  node: DiscoveredNode;
  onPair: (node: DiscoveredNode) => void;
  isPairing?: boolean;
}

const platformIcons: Record<string, string> = {
  ios: '🍎',
  android: '🤖',
  macos: '🍎',
  linux: '🐧',
  windows: '🪟',
  unknown: '🖥️',
};

const platformLabels: Record<string, string> = {
  ios: 'iPhone/iPad',
  android: 'Android',
  macos: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
  unknown: 'Unknown Platform',
};

export function DiscoveredNodeCard({
  node,
  onPair,
  isPairing = false,
}: DiscoveredNodeCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handlePair = useCallback(() => {
    onPair(node);
  }, [node, onPair]);

  const platformIcon = platformIcons[node.platform.toLowerCase()] || platformIcons.unknown;
  const platformLabel = platformLabels[node.platform.toLowerCase()] || platformLabels.unknown;

  return (
    <div className="dnc-card">
      {/* Header with icon and name */}
      <div className="dnc-header">
        <div className="dnc-platform">
          <span className="dnc-platform-icon">{platformIcon}</span>
          <div className="dnc-name-group">
            <h3 className="dnc-name">{node.name}</h3>
            <p className="dnc-platform-label">{platformLabel}</p>
          </div>
        </div>
        <div className="dnc-online-indicator">
          <Wifi size={16} className="dnc-online-icon" />
        </div>
      </div>

      {/* Connection info */}
      <div className="dnc-connection-info">
        <div className="dnc-info-row">
          <span className="dnc-label">IP Address</span>
          <code className="dnc-value">{node.host}</code>
        </div>
        <div className="dnc-info-row">
          <span className="dnc-label">Port</span>
          <code className="dnc-value">{node.port}</code>
        </div>
        <div className="dnc-info-row">
          <span className="dnc-label">Version</span>
          <span className="dnc-value">{node.version}</span>
        </div>
      </div>

      {/* Expandable details */}
      {showDetails && (
        <div className="dnc-details">
          {node.cliPath && (
            <div className="dnc-detail-row">
              <span className="dnc-detail-label">CLI Path</span>
              <code className="dnc-detail-value">{node.cliPath}</code>
            </div>
          )}
          {node.nodeId && (
            <div className="dnc-detail-row">
              <span className="dnc-detail-label">Node ID</span>
              <code className="dnc-detail-value">{node.nodeId}</code>
            </div>
          )}
          <div className="dnc-detail-row">
            <span className="dnc-detail-label">Discovered</span>
            <span className="dnc-detail-value">
              {new Date(node.discovered).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Actions footer */}
      <div className="dnc-footer">
        <button
          className="dnc-btn-details"
          onClick={() => setShowDetails(!showDetails)}
          title={showDetails ? 'Hide details' : 'Show details'}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
        <button
          className="dnc-btn-pair"
          onClick={handlePair}
          disabled={isPairing}
          title={isPairing ? 'Pairing in progress...' : 'Initiate pairing'}
        >
          {isPairing ? 'Pairing...' : 'Pair Device'}
        </button>
      </div>
    </div>
  );
}
