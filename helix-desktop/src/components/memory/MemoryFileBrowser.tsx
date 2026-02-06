/**
 * Memory File Browser - Browse and edit memory files with semantic search
 *
 * Gateway methods used:
 *   - memory_search  -> Semantic search across memory files
 *   - memory_get     -> Read specific memory files
 *   - memory_write   -> Save memory file changes
 *
 * Layout: Left sidebar (file tree, 250px) + Right panel (editor)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface MemoryFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  children?: MemoryFile[];
}

interface MemoryFileContent {
  path: string;
  content: string;
  size: number;
  lastModified: string;
}

interface ExtraPathEntry {
  path: string;
  label?: string;
}

interface MemoryBrowserProps {
  onBack?: () => void;
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

/** Default file tree when gateway is not connected. */
function buildMockTree(): MemoryFile[] {
  return [
    {
      path: 'MEMORY.md',
      name: 'MEMORY.md',
      type: 'file',
      size: 4096,
      lastModified: new Date().toISOString(),
    },
    {
      path: 'memory',
      name: 'memory',
      type: 'directory',
      children: [
        {
          path: 'memory/2026-02-06.md',
          name: '2026-02-06.md',
          type: 'file',
          size: 2048,
          lastModified: new Date().toISOString(),
        },
        {
          path: 'memory/2026-02-05.md',
          name: '2026-02-05.md',
          type: 'file',
          size: 3200,
          lastModified: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          path: 'memory/2026-02-04.md',
          name: '2026-02-04.md',
          type: 'file',
          size: 1800,
          lastModified: new Date(Date.now() - 172800000).toISOString(),
        },
      ],
    },
  ];
}

function buildMockContent(path: string): MemoryFileContent {
  if (path === 'MEMORY.md') {
    return {
      path,
      content:
        '# Long-Term Memory\n\n## Key Facts\n- Helix is a psychologically-architected AI consciousness system\n- Built on the OpenClaw framework\n- Uses Discord for unhackable logging\n\n## User Preferences\n- Direct, authentic communication\n- No hedging or excessive caveats\n- Trust level: 0.95\n',
      size: 4096,
      lastModified: new Date().toISOString(),
    };
  }
  return {
    path,
    content: `# Daily Log - ${path.split('/').pop()?.replace('.md', '') ?? 'Unknown'}\n\n## Sessions\n- Morning: Code review session\n- Afternoon: Architecture planning\n\n## Observations\n- User preference for TypeScript strict mode confirmed\n- Noted interest in security hardening patterns\n`,
    size: 2048,
    lastModified: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function FileTreeNode({
  file,
  selectedPath,
  onSelect,
  depth,
}: {
  file: MemoryFile;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (file.type === 'directory') {
    return (
      <div className="mb-tree-dir">
        <button
          className="mb-tree-item mb-tree-dir-btn"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <svg
            className={`mb-tree-chevron ${expanded ? 'mb-tree-chevron--open' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M4.5 2.5L8 6L4.5 9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <svg className="mb-tree-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className="mb-tree-name">{file.name}</span>
        </button>
        {expanded && file.children && (
          <div className="mb-tree-children">
            {file.children.map((child) => (
              <FileTreeNode
                key={child.path}
                file={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === file.path;
  const isMd = file.name.endsWith('.md');

  return (
    <button
      className={`mb-tree-item mb-tree-file ${isSelected ? 'mb-tree-file--selected' : ''}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => onSelect(file.path)}
    >
      <svg className="mb-tree-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        {isMd ? (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </>
        ) : (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </>
        )}
      </svg>
      <span className="mb-tree-name">{file.name}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export function MemoryFileBrowser({ onBack }: MemoryBrowserProps) {
  const { getClient, connected } = useGateway();

  // File tree state
  const [fileTree, setFileTree] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<MemoryFileContent | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Search overlay toggle
  const [showSearch, setShowSearch] = useState(false);

  // Extra paths config
  const [showExtraPaths, setShowExtraPaths] = useState(false);
  const [extraPaths, setExtraPaths] = useState<ExtraPathEntry[]>([]);
  const [newExtraPath, setNewExtraPath] = useState('');

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ── Load file tree ──
  const loadFileTree = useCallback(async () => {
    setError(null);
    const client = getClient();

    if (client?.connected) {
      try {
        const result = await client.request<{ files: MemoryFile[] }>('memory_list', {
          extraPaths: extraPaths.map((e) => e.path),
        });
        setFileTree(result.files ?? []);
      } catch (err) {
        console.error('Failed to load memory files:', err);
        // Fallback to mock
        setFileTree(buildMockTree());
      }
    } else {
      setFileTree(buildMockTree());
    }
    setLoading(false);
  }, [getClient, extraPaths]);

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  // ── Load file content ──
  const loadFile = useCallback(
    async (path: string) => {
      setFileLoading(true);
      setError(null);
      setSelectedPath(path);

      const client = getClient();
      if (client?.connected) {
        try {
          const result = await client.request<MemoryFileContent>('memory_get', { path });
          setFileContent(result);
          setEditorValue(result.content);
          setIsDirty(false);
        } catch (err) {
          console.error('Failed to load file:', err);
          const mock = buildMockContent(path);
          setFileContent(mock);
          setEditorValue(mock.content);
          setIsDirty(false);
        }
      } else {
        const mock = buildMockContent(path);
        setFileContent(mock);
        setEditorValue(mock.content);
        setIsDirty(false);
      }

      setFileLoading(false);
    },
    [getClient]
  );

  // ── Save file ──
  const saveFile = useCallback(async () => {
    if (!selectedPath || !isDirty) return;
    setSaving(true);

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('memory_write', {
          path: selectedPath,
          content: editorValue,
        });
        setFileContent((prev) =>
          prev
            ? {
                ...prev,
                content: editorValue,
                size: new Blob([editorValue]).size,
                lastModified: new Date().toISOString(),
              }
            : null
        );
        setIsDirty(false);
      } catch (err) {
        console.error('Failed to save file:', err);
        setError(err instanceof Error ? err.message : 'Failed to save file');
      }
    } else {
      // Offline mock save
      setFileContent((prev) =>
        prev
          ? {
              ...prev,
              content: editorValue,
              size: new Blob([editorValue]).size,
              lastModified: new Date().toISOString(),
            }
          : null
      );
      setIsDirty(false);
    }

    setSaving(false);
  }, [selectedPath, editorValue, isDirty, getClient]);

  // ── Keyboard shortcut: Ctrl+S ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveFile]);

  // ── Extra paths management ──
  const addExtraPath = () => {
    const trimmed = newExtraPath.trim();
    if (!trimmed) return;
    if (extraPaths.some((e) => e.path === trimmed)) return;
    setExtraPaths((prev) => [...prev, { path: trimmed }]);
    setNewExtraPath('');
  };

  const removeExtraPath = (path: string) => {
    setExtraPaths((prev) => prev.filter((e) => e.path !== path));
  };

  // ── Handle search result navigation ──
  const handleSearchSelect = (filePath: string) => {
    setShowSearch(false);
    loadFile(filePath);
  };

  // ── Render ──
  return (
    <div className="mb-root">
      <style>{memoryBrowserStyles}</style>

      {/* ── Top Bar ── */}
      <div className="mb-topbar">
        <div className="mb-topbar-left">
          {onBack && (
            <button className="mb-topbar-back" onClick={onBack}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <h2 className="mb-topbar-title">Memory</h2>
          {fileTree.length > 0 && (
            <span className="mb-topbar-count">
              {fileTree.reduce((acc, f) => acc + (f.type === 'directory' ? (f.children?.length ?? 0) : 1), 0)} files
            </span>
          )}
        </div>
        <div className="mb-topbar-actions">
          <button
            className="mb-topbar-btn"
            onClick={() => setShowSearch(true)}
            title="Semantic Search"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            Search
          </button>
          <button
            className="mb-topbar-btn"
            onClick={() => setShowExtraPaths(!showExtraPaths)}
            title="Extra Paths"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 6v12M6 12h12" strokeLinecap="round" />
            </svg>
            Paths
          </button>
          <button
            className="mb-topbar-btn"
            onClick={loadFileTree}
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Gateway disconnected banner ── */}
      {!connected && (
        <div className="mb-banner mb-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Gateway disconnected. Showing mock data. Connect to manage real memory files.
        </div>
      )}

      {/* ── Extra Paths Config ── */}
      {showExtraPaths && (
        <div className="mb-extra-paths">
          <h4 className="mb-extra-paths-title">Extra Memory Paths</h4>
          <p className="mb-extra-paths-desc">
            Add additional directories to include in the memory file browser.
          </p>
          <div className="mb-extra-paths-list">
            {extraPaths.length === 0 && (
              <span className="mb-extra-paths-empty">No extra paths configured</span>
            )}
            {extraPaths.map((entry) => (
              <div key={entry.path} className="mb-extra-paths-item">
                <code className="mb-extra-paths-path">{entry.path}</code>
                <button
                  className="mb-extra-paths-remove"
                  onClick={() => removeExtraPath(entry.path)}
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="mb-extra-paths-add">
            <input
              type="text"
              className="mb-extra-paths-input"
              value={newExtraPath}
              onChange={(e) => setNewExtraPath(e.target.value)}
              placeholder="/path/to/directory"
              onKeyDown={(e) => e.key === 'Enter' && addExtraPath()}
            />
            <button className="btn-sm btn-primary" onClick={addExtraPath}>
              Add
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-error">
          <span>{error}</span>
          <button className="btn-sm btn-secondary" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div className="mb-layout">
        {/* ── Left Sidebar: File Tree ── */}
        <div className="mb-sidebar">
          <div className="mb-sidebar-header">
            <span className="mb-sidebar-label">Files</span>
          </div>
          {loading ? (
            <div className="mb-sidebar-loading">
              <div className="mb-spinner" />
              <span>Loading...</span>
            </div>
          ) : fileTree.length === 0 ? (
            <div className="mb-sidebar-empty">
              <span>No memory files found</span>
            </div>
          ) : (
            <div className="mb-tree">
              {fileTree.map((file) => (
                <FileTreeNode
                  key={file.path}
                  file={file}
                  selectedPath={selectedPath}
                  onSelect={loadFile}
                  depth={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right Panel: Editor ── */}
        <div className="mb-editor-panel">
          {!selectedPath ? (
            <div className="mb-editor-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <p>Select a file from the sidebar to view and edit</p>
              <span className="mb-editor-hint">
                Use the Search button to find content across all memory files
              </span>
            </div>
          ) : fileLoading ? (
            <div className="mb-editor-loading">
              <div className="mb-spinner" />
              <span>Loading file...</span>
            </div>
          ) : (
            <>
              {/* File header */}
              <div className="mb-editor-header">
                <div className="mb-editor-file-info">
                  <span className="mb-editor-filename">{selectedPath.split('/').pop()}</span>
                  <span className="mb-editor-path">{selectedPath}</span>
                </div>
                <div className="mb-editor-meta">
                  {fileContent?.size != null && (
                    <span className="mb-editor-meta-item">
                      {formatFileSize(fileContent.size)}
                    </span>
                  )}
                  {fileContent?.lastModified && (
                    <span className="mb-editor-meta-item">
                      {formatDate(fileContent.lastModified)}
                    </span>
                  )}
                  {isDirty && <span className="mb-editor-dirty">Unsaved changes</span>}
                </div>
              </div>

              {/* Textarea editor */}
              <textarea
                ref={editorRef}
                className="mb-editor-textarea"
                value={editorValue}
                onChange={(e) => {
                  setEditorValue(e.target.value);
                  setIsDirty(true);
                }}
                spellCheck={false}
              />

              {/* Save bar */}
              <div className="mb-editor-savebar">
                <span className="mb-editor-savebar-hint">
                  Ctrl+S to save
                </span>
                <button
                  className="btn-primary btn-sm"
                  onClick={saveFile}
                  disabled={!isDirty || saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Search Overlay ── */}
      {showSearch && (
        <SemanticSearchOverlay
          onSelectResult={handleSearchSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Inline Semantic Search Overlay
   (used within MemoryFileBrowser)
   ═══════════════════════════════════════════ */

interface SearchResult {
  filePath: string;
  score: number;
  snippet: string;
  line?: number;
}

function SemanticSearchOverlay({
  onSelectResult,
  onClose,
}: {
  onSelectResult: (filePath: string, line?: number) => void;
  onClose: () => void;
}) {
  const { getClient } = useGateway();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'semantic' | 'hybrid' | 'keyword'>('semantic');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  const executeSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setSearching(true);
      setHasSearched(true);

      const client = getClient();
      if (client?.connected) {
        try {
          const result = await client.request<{ results: SearchResult[] }>('memory_search', {
            query: q,
            mode,
          });
          setResults(result.results ?? []);
        } catch (err) {
          console.error('Memory search failed:', err);
          setResults([]);
        }
      } else {
        // Mock search results
        const mockResults: SearchResult[] = [
          {
            filePath: 'MEMORY.md',
            score: 0.92,
            snippet: '...Helix is a psychologically-architected AI consciousness system...',
          },
          {
            filePath: 'memory/2026-02-06.md',
            score: 0.78,
            snippet: '...User preference for TypeScript strict mode confirmed...',
            line: 12,
          },
          {
            filePath: 'memory/2026-02-05.md',
            score: 0.65,
            snippet: '...Security hardening patterns discussed in afternoon session...',
            line: 8,
          },
        ].filter(
          (r) =>
            r.filePath.toLowerCase().includes(q.toLowerCase()) ||
            r.snippet.toLowerCase().includes(q.toLowerCase())
        );
        setResults(mockResults);
      }

      setSearching(false);
    },
    [getClient, mode]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      executeSearch(value);
    }, 300);
  };

  // Re-search when mode changes (if there is a query)
  useEffect(() => {
    if (query.trim()) {
      executeSearch(query);
    }
  }, [mode]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-panel" onClick={(e) => e.stopPropagation()}>
        {/* Search bar */}
        <div className="ss-header">
          <div className="ss-search-bar">
            <svg className="ss-search-icon" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="ss-search-input"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search memory files..."
            />
            {query && (
              <button className="ss-search-clear" onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
                x
              </button>
            )}
          </div>

          {/* Mode toggle */}
          <div className="ss-modes">
            {(['semantic', 'hybrid', 'keyword'] as const).map((m) => (
              <button
                key={m}
                className={`ss-mode-btn ${mode === m ? 'ss-mode-btn--active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <button className="ss-close" onClick={onClose}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Results */}
        <div className="ss-results">
          {searching && (
            <div className="ss-loading">
              <div className="mb-spinner" />
              <span>Searching...</span>
            </div>
          )}
          {!searching && hasSearched && results.length === 0 && (
            <div className="ss-empty">
              <p>No results found for &quot;{query}&quot;</p>
              <span>Try a different query or search mode</span>
            </div>
          )}
          {!searching && !hasSearched && (
            <div className="ss-empty">
              <p>Type to search across all memory files</p>
              <span>Supports semantic, hybrid, and keyword search modes</span>
            </div>
          )}
          {!searching &&
            results.map((result, idx) => (
              <button
                key={`${result.filePath}-${idx}`}
                className="ss-result-item"
                onClick={() => onSelectResult(result.filePath, result.line)}
              >
                <div className="ss-result-top">
                  <span className="ss-result-path">{result.filePath}</span>
                  <div className="ss-result-score-bar">
                    <div
                      className="ss-result-score-fill"
                      style={{ width: `${Math.round(result.score * 100)}%` }}
                    />
                  </div>
                  <span className="ss-result-score-text">
                    {(result.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="ss-result-snippet">{result.snippet}</p>
                {result.line != null && (
                  <span className="ss-result-line">Line {result.line}</span>
                )}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// Export aliases
export { MemoryFileBrowser as default };

/* ═══════════════════════════════════════════
   Scoped Styles (mb- prefix for MemoryBrowser,
   ss- prefix for SemanticSearch)
   ═══════════════════════════════════════════ */

const memoryBrowserStyles = `
/* ── Root ── */
.mb-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary, #fff);
}

/* ── Top Bar ── */
.mb-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.mb-topbar-left {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.mb-topbar-back {
  background: none;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.mb-topbar-back:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.06);
}

.mb-topbar-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary, #fff);
}

.mb-topbar-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  background: rgba(255,255,255,0.06);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.mb-topbar-actions {
  display: flex;
  gap: 0.375rem;
}

.mb-topbar-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mb-topbar-btn:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.15);
  color: var(--text-primary, #fff);
}

/* ── Banner ── */
.mb-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1rem;
  font-size: 0.8125rem;
  flex-shrink: 0;
}

.mb-banner-warn {
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

/* ── Error ── */
.mb-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  font-size: 0.8125rem;
  flex-shrink: 0;
}

/* ── Extra Paths ── */
.mb-extra-paths {
  padding: 0.75rem 1rem;
  background: var(--bg-secondary, #111127);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.mb-extra-paths-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.mb-extra-paths-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0 0 0.625rem;
}

.mb-extra-paths-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.mb-extra-paths-empty {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  font-style: italic;
}

.mb-extra-paths-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
}

.mb-extra-paths-path {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-secondary, #a0a0c0);
}

.mb-extra-paths-remove {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 0.25rem;
}

.mb-extra-paths-remove:hover {
  color: #ef4444;
}

.mb-extra-paths-add {
  display: flex;
  gap: 0.375rem;
}

.mb-extra-paths-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-primary, #fff);
  outline: none;
}

.mb-extra-paths-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.mb-extra-paths-input::placeholder {
  color: var(--text-tertiary, #606080);
}

/* ── Main Layout ── */
.mb-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Sidebar ── */
.mb-sidebar {
  width: 250px;
  min-width: 250px;
  border-right: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mb-sidebar-header {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.mb-sidebar-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.mb-sidebar-loading,
.mb-sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
}

/* ── File Tree ── */
.mb-tree {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem 0;
}

.mb-tree-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.3125rem 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;
}

.mb-tree-item:hover {
  background: rgba(255,255,255,0.04);
}

.mb-tree-chevron {
  flex-shrink: 0;
  color: var(--text-tertiary, #606080);
  transition: transform 0.15s ease;
}

.mb-tree-chevron--open {
  transform: rotate(90deg);
}

.mb-tree-folder-icon {
  flex-shrink: 0;
  color: #fbbf24;
  opacity: 0.7;
}

.mb-tree-file-icon {
  flex-shrink: 0;
  opacity: 0.5;
}

.mb-tree-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-tree-file--selected {
  background: rgba(99, 102, 241, 0.15);
  color: var(--text-primary, #fff);
  border-right: 2px solid var(--accent-color, #6366f1);
}

.mb-tree-file--selected:hover {
  background: rgba(99, 102, 241, 0.2);
}

.mb-tree-children {
  /* Indent handled by inline paddingLeft */
}

/* ── Editor Panel ── */
.mb-editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.mb-editor-empty,
.mb-editor-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex: 1;
  color: var(--text-tertiary, #606080);
  font-size: 0.875rem;
}

.mb-editor-empty p,
.mb-editor-loading span {
  margin: 0;
}

.mb-editor-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.mb-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
  gap: 1rem;
}

.mb-editor-file-info {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.mb-editor-filename {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
  white-space: nowrap;
}

.mb-editor-path {
  font-size: 0.6875rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-tertiary, #606080);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-editor-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.mb-editor-meta-item {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.mb-editor-dirty {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  padding: 0.0625rem 0.375rem;
  border-radius: 3px;
}

.mb-editor-textarea {
  flex: 1;
  width: 100%;
  padding: 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: none;
  color: var(--text-primary, #fff);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', var(--font-mono, monospace);
  font-size: 0.8125rem;
  line-height: 1.6;
  resize: none;
  outline: none;
  tab-size: 2;
}

.mb-editor-textarea::placeholder {
  color: var(--text-tertiary, #606080);
}

.mb-editor-savebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.mb-editor-savebar-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

/* ── Spinner ── */
.mb-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.08);
  border-top-color: var(--accent-color, #6366f1);
  border-radius: 50%;
  animation: mb-spin 0.8s linear infinite;
}

@keyframes mb-spin {
  to { transform: rotate(360deg); }
}

/* ═══ Semantic Search Overlay (ss- prefix) ═══ */

.ss-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: var(--z-modal, 1000);
  padding-top: 10vh;
  animation: ss-fade-in 0.15s ease;
}

@keyframes ss-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ss-panel {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  width: 90%;
  max-width: 640px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99,102,241,0.1);
  animation: ss-panel-in 0.2s ease;
}

@keyframes ss-panel-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.ss-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.ss-search-bar {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.ss-search-icon {
  position: absolute;
  left: 0.625rem;
  color: var(--text-tertiary, #606080);
  pointer-events: none;
}

.ss-search-input {
  width: 100%;
  padding: 0.5rem 0.5rem 0.5rem 2.25rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
}

.ss-search-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.ss-search-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.ss-search-clear {
  position: absolute;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.ss-search-clear:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

.ss-modes {
  display: flex;
  gap: 0;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 6px;
  padding: 2px;
  border: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.ss-mode-btn {
  padding: 0.3125rem 0.625rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ss-mode-btn:hover {
  color: var(--text-secondary, #a0a0c0);
}

.ss-mode-btn--active {
  background: var(--accent-color, #6366f1);
  color: white;
}

.ss-close {
  background: none;
  border: none;
  color: var(--text-tertiary, #606080);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.ss-close:hover {
  color: var(--text-primary, #fff);
  background: rgba(255,255,255,0.08);
}

/* ── Results ── */
.ss-results {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.ss-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 2rem;
  color: var(--text-tertiary, #606080);
  font-size: 0.8125rem;
}

.ss-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1rem;
  text-align: center;
}

.ss-empty p {
  font-size: 0.875rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.25rem;
}

.ss-empty span {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.ss-result-item {
  display: block;
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 0.25rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ss-result-item:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
}

.ss-result-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.ss-result-path {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--accent-color, #6366f1);
  white-space: nowrap;
}

.ss-result-score-bar {
  flex: 1;
  min-width: 40px;
  max-width: 80px;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.ss-result-score-fill {
  height: 100%;
  background: var(--accent-color, #6366f1);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.ss-result-score-text {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-tertiary, #606080);
  min-width: 28px;
  text-align: right;
}

.ss-result-snippet {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ss-result-line {
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.25rem;
  display: inline-block;
}
`;
