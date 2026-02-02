import { useConfigStore, type PrivacyConfig } from '../../stores/configStore';

export function PrivacySettings() {
  const { config, updateConfig } = useConfigStore();

  const handleChange = (field: keyof PrivacyConfig, value: boolean) => {
    updateConfig('privacy', { [field]: value });
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
          <button className="secondary-button">
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
          <button className="secondary-button" style={{ color: 'var(--color-error)' }}>
            Clear Data
          </button>
        </div>
      </div>
    </div>
  );
}
