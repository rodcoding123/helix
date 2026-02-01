import { useState, useEffect } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';
import './KeyboardShortcuts.css';

interface Shortcut {
  id: string;
  action: string;
  category: string;
  keys: string[];
  description: string;
  isCustom?: boolean;
}

interface ShortcutCategory {
  id: string;
  name: string;
  icon: string;
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  { id: 'general', name: 'General', icon: '⌨️' },
  { id: 'chat', name: 'Chat', icon: '💬' },
  { id: 'editor', name: 'Editor', icon: '📝' },
  { id: 'navigation', name: 'Navigation', icon: '🧭' },
  { id: 'files', name: 'Files', icon: '📁' },
  { id: 'tools', name: 'Tools', icon: '🔧' },
];

const DEFAULT_SHORTCUTS: Shortcut[] = [
  // General
  { id: 'new-chat', action: 'New Chat', category: 'general', keys: ['Ctrl', 'N'], description: 'Start a new chat session' },
  { id: 'settings', action: 'Open Settings', category: 'general', keys: ['Ctrl', ','], description: 'Open settings panel' },
  { id: 'command-palette', action: 'Command Palette', category: 'general', keys: ['Ctrl', 'Shift', 'P'], description: 'Open command palette' },
  { id: 'toggle-sidebar', action: 'Toggle Sidebar', category: 'general', keys: ['Ctrl', 'B'], description: 'Show/hide sidebar' },
  { id: 'fullscreen', action: 'Toggle Fullscreen', category: 'general', keys: ['F11'], description: 'Toggle fullscreen mode' },
  { id: 'quit', action: 'Quit Application', category: 'general', keys: ['Ctrl', 'Q'], description: 'Close the application' },

  // Chat
  { id: 'send-message', action: 'Send Message', category: 'chat', keys: ['Enter'], description: 'Send the current message' },
  { id: 'new-line', action: 'New Line', category: 'chat', keys: ['Shift', 'Enter'], description: 'Add a new line in message' },
  { id: 'cancel-generation', action: 'Cancel Generation', category: 'chat', keys: ['Escape'], description: 'Stop AI response generation' },
  { id: 'regenerate', action: 'Regenerate Response', category: 'chat', keys: ['Ctrl', 'Shift', 'R'], description: 'Regenerate last AI response' },
  { id: 'copy-last', action: 'Copy Last Response', category: 'chat', keys: ['Ctrl', 'Shift', 'C'], description: 'Copy last AI response to clipboard' },
  { id: 'clear-chat', action: 'Clear Chat', category: 'chat', keys: ['Ctrl', 'Shift', 'Delete'], description: 'Clear current chat history' },

  // Editor
  { id: 'copy', action: 'Copy', category: 'editor', keys: ['Ctrl', 'C'], description: 'Copy selected text' },
  { id: 'paste', action: 'Paste', category: 'editor', keys: ['Ctrl', 'V'], description: 'Paste from clipboard' },
  { id: 'cut', action: 'Cut', category: 'editor', keys: ['Ctrl', 'X'], description: 'Cut selected text' },
  { id: 'undo', action: 'Undo', category: 'editor', keys: ['Ctrl', 'Z'], description: 'Undo last action' },
  { id: 'redo', action: 'Redo', category: 'editor', keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo last undone action' },
  { id: 'select-all', action: 'Select All', category: 'editor', keys: ['Ctrl', 'A'], description: 'Select all text' },
  { id: 'find', action: 'Find', category: 'editor', keys: ['Ctrl', 'F'], description: 'Find in current view' },
  { id: 'find-replace', action: 'Find & Replace', category: 'editor', keys: ['Ctrl', 'H'], description: 'Find and replace text' },

  // Navigation
  { id: 'go-home', action: 'Go to Home', category: 'navigation', keys: ['Ctrl', 'Home'], description: 'Navigate to home screen' },
  { id: 'go-back', action: 'Go Back', category: 'navigation', keys: ['Alt', 'Left'], description: 'Go to previous view' },
  { id: 'go-forward', action: 'Go Forward', category: 'navigation', keys: ['Alt', 'Right'], description: 'Go to next view' },
  { id: 'focus-chat', action: 'Focus Chat Input', category: 'navigation', keys: ['Ctrl', 'L'], description: 'Focus the chat input field' },
  { id: 'next-session', action: 'Next Session', category: 'navigation', keys: ['Ctrl', 'Tab'], description: 'Switch to next session' },
  { id: 'prev-session', action: 'Previous Session', category: 'navigation', keys: ['Ctrl', 'Shift', 'Tab'], description: 'Switch to previous session' },

  // Files
  { id: 'open-file', action: 'Open File', category: 'files', keys: ['Ctrl', 'O'], description: 'Open a file' },
  { id: 'save-file', action: 'Save File', category: 'files', keys: ['Ctrl', 'S'], description: 'Save current file' },
  { id: 'save-as', action: 'Save As', category: 'files', keys: ['Ctrl', 'Shift', 'S'], description: 'Save file with new name' },
  { id: 'close-file', action: 'Close File', category: 'files', keys: ['Ctrl', 'W'], description: 'Close current file' },
  { id: 'file-explorer', action: 'File Explorer', category: 'files', keys: ['Ctrl', 'Shift', 'E'], description: 'Open file explorer' },

  // Tools
  { id: 'run-tool', action: 'Run Tool', category: 'tools', keys: ['Ctrl', 'Enter'], description: 'Execute selected tool' },
  { id: 'tool-history', action: 'Tool History', category: 'tools', keys: ['Ctrl', 'Shift', 'H'], description: 'View tool execution history' },
  { id: 'mcp-servers', action: 'MCP Servers', category: 'tools', keys: ['Ctrl', 'Shift', 'M'], description: 'Manage MCP servers' },
  { id: 'toggle-terminal', action: 'Toggle Terminal', category: 'tools', keys: ['Ctrl', '`'], description: 'Show/hide terminal' },
  { id: 'dev-tools', action: 'Developer Tools', category: 'tools', keys: ['F12'], description: 'Open developer tools' },
];

export function KeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKeys, setRecordingKeys] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadShortcuts();
  }, []);

  useEffect(() => {
    if (editingId) {
      const handleKeyDown = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const key = getKeyName(e);
        if (key && !recordingKeys.includes(key)) {
          setRecordingKeys(prev => [...prev, key]);
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Only save if we have at least one non-modifier key
        const hasNonModifier = recordingKeys.some(k =>
          !['Ctrl', 'Alt', 'Shift', 'Meta'].includes(k)
        );

        if (hasNonModifier && recordingKeys.length > 0) {
          saveShortcut(editingId, recordingKeys);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [editingId, recordingKeys]);

  const getKeyName = (e: KeyboardEvent): string | null => {
    if (e.key === 'Control') return 'Ctrl';
    if (e.key === 'Alt') return 'Alt';
    if (e.key === 'Shift') return 'Shift';
    if (e.key === 'Meta') return 'Meta';
    if (e.key === ' ') return 'Space';
    if (e.key === 'Escape') return 'Escape';
    if (e.key === 'Enter') return 'Enter';
    if (e.key === 'Backspace') return 'Backspace';
    if (e.key === 'Delete') return 'Delete';
    if (e.key === 'Tab') return 'Tab';
    if (e.key === 'ArrowUp') return 'Up';
    if (e.key === 'ArrowDown') return 'Down';
    if (e.key === 'ArrowLeft') return 'Left';
    if (e.key === 'ArrowRight') return 'Right';
    if (e.key === 'Home') return 'Home';
    if (e.key === 'End') return 'End';
    if (e.key === 'PageUp') return 'PageUp';
    if (e.key === 'PageDown') return 'PageDown';
    if (e.key.startsWith('F') && e.key.length <= 3) return e.key;
    if (e.key.length === 1) return e.key.toUpperCase();
    return null;
  };

  const loadShortcuts = async () => {
    const client = getGatewayClient();
    if (client?.connected) {
      // Load from backend
    }
    // Use defaults for now
  };

  const saveShortcut = (id: string, keys: string[]) => {
    // Sort modifiers first
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
    const sorted = [...keys].sort((a, b) => {
      const aIdx = modifiers.indexOf(a);
      const bIdx = modifiers.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

    setShortcuts(prev => prev.map(s =>
      s.id === id ? { ...s, keys: sorted, isCustom: true } : s
    ));
    setEditingId(null);
    setRecordingKeys([]);
    setHasChanges(true);
  };

  const startEditing = (id: string) => {
    setEditingId(id);
    setRecordingKeys([]);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setRecordingKeys([]);
  };

  const resetShortcut = (id: string) => {
    const defaultShortcut = DEFAULT_SHORTCUTS.find(s => s.id === id);
    if (defaultShortcut) {
      setShortcuts(prev => prev.map(s =>
        s.id === id ? { ...defaultShortcut } : s
      ));
      setHasChanges(true);
    }
  };

  const resetAllShortcuts = () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    setHasChanges(true);
  };

  const saveAllShortcuts = async () => {
    const client = getGatewayClient();
    if (client?.connected) {
      // Save to backend
    }
    setHasChanges(false);
  };

  const filteredShortcuts = shortcuts.filter(s => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      s.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatKeys = (keys: string[]) => {
    return keys.map((key, i) => (
      <span key={i}>
        <kbd className="key">{key}</kbd>
        {i < keys.length - 1 && <span className="key-separator">+</span>}
      </span>
    ));
  };

  return (
    <div className="keyboard-shortcuts">
      <div className="shortcuts-header">
        <div className="header-title">
          <span className="header-icon">⌨️</span>
          <h2>Keyboard Shortcuts</h2>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary btn-sm"
            onClick={resetAllShortcuts}
          >
            Reset All
          </button>
          <button
            className="btn-primary btn-sm"
            disabled={!hasChanges}
            onClick={saveAllShortcuts}
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="shortcuts-toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="shortcuts-content">
        <div className="category-tabs">
          <button
            className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <span className="tab-icon">🔍</span>
            <span className="tab-label">All</span>
          </button>
          {SHORTCUT_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              <span className="tab-icon">{cat.icon}</span>
              <span className="tab-label">{cat.name}</span>
            </button>
          ))}
        </div>

        <div className="shortcuts-list">
          {filteredShortcuts.length === 0 ? (
            <div className="no-shortcuts">
              <p>No shortcuts found</p>
            </div>
          ) : (
            filteredShortcuts.map(shortcut => (
              <div
                key={shortcut.id}
                className={`shortcut-item ${editingId === shortcut.id ? 'editing' : ''} ${shortcut.isCustom ? 'custom' : ''}`}
              >
                <div className="shortcut-info">
                  <span className="shortcut-action">{shortcut.action}</span>
                  <span className="shortcut-description">{shortcut.description}</span>
                </div>
                <div className="shortcut-keys">
                  {editingId === shortcut.id ? (
                    <div className="key-recorder">
                      {recordingKeys.length > 0 ? (
                        formatKeys(recordingKeys)
                      ) : (
                        <span className="recording-hint">Press keys...</span>
                      )}
                    </div>
                  ) : (
                    <>
                      {formatKeys(shortcut.keys)}
                      {shortcut.isCustom && (
                        <span className="custom-badge">Modified</span>
                      )}
                    </>
                  )}
                </div>
                <div className="shortcut-actions">
                  {editingId === shortcut.id ? (
                    <>
                      <button
                        className="action-btn cancel"
                        onClick={cancelEditing}
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="action-btn edit"
                        onClick={() => startEditing(shortcut.id)}
                        title="Edit shortcut"
                      >
                        ✏️
                      </button>
                      {shortcut.isCustom && (
                        <button
                          className="action-btn reset"
                          onClick={() => resetShortcut(shortcut.id)}
                          title="Reset to default"
                        >
                          ↺
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="shortcuts-footer">
        <div className="footer-info">
          <span className="info-icon">ℹ️</span>
          <span>Click edit to record a new shortcut. Press Escape to cancel.</span>
        </div>
      </div>
    </div>
  );
}
