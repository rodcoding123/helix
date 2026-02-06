/**
 * Device Registration Step - Register This Device
 *
 * Allows web/mobile to know about this desktop device for:
 * - Remote command execution
 * - Cross-device sync
 * - Device management (rename, remove)
 *
 * Device ID persists across app restarts to maintain identity.
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import './DeviceRegistrationStep.css';

export interface DeviceRegistrationData {
  device_id: string;
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'web';
  platform: string;
}

interface DeviceRegistrationStepProps {
  userId: string;
  onRegistrationComplete: (data: DeviceRegistrationData) => void;
  onSkip?: () => void;
  onError?: (error: string) => void;
}

/**
 * Detect platform from user agent
 */
function detectPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('win')) {
    return 'windows';
  } else if (ua.includes('mac')) {
    return 'macos';
  } else if (ua.includes('linux')) {
    return 'linux';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    return 'ios';
  } else if (ua.includes('android')) {
    return 'android';
  }

  return 'desktop';
}

/**
 * Get platform name for display
 */
async function getPlatformName(): Promise<string> {
  const p = detectPlatform();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/**
 * Generate or load persistent device ID
 */
async function getOrCreateDeviceId(): Promise<string> {
  try {
    // Try to load from localStorage first (persists across sessions)
    const stored = localStorage.getItem('helix_device_id');
    if (stored) {
      return stored;
    }

    // Generate new device ID
    const newId = uuidv4();
    localStorage.setItem('helix_device_id', newId);
    return newId;
  } catch {
    // Fallback: generate temp ID (won't persist)
    return uuidv4();
  }
}

/**
 * Get default device name based on platform and hostname
 */
async function getDefaultDeviceName(): Promise<string> {
  try {
    const p = detectPlatform();
    const hostname = await invoke<string>('get_hostname');
    return `${hostname} (${p})`;
  } catch {
    return `Helix Desktop`;
  }
}

export function DeviceRegistrationStep({
  userId,
  onRegistrationComplete,
  onSkip,
  onError,
}: DeviceRegistrationStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [platformName, setPlatformName] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  // Initialize device data on mount
  useEffect(() => {
    (async () => {
      try {
        const id = await getOrCreateDeviceId();
        const name = await getDefaultDeviceName();
        const p = await getPlatformName();

        setDeviceId(id);
        setDeviceName(name);
        setPlatformName(p);
        setError(null);
      } catch (err) {
        const msg = `Failed to initialize: ${String(err)}`;
        setError(msg);
        onError?.(msg);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [onError]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      setError('Please enter a device name');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // Call Tauri command to register with Supabase
      const result = await invoke<{
        success: boolean;
        error?: string;
      }>('register_device', {
        user_id: userId,
        device_id: deviceId,
        device_name: deviceName.trim(),
        device_type: 'desktop',
        platform: platformName.toLowerCase(),
      });

      if (result.success) {
        onRegistrationComplete({
          device_id: deviceId,
          device_name: deviceName,
          device_type: 'desktop',
          platform: platformName,
        });
      } else {
        throw new Error(result.error || 'Registration failed');
      }
    } catch (err) {
      const msg = `Registration failed: ${String(err)}`;
      setError(msg);
      onError?.(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="device-registration-step">
        <div className="loading-state">
          <div className="spinner" />
          <p>Initializing device...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="device-registration-step">
      {/* Header */}
      <div className="registration-header">
        <h1>Register This Device</h1>
        <p className="registration-subtitle">
          Your web dashboard and other devices can see and control this device
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="registration-form">
        {/* Device Name Input */}
        <div className="form-group">
          <label htmlFor="device-name">Device Name</label>
          <input
            id="device-name"
            type="text"
            value={deviceName}
            onChange={(e) => {
              setDeviceName(e.target.value);
              setError(null);
            }}
            placeholder="My MacBook Pro, Work Desktop, etc."
            disabled={isRegistering}
            autoFocus
          />
          <p className="form-hint">Help identify this device on your dashboard (you can change this later)</p>
        </div>

        {/* Device Details (Read-only) */}
        <div className="device-details">
          <button
            type="button"
            className="toggle-details"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>{showDetails ? '▼' : '▶'}</span>
            <span>Device Details</span>
          </button>

          {showDetails && (
            <div className="details-content">
              <div className="detail-row">
                <span className="label">Device ID:</span>
                <span className="value mono">{deviceId}</span>
              </div>
              <div className="detail-row">
                <span className="label">Platform:</span>
                <span className="value">{platformName}</span>
              </div>
              <div className="detail-row">
                <span className="label">Device Type:</span>
                <span className="value">Desktop</span>
              </div>
              <p className="detail-note">
                Device ID is persistent - reinstalling the app uses the same ID
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="error-message">{error}</div>}

        {/* Privacy Note */}
        <div className="privacy-note">
          <span className="icon">🔒</span>
          <p>
            <strong>Privacy:</strong> Your device is only visible to you and authorized accounts.
            Credentials stay on this device.
          </p>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={isRegistering || !deviceName.trim()}
          >
            {isRegistering ? 'Registering...' : 'Register Device'}
          </button>
          {onSkip && (
            <button
              type="button"
              className="btn-text"
              onClick={onSkip}
              disabled={isRegistering}
            >
              Skip for now
            </button>
          )}
        </div>
      </form>

      {/* Info Section */}
      <div className="registration-info">
        <h3>Why register your device?</h3>
        <div className="info-grid">
          <div className="info-card">
            <span className="info-icon">📱</span>
            <h4>Web Dashboard</h4>
            <p>See all your devices on your web dashboard</p>
          </div>
          <div className="info-card">
            <span className="info-icon">⚡</span>
            <h4>Remote Commands</h4>
            <p>Send commands from web/mobile to your desktop</p>
          </div>
          <div className="info-card">
            <span className="info-icon">🔄</span>
            <h4>Cross-Device Sync</h4>
            <p>Results sync back in real-time</p>
          </div>
          <div className="info-card">
            <span className="info-icon">💻</span>
            <h4>Device Management</h4>
            <p>Rename, enable/disable, or remove devices</p>
          </div>
        </div>
      </div>
    </div>
  );
}
