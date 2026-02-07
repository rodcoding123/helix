import { useState } from 'react';
import { invoke } from '../../lib/tauri-compat';
import { useConfigStore, type PrivacyConfig } from '../../stores/configStore';

export function PrivacySettings() {
  const { config, updateConfig } = useConfigStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleChange = (field: keyof PrivacyConfig, value: boolean) => {
    updateConfig('privacy', { [field]: value });
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

  const handleClearData = async () => {
    try {
      await invoke('delete_all_data');
      alert('All local data cleared successfully.');
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data. Check console for details.');
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Privacy Settings</h1>
        <p>Control data collection and storage</p>
      </header>

      <div className="settings-group">
        <h3>Data Collection</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Usage Telemetry</div>
            <div className="settings-item-description">
              Send anonymous usage statistics to improve Helix
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.privacy.telemetryEnabled}
              onChange={(e) => handleChange('telemetryEnabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Analytics</div>
            <div className="settings-item-description">
              Help us understand how features are used
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.privacy.analyticsEnabled}
              onChange={(e) => handleChange('analyticsEnabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Crash Reporting</div>
            <div className="settings-item-description">
              Automatically send crash reports to help fix bugs
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.privacy.crashReportingEnabled}
              onChange={(e) => handleChange('crashReportingEnabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>Data Storage</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Local Storage Only</div>
            <div className="settings-item-description">
              Keep all data on your device, never sync to cloud
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.privacy.localStorageOnly}
              onChange={(e) => handleChange('localStorageOnly', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>Data Management</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Export Data</div>
            <div className="settings-item-description">
              Download all your Helix data as JSON
            </div>
          </div>
          <button className="secondary-button" onClick={handleExportData}>
            Export
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Clear All Data</div>
            <div className="settings-item-description">
              Permanently delete all local data and conversations
            </div>
          </div>
          <button className="secondary-button" style={{ color: 'var(--color-error)' }} onClick={() => setShowClearConfirm(true)}>
            Clear Data
          </button>
        </div>
      </div>

      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Clear All Data</h2>
            <p>This will permanently delete:</p>
            <ul>
              <li>All conversation history</li>
              <li>All memory entries</li>
              <li>All psychology data</li>
              <li>All settings and configurations</li>
            </ul>
            <p style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>
              This action cannot be undone!
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </button>
              <button className="danger-button" onClick={handleClearData}>
                Yes, Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
