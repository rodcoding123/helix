import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { useConfigStore, type AdvancedConfig } from '../../stores/configStore';

export function AdvancedSettings() {
  const { config, updateConfig, resetConfig } = useConfigStore();
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [exportingConfig, setExportingConfig] = useState(false);
  const [importingConfig, setImportingConfig] = useState(false);

  const handleLogLevelChange = (level: string) => {
    updateConfig('advanced', { logLevel: level as AdvancedConfig['logLevel'] });
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheCleared(false);

    try {
      await invoke('clear_cache');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setClearingCache(false);
    }
  };

  const handleExportConfig = async () => {
    setExportingConfig(true);

    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'helix-config.json',
      });

      if (filePath) {
        const configJson = JSON.stringify(config, null, 2);
        await writeTextFile(filePath, configJson);
      }
    } catch (error) {
      console.error('Failed to export config:', error);
    } finally {
      setExportingConfig(false);
    }
  };

  const handleImportConfig = async () => {
    setImportingConfig(true);

    try {
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      });

      if (filePath && typeof filePath === 'string') {
        const configJson = await readTextFile(filePath);
        const importedConfig = JSON.parse(configJson);

        // Validate basic structure before importing
        if (importedConfig && typeof importedConfig === 'object') {
          // Merge imported config
          Object.keys(importedConfig).forEach((section) => {
            updateConfig(section as keyof typeof config, importedConfig[section]);
          });
        }
      }
    } catch (error) {
      console.error('Failed to import config:', error);
    } finally {
      setImportingConfig(false);
    }
  };

  const handleResetConfig = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      resetConfig();
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Advanced Settings</h1>
        <p>Power user options and diagnostics</p>
      </header>

      <div className="settings-group">
        <h3>Logging</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Log Level</div>
            <div className="settings-item-description">
              Control the verbosity of application logs
            </div>
          </div>
          <select
            className="settings-select"
            value={config.advanced?.logLevel ?? 'info'}
            onChange={(e) => handleLogLevelChange(e.target.value)}
          >
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
            <option value="trace">Trace</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h3>Developer</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Developer Mode</div>
            <div className="settings-item-description">
              Enable developer tools and additional debugging features
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.advanced?.developerMode ?? false}
              onChange={(e) => updateConfig('advanced', { developerMode: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Show Thinking</div>
            <div className="settings-item-description">
              Display Claude's extended thinking in responses
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.advanced?.showThinking ?? true}
              onChange={(e) => updateConfig('advanced', { showThinking: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Show Tool Calls</div>
            <div className="settings-item-description">
              Display tool call details during execution
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.advanced?.showToolCalls ?? true}
              onChange={(e) => updateConfig('advanced', { showToolCalls: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="settings-group">
        <h3>Cache</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Clear Cache</div>
            <div className="settings-item-description">
              Remove cached data and temporary files
            </div>
          </div>
          <button
            className="settings-button secondary"
            onClick={handleClearCache}
            disabled={clearingCache}
          >
            {clearingCache ? 'Clearing...' : cacheCleared ? 'Cleared!' : 'Clear Cache'}
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h3>Configuration</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Export Configuration</div>
            <div className="settings-item-description">
              Save your settings to a JSON file
            </div>
          </div>
          <button
            className="settings-button secondary"
            onClick={handleExportConfig}
            disabled={exportingConfig}
          >
            {exportingConfig ? 'Exporting...' : 'Export'}
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Import Configuration</div>
            <div className="settings-item-description">
              Load settings from a previously exported file
            </div>
          </div>
          <button
            className="settings-button secondary"
            onClick={handleImportConfig}
            disabled={importingConfig}
          >
            {importingConfig ? 'Importing...' : 'Import'}
          </button>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Reset to Defaults</div>
            <div className="settings-item-description">
              Reset all settings to their default values
            </div>
          </div>
          <button
            className="settings-button danger"
            onClick={handleResetConfig}
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
