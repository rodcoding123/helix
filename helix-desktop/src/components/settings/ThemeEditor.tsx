import { useState, useEffect } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import './ThemeEditor.css';

interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accentColor: string;
  accentHover: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
}

interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark' | 'custom';
  colors: ThemeColors;
  isBuiltIn: boolean;
  isActive?: boolean;
}

const DEFAULT_THEMES: Theme[] = [
  {
    id: 'helix-dark',
    name: 'Helix Dark',
    type: 'dark',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#0a0a0f',
      bgSecondary: '#111118',
      bgTertiary: '#1a1a24',
      textPrimary: '#ffffff',
      textSecondary: '#a0a0b0',
      textTertiary: '#606070',
      accentColor: '#6366f1',
      accentHover: '#4f46e5',
      borderColor: '#2a2a3a',
      successColor: '#22c55e',
      warningColor: '#eab308',
      errorColor: '#ef4444',
    },
  },
  {
    id: 'helix-light',
    name: 'Helix Light',
    type: 'light',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8f9fa',
      bgTertiary: '#e9ecef',
      textPrimary: '#1a1a2e',
      textSecondary: '#4a4a5a',
      textTertiary: '#8a8a9a',
      accentColor: '#6366f1',
      accentHover: '#4f46e5',
      borderColor: '#dee2e6',
      successColor: '#16a34a',
      warningColor: '#ca8a04',
      errorColor: '#dc2626',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    type: 'dark',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#161b22',
      bgTertiary: '#21262d',
      textPrimary: '#c9d1d9',
      textSecondary: '#8b949e',
      textTertiary: '#484f58',
      accentColor: '#58a6ff',
      accentHover: '#1f6feb',
      borderColor: '#30363d',
      successColor: '#3fb950',
      warningColor: '#d29922',
      errorColor: '#f85149',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    type: 'dark',
    isBuiltIn: true,
    colors: {
      bgPrimary: '#1e1e2e',
      bgSecondary: '#181825',
      bgTertiary: '#313244',
      textPrimary: '#cdd6f4',
      textSecondary: '#a6adc8',
      textTertiary: '#6c7086',
      accentColor: '#cba6f7',
      accentHover: '#b4befe',
      borderColor: '#45475a',
      successColor: '#a6e3a1',
      warningColor: '#f9e2af',
      errorColor: '#f38ba8',
    },
  },
];

const COLOR_LABELS: Record<keyof ThemeColors, string> = {
  bgPrimary: 'Background Primary',
  bgSecondary: 'Background Secondary',
  bgTertiary: 'Background Tertiary',
  textPrimary: 'Text Primary',
  textSecondary: 'Text Secondary',
  textTertiary: 'Text Tertiary',
  accentColor: 'Accent Color',
  accentHover: 'Accent Hover',
  borderColor: 'Border Color',
  successColor: 'Success Color',
  warningColor: 'Warning Color',
  errorColor: 'Error Color',
};

export function ThemeEditor() {
  const [themes, setThemes] = useState<Theme[]>(DEFAULT_THEMES);
  const [activeTheme, setActiveTheme] = useState<string>('helix-dark');
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [showNewThemeModal, setShowNewThemeModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    const client = getGatewayClient();
    if (client?.connected) {
      // Load from backend
    }
  };

  const applyTheme = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;

    setActiveTheme(themeId);

    // Apply CSS variables
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });
  };

  const startEditing = (theme: Theme) => {
    setEditingTheme({ ...theme, colors: { ...theme.colors } });
  };

  const updateColor = (key: keyof ThemeColors, value: string) => {
    if (!editingTheme) return;
    setEditingTheme({
      ...editingTheme,
      colors: { ...editingTheme.colors, [key]: value },
    });
  };

  const saveTheme = () => {
    if (!editingTheme) return;

    if (editingTheme.isBuiltIn) {
      // Create a custom copy
      const customTheme: Theme = {
        ...editingTheme,
        id: `${editingTheme.id}-custom-${Date.now()}`,
        name: `${editingTheme.name} (Custom)`,
        type: 'custom',
        isBuiltIn: false,
      };
      setThemes(prev => [...prev, customTheme]);
      applyTheme(customTheme.id);
    } else {
      setThemes(prev => prev.map(t => t.id === editingTheme.id ? editingTheme : t));
      if (activeTheme === editingTheme.id) {
        applyTheme(editingTheme.id);
      }
    }
    setEditingTheme(null);
  };

  const createNewTheme = () => {
    if (!newThemeName.trim()) return;

    const baseTheme = themes.find(t => t.id === activeTheme) || themes[0];
    const newTheme: Theme = {
      id: `custom-${Date.now()}`,
      name: newThemeName.trim(),
      type: 'custom',
      isBuiltIn: false,
      colors: { ...baseTheme.colors },
    };

    setThemes(prev => [...prev, newTheme]);
    setNewThemeName('');
    setShowNewThemeModal(false);
    startEditing(newTheme);
  };

  const deleteTheme = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (!theme || theme.isBuiltIn) return;

    setThemes(prev => prev.filter(t => t.id !== themeId));
    if (activeTheme === themeId) {
      applyTheme('helix-dark');
    }
  };

  const exportTheme = (theme: Theme) => {
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="theme-editor">
      <div className="theme-header">
        <div className="header-title">
          <span className="header-icon">🎨</span>
          <h2>Theme Editor</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn-primary btn-sm"
            onClick={() => setShowNewThemeModal(true)}
          >
            + New Theme
          </button>
        </div>
      </div>

      <div className="theme-content">
        <div className="theme-sidebar">
          <h3>Themes</h3>
          <div className="theme-list">
            {themes.map(theme => (
              <div
                key={theme.id}
                className={`theme-item ${activeTheme === theme.id ? 'active' : ''}`}
                onClick={() => applyTheme(theme.id)}
              >
                <div className="theme-preview">
                  <div
                    className="preview-swatch"
                    style={{ background: theme.colors.bgPrimary }}
                  >
                    <div
                      className="preview-accent"
                      style={{ background: theme.colors.accentColor }}
                    />
                  </div>
                </div>
                <div className="theme-info">
                  <span className="theme-name">{theme.name}</span>
                  <span className="theme-type">
                    {theme.isBuiltIn ? 'Built-in' : 'Custom'}
                  </span>
                </div>
                <div className="theme-actions">
                  <button
                    className="action-btn"
                    onClick={(e) => { e.stopPropagation(); startEditing(theme); }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => { e.stopPropagation(); exportTheme(theme); }}
                    title="Export"
                  >
                    📤
                  </button>
                  {!theme.isBuiltIn && (
                    <button
                      className="action-btn delete"
                      onClick={(e) => { e.stopPropagation(); deleteTheme(theme.id); }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="theme-editor-panel">
          {editingTheme ? (
            <>
              <div className="editor-header">
                <h3>Editing: {editingTheme.name}</h3>
                {editingTheme.isBuiltIn && (
                  <span className="builtin-notice">
                    Changes will be saved as a new custom theme
                  </span>
                )}
              </div>
              <div className="color-grid">
                {(Object.keys(editingTheme.colors) as Array<keyof ThemeColors>).map(key => (
                  <div key={key} className="color-field">
                    <label>{COLOR_LABELS[key]}</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={editingTheme.colors[key]}
                        onChange={(e) => updateColor(key, e.target.value)}
                      />
                      <input
                        type="text"
                        value={editingTheme.colors[key]}
                        onChange={(e) => updateColor(key, e.target.value)}
                        pattern="^#[0-9A-Fa-f]{6}$"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="editor-preview">
                <h4>Preview</h4>
                <div
                  className="preview-container"
                  style={{
                    '--preview-bg': editingTheme.colors.bgPrimary,
                    '--preview-bg-secondary': editingTheme.colors.bgSecondary,
                    '--preview-text': editingTheme.colors.textPrimary,
                    '--preview-text-secondary': editingTheme.colors.textSecondary,
                    '--preview-accent': editingTheme.colors.accentColor,
                    '--preview-border': editingTheme.colors.borderColor,
                  } as React.CSSProperties}
                >
                  <div className="preview-header">
                    <span>Helix Desktop</span>
                    <div className="preview-dots">
                      <span style={{ background: editingTheme.colors.errorColor }} />
                      <span style={{ background: editingTheme.colors.warningColor }} />
                      <span style={{ background: editingTheme.colors.successColor }} />
                    </div>
                  </div>
                  <div className="preview-sidebar">
                    <div className="preview-nav-item active">Dashboard</div>
                    <div className="preview-nav-item">Settings</div>
                    <div className="preview-nav-item">Chat</div>
                  </div>
                  <div className="preview-main">
                    <div className="preview-card">Sample content</div>
                    <button className="preview-button">Action</button>
                  </div>
                </div>
              </div>
              <div className="editor-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setEditingTheme(null)}
                >
                  Cancel
                </button>
                <button className="btn-primary" onClick={saveTheme}>
                  {editingTheme.isBuiltIn ? 'Save as Custom' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : (
            <div className="no-editing">
              <div className="no-editing-icon">🎨</div>
              <p>Select a theme to preview or click edit to customize</p>
            </div>
          )}
        </div>
      </div>

      {showNewThemeModal && (
        <div className="modal-overlay" onClick={() => setShowNewThemeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Theme</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewThemeModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field">
                <label>Theme Name</label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="My Custom Theme"
                  autoFocus
                />
              </div>
              <p className="form-hint">
                The new theme will be based on the currently active theme.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowNewThemeModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={createNewTheme}
                disabled={!newThemeName.trim()}
              >
                Create Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
