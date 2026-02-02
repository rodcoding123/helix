/**
 * File Explorer - Visual file browser with preview
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './FileExplorer.css';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  extension?: string;
  children?: FileNode[];
}

interface FilePreview {
  content: string;
  language: string;
  lineCount: number;
}

const FILE_ICONS: Record<string, string> = {
  folder: '📁',
  ts: '🔷',
  tsx: '⚛️',
  js: '🟨',
  jsx: '⚛️',
  json: '📋',
  md: '📝',
  css: '🎨',
  html: '🌐',
  py: '🐍',
  rs: '🦀',
  go: '🐹',
  sh: '⚡',
  yml: '⚙️',
  yaml: '⚙️',
  toml: '⚙️',
  env: '🔒',
  git: '🔀',
  png: '🖼️',
  jpg: '🖼️',
  svg: '🎭',
  default: '📄',
};

export function FileExplorer() {
  const { getClient } = useGateway();
  const [rootPath, setRootPath] = useState<string>('');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileNode[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async (path?: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('files.list', { path }) as { files: FileNode[]; root: string };
        setFiles(result.files);
        setRootPath(result.root);
      } catch (err) {
        console.error('Failed to load files:', err);
      }
    } else {
      // Mock data
      setRootPath('/Users/Specter/Desktop/Helix');
      setFiles([
        {
          name: 'src',
          path: '/src',
          type: 'directory',
          children: [
            {
              name: 'helix',
              path: '/src/helix',
              type: 'directory',
              children: [
                { name: 'index.ts', path: '/src/helix/index.ts', type: 'file', size: 2456, extension: 'ts' },
                { name: 'hash-chain.ts', path: '/src/helix/hash-chain.ts', type: 'file', size: 4512, extension: 'ts' },
                { name: 'logging-hooks.ts', path: '/src/helix/logging-hooks.ts', type: 'file', size: 3201, extension: 'ts' },
              ],
            },
            {
              name: 'components',
              path: '/src/components',
              type: 'directory',
              children: [
                { name: 'chat', path: '/src/components/chat', type: 'directory', children: [] },
                { name: 'settings', path: '/src/components/settings', type: 'directory', children: [] },
              ],
            },
          ],
        },
        { name: 'package.json', path: '/package.json', type: 'file', size: 1234, extension: 'json' },
        { name: 'tsconfig.json', path: '/tsconfig.json', type: 'file', size: 567, extension: 'json' },
        { name: 'README.md', path: '/README.md', type: 'file', size: 4567, extension: 'md' },
        { name: 'CLAUDE.md', path: '/CLAUDE.md', type: 'file', size: 8901, extension: 'md' },
        { name: '.env', path: '/.env', type: 'file', size: 234, extension: 'env' },
        { name: '.gitignore', path: '/.gitignore', type: 'file', size: 123, extension: 'git' },
      ]);
    }
    setLoading(false);
  };

  const toggleExpand = async (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
      // Load children if not already loaded
      const node = findNode(files, path);
      if (node && node.type === 'directory' && (!node.children || node.children.length === 0)) {
        await loadDirectory(path);
      }
    }
    setExpandedPaths(newExpanded);
  };

  const loadDirectory = async (path: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('files.list', { path }) as { files: FileNode[] };
        setFiles(prev => updateNodeChildren(prev, path, result.files));
      } catch (err) {
        console.error('Failed to load directory:', err);
      }
    }
  };

  const findNode = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNode(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const updateNodeChildren = (nodes: FileNode[], path: string, children: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.path === path) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateNodeChildren(node.children, path, children) };
      }
      return node;
    });
  };

  const selectFile = async (file: FileNode) => {
    setSelectedFile(file);

    if (file.type === 'file') {
      const client = getClient();
      if (client?.connected) {
        try {
          const result = await client.request('files.read', { path: file.path }) as FilePreview;
          setPreview(result);
        } catch (err) {
          console.error('Failed to read file:', err);
        }
      } else {
        // Mock preview
        setPreview({
          content: `// File: ${file.name}\n// This is a preview of the file content\n\nexport function example() {\n  console.log('Hello, World!');\n}\n`,
          language: file.extension || 'text',
          lineCount: 7,
        });
      }
    } else {
      setPreview(null);
    }
  };

  const searchFiles = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results: FileNode[] = [];
    const search = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.name.toLowerCase().includes(query.toLowerCase())) {
          results.push(node);
        }
        if (node.children) {
          search(node.children);
        }
      }
    };
    search(files);
    setSearchResults(results);
  };

  const getIcon = (node: FileNode): string => {
    if (node.type === 'directory') return FILE_ICONS.folder;
    const ext = node.extension?.toLowerCase() || '';
    return FILE_ICONS[ext] || FILE_ICONS.default;
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderTree = (nodes: FileNode[], depth = 0): React.ReactNode => {
    const filtered = showHidden ? nodes : nodes.filter(n => !n.name.startsWith('.'));
    const sorted = [...filtered].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return sorted.map(node => (
      <div key={node.path} className="tree-node">
        <button
          className={`tree-item ${selectedFile?.path === node.path ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => node.type === 'directory' ? toggleExpand(node.path) : selectFile(node)}
          onDoubleClick={() => node.type === 'directory' && toggleExpand(node.path)}
        >
          {node.type === 'directory' && (
            <span className={`expand-icon ${expandedPaths.has(node.path) ? 'expanded' : ''}`}>
              ▸
            </span>
          )}
          <span className="file-icon">{getIcon(node)}</span>
          <span className="file-name">{node.name}</span>
          {node.type === 'file' && node.size && (
            <span className="file-size">{formatSize(node.size)}</span>
          )}
        </button>
        {node.type === 'directory' && expandedPaths.has(node.path) && node.children && (
          <div className="tree-children">
            {renderTree(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (loading) {
    return <div className="files-loading">Loading files...</div>;
  }

  return (
    <div className="file-explorer">
      <aside className="files-sidebar">
        <header className="sidebar-header">
          <h2>Files</h2>
          <button
            className={`toggle-hidden ${showHidden ? 'active' : ''}`}
            onClick={() => setShowHidden(!showHidden)}
            title="Show hidden files"
          >
            👁
          </button>
        </header>

        <div className="sidebar-toolbar">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => searchFiles(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="sidebar-path">
          <span className="path-icon">📍</span>
          <span className="path-text" title={rootPath}>
            {rootPath.split('/').slice(-2).join('/')}
          </span>
        </div>

        <div className="files-tree">
          {searchQuery && searchResults.length > 0 ? (
            <div className="search-results">
              {searchResults.map(node => (
                <button
                  key={node.path}
                  className={`search-result-item ${selectedFile?.path === node.path ? 'selected' : ''}`}
                  onClick={() => selectFile(node)}
                >
                  <span className="file-icon">{getIcon(node)}</span>
                  <div className="result-info">
                    <span className="file-name">{node.name}</span>
                    <span className="file-path">{node.path}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="no-results">
              <span>No files found</span>
            </div>
          ) : (
            renderTree(files)
          )}
        </div>
      </aside>

      <main className="file-preview">
        {selectedFile ? (
          <>
            <header className="preview-header">
              <div className="preview-info">
                <span className="preview-icon">{getIcon(selectedFile)}</span>
                <div className="preview-details">
                  <span className="preview-name">{selectedFile.name}</span>
                  <span className="preview-path">{selectedFile.path}</span>
                </div>
              </div>
              <div className="preview-actions">
                {selectedFile.type === 'file' && (
                  <>
                    <button className="btn-secondary btn-sm">Open in Editor</button>
                    <button className="btn-secondary btn-sm">Copy Path</button>
                  </>
                )}
              </div>
            </header>

            <div className="preview-content">
              {preview ? (
                <div className="code-preview">
                  <div className="code-header">
                    <span className="language-badge">{preview.language}</span>
                    <span className="line-count">{preview.lineCount} lines</span>
                  </div>
                  <pre className="code-block">
                    <code>{preview.content}</code>
                  </pre>
                </div>
              ) : selectedFile.type === 'directory' ? (
                <div className="directory-info">
                  <span className="dir-icon">📁</span>
                  <span className="dir-name">{selectedFile.name}</span>
                  <span className="dir-hint">
                    {selectedFile.children?.length || 0} items
                  </span>
                </div>
              ) : (
                <div className="loading-preview">Loading preview...</div>
              )}
            </div>
          </>
        ) : (
          <div className="no-selection">
            <span className="no-selection-icon">📂</span>
            <p>Select a file to preview</p>
          </div>
        )}
      </main>
    </div>
  );
}
