/**
 * Device Management Dashboard
 *
 * Manages device pairing, approval workflows, and trust settings
 * Uses three-section pattern: Pending → Trusted Devices → History
 *
 * Pattern: ExecApprovalsDashboard
 */

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, RefreshCw, Wifi } from 'lucide-react';
import { getGatewayClient } from '../../lib/gateway-client';
import { DeviceApprovalCard } from './DeviceApprovalCard';
import { DeviceDetailView } from './DeviceDetailView';
import { DiscoveredNodeCard } from './DiscoveredNodeCard';
import type { DiscoveredNode } from './types';
import './device-management.css';

export interface PairingRequest {
  id: string;
  deviceId: string;
  displayName: string;
  platform: 'ios' | 'android' | 'macos' | 'linux' | 'windows';
  requestedAt: number;
  expiresAt: number;
}

export interface TrustedDevice {
  id: string;
  displayName: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'macos' | 'linux' | 'windows';
  isPrimary: boolean;
  status: 'connected' | 'pairing' | 'offline' | 'error';
  lastSeen?: number;
  capabilities: string[];
  createdAt: number;
}

export interface DeviceManagementDashboardProps {
  // No props required at this time
}

export function DeviceManagementDashboard({}: DeviceManagementDashboardProps) {
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [discoveredNodes, setDiscoveredNodes] = useState<DiscoveredNode[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<TrustedDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredExpanded, setDiscoveredExpanded] = useState(true);
  const [pendingHistoryExpanded, setPendingHistoryExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const client = getGatewayClient();

  const loadDeviceData = useCallback(async () => {
    if (!client?.connected) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch pairing requests and trusted devices
      const result = await client.request('device.pair.list', {});

      if (result && typeof result === 'object' && 'ok' in result && result.ok) {
        setPairingRequests((result as any).pending || []);
        setTrustedDevices((result as any).paired || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [client]);

  // Load data on mount and set up auto-refresh
  useEffect(() => {
    loadDeviceData();

    const interval = setInterval(loadDeviceData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadDeviceData]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!client) return;

    const handlePairingRequested = () => {
      loadDeviceData();
    };

    const handlePairingResolved = () => {
      loadDeviceData();
    };

    const handleNodeConnected = () => {
      loadDeviceData();
    };

    const handleNodeDisconnected = () => {
      loadDeviceData();
    };

    client.on('device.pair.requested', handlePairingRequested);
    client.on('device.pair.resolved', handlePairingResolved);
    client.on('node.connected', handleNodeConnected);
    client.on('node.disconnected', handleNodeDisconnected);

    return () => {
      client.off('device.pair.requested', handlePairingRequested);
      client.off('device.pair.resolved', handlePairingResolved);
      client.off('node.connected', handleNodeConnected);
      client.off('node.disconnected', handleNodeDisconnected);
    };
  }, [client, loadDeviceData]);

  const handleApproveRequest = useCallback(
    async (requestId: string) => {
      if (!client?.connected) return;

      try {
        await client.request('device.pair.approve', {
          id: requestId,
          role: 'operator'
        });

        // Remove from pending and reload
        setPairingRequests((prev) => prev.filter((r) => r.id !== requestId));
        await loadDeviceData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve request');
      }
    },
    [client, loadDeviceData]
  );

  const handleRejectRequest = useCallback(
    async (requestId: string) => {
      if (!client?.connected) return;

      try {
        await client.request('device.pair.reject', { id: requestId });

        // Remove from pending
        setPairingRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject request');
      }
    },
    [client]
  );


  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDeviceData();
    setRefreshing(false);
  }, [loadDeviceData]);

  const handleDiscoverNetwork = useCallback(async () => {
    if (!client?.connected) return;

    try {
      setDiscovering(true);
      setError(null);

      // Trigger network scan
      const result = await client.request('node.discovery.trigger', {});

      if (result && typeof result === 'object' && 'nodes' in result) {
        setDiscoveredNodes((result as any).nodes);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan network';
      setError(message);
      console.debug('[discovery] Network scan error:', err);
    } finally {
      setDiscovering(false);
    }
  }, [client]);

  const handlePairDiscovered = useCallback(
    async (node: DiscoveredNode) => {
      if (!client?.connected) return;

      try {
        // Initiate pairing with discovered node
        // This would trigger the pairing workflow similar to manual pairing
        await client.request('node.pair.request', {
          nodeHost: node.host,
          nodePort: node.port,
          displayName: node.name,
        });

        // Reload device data to show new pairing request
        await loadDeviceData();

        // Remove from discovered list
        setDiscoveredNodes((prev) => prev.filter((n) => n.name !== node.name));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to pair device';
        setError(message);
        console.debug('[discovery] Pairing error:', err);
      }
    },
    [client, loadDeviceData]
  );

  // Show detail view if device selected
  if (selectedDevice) {
    return (
      <DeviceDetailView device={selectedDevice as any} onClose={() => setSelectedDevice(null)} onDeviceUpdated={loadDeviceData} />
    );
  }

  const pendingCount = pairingRequests.length;

  return (
    <div className="dmd-container">
      {/* Header */}
      <div className="dmd-header">
        <div className="dmd-header__content">
          <h1 className="dmd-header__title">Device Management</h1>
          <p className="dmd-header__desc">Manage paired devices and approve new pairing requests</p>
        </div>
        <button
          className="dmd-btn-refresh"
          onClick={handleRefresh}
          disabled={refreshing || !client?.connected}
          title="Refresh device list"
        >
          <RefreshCw size={16} />
          {refreshing ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="dmd-error-banner">
          <div className="dmd-error-content">
            <span className="dmd-error-icon">⚠️</span>
            <span>{error}</span>
            <button
              className="dmd-error-close"
              onClick={() => setError(null)}
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Section 0: Discovered Devices (Network Scan) */}
      <section className="dmd-section">
        <button
          className="dmd-section__header"
          onClick={() => setDiscoveredExpanded(!discoveredExpanded)}
        >
          <div className="dmd-section__title-group">
            <h2 className="dmd-section__title">Discovered Devices</h2>
            <span className="dmd-discovery-status">Local Network</span>
          </div>
          <div className="dmd-section__actions">
            <button
              className="dmd-btn-scan"
              onClick={(e) => {
                e.stopPropagation();
                handleDiscoverNetwork();
              }}
              disabled={discovering || !client?.connected}
              title="Scan local network for Helix nodes"
            >
              <Wifi size={14} />
              {discovering ? 'Scanning...' : 'Scan Network'}
            </button>
            <ChevronDown
              size={18}
              className={`dmd-section__chevron ${discoveredExpanded ? 'dmd-section__chevron--open' : ''}`}
            />
          </div>
        </button>

        {discoveredExpanded && (
          <div className="dmd-section__content">
            {discoveredNodes.length === 0 ? (
              <div className="dmd-empty">
                <p className="dmd-empty__title">No devices found</p>
                <p className="dmd-empty__desc">
                  {discovering ? 'Scanning local network...' : 'Click "Scan Network" to discover Helix nodes on your WiFi'}
                </p>
              </div>
            ) : (
              <div className="dmd-discovered-grid">
                {discoveredNodes.map((node) => (
                  <DiscoveredNodeCard
                    key={node.name}
                    node={node}
                    onPair={handlePairDiscovered}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 1: Pending Approvals */}
      <section className="dmd-section">
        <button
          className="dmd-section__header"
          onClick={() => setPendingHistoryExpanded(!pendingHistoryExpanded)}
        >
          <div className="dmd-section__title-group">
            <h2 className="dmd-section__title">Pending Approvals</h2>
            {pendingCount > 0 && <span className="dmd-pending-badge">{pendingCount}</span>}
          </div>
          <ChevronDown
            size={18}
            className={`dmd-section__chevron ${pendingHistoryExpanded ? 'dmd-section__chevron--open' : ''}`}
          />
        </button>

        {pendingHistoryExpanded && (
          <div className="dmd-section__content">
            {loading ? (
              <div className="dmd-loading">Loading pairing requests...</div>
            ) : pairingRequests.length === 0 ? (
              <div className="dmd-empty">
                <p className="dmd-empty__title">No pending requests</p>
                <p className="dmd-empty__desc">Devices will appear here when they request pairing</p>
              </div>
            ) : (
              <div className="dmd-approval-list">
                {pairingRequests.map((request) => (
                  <DeviceApprovalCard
                    key={request.id}
                    request={request}
                    onApprove={() => handleApproveRequest(request.id)}
                    onReject={() => handleRejectRequest(request.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section 2: Trusted Devices */}
      <section className="dmd-section dmd-section--main">
        <div className="dmd-section__header-static">
          <h2 className="dmd-section__title">Trusted Devices</h2>
          <p className="dmd-section__desc">Manage connected and previously paired devices</p>
        </div>

        <div className="dmd-section__content">
          {loading ? (
            <div className="dmd-loading">Loading devices...</div>
          ) : trustedDevices.length === 0 ? (
            <div className="dmd-empty">
              <p className="dmd-empty__title">No trusted devices</p>
              <p className="dmd-empty__desc">
                Once you approve a pairing request, the device will appear here
              </p>
            </div>
          ) : (
            <div className="dmd-device-grid">
              {trustedDevices.map((device) => (
                <div
                  key={device.id}
                  className="dmd-device-card"
                  onClick={() => setSelectedDevice(device)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedDevice(device);
                    }
                  }}
                >
                  <div className="dmd-card-header">
                    <div className="dmd-card-platform">
                      {device.platform === 'ios' ? '🍎' : device.platform === 'android' ? '🤖' : device.platform === 'macos' ? '🍎' : device.platform === 'linux' ? '🐧' : '🪟'}
                    </div>
                    <div className="dmd-card-info">
                      <h3 className="dmd-card-name">{device.displayName}</h3>
                      <p className="dmd-card-status" data-status={device.status}>
                        {device.status === 'connected' ? '● Connected' : device.status === 'pairing' ? '⏳ Pairing' : device.status === 'offline' ? '○ Offline' : '⚠ Error'}
                      </p>
                    </div>
                    {device.isPrimary && <span className="dmd-card-primary">Primary</span>}
                  </div>
                  {device.capabilities && device.capabilities.length > 0 && (
                    <div className="dmd-card-capabilities">
                      {device.capabilities.slice(0, 3).map((cap) => (
                        <span key={cap} className="dmd-capability-tag">
                          {cap}
                        </span>
                      ))}
                      {device.capabilities.length > 3 && <span className="dmd-more-caps">+{device.capabilities.length - 3}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Device History (Collapsible) */}
      <section className="dmd-section">
        <button
          className="dmd-section__header"
          onClick={() => setHistoryExpanded(!historyExpanded)}
        >
          <h2 className="dmd-section__title">Recent Activity</h2>
          <ChevronDown
            size={18}
            className={`dmd-section__chevron ${historyExpanded ? 'dmd-section__chevron--open' : ''}`}
          />
        </button>

        {historyExpanded && (
          <div className="dmd-section__content">
            <div className="dmd-history">
              <div className="dmd-history__item">
                <span className="dmd-history__time">5 min ago</span>
                <span className="dmd-history__event">iPhone approved for pairing</span>
              </div>
              <div className="dmd-history__item">
                <span className="dmd-history__time">2 hours ago</span>
                <span className="dmd-history__event">iPad went offline</span>
              </div>
              <div className="dmd-history__item">
                <span className="dmd-history__time">1 day ago</span>
                <span className="dmd-history__event">MacBook pairing request approved</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
