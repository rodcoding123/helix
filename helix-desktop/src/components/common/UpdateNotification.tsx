/**
 * Update Notification Component
 *
 * Displays update availability notification and handles installation
 */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import './UpdateNotification.css';

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
  should_update: boolean;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let unlisteners: UnlistenFn[] = [];

    const initListeners = async () => {
      // Listen for update available event
      unlisteners.push(
        await listen<UpdateInfo>('updater:update-available', (event) => {
          setUpdateInfo(event.payload);
          setShowBanner(true);
        })
      );

      // Listen for installation start
      unlisteners.push(
        await listen<string>('updater:installing', () => {
          setInstalling(true);
        })
      );

      // Listen for installation complete
      unlisteners.push(
        await listen<string>('updater:install-complete', (event) => {
          setInstalling(false);
          setShowBanner(false);
          // Show restart prompt
          showRestartPrompt(event.payload);
        })
      );

      // Listen for errors
      unlisteners.push(
        await listen<string>('updater:error', (event) => {
          console.error('[updater] Error:', event.payload);
          setInstalling(false);
        })
      );

      // Auto-check for updates every hour
      checkForUpdates();
      const interval = setInterval(checkForUpdates, 3600000);
      return () => clearInterval(interval);
    };

    initListeners();

    return () => {
      unlisteners.forEach(unlisten => unlisten());
    };
  }, []);

  const checkForUpdates = async () => {
    try {
      const info = await invoke<UpdateInfo>('check_for_update');
      if (info.should_update) {
        setUpdateInfo(info);
        setShowBanner(true);
      }
    } catch (err) {
      console.debug('[updater] Check error:', err);
    }
  };

  const handleInstall = async () => {
    try {
      setInstalling(true);
      await invoke<string>('install_update');
    } catch (err) {
      console.error('[updater] Install error:', err);
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  const showRestartPrompt = (version: string) => {
    const response = window.confirm(
      `Update ${version} has been installed. Restart now to apply the update?`
    );

    if (response) {
      invoke('restart_for_update').catch(err => {
        console.error('[updater] Restart error:', err);
      });
    }
  };

  if (!showBanner || !updateInfo) {
    return null;
  }

  return (
    <div className="update-notification">
      <div className="update-content">
        <div className="update-header">
          <h3>Update Available</h3>
          <button
            className="update-close"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        <div className="update-body">
          <p>
            <strong>Helix {updateInfo.version}</strong> is available.
            {updateInfo.date && (
              <span className="update-date"> Released {updateInfo.date}</span>
            )}
          </p>

          {updateInfo.body && (
            <div className="update-notes">
              <p className="update-notes-label">What's new:</p>
              <p className="update-notes-content">{updateInfo.body.substring(0, 150)}...</p>
            </div>
          )}
        </div>

        <div className="update-actions">
          <button
            className="btn-update"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? 'Downloading...' : 'Update Now'}
          </button>
          <button
            className="btn-later"
            onClick={handleDismiss}
            disabled={installing}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
