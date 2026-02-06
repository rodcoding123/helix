/**
 * DevicesDashboard - Main device management hub
 *
 * Gateway methods used:
 *   - devices.list    -> Fetch all paired devices
 *   - devices.approve -> Approve a pairing request
 *   - devices.deny    -> Deny a pairing request
 *   - devices.revoke  -> Revoke device access
 *   - devices.rotate  -> Rotate device tokens
 *
 * Events:
 *   - device.pairing.requested -> New pairing request (real-time)
 *
 * CSS prefix: dd-
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { DeviceCard } from './DeviceCard';
import { PairingApproval } from './PairingApproval';
import type { GatewayEventFrame } from '../../lib/gateway-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevicesDashboardProps {
  onBack?: () => void;
}

/** Device data from the gateway */
interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  capabilities: string[];
  status: 'online' | 'offline';
  lastSeen?: string;
  isCurrentDevice?: boolean;
}

/** Pairing request from the gateway */
interface PairingRequest {
  requestId: string;
  deviceName: string;
  platform: string;
  requestedAt: number;
  capabilities: string[];
}

/** Response shape from devices.list */
interface DevicesListResponse {
  devices?: DeviceInfo[];
  pairingRequests?: PairingRequest[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DevicesDashboard({ onBack }: DevicesDashboardProps) {
  const { getClient, connected } = useGateway();

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rotatingAll, setRotatingAll] = useState(false);
  const [confirmRotateAll, setConfirmRotateAll] = useState(false);

  // Keep a stable ref for the event handler
  const pairingRequestsRef = useRef(pairingRequests);
  pairingRequestsRef.current = pairingRequests;

  // ------ Load devices ------
  const loadDevices = useCallback(async () => {
    setError(null);
    const client = getClient();

    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const result = await client.request<DevicesListResponse>('devices.list');
      if (result.devices) {
        setDevices(result.devices);
      }
      if (result.pairingRequests) {
        setPairingRequests(result.pairingRequests);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  // Initial load
  useEffect(() => {
    loadDevices();
  }, [loadDevices, connected]);

  // ------ Real-time pairing request events ------
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    // We piggyback on the gateway client's onEvent mechanism.
    // The useGateway hook forwards events via handleEvent, but we need
    // to listen for device-specific events.  We intercept them here via
    // the gateway client event stream by registering our own small event
    // handler through a custom event subscription pattern.
    //
    // Because the GatewayClient exposes events through the onEvent callback
    // (set at construction time), and we can't dynamically add listeners
    // to it, we poll for new pairing requests whenever we detect a relevant
    // gateway event.  To keep things efficient, we hook into the shared
    // gateway client's message processing by listening for custom Tauri events
    // or by polling.
    //
    // The cleanest approach is to subscribe via the gateway client options,
    // but since the client is already created, we watch for the event via
    // a wrapper approach: listen for gateway events from the hook.
    //
    // For now we use a polling strategy that checks every 30 seconds if
    // connected, plus we hook into the gateway onEvent via a proxy pattern.

    // Store the original onEvent handler
    const originalOnEvent = (client as unknown as { opts: { onEvent?: (evt: GatewayEventFrame) => void } }).opts?.onEvent;

    // Create a wrapped handler that also checks for device pairing events
    const wrappedOnEvent = (evt: GatewayEventFrame) => {
      // Forward to original handler
      originalOnEvent?.(evt);

      // Handle device pairing requests
      if (evt.event === 'device.pairing.requested') {
        const payload = evt.payload as PairingRequest | undefined;
        if (payload && payload.requestId) {
          setPairingRequests((prev) => {
            // Avoid duplicates
            if (prev.some((r) => r.requestId === payload.requestId)) {
              return prev;
            }
            return [...prev, payload];
          });
        }
      }
    };

    // Apply the wrapped handler
    const opts = (client as unknown as { opts: { onEvent?: (evt: GatewayEventFrame) => void } }).opts;
    if (opts) {
      opts.onEvent = wrappedOnEvent;
    }

    // Periodic refresh as a fallback (every 30s)
    const interval = setInterval(() => {
      if (client.connected) {
        client
          .request<DevicesListResponse>('devices.list')
          .then((result) => {
            if (result.devices) setDevices(result.devices);
            if (result.pairingRequests) setPairingRequests(result.pairingRequests);
          })
          .catch(() => {
            // Silent failure on periodic refresh
          });
      }
    }, 30_000);

    return () => {
      clearInterval(interval);
      // Restore original handler
      if (opts) {
        opts.onEvent = originalOnEvent;
      }
    };
  }, [getClient, connected]);

  // ------ Actions ------
  const handleApprove = useCallback(
    async (requestId: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('devices.approve', { requestId });
        setPairingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
        // Reload to get the newly approved device
        await loadDevices();
      } catch (err) {
        console.error('Failed to approve pairing:', err);
        setError(err instanceof Error ? err.message : 'Failed to approve pairing request');
      }
    },
    [getClient, loadDevices]
  );

  const handleDeny = useCallback(
    async (requestId: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('devices.deny', { requestId });
        setPairingRequests((prev) => prev.filter((r) => r.requestId !== requestId));
      } catch (err) {
        console.error('Failed to deny pairing:', err);
        setError(err instanceof Error ? err.message : 'Failed to deny pairing request');
      }
    },
    [getClient]
  );

  const handleRevoke = useCallback(
    async (deviceId: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('devices.revoke', { deviceId });
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      } catch (err) {
        console.error('Failed to revoke device:', err);
        setError(err instanceof Error ? err.message : 'Failed to revoke device access');
      }
    },
    [getClient]
  );

  const handleRotateToken = useCallback(
    async (deviceId: string) => {
      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('devices.rotate', { deviceId });
        // Reload to reflect updated token state
        await loadDevices();
      } catch (err) {
        console.error('Failed to rotate token:', err);
        setError(err instanceof Error ? err.message : 'Failed to rotate device token');
      }
    },
    [getClient, loadDevices]
  );

  const handleRename = useCallback(
    async (deviceId: string, newName: string) => {
      const client = getClient();
      if (!client?.connected) {
        // Optimistic local update only
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, name: newName } : d))
        );
        return;
      }

      // Optimistic update
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, name: newName } : d))
      );

      try {
        await client.request('devices.rename', { deviceId, name: newName });
      } catch (err) {
        console.error('Failed to rename device:', err);
        // Reload to revert
        await loadDevices();
      }
    },
    [getClient, loadDevices]
  );

  const handleRotateAll = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    setRotatingAll(true);
    setConfirmRotateAll(false);

    try {
      // Rotate tokens for all devices
      const rotatePromises = devices.map((device) =>
        client.request('devices.rotate', { deviceId: device.id }).catch((err: unknown) => {
          console.error(`Failed to rotate token for ${device.name}:`, err);
        })
      );
      await Promise.all(rotatePromises);
      await loadDevices();
    } catch (err) {
      console.error('Failed to rotate all tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to rotate all tokens');
    } finally {
      setRotatingAll(false);
    }
  }, [getClient, devices, loadDevices]);

  // ------ Disconnected state ------
  if (!connected && devices.length === 0 && !loading) {
    return (
      <div className="dd-disconnected">
        <style>{devicesDashboardStyles}</style>
        {onBack && (
          <button className="dd-back" onClick={onBack} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="dd-disconnected__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          </svg>
        </div>
        <h3 className="dd-disconnected__title">Gateway Not Connected</h3>
        <p className="dd-disconnected__desc">
          Start the gateway to manage your devices. Device management requires an active gateway connection.
        </p>
      </div>
    );
  }

  // ------ Loading state ------
  if (loading) {
    return (
      <div className="dd-loading">
        <style>{devicesDashboardStyles}</style>
        <div className="dd-spinner" />
        <span>Loading devices...</span>
      </div>
    );
  }

  return (
    <div className="dd-container">
      <style>{devicesDashboardStyles}</style>

      {/* Header */}
      <header className="dd-header">
        {onBack && (
          <button className="dd-back" onClick={onBack} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="dd-header__text">
          <h2 className="dd-header__title">
            Devices
            {devices.length > 0 && (
              <span className="dd-header__count">{devices.length}</span>
            )}
          </h2>
          <p className="dd-header__subtitle">Paired devices and pairing requests</p>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="dd-error">
          <span>{error}</span>
          <button
            className="dd-error__dismiss"
            onClick={() => setError(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Disconnected warning banner */}
      {!connected && (
        <div className="dd-banner dd-banner--warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Some actions may not be available.
        </div>
      )}

      {/* Pending Pairing Requests */}
      {pairingRequests.length > 0 && (
        <section className="dd-pairing-section">
          <div className="dd-pairing-header">
            <h3 className="dd-pairing-title">
              Pending Pairing Requests
              <span className="dd-pairing-badge">{pairingRequests.length}</span>
            </h3>
          </div>
          <div className="dd-pairing-list">
            {pairingRequests.map((req) => (
              <PairingApproval
                key={req.requestId}
                requestId={req.requestId}
                deviceName={req.deviceName}
                platform={req.platform}
                requestedAt={req.requestedAt}
                capabilities={req.capabilities}
                onApprove={handleApprove}
                onDeny={handleDeny}
              />
            ))}
          </div>
        </section>
      )}

      {/* Paired Devices Grid */}
      {devices.length === 0 ? (
        <div className="dd-empty">
          <div className="dd-empty__icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h3 className="dd-empty__title">No Paired Devices</h3>
          <p className="dd-empty__desc">
            When other devices pair with this instance, they will appear here. Use the web dashboard or mobile app to initiate pairing.
          </p>
        </div>
      ) : (
        <div className="dd-grid">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              id={device.id}
              name={device.name}
              platform={device.platform}
              capabilities={device.capabilities}
              status={device.status}
              lastSeen={device.lastSeen}
              isCurrentDevice={device.isCurrentDevice}
              onRotateToken={handleRotateToken}
              onRevoke={handleRevoke}
              onRename={handleRename}
            />
          ))}
        </div>
      )}

      {/* Bottom section: token info + rotate all */}
      {devices.length > 0 && (
        <div className="dd-footer">
          <div className="dd-footer__info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>
              Device tokens are used for secure communication between paired devices. Rotating a token invalidates the current one and issues a new one. The affected device will need to re-authenticate.
            </span>
          </div>
          <div className="dd-footer__actions">
            {!confirmRotateAll ? (
              <button
                className="dd-btn dd-btn--danger"
                onClick={() => setConfirmRotateAll(true)}
                disabled={rotatingAll || !connected}
                type="button"
              >
                Rotate All Tokens
              </button>
            ) : (
              <div className="dd-rotate-confirm">
                <span className="dd-rotate-confirm__text">
                  This will invalidate all device tokens. Every device will need to re-authenticate. Continue?
                </span>
                <div className="dd-rotate-confirm__btns">
                  <button
                    className="dd-btn dd-btn--secondary dd-btn--sm"
                    onClick={() => setConfirmRotateAll(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="dd-btn dd-btn--danger dd-btn--sm"
                    onClick={handleRotateAll}
                    disabled={rotatingAll}
                    type="button"
                  >
                    {rotatingAll ? 'Rotating...' : 'Confirm Rotate All'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DevicesDashboard;

// ---------------------------------------------------------------------------
// Scoped Styles (dd- prefix)
// ---------------------------------------------------------------------------

const devicesDashboardStyles = `
/* Container */
.dd-container {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
}

.dd-container::-webkit-scrollbar {
  width: 6px;
}

.dd-container::-webkit-scrollbar-track {
  background: transparent;
}

.dd-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.dd-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Back button */
.dd-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.375rem 0;
  margin-bottom: 1rem;
  transition: color 0.15s ease;
  font-family: inherit;
}

.dd-back:hover {
  color: var(--text-primary, #fff);
}

.dd-back svg {
  flex-shrink: 0;
}

/* Header */
.dd-header {
  margin-bottom: 1.75rem;
}

.dd-header__text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dd-header__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.dd-header__count {
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.2);
  color: var(--accent-color, #6366f1);
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}

.dd-header__subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
}

/* Error */
.dd-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.625rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.dd-error__dismiss {
  background: none;
  border: none;
  color: #fca5a5;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.15s ease;
  font-family: inherit;
  flex-shrink: 0;
}

.dd-error__dismiss:hover {
  background: rgba(239, 68, 68, 0.15);
}

/* Warning banner */
.dd-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

.dd-banner--warn {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* Pairing section */
.dd-pairing-section {
  margin-bottom: 1.75rem;
  padding: 1.25rem;
  background: rgba(245, 158, 11, 0.04);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 12px;
}

.dd-pairing-header {
  margin-bottom: 1rem;
}

.dd-pairing-title {
  font-size: 1rem;
  font-weight: 600;
  color: #fbbf24;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dd-pairing-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f59e0b;
  color: #000;
  border-radius: 9999px;
  padding: 0 0.375rem;
  animation: dd-pulse 2s ease-in-out infinite;
}

@keyframes dd-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.dd-pairing-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Device grid */
.dd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

/* Empty state */
.dd-empty {
  text-align: center;
  padding: 4rem 2rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

.dd-empty__icon {
  margin-bottom: 1.25rem;
  color: var(--text-tertiary, #606080);
}

.dd-empty__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.5rem;
}

.dd-empty__desc {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

/* Footer */
.dd-footer {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.dd-footer__info {
  display: flex;
  gap: 0.625rem;
  align-items: flex-start;
  margin-bottom: 1.25rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.5;
}

.dd-footer__info svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.dd-footer__actions {
  display: flex;
  justify-content: flex-end;
}

/* Rotate all confirm */
.dd-rotate-confirm {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  width: 100%;
}

.dd-rotate-confirm__text {
  font-size: 0.8125rem;
  color: #fca5a5;
  line-height: 1.4;
}

.dd-rotate-confirm__btns {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Buttons */
.dd-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  border: none;
}

.dd-btn--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.dd-btn--secondary {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary, #a0a0c0);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dd-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary, #fff);
}

.dd-btn--danger {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.35);
}

.dd-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.6);
}

.dd-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Disconnected */
.dd-disconnected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 3rem;
  color: var(--text-tertiary, #606080);
}

.dd-disconnected__icon {
  margin-bottom: 1.5rem;
  opacity: 0.5;
}

.dd-disconnected__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.5rem;
}

.dd-disconnected__desc {
  font-size: 0.875rem;
  color: var(--text-tertiary, #606080);
  max-width: 360px;
  line-height: 1.5;
  margin: 0;
}

/* Loading */
.dd-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.875rem;
}

.dd-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: dd-spin 0.7s linear infinite;
}

@keyframes dd-spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .dd-grid {
    grid-template-columns: 1fr;
  }

  .dd-container {
    padding: 1rem;
  }

  .dd-footer__actions {
    justify-content: stretch;
  }

  .dd-btn--danger {
    width: 100%;
    justify-content: center;
  }

  .dd-rotate-confirm__btns {
    flex-direction: column-reverse;
  }

  .dd-rotate-confirm__btns .dd-btn {
    width: 100%;
    justify-content: center;
  }
}
`;
