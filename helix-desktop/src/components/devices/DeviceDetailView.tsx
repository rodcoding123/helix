/**
 * Device Detail View
 *
 * Comprehensive device details and management with tabs for:
 * - Overview: Basic info, platform, capabilities
 * - Permissions: Role selection, capability verification
 * - Exec Policy: Per-device command allowlist
 * - Danger Zone: Token rotation, revocation
 *
 * Pattern: Two-column layout from AgentEditor
 */

import { useState, useCallback } from 'react';
import { ArrowLeft, Copy, RotateCw, Trash2, Shield, Settings, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getGatewayClient } from '../../lib/gateway-client';
import { NodeHealthPanel } from './NodeHealthPanel';
import type { PairingRequest } from './DeviceManagementDashboard';
import './device-management.css';

export interface DeviceDetailViewProps {
  device: PairingRequest & {
    status?: 'connected' | 'pairing' | 'offline' | 'error';
    capabilities?: string[];
    role?: 'operator' | 'node';
    allowedCommands?: string[];
    lastSeen?: number;
    pairedAt?: number;
  };
  onClose: () => void;
  onDeviceUpdated?: () => void;
}

type TabType = 'overview' | 'permissions' | 'exec-policy' | 'health' | 'danger';

interface DeviceDetailState {
  displayName: string;
  role: 'operator' | 'node';
  allowedCommands: string[];
  loading: boolean;
  error: string | null;
  saving: boolean;
}

export function DeviceDetailView({ device, onClose, onDeviceUpdated }: DeviceDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [state, setState] = useState<DeviceDetailState>({
    displayName: device.displayName,
    role: device.role || 'node',
    allowedCommands: device.allowedCommands || [],
    loading: false,
    error: null,
    saving: false,
  });

  const client = getGatewayClient();

  const handleSave = useCallback(async () => {
    if (!client?.connected) {
      setState(prev => ({ ...prev, error: 'Gateway not connected' }));
      return;
    }

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      // Update device configuration via gateway
      await client.request('device.pair.configure', {
        deviceId: device.id,
        displayName: state.displayName,
        role: state.role,
        allowedCommands: state.allowedCommands,
      });

      setState(prev => ({ ...prev, saving: false }));
      onDeviceUpdated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save device config';
      setState(prev => ({ ...prev, error: message, saving: false }));
    }
  }, [client, device.id, state, onDeviceUpdated]);

  const handleRotateToken = useCallback(async () => {
    if (!client?.connected || !confirm('Rotate device token? The old token will be invalidated.')) {
      return;
    }

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      const result = await client.request('device.token.rotate', { deviceId: device.id });

      setState(prev => ({ ...prev, saving: false }));

      if (result && typeof result === 'object' && 'newToken' in result && typeof (result as any).newToken === 'string') {
        // Show success toast or copy to clipboard
        navigator.clipboard.writeText((result as any).newToken);
        alert('New token copied to clipboard. Share with device.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rotate token';
      setState(prev => ({ ...prev, error: message, saving: false }));
    }
  }, [client, device.id]);

  const handleRevoke = useCallback(async () => {
    if (!client?.connected || !confirm('Revoke device access? This cannot be undone.')) {
      return;
    }

    setState(prev => ({ ...prev, saving: true, error: null }));

    try {
      await client.request('device.token.revoke', { deviceId: device.id });
      onClose();
      onDeviceUpdated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke device';
      setState(prev => ({ ...prev, error: message, saving: false }));
    }
  }, [client, device.id, onClose, onDeviceUpdated]);

  const platformIcon: Record<string, string> = {
    ios: '🍎',
    android: '🤖',
    macos: '🍎',
    linux: '🐧',
    windows: '🪟',
  };

  const platformLabel: Record<string, string> = {
    ios: 'iPhone/iPad',
    android: 'Android',
    macos: 'macOS',
    linux: 'Linux',
    windows: 'Windows',
  };

  return (
    <div className="device-detail-view">
      {/* Header with back button */}
      <div className="ddv-header">
        <button className="ddv-back-btn" onClick={onClose} title="Back to devices">
          <ArrowLeft size={20} />
        </button>
        <div className="ddv-header-content">
          <h1 className="ddv-title">{state.displayName}</h1>
          <p className="ddv-subtitle">
            {platformLabel[device.platform]} • {device.pairedAt ? `Connected ${formatDistanceToNow(device.pairedAt, { addSuffix: true })}` : 'Pairing in progress'}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {state.error && <div className="dmd-error">{state.error}</div>}

      {/* Two-column layout */}
      <div className="ddv-container">
        {/* Left column: Tab navigation */}
        <div className="ddv-sidebar">
          <div className="ddv-tabs">
            <button
              className={`ddv-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Settings size={16} />
              <span>Overview</span>
            </button>
            <button
              className={`ddv-tab ${activeTab === 'permissions' ? 'active' : ''}`}
              onClick={() => setActiveTab('permissions')}
            >
              <Shield size={16} />
              <span>Permissions</span>
            </button>
            <button
              className={`ddv-tab ${activeTab === 'health' ? 'active' : ''}`}
              onClick={() => setActiveTab('health')}
            >
              <Heart size={16} />
              <span>Health</span>
            </button>
            <button
              className={`ddv-tab ${activeTab === 'exec-policy' ? 'active' : ''}`}
              onClick={() => setActiveTab('exec-policy')}
            >
              <Shield size={16} />
              <span>Exec Policy</span>
            </button>
            <button
              className={`ddv-tab ${activeTab === 'danger' ? 'active' : ''}`}
              onClick={() => setActiveTab('danger')}
            >
              <Trash2 size={16} />
              <span>Danger Zone</span>
            </button>
          </div>
        </div>

        {/* Right column: Tab content */}
        <div className="ddv-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="ddv-tab-panel">
              <div className="ddv-form-group">
                <label className="ddv-label">Device Name</label>
                <input
                  type="text"
                  className="ddv-input"
                  value={state.displayName}
                  onChange={e => setState(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g., John's iPhone"
                />
              </div>

              <div className="ddv-form-group">
                <label className="ddv-label">Platform</label>
                <div className="ddv-readonly-field">
                  <span className="ddv-platform-icon">{platformIcon[device.platform]}</span>
                  <span>{platformLabel[device.platform]}</span>
                </div>
              </div>

              <div className="ddv-form-group">
                <label className="ddv-label">Device ID</label>
                <div className="ddv-copy-field">
                  <code>{device.id}</code>
                  <button
                    className="ddv-copy-btn"
                    onClick={() => navigator.clipboard.writeText(device.id)}
                    title="Copy device ID"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div className="ddv-form-group">
                <label className="ddv-label">Capabilities</label>
                <div className="ddv-capability-list">
                  {device.capabilities?.length ? (
                    device.capabilities.map(cap => (
                      <span key={cap} className="ddv-capability-badge">
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span className="ddv-empty-caps">No capabilities declared</span>
                  )}
                </div>
              </div>

              <div className="ddv-form-group">
                <label className="ddv-label">Status</label>
                <div className="ddv-status-display">
                  <span
                    className={`ddv-status-indicator ${device.status || 'offline'}`}
                  />
                  <span className="ddv-status-text">
                    {device.status === 'connected' ? 'Online' : 'Offline'}
                  </span>
                  {device.lastSeen && (
                    <span className="ddv-status-time">
                      Last seen {formatDistanceToNow(device.lastSeen, { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>

              <div className="ddv-form-actions">
                <button
                  className="ddv-btn ddv-btn--primary"
                  onClick={handleSave}
                  disabled={state.saving}
                >
                  {state.saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="ddv-tab-panel">
              <div className="ddv-form-group">
                <label className="ddv-label">Device Role</label>
                <select
                  className="ddv-select"
                  value={state.role}
                  onChange={e => setState(prev => ({ ...prev, role: e.target.value as 'operator' | 'node' }))}
                >
                  <option value="node">Node (Execute commands)</option>
                  <option value="operator">Operator (Send commands)</option>
                </select>
              </div>

              <div className="ddv-info-box">
                <p>
                  <strong>Node:</strong> Device can execute commands and access its local resources.
                </p>
                <p>
                  <strong>Operator:</strong> Device can send commands but cannot execute them locally.
                </p>
              </div>

              <div className="ddv-capability-section">
                <h3>Declared Capabilities</h3>
                {device.capabilities?.length ? (
                  <div className="ddv-capability-matrix">
                    {device.capabilities.map(cap => (
                      <div key={cap} className="ddv-capability-row">
                        <div className="ddv-capability-name">{cap}</div>
                        <div className="ddv-capability-status">✓ Available</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ddv-empty-caps">No capabilities available on this device</p>
                )}
              </div>

              <div className="ddv-form-actions">
                <button
                  className="ddv-btn ddv-btn--primary"
                  onClick={handleSave}
                  disabled={state.saving}
                >
                  {state.saving ? 'Saving...' : 'Update Permissions'}
                </button>
              </div>
            </div>
          )}

          {/* Health Tab */}
          {activeTab === 'health' && (
            <div className="ddv-tab-panel">
              <div className="ddv-health-container">
                <p className="ddv-health-subtitle">
                  Real-time connection quality, latency, and uptime metrics
                </p>
                <NodeHealthPanel nodeId={device.id} />
              </div>
            </div>
          )}

          {/* Exec Policy Tab */}
          {activeTab === 'exec-policy' && (
            <div className="ddv-tab-panel">
              <div className="ddv-form-group">
                <label className="ddv-label">Allowed Commands (glob patterns)</label>
                <textarea
                  className="ddv-textarea"
                  value={state.allowedCommands.join('\n')}
                  onChange={e =>
                    setState(prev => ({
                      ...prev,
                      allowedCommands: e.target.value.split('\n').filter(Boolean),
                    }))
                  }
                  placeholder={`/usr/bin/*\n~/scripts/*\n/opt/helix/*`}
                  rows={8}
                />
              </div>

              <div className="ddv-info-box">
                <p>One pattern per line. Use * for wildcards. Examples:</p>
                <ul>
                  <li>/usr/bin/* - Allow all commands in /usr/bin</li>
                  <li>~/scripts/* - Allow all scripts in home directory</li>
                  <li>/opt/helix/cli - Allow exact path</li>
                </ul>
              </div>

              <div className="ddv-form-actions">
                <button
                  className="ddv-btn ddv-btn--primary"
                  onClick={handleSave}
                  disabled={state.saving}
                >
                  {state.saving ? 'Saving...' : 'Update Policy'}
                </button>
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="ddv-tab-panel">
              <div className="ddv-danger-zone">
                <div className="ddv-danger-section">
                  <div className="ddv-danger-header">
                    <h3>Rotate Device Token</h3>
                    <p>Generate a new token for this device. The old token will be invalidated.</p>
                  </div>
                  <button
                    className="ddv-btn ddv-btn--warning"
                    onClick={handleRotateToken}
                    disabled={state.saving}
                  >
                    <RotateCw size={16} />
                    {state.saving ? 'Rotating...' : 'Rotate Token'}
                  </button>
                </div>

                <hr className="ddv-divider" />

                <div className="ddv-danger-section">
                  <div className="ddv-danger-header">
                    <h3>Revoke Device Access</h3>
                    <p>Permanently revoke this device's access. This cannot be undone.</p>
                  </div>
                  <button
                    className="ddv-btn ddv-btn--danger"
                    onClick={handleRevoke}
                    disabled={state.saving}
                  >
                    <Trash2 size={16} />
                    {state.saving ? 'Revoking...' : 'Revoke Access'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
