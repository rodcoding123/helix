import { useState } from 'react';
import { invoke } from '../../lib/tauri-compat';
import { useConfigStore } from '../../stores/configStore';
import { OAuthFlowDialog } from '../auth/OAuthFlowDialog';
import type { AuthProfile } from '../auth/AuthProfileManager';

export function AccountSettings() {
  const { config, updateConfig } = useConfigStore();
  const [displayName, setDisplayName] = useState(config.account?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOAuthDialog, setShowOAuthDialog] = useState(false);

  const isCloudConnected = config.account?.cloudSync ?? false;

  const handleSaveDisplayName = async () => {
    setSaving(true);
    try {
      updateConfig('account', { displayName });
      // Simulate save delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setSaving(false);
    }
  };

  const handleCloudSyncToggle = async (enabled: boolean) => {
    if (enabled) {
      // Show OAuth dialog to connect account
      setShowOAuthDialog(true);
    } else {
      updateConfig('account', { cloudSync: false });
    }
  };

  const handleOAuthComplete = (profile: AuthProfile) => {
    console.log('OAuth completed:', profile);
    setShowOAuthDialog(false);
    updateConfig('account', { cloudSync: true });
  };

  const handleOAuthCancel = () => {
    setShowOAuthDialog(false);
  };

  const handleExportData = async () => {
    try {
      const data = await invoke('export_all_data');
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helix-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      alert('Failed to export data. Check console for details.');
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      // Delete all local data
      await invoke('delete_all_data');

      // Reset config
      updateConfig('account', {
        displayName: '',
        cloudSync: false,
        avatar: null,
      });

      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete data:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleResetHelix = async () => {
    if (window.confirm('This will reset Helix to factory settings, including all psychology data, memories, and configurations. This cannot be undone. Continue?')) {
      try {
        await invoke('factory_reset');
        // App will restart
      } catch (error) {
        console.error('Failed to reset:', error);
      }
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Account Settings</h1>
        <p>Manage your account and data</p>
      </header>

      <div className="settings-group">
        <h3>Profile</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Avatar</div>
            <div className="settings-item-description">
              Your profile picture
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--color-bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {config.account?.avatar ? (
                <img
                  src={config.account.avatar}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                '👤'
              )}
            </div>
            <button className="settings-button secondary" disabled>
              Upload (Coming Soon)
            </button>
          </div>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Display Name</div>
            <div className="settings-item-description">
              How Helix will address you
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="settings-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              style={{
                padding: '8px 12px',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                color: 'var(--color-text)',
                fontSize: '14px',
              }}
            />
            <button
              className="settings-button primary"
              onClick={handleSaveDisplayName}
              disabled={saving || displayName === config.account?.displayName}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>Helix Cloud</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Cloud Sync</div>
            <div className="settings-item-description">
              Sync your sessions and settings across devices
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isCloudConnected && (
              <span style={{ fontSize: '12px', color: 'var(--color-success)' }}>
                Connected
              </span>
            )}
            <label className="toggle">
              <input
                type="checkbox"
                checked={isCloudConnected}
                onChange={(e) => handleCloudSyncToggle(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {!isCloudConnected && (
          <div
            style={{
              padding: '16px',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              marginTop: '-4px',
            }}
          >
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Connect to Helix Cloud to sync your conversations, memories, and psychology data
              across all your devices. Your data is end-to-end encrypted.
            </p>
            <button
              className="settings-button primary"
              style={{ marginTop: '12px' }}
              onClick={() => setShowOAuthDialog(true)}
            >
              Sign in to Helix Cloud
            </button>
          </div>
        )}
      </div>

      <div className="settings-group">
        <h3>Data Management</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Export All Data</div>
            <div className="settings-item-description">
              Download all your data including conversations and memories
            </div>
          </div>
          <button className="settings-button secondary" onClick={handleExportData}>
            Export Data
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Delete Conversation History</div>
            <div className="settings-item-description">
              Remove all past conversations (keeps memories)
            </div>
          </div>
          <button
            className="settings-button danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete History
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Factory Reset</div>
            <div className="settings-item-description">
              Reset Helix to default state, removing all data
            </div>
          </div>
          <button
            className="settings-button danger"
            onClick={handleResetHelix}
          >
            Reset Helix
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '12px' }}>Delete Conversation History?</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              This will permanently delete all your conversations. Your memories and psychology
              data will be preserved. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="settings-button secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="settings-button danger"
                onClick={handleDeleteData}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOAuthDialog && (
        <OAuthFlowDialog
          provider="anthropic"
          onComplete={handleOAuthComplete}
          onCancel={handleOAuthCancel}
        />
      )}
    </div>
  );
}
