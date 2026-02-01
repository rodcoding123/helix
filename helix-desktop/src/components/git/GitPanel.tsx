/**
 * Git Panel - View status, branches, diffs, and commits
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './GitPanel.css';

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  modified: GitFile[];
  untracked: GitFile[];
}

interface GitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
  diff?: string;
}

interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: string;
}

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  body?: string;
}

type TabType = 'changes' | 'branches' | 'history';

export function GitPanel() {
  const { getClient } = useGateway();
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('changes');
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    loadGitData();
  }, []);

  const loadGitData = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const [statusResult, branchResult, commitResult] = await Promise.all([
          client.request('git.status') as Promise<{ status: GitStatus }>,
          client.request('git.branches') as Promise<{ branches: GitBranch[] }>,
          client.request('git.log', { limit: 20 }) as Promise<{ commits: GitCommit[] }>,
        ]);
        setStatus(statusResult.status);
        setBranches(branchResult.branches);
        setCommits(commitResult.commits);
      } catch (err) {
        console.error('Failed to load git data:', err);
      }
    } else {
      // Mock data
      setStatus({
        branch: 'main',
        ahead: 2,
        behind: 0,
        staged: [
          { path: 'src/components/git/GitPanel.tsx', status: 'added' },
        ],
        modified: [
          { path: 'src/App.tsx', status: 'modified', diff: '@@ -15,6 +15,8 @@\n import { GitPanel } from \'./components/git\';\n+import { NewComponent } from \'./components/new\';\n' },
          { path: 'package.json', status: 'modified' },
        ],
        untracked: [
          { path: 'src/components/new/index.ts', status: 'untracked' },
        ],
      });

      setBranches([
        { name: 'main', current: true, remote: 'origin/main', lastCommit: '2 hours ago' },
        { name: 'feature/git-panel', current: false, remote: 'origin/feature/git-panel', lastCommit: '1 day ago' },
        { name: 'fix/typescript-errors', current: false, lastCommit: '3 days ago' },
      ]);

      setCommits([
        { hash: 'abc123def456', shortHash: 'abc123d', message: 'feat: Add Git panel component', author: 'Rodrigo Specter', date: '2 hours ago' },
        { hash: 'def456ghi789', shortHash: 'def456g', message: 'fix: Resolve TypeScript errors in AgentEditor', author: 'Rodrigo Specter', date: '5 hours ago' },
        { hash: 'ghi789jkl012', shortHash: 'ghi789j', message: 'feat: Add session manager and usage dashboard', author: 'Rodrigo Specter', date: '1 day ago' },
        { hash: 'jkl012mno345', shortHash: 'jkl012m', message: 'refactor: Clean up component exports', author: 'Rodrigo Specter', date: '1 day ago' },
        { hash: 'mno345pqr678', shortHash: 'mno345p', message: 'docs: Update CLAUDE.md with new components', author: 'Rodrigo Specter', date: '2 days ago' },
      ]);
    }
    setLoading(false);
  };

  const stageFile = async (path: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('git.stage', { paths: [path] });
        loadGitData();
      } catch (err) {
        console.error('Failed to stage file:', err);
      }
    } else {
      // Mock staging
      setStatus(prev => {
        if (!prev) return prev;
        const file = [...prev.modified, ...prev.untracked].find(f => f.path === path);
        if (!file) return prev;
        return {
          ...prev,
          staged: [...prev.staged, { ...file, status: file.status === 'untracked' ? 'added' : file.status }],
          modified: prev.modified.filter(f => f.path !== path),
          untracked: prev.untracked.filter(f => f.path !== path),
        };
      });
    }
  };

  const unstageFile = async (path: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('git.unstage', { paths: [path] });
        loadGitData();
      } catch (err) {
        console.error('Failed to unstage file:', err);
      }
    } else {
      // Mock unstaging
      setStatus(prev => {
        if (!prev) return prev;
        const file = prev.staged.find(f => f.path === path);
        if (!file) return prev;
        return {
          ...prev,
          staged: prev.staged.filter(f => f.path !== path),
          modified: file.status === 'added' ? prev.modified : [...prev.modified, file],
          untracked: file.status === 'added' ? [...prev.untracked, { ...file, status: 'untracked' }] : prev.untracked,
        };
      });
    }
  };

  const stageAll = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('git.stage', { all: true });
        loadGitData();
      } catch (err) {
        console.error('Failed to stage all:', err);
      }
    } else {
      setStatus(prev => {
        if (!prev) return prev;
        const allFiles = [...prev.modified, ...prev.untracked].map(f => ({
          ...f,
          status: f.status === 'untracked' ? 'added' as const : f.status,
        }));
        return {
          ...prev,
          staged: [...prev.staged, ...allFiles],
          modified: [],
          untracked: [],
        };
      });
    }
  };

  const commit = async () => {
    if (!commitMessage.trim() || !status?.staged.length) return;

    setIsCommitting(true);
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('git.commit', { message: commitMessage });
        setCommitMessage('');
        loadGitData();
      } catch (err) {
        console.error('Failed to commit:', err);
      }
    } else {
      // Mock commit
      setCommits(prev => [
        {
          hash: Date.now().toString(16),
          shortHash: Date.now().toString(16).slice(0, 7),
          message: commitMessage,
          author: 'You',
          date: 'Just now',
        },
        ...prev,
      ]);
      setStatus(prev => prev ? { ...prev, staged: [] } : prev);
      setCommitMessage('');
    }
    setIsCommitting(false);
  };

  const checkoutBranch = async (branchName: string) => {
    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('git.checkout', { branch: branchName });
        loadGitData();
      } catch (err) {
        console.error('Failed to checkout branch:', err);
      }
    } else {
      setBranches(prev => prev.map(b => ({
        ...b,
        current: b.name === branchName,
      })));
      setStatus(prev => prev ? { ...prev, branch: branchName } : prev);
    }
  };

  const getStatusIcon = (status: GitFile['status']): string => {
    switch (status) {
      case 'added': return '+';
      case 'modified': return 'M';
      case 'deleted': return 'D';
      case 'renamed': return 'R';
      case 'untracked': return '?';
      default: return '•';
    }
  };

  const getStatusColor = (status: GitFile['status']): string => {
    switch (status) {
      case 'added': return 'status-added';
      case 'modified': return 'status-modified';
      case 'deleted': return 'status-deleted';
      case 'untracked': return 'status-untracked';
      default: return '';
    }
  };

  if (loading) {
    return <div className="git-loading">Loading git status...</div>;
  }

  const totalChanges = status ? status.staged.length + status.modified.length + status.untracked.length : 0;

  return (
    <div className="git-panel">
      <header className="git-header">
        <div className="branch-info">
          <span className="branch-icon">🔀</span>
          <span className="branch-name">{status?.branch || 'No branch'}</span>
          {status && (status.ahead > 0 || status.behind > 0) && (
            <span className="sync-status">
              {status.ahead > 0 && <span className="ahead">↑{status.ahead}</span>}
              {status.behind > 0 && <span className="behind">↓{status.behind}</span>}
            </span>
          )}
        </div>
        <button className="btn-secondary btn-sm" onClick={loadGitData}>
          ↻ Refresh
        </button>
      </header>

      <nav className="git-tabs">
        <button
          className={`tab-btn ${activeTab === 'changes' ? 'active' : ''}`}
          onClick={() => setActiveTab('changes')}
        >
          Changes
          {totalChanges > 0 && <span className="badge">{totalChanges}</span>}
        </button>
        <button
          className={`tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
          onClick={() => setActiveTab('branches')}
        >
          Branches
          <span className="badge">{branches.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </nav>

      <div className="git-content">
        {activeTab === 'changes' && status && (
          <div className="changes-tab">
            {/* Commit Form */}
            <div className="commit-form">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                rows={3}
              />
              <div className="commit-actions">
                <button
                  className="btn-primary"
                  onClick={commit}
                  disabled={!commitMessage.trim() || status.staged.length === 0 || isCommitting}
                >
                  {isCommitting ? 'Committing...' : `Commit (${status.staged.length})`}
                </button>
              </div>
            </div>

            {/* Staged Changes */}
            {status.staged.length > 0 && (
              <div className="file-section">
                <div className="section-header">
                  <span>Staged Changes</span>
                  <span className="section-count">{status.staged.length}</span>
                </div>
                {status.staged.map(file => (
                  <div
                    key={file.path}
                    className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <span className={`file-status ${getStatusColor(file.status)}`}>
                      {getStatusIcon(file.status)}
                    </span>
                    <span className="file-path">{file.path}</span>
                    <button
                      className="file-action"
                      onClick={(e) => { e.stopPropagation(); unstageFile(file.path); }}
                      title="Unstage"
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Modified Files */}
            {status.modified.length > 0 && (
              <div className="file-section">
                <div className="section-header">
                  <span>Modified</span>
                  <span className="section-count">{status.modified.length}</span>
                </div>
                {status.modified.map(file => (
                  <div
                    key={file.path}
                    className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <span className={`file-status ${getStatusColor(file.status)}`}>
                      {getStatusIcon(file.status)}
                    </span>
                    <span className="file-path">{file.path}</span>
                    <button
                      className="file-action"
                      onClick={(e) => { e.stopPropagation(); stageFile(file.path); }}
                      title="Stage"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Untracked Files */}
            {status.untracked.length > 0 && (
              <div className="file-section">
                <div className="section-header">
                  <span>Untracked</span>
                  <span className="section-count">{status.untracked.length}</span>
                </div>
                {status.untracked.map(file => (
                  <div
                    key={file.path}
                    className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <span className={`file-status ${getStatusColor(file.status)}`}>
                      {getStatusIcon(file.status)}
                    </span>
                    <span className="file-path">{file.path}</span>
                    <button
                      className="file-action"
                      onClick={(e) => { e.stopPropagation(); stageFile(file.path); }}
                      title="Stage"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}

            {totalChanges === 0 && (
              <div className="no-changes">
                <span className="no-changes-icon">✓</span>
                <p>Working tree clean</p>
              </div>
            )}

            {(status.modified.length > 0 || status.untracked.length > 0) && (
              <div className="stage-all">
                <button className="btn-secondary" onClick={stageAll}>
                  Stage All Changes
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="branches-tab">
            {branches.map(branch => (
              <div
                key={branch.name}
                className={`branch-item ${branch.current ? 'current' : ''}`}
              >
                <div className="branch-info-row">
                  <span className="branch-indicator">{branch.current ? '●' : '○'}</span>
                  <span className="branch-name">{branch.name}</span>
                  {branch.remote && (
                    <span className="branch-remote">{branch.remote}</span>
                  )}
                </div>
                {branch.lastCommit && (
                  <span className="branch-last-commit">{branch.lastCommit}</span>
                )}
                {!branch.current && (
                  <button
                    className="btn-sm btn-secondary"
                    onClick={() => checkoutBranch(branch.name)}
                  >
                    Checkout
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-tab">
            {commits.map(commit => (
              <div key={commit.hash} className="commit-item">
                <div className="commit-header">
                  <span className="commit-hash">{commit.shortHash}</span>
                  <span className="commit-date">{commit.date}</span>
                </div>
                <p className="commit-message">{commit.message}</p>
                <span className="commit-author">{commit.author}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diff Preview */}
      {selectedFile?.diff && (
        <div className="diff-preview">
          <div className="diff-header">
            <span className="diff-file">{selectedFile.path}</span>
            <button className="close-btn" onClick={() => setSelectedFile(null)}>×</button>
          </div>
          <pre className="diff-content">{selectedFile.diff}</pre>
        </div>
      )}
    </div>
  );
}
