import { useConfigStore } from '../../stores/configStore';
import { useTheme } from '../../hooks/useTheme';

export function GeneralSettings() {
  const { config, updateConfig } = useConfigStore();
  const { theme, setTheme } = useTheme();

  const handleChange = (field: string, value: string | boolean) => {
    updateConfig('general', { [field]: value });
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>General Settings</h1>
        <p>Configure basic application behavior</p>
      </header>

      <div className="settings-group">
        <h3>Appearance</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Theme</div>
            <div className="settings-item-description">
              Choose light, dark, or system theme
            </div>
          </div>
          <select
            className="settings-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Language</div>
            <div className="settings-item-description">
              Interface language
            </div>
          </div>
          <select
            className="settings-select"
            value={config.general.language}
            onChange={(e) => handleChange('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="pt">Português</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h3>Behavior</h3>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Startup Behavior</div>
            <div className="settings-item-description">
              How Helix starts when launched
            </div>
          </div>
          <select
            className="settings-select"
            value={config.general.startupBehavior}
            onChange={(e) => handleChange('startupBehavior', e.target.value)}
          >
            <option value="normal">Normal Window</option>
            <option value="minimized">Minimized to Tray</option>
            <option value="maximized">Maximized</option>
          </select>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Close to Tray</div>
            <div className="settings-item-description">
              Minimize to system tray instead of quitting
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.general.closeToTray}
              onChange={(e) => handleChange('closeToTray', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-item-label">Check for Updates</div>
            <div className="settings-item-description">
              Automatically check for new versions
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.general.checkUpdates}
              onChange={(e) => handleChange('checkUpdates', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>
    </div>
  );
}
