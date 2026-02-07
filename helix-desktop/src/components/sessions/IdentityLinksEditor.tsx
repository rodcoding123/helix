/**
 * Identity Links Editor
 *
 * Manage cross-channel user identity links and trust maps
 * Phase G.4 - Context Visualization & Integration
 */

import { useState, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';

interface IdentityLink {
  id: string;
  identityA: string;
  identityB: string;
  confidence: number;
  linkType: 'email' | 'phone' | 'username' | 'manual' | 'inferred';
  createdAt?: string;
  createdBy?: string;
}

export function IdentityLinksEditor() {
  const { getClient, _connected } = useGateway();
  const [links, setLinks] = useState<IdentityLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLink, setNewLink] = useState<Partial<IdentityLink>>({
    identityA: '',
    identityB: '',
    confidence: 0.95,
    linkType: 'manual',
  });

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const client = getClient();
      if (!client?.connected) {
        setLoading(false);
        return;
      }

      const result = (await client.request('identity.list_links', {})) as any;
      if (result?.links) {
        setLinks(result.links);
      }
    } catch (err) {
      console.error('Failed to load identity links:', err);
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  const handleCreateLink = useCallback(async () => {
    if (!newLink.identityA || !newLink.identityB) {
      alert('Both identities are required');
      return;
    }

    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('identity.create_link', {
        identityA: newLink.identityA,
        identityB: newLink.identityB,
        confidence: newLink.confidence,
        linkType: newLink.linkType,
      });

      setShowCreateForm(false);
      setNewLink({ identityA: '', identityB: '', confidence: 0.95, linkType: 'manual' });
      await loadLinks();
    } catch (err) {
      console.error('Failed to create link:', err);
    }
  }, [newLink, getClient, loadLinks]);

  const handleDeleteLink = useCallback(
    async (linkId: string) => {
      if (!confirm('Delete this identity link?')) return;

      const client = getClient();
      if (!client?.connected) return;

      try {
        await client.request('identity.delete_link', { linkId });
        await loadLinks();
      } catch (err) {
        console.error('Failed to delete link:', err);
      }
    },
    [getClient, loadLinks]
  );

  if (loading) {
    return <div className="identity-links-editor loading">Loading identity links...</div>;
  }

  const linkTypeColors: Record<string, string> = {
    email: '#06b6d4',
    phone: '#8b5cf6',
    username: '#ec4899',
    manual: '#f59e0b',
    inferred: '#10b981',
  };

  return (
    <div className="identity-links-editor">
      <style>{identityLinksEditorStyles}</style>

      {/* Header */}
      <div className="editor-header">
        <h3>Identity Links</h3>
        <button
          className="create-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '✕ Cancel' : '+ Create Link'}
        </button>
      </div>

      <p className="subtitle">
        Map identities across different channels. Used for maintaining user continuity and building trust maps.
      </p>

      {/* Create Form */}
      {showCreateForm && (
        <div className="create-form">
          <div className="form-row">
            <div className="form-group">
              <label>Identity A</label>
              <input
                type="text"
                value={newLink.identityA || ''}
                onChange={(e) => setNewLink({ ...newLink, identityA: e.target.value })}
                placeholder="First identity (e.g., user@example.com)"
              />
            </div>

            <div className="form-group">
              <label>Identity B</label>
              <input
                type="text"
                value={newLink.identityB || ''}
                onChange={(e) => setNewLink({ ...newLink, identityB: e.target.value })}
                placeholder="Second identity (e.g., @username)"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Link Type</label>
              <select
                value={newLink.linkType}
                onChange={(e) =>
                  setNewLink({ ...newLink, linkType: e.target.value as any })
                }
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="username">Username</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div className="form-group">
              <label>Confidence: {Math.round((newLink.confidence || 0.95) * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={newLink.confidence || 0.95}
                onChange={(e) =>
                  setNewLink({ ...newLink, confidence: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleCreateLink}>
              Create Link
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Links List */}
      <div className="links-list">
        {links.length === 0 ? (
          <div className="empty-state">
            <p>No identity links yet. Create your first link to map identities across channels.</p>
          </div>
        ) : (
          links.map((link) => (
            <div key={link.id} className="link-item">
              <div className="link-identities">
                <div className="identity">
                  <span className="identity-value">{link.identityA}</span>
                </div>

                <div className="link-arrow">↔</div>

                <div className="identity">
                  <span className="identity-value">{link.identityB}</span>
                </div>
              </div>

              <div className="link-metadata">
                <span
                  className="link-type"
                  style={{ backgroundColor: linkTypeColors[link.linkType] }}
                >
                  {link.linkType}
                </span>
                <span className="confidence">
                  {Math.round(link.confidence * 100)}% confidence
                </span>
                {link.createdAt && (
                  <span className="created-at">
                    {new Date(link.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="link-actions">
                <button
                  className="action-btn delete"
                  onClick={() => handleDeleteLink(link.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="info-box">
        <strong>💡 How Identity Links Work:</strong>
        <ul>
          <li>Links map identities across different channels (email, phone, username)</li>
          <li>Confidence score reflects certainty of the link</li>
          <li>Used to maintain user context across conversations</li>
          <li>Builds trust maps for relational memory (Layer 3)</li>
          <li>Manual links can be created, inferred links are automatic</li>
        </ul>
      </div>
    </div>
  );
}

const identityLinksEditorStyles = `
.identity-links-editor {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.identity-links-editor.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-tertiary, #606080);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.editor-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.create-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-btn:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.subtitle {
  margin: 0 0 1.5rem 0;
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.create-form {
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary, #a0a0c0);
}

.form-group input,
.form-group select {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: var(--text-primary, #fff);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.1);
}

.form-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  flex: 1;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary, #fff);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.link-item:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.25);
}

.link-identities {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.identity {
  flex: 1;
  min-width: 0;
}

.identity-value {
  display: block;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  color: #818cf8;
  font-size: 0.8125rem;
  font-family: monospace;
  word-break: break-all;
}

.link-arrow {
  color: var(--text-tertiary, #606080);
  font-weight: 600;
  flex-shrink: 0;
}

.link-metadata {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.link-type {
  padding: 0.25rem 0.5rem;
  color: #fff;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.confidence {
  font-size: 0.75rem;
  color: var(--text-secondary, #a0a0c0);
  flex-shrink: 0;
}

.created-at {
  font-size: 0.7rem;
  color: var(--text-tertiary, #606080);
}

.link-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 0.75rem;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0c0);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: var(--text-primary, #fff);
}

.action-btn.delete {
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-tertiary, #606080);
}

.info-box {
  padding: 1rem;
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 6px;
  font-size: 0.8125rem;
}

.info-box strong {
  color: #60a5fa;
  display: block;
  margin-bottom: 0.5rem;
}

.info-box ul {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--text-secondary, #a0a0c0);
}

.info-box li {
  margin: 0.25rem 0;
}
`;
