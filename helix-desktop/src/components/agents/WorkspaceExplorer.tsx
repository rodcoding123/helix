/**
 * Workspace Explorer - File browser + editor for agent workspace bootstrap files
 *
 * Provides a two-panel layout: file tree on the left, monospace editor on the right.
 * Uses Tauri invoke commands for all file system operations:
 *   - list_directory  -> enumerate workspace files
 *   - read_file       -> load file content into editor
 *   - write_file      -> persist editor changes
 *   - file_exists     -> check file presence before operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceExplorerProps {
  workspacePath: string;
  agentName: string;
  onClose?: () => void;
}

interface DirectoryEntry {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  modified: number | null;
}

interface BootstrapFile {
  name: string;
  label: string;
  icon: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOOTSTRAP_FILES: BootstrapFile[] = [
  { name: 'AGENTS.md', label: 'Agents', icon: '\u{1F916}', description: 'Agent personas and capabilities' },
  { name: 'SOUL.md', label: 'Soul', icon: '\u{2728}', description: 'Core identity and values' },
  { name: 'TOOLS.md', label: 'Tools', icon: '\u{1F527}', description: 'Available tools and usage' },
  { name: 'USER.md', label: 'User', icon: '\u{1F464}', description: 'User profile and preferences' },
  { name: 'IDENTITY.md', label: 'Identity', icon: '\u{1F3AD}', description: 'Agent identity definition' },
  { name: 'BOOTSTRAP.md', label: 'Bootstrap', icon: '\u{1F680}', description: 'Initialization instructions' },
  { name: 'MEMORY.md', label: 'Memory', icon: '\u{1F9E0}', description: 'Long-term memory' },
];

const BOOTSTRAP_FILE_NAMES = new Set(BOOTSTRAP_FILES.map((f) => f.name));

const DEFAULT_CONTENTS: Record<string, string> = {
  'AGENTS.md': `# Agents

Define the agent personas available in this workspace.

## Default Agent

- **Name**: Assistant
- **Role**: General-purpose AI assistant
- **Capabilities**: Code analysis, writing, problem-solving
`,
  'SOUL.md': `# Soul

Core identity and values for this agent.

## Identity

You are a helpful AI assistant with a commitment to accuracy and transparency.

## Values

- Honesty and directness
- Thoughtful analysis
- Respect for the user's intent
`,
  'TOOLS.md': `# Tools

Available tools and their usage guidelines.

## File Operations
- **Read**: Read file contents
- **Write**: Write to files
- **Edit**: Make targeted edits
- **Glob**: Search for files by pattern
- **Grep**: Search file contents

## System
- **Bash**: Execute shell commands
- **WebFetch**: Fetch web content
- **WebSearch**: Search the web
`,
  'USER.md': `# User Profile

Information about the user this agent serves.

## Preferences

- Communication style: Direct and concise
- Technical level: Advanced
`,
  'IDENTITY.md': `# Agent Identity

## Name

Assistant

## Description

A general-purpose AI agent configured for this workspace.

## Tone

Professional, helpful, and direct.
`,
  'BOOTSTRAP.md': `# Bootstrap

Initialization instructions loaded at agent startup.

## Startup Sequence

1. Load identity and soul files
2. Review user preferences
3. Check available tools
4. Initialize memory context
`,
  'MEMORY.md': `# Memory

Long-term memory and context for this agent.

## Session History

No sessions recorded yet.

## Key Facts

Add important facts and context here that should persist across sessions.
`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the BootstrapFile definition for a given filename, or null if not a known bootstrap file. */
function getBootstrapInfo(filename: string): BootstrapFile | null {
  return BOOTSTRAP_FILES.find((bf) => bf.name === filename) ?? null;
}

/** Sort files: known bootstrap files first (in defined order), then alphabetical. */
function sortWorkspaceFiles(files: string[]): string[] {
  const bootstrapOrder = new Map(BOOTSTRAP_FILES.map((bf, idx) => [bf.name, idx]));

  return [...files].sort((a, b) => {
    const aIdx = bootstrapOrder.get(a);
    const bIdx = bootstrapOrder.get(b);

    // Both are bootstrap files: sort by defined order
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    // Only a is bootstrap
    if (aIdx !== undefined) return -1;
    // Only b is bootstrap
    if (bIdx !== undefined) return 1;
    // Neither: alphabetical
    return a.localeCompare(b);
  });
}

/** Normalise path separators (Windows backslash -> forward slash for display, but keep original for invoke). */
function displayPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Join path segments. Handles both Windows and Unix separators. */
function joinPath(base: string, child: string): string {
  const sep = base.includes('\\') ? '\\' : '/';
  const trimmed = base.endsWith(sep) ? base.slice(0, -1) : base;
  return `${trimmed}${sep}${child}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceExplorer({ workspacePath, agentName, onClose }: WorkspaceExplorerProps) {
  // File list state
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Editor state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fileNotFound, setFileNotFound] = useState(false);

  // New file dialog
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileError, setNewFileError] = useState<string | null>(null);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const isModified = editorContent !== savedContent;

  // ---------------------------------------------------------------------------
  // Load directory listing
  // ---------------------------------------------------------------------------

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const entries = await invoke<DirectoryEntry[]>('list_directory', { path: workspacePath });
      const mdFiles = entries
        .filter((e) => !e.is_directory && e.name.endsWith('.md'))
        .map((e) => e.name);
      setFiles(sortWorkspaceFiles(mdFiles));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setListError(message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // ---------------------------------------------------------------------------
  // Load file content
  // ---------------------------------------------------------------------------

  const loadFile = useCallback(async (filename: string) => {
    setSelectedFile(filename);
    setFileLoading(true);
    setFileError(null);
    setFileNotFound(false);
    setSaveSuccess(false);
    setShowResetConfirm(false);

    const filePath = joinPath(workspacePath, filename);

    try {
      const exists = await invoke<boolean>('file_exists', { path: filePath });
      if (!exists) {
        setFileNotFound(true);
        setEditorContent('');
        setSavedContent('');
        setFileLoading(false);
        return;
      }

      const content = await invoke<string>('read_file', { path: filePath });
      setEditorContent(content);
      setSavedContent(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFileError(message);
      setEditorContent('');
      setSavedContent('');
    } finally {
      setFileLoading(false);
    }
  }, [workspacePath]);

  // ---------------------------------------------------------------------------
  // Save file
  // ---------------------------------------------------------------------------

  const saveFile = useCallback(async () => {
    if (!selectedFile || !isModified) return;

    setSaving(true);
    setFileError(null);
    setSaveSuccess(false);

    const filePath = joinPath(workspacePath, selectedFile);

    try {
      await invoke('write_file', { path: filePath, content: editorContent });
      setSavedContent(editorContent);
      setFileNotFound(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      // If this was a new file not yet in the list, refresh
      if (!files.includes(selectedFile)) {
        await loadFiles();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFileError(message);
    } finally {
      setSaving(false);
    }
  }, [selectedFile, isModified, editorContent, workspacePath, files, loadFiles]);

  // ---------------------------------------------------------------------------
  // Create file from "not found" state
  // ---------------------------------------------------------------------------

  const createFileWithDefault = useCallback(async (filename: string) => {
    const defaultContent = DEFAULT_CONTENTS[filename] ?? `# ${filename.replace('.md', '')}\n\n`;
    setEditorContent(defaultContent);
    setSavedContent(''); // Mark as modified so save button is active
    setFileNotFound(false);

    // Write immediately
    const filePath = joinPath(workspacePath, filename);
    try {
      await invoke('write_file', { path: filePath, content: defaultContent });
      setSavedContent(defaultContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      await loadFiles();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFileError(message);
    }
  }, [workspacePath, loadFiles]);

  // ---------------------------------------------------------------------------
  // New file
  // ---------------------------------------------------------------------------

  const handleNewFile = useCallback(async () => {
    let name = newFileName.trim();
    if (!name) {
      setNewFileError('File name is required');
      return;
    }

    // Ensure .md extension
    if (!name.endsWith('.md')) {
      name = `${name}.md`;
    }

    // Validate filename
    if (/[<>:"/\\|?*]/.test(name.replace('.md', ''))) {
      setNewFileError('File name contains invalid characters');
      return;
    }

    // Check if already exists
    if (files.includes(name)) {
      setNewFileError('File already exists');
      return;
    }

    const filePath = joinPath(workspacePath, name);
    const defaultContent = `# ${name.replace('.md', '')}\n\n`;

    try {
      await invoke('write_file', { path: filePath, content: defaultContent });
      setShowNewFile(false);
      setNewFileName('');
      setNewFileError(null);
      await loadFiles();
      // Select the new file
      loadFile(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setNewFileError(message);
    }
  }, [newFileName, files, workspacePath, loadFiles, loadFile]);

  // ---------------------------------------------------------------------------
  // Reset to defaults
  // ---------------------------------------------------------------------------

  const resetToDefault = useCallback(async () => {
    if (!selectedFile || !BOOTSTRAP_FILE_NAMES.has(selectedFile)) return;

    const defaultContent = DEFAULT_CONTENTS[selectedFile];
    if (!defaultContent) return;

    const filePath = joinPath(workspacePath, selectedFile);

    try {
      await invoke('write_file', { path: filePath, content: defaultContent });
      setEditorContent(defaultContent);
      setSavedContent(defaultContent);
      setShowResetConfirm(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFileError(message);
    }
  }, [selectedFile, workspacePath]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isModified && selectedFile) {
          saveFile();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModified, selectedFile, saveFile]);

  // Focus new file input when dialog opens
  useEffect(() => {
    if (showNewFile && newFileInputRef.current) {
      newFileInputRef.current.focus();
    }
  }, [showNewFile]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderFileItem = (filename: string) => {
    const bsInfo = getBootstrapInfo(filename);
    const isSelected = selectedFile === filename;

    return (
      <button
        key={filename}
        className={`we-file-item ${isSelected ? 'we-file-item--selected' : ''}`}
        onClick={() => loadFile(filename)}
        title={bsInfo ? bsInfo.description : filename}
      >
        <span className="we-file-item__icon">
          {bsInfo ? bsInfo.icon : '\u{1F4C4}'}
        </span>
        <div className="we-file-item__info">
          <span className="we-file-item__name">{filename}</span>
          {bsInfo && (
            <span className="we-file-item__label">{bsInfo.label}</span>
          )}
        </div>
      </button>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="we-container">
      {/* Header bar */}
      <div className="we-header">
        {onClose && (
          <button className="we-header__back" onClick={onClose} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        )}
        <div className="we-header__title-group">
          <span className="we-header__agent">{agentName}</span>
          <span className="we-header__path" title={workspacePath}>
            {displayPath(workspacePath)}
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className="we-layout">
        {/* Left panel: file tree */}
        <aside className="we-sidebar">
          <div className="we-sidebar__header">
            <span className="we-sidebar__title">Files</span>
          </div>

          <div className="we-sidebar__list">
            {loading ? (
              <div className="we-sidebar__loading">
                <div className="we-spinner" />
                <span>Loading files...</span>
              </div>
            ) : listError ? (
              <div className="we-sidebar__error">
                <span className="we-sidebar__error-icon">!</span>
                <span className="we-sidebar__error-text">{listError}</span>
                <button className="we-sidebar__retry" onClick={loadFiles} type="button">
                  Retry
                </button>
              </div>
            ) : files.length === 0 ? (
              <div className="we-sidebar__empty">
                <span className="we-sidebar__empty-text">No .md files found</span>
              </div>
            ) : (
              files.map(renderFileItem)
            )}
          </div>

          {/* New file button */}
          {!showNewFile ? (
            <button
              className="we-sidebar__new-btn"
              onClick={() => { setShowNewFile(true); setNewFileError(null); setNewFileName(''); }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M7 1v12M1 7h12" />
              </svg>
              New File
            </button>
          ) : (
            <div className="we-new-file">
              <input
                ref={newFileInputRef}
                className="we-new-file__input"
                value={newFileName}
                onChange={(e) => { setNewFileName(e.target.value); setNewFileError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNewFile();
                  if (e.key === 'Escape') { setShowNewFile(false); setNewFileName(''); setNewFileError(null); }
                }}
                placeholder="filename.md"
              />
              <div className="we-new-file__actions">
                <button
                  className="we-new-file__create"
                  onClick={handleNewFile}
                  type="button"
                >
                  Create
                </button>
                <button
                  className="we-new-file__cancel"
                  onClick={() => { setShowNewFile(false); setNewFileName(''); setNewFileError(null); }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              {newFileError && (
                <span className="we-new-file__error">{newFileError}</span>
              )}
            </div>
          )}

          {/* Reset defaults button */}
          {selectedFile && BOOTSTRAP_FILE_NAMES.has(selectedFile) && (
            <div className="we-sidebar__reset">
              {!showResetConfirm ? (
                <button
                  className="we-sidebar__reset-btn"
                  onClick={() => setShowResetConfirm(true)}
                  type="button"
                >
                  Reset Defaults
                </button>
              ) : (
                <div className="we-reset-confirm">
                  <span className="we-reset-confirm__text">
                    Reset {selectedFile} to default content?
                  </span>
                  <div className="we-reset-confirm__actions">
                    <button
                      className="we-reset-confirm__yes"
                      onClick={resetToDefault}
                      type="button"
                    >
                      Reset
                    </button>
                    <button
                      className="we-reset-confirm__no"
                      onClick={() => setShowResetConfirm(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right panel: editor */}
        <main className="we-editor">
          {!selectedFile ? (
            <div className="we-editor__empty">
              <div className="we-editor__empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <span className="we-editor__empty-text">
                Select a file to view and edit
              </span>
            </div>
          ) : fileLoading ? (
            <div className="we-editor__loading">
              <div className="we-spinner" />
              <span>Loading {selectedFile}...</span>
            </div>
          ) : fileNotFound ? (
            <div className="we-editor__not-found">
              <span className="we-editor__not-found-name">{selectedFile}</span>
              <span className="we-editor__not-found-text">
                This file does not exist yet in the workspace.
              </span>
              <button
                className="we-editor__create-btn"
                onClick={() => createFileWithDefault(selectedFile)}
                type="button"
              >
                Create with defaults
              </button>
            </div>
          ) : (
            <>
              {/* Editor header */}
              <div className="we-editor__header">
                <div className="we-editor__header-left">
                  <span className="we-editor__filename">
                    {(() => {
                      const bsInfo = getBootstrapInfo(selectedFile);
                      return bsInfo ? `${bsInfo.icon} ` : '';
                    })()}
                    {selectedFile}
                  </span>
                  {isModified && (
                    <span className="we-editor__modified-badge">Modified</span>
                  )}
                  {saveSuccess && (
                    <span className="we-editor__saved-badge">Saved</span>
                  )}
                </div>
                <button
                  className={`we-editor__save-btn ${isModified ? 'we-editor__save-btn--active' : ''}`}
                  onClick={saveFile}
                  disabled={!isModified || saving}
                  type="button"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Error banner */}
              {fileError && (
                <div className="we-editor__error">
                  <span>{fileError}</span>
                  <button
                    className="we-editor__error-dismiss"
                    onClick={() => setFileError(null)}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Textarea editor */}
              <textarea
                ref={textareaRef}
                className="we-editor__textarea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck={false}
              />

              {/* Footer */}
              <div className="we-editor__footer">
                <span className="we-editor__char-count">
                  {editorContent.length.toLocaleString()} characters
                </span>
                <span className="we-editor__line-count">
                  {editorContent.split('\n').length} lines
                </span>
                <span className="we-editor__shortcut">
                  Ctrl+S to save
                </span>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Scoped styles */}
      <style>{`
        /* =====================================================================
           Workspace Explorer - Scoped styles (we- prefix)
           ===================================================================== */

        .we-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0a0a1a;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ---- Header ---- */

        .we-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: #111127;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        .we-header__back {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.625rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #a0a0c0;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .we-header__back:hover {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.04);
        }

        .we-header__title-group {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }

        .we-header__agent {
          font-size: 0.875rem;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .we-header__path {
          font-size: 0.6875rem;
          color: #606080;
          font-family: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ---- Layout ---- */

        .we-layout {
          display: flex;
          flex: 1;
          min-height: 0;
        }

        /* ---- Sidebar ---- */

        .we-sidebar {
          width: 220px;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          background: #0e0e24;
          border-right: 1px solid rgba(255, 255, 255, 0.08);
        }

        .we-sidebar__header {
          padding: 0.75rem 0.875rem 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }

        .we-sidebar__title {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #606080;
        }

        .we-sidebar__list {
          flex: 1;
          overflow-y: auto;
          padding: 0.375rem 0;
        }

        .we-sidebar__list::-webkit-scrollbar {
          width: 4px;
        }
        .we-sidebar__list::-webkit-scrollbar-track {
          background: transparent;
        }
        .we-sidebar__list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
        }

        .we-sidebar__loading,
        .we-sidebar__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 2rem 1rem;
          color: #606080;
          font-size: 0.8125rem;
        }

        .we-sidebar__error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem 0.875rem;
          text-align: center;
        }

        .we-sidebar__error-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          font-size: 0.875rem;
          font-weight: 700;
        }

        .we-sidebar__error-text {
          font-size: 0.75rem;
          color: #ef4444;
          line-height: 1.4;
        }

        .we-sidebar__retry {
          font-size: 0.75rem;
          color: #6366f1;
          background: none;
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 4px;
          padding: 0.25rem 0.625rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .we-sidebar__retry:hover {
          background: rgba(99, 102, 241, 0.1);
        }

        /* File items */

        .we-file-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.875rem;
          background: none;
          border: none;
          border-left: 2px solid transparent;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.12s ease;
          color: #a0a0c0;
        }

        .we-file-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #ffffff;
        }

        .we-file-item--selected {
          background: rgba(99, 102, 241, 0.08);
          border-left-color: #6366f1;
          color: #ffffff;
        }

        .we-file-item--selected:hover {
          background: rgba(99, 102, 241, 0.12);
        }

        .we-file-item__icon {
          font-size: 0.9375rem;
          flex-shrink: 0;
          width: 20px;
          text-align: center;
        }

        .we-file-item__info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .we-file-item__name {
          font-size: 0.8125rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .we-file-item__label {
          font-size: 0.625rem;
          color: #606080;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .we-file-item--selected .we-file-item__label {
          color: #818cf8;
        }

        /* New file button */

        .we-sidebar__new-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          margin: 0.5rem 0.625rem;
          padding: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.06);
          border: 1px dashed rgba(99, 102, 241, 0.3);
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .we-sidebar__new-btn:hover {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.5);
        }

        /* New file form */

        .we-new-file {
          padding: 0.5rem 0.625rem;
          flex-shrink: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .we-new-file__input {
          width: 100%;
          padding: 0.375rem 0.5rem;
          font-size: 0.8125rem;
          color: #ffffff;
          background: #0a0a14;
          border: 1px solid rgba(99, 102, 241, 0.4);
          border-radius: 4px;
          font-family: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;
          outline: none;
          box-sizing: border-box;
        }

        .we-new-file__input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        }

        .we-new-file__input::placeholder {
          color: #606080;
        }

        .we-new-file__actions {
          display: flex;
          gap: 0.375rem;
          margin-top: 0.375rem;
        }

        .we-new-file__create,
        .we-new-file__cancel {
          flex: 1;
          padding: 0.3rem;
          font-size: 0.6875rem;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          border: none;
          transition: all 0.15s ease;
        }

        .we-new-file__create {
          color: #ffffff;
          background: #6366f1;
        }

        .we-new-file__create:hover {
          background: #5558e6;
        }

        .we-new-file__cancel {
          color: #a0a0c0;
          background: rgba(255, 255, 255, 0.06);
        }

        .we-new-file__cancel:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .we-new-file__error {
          display: block;
          margin-top: 0.375rem;
          font-size: 0.6875rem;
          color: #ef4444;
        }

        /* Reset defaults */

        .we-sidebar__reset {
          padding: 0.625rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }

        .we-sidebar__reset-btn {
          width: 100%;
          padding: 0.4375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #a0a0c0;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .we-sidebar__reset-btn:hover {
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.3);
          background: rgba(251, 191, 36, 0.06);
        }

        .we-reset-confirm {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .we-reset-confirm__text {
          font-size: 0.75rem;
          color: #fbbf24;
          line-height: 1.4;
        }

        .we-reset-confirm__actions {
          display: flex;
          gap: 0.375rem;
        }

        .we-reset-confirm__yes,
        .we-reset-confirm__no {
          flex: 1;
          padding: 0.3rem;
          font-size: 0.6875rem;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          border: none;
          transition: all 0.15s ease;
        }

        .we-reset-confirm__yes {
          color: #ffffff;
          background: #d97706;
        }

        .we-reset-confirm__yes:hover {
          background: #b45309;
        }

        .we-reset-confirm__no {
          color: #a0a0c0;
          background: rgba(255, 255, 255, 0.06);
        }

        .we-reset-confirm__no:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        /* ---- Editor ---- */

        .we-editor {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #0a0a1a;
        }

        .we-editor__empty,
        .we-editor__loading,
        .we-editor__not-found {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          color: #606080;
        }

        .we-editor__empty-icon {
          opacity: 0.3;
        }

        .we-editor__empty-text {
          font-size: 0.875rem;
          color: #606080;
        }

        .we-editor__not-found-name {
          font-size: 1rem;
          font-weight: 600;
          color: #a0a0c0;
          font-family: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;
        }

        .we-editor__not-found-text {
          font-size: 0.8125rem;
          color: #606080;
        }

        .we-editor__create-btn {
          margin-top: 0.5rem;
          padding: 0.5rem 1.25rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #ffffff;
          background: #6366f1;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .we-editor__create-btn:hover {
          background: #5558e6;
        }

        /* Editor header */

        .we-editor__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          flex-shrink: 0;
        }

        .we-editor__header-left {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          min-width: 0;
        }

        .we-editor__filename {
          font-size: 0.875rem;
          font-weight: 600;
          color: #ffffff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .we-editor__modified-badge {
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.12);
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .we-editor__saved-badge {
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #4ade80;
          background: rgba(74, 222, 128, 0.12);
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          flex-shrink: 0;
          animation: we-fade-in 0.2s ease;
        }

        @keyframes we-fade-in {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .we-editor__save-btn {
          padding: 0.375rem 0.875rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #606080;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          cursor: not-allowed;
          font-family: inherit;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .we-editor__save-btn--active {
          color: #ffffff;
          background: #6366f1;
          border-color: #6366f1;
          cursor: pointer;
        }

        .we-editor__save-btn--active:hover {
          background: #5558e6;
        }

        .we-editor__save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Error banner */

        .we-editor__error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          background: rgba(239, 68, 68, 0.08);
          border-bottom: 1px solid rgba(239, 68, 68, 0.2);
          font-size: 0.8125rem;
          color: #ef4444;
          flex-shrink: 0;
        }

        .we-editor__error-dismiss {
          font-size: 0.75rem;
          color: #ef4444;
          background: none;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          padding: 0.15rem 0.5rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s ease;
        }

        .we-editor__error-dismiss:hover {
          background: rgba(239, 68, 68, 0.12);
        }

        /* Textarea */

        .we-editor__textarea {
          flex: 1;
          width: 100%;
          padding: 1rem;
          font-family: 'JetBrains Mono', 'Consolas', 'SF Mono', 'Menlo', 'Monaco', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #e0e0f0;
          background: #0a0a14;
          border: none;
          outline: none;
          resize: none;
          tab-size: 2;
          box-sizing: border-box;
        }

        .we-editor__textarea::placeholder {
          color: #606080;
        }

        .we-editor__textarea::-webkit-scrollbar {
          width: 8px;
        }
        .we-editor__textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        .we-editor__textarea::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }
        .we-editor__textarea::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        /* Footer */

        .we-editor__footer {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.375rem 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.6875rem;
          color: #606080;
          flex-shrink: 0;
        }

        .we-editor__shortcut {
          margin-left: auto;
          font-family: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;
          font-size: 0.625rem;
          color: #4a4a6a;
        }

        /* ---- Shared ---- */

        .we-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: we-spin 0.6s linear infinite;
        }

        @keyframes we-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
