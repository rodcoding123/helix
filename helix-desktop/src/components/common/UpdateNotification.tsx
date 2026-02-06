/**
 * Update Notification Component (Phase J4)
 *
 * Periodic background check for Helix app updates via Tauri's `check_update` command.
 * Shows a non-intrusive toast/banner notification when an update is available.
 * Uses `install_update` to download and schedule the update for next restart.
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertCircle, Download, X } from 'lucide-react';
import { invoke, isTauri } from '../../lib/tauri-compat';
import './UpdateNotification.css';

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  updateUrl?: string;
  downloadUrl?: string;
  body?: string;
}

/**
 * Check for updates every 30 minutes (in production).
 * During dev, checks every 5 minutes.
 */
const CHECK_INTERVAL_MS = import.meta.env.DEV ? 5 * 60_000 : 30 * 60_000;

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  /**
   * Check for available updates.
   */
  const checkForUpdates = useCallback(async () => {
    if (!isTauri) return;

    try {
      setCheckError(null);
      const result = (await invoke('check_for_update', {})) as UpdateInfo | null;

      if (result && result.available) {
        setUpdateInfo(result);
        setShowNotification(true);
      }
    } catch (err) {
      // Log but don't disrupt UI - update checks are best-effort
      const message = err instanceof Error ? err.message : String(err);
      console.debug('[update-check] failed:', message);
      setCheckError(message);
    }
  }, []);

  /**
   * Download and install the update.
   * After installation, prompts user to restart.
   */
  const handleInstallUpdate = useCallback(async () => {
    if (!isTauri || !updateInfo) return;

    try {
      setIsInstalling(true);
      await invoke('install_update', {});

      // Update installation scheduled for next restart
      setShowNotification(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[update-install] failed:', message);
      setCheckError(`Installation failed: ${message}`);
    } finally {
      setIsInstalling(false);
    }
  }, [updateInfo]);

  /**
   * Dismiss the notification and don't show again until next check.
   */
  const handleDismiss = useCallback(() => {
    setShowNotification(false);
  }, []);

  /**
   * Check for updates on mount and periodically.
   */
  useEffect(() => {
    if (!isTauri) return;

    // Check immediately
    checkForUpdates();

    // Set up periodic checks
    const intervalId = setInterval(checkForUpdates, CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [checkForUpdates]);

  if (!showNotification || !updateInfo) {
    return null;
  }

  return (
    <div className="update-notification">
      <div className="update-content">
        <div className="update-icon">
          <AlertCircle size={20} />
        </div>
        <div className="update-text">
          <p className="update-title">
            Update available: v{updateInfo.latestVersion}
          </p>
          {updateInfo.body && (
            <p className="update-details">{updateInfo.body}</p>
          )}
        </div>
      </div>

      <div className="update-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={handleInstallUpdate}
          disabled={isInstalling}
        >
          <Download size={16} />
          {isInstalling ? 'Installing...' : 'Install'}
        </button>
        <button
          className="btn-icon btn-sm"
          onClick={handleDismiss}
          title="Dismiss"
          disabled={isInstalling}
        >
          <X size={16} />
        </button>
      </div>

      {checkError && (
        <div className="update-error">
          <small>{checkError}</small>
        </div>
      )}
    </div>
  );
}
