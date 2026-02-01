import './MemoryDetail.css';
import type { MemoryListEntry } from './MemoryList';

interface MemoryDetailProps {
  entry: MemoryListEntry | null;
  onDelete?: (id: string) => void;
  onEdit?: (entry: MemoryListEntry) => void;
}

const TYPE_ICONS = {
  conversation: '💬',
  knowledge: '📚',
  context: '🔗',
};

export function MemoryDetail({ entry, onDelete, onEdit }: MemoryDetailProps) {
  if (!entry) {
    return (
      <div className="memory-detail-placeholder">
        <span className="placeholder-icon">📋</span>
        <p>Select a memory entry to view details</p>
      </div>
    );
  }

  const typeIcon = TYPE_ICONS[entry.type] || '📄';

  return (
    <div className="memory-detail">
      <header className="memory-detail-header">
        <div className="memory-detail-type">
          <span className="type-icon">{typeIcon}</span>
          <span className="type-label">{entry.type}</span>
        </div>

        <div className="memory-detail-actions">
          {onEdit && (
            <button
              className="memory-action-button"
              onClick={() => onEdit(entry)}
              title="Edit memory"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              className="memory-action-button delete"
              onClick={() => onDelete(entry.id)}
              title="Delete memory"
            >
              🗑️
            </button>
          )}
        </div>
      </header>

      <section className="memory-detail-content">
        <h3>Content</h3>
        <div className="memory-content-text">
          {entry.content}
        </div>
      </section>

      <section className="memory-detail-metadata">
        <h3>Metadata</h3>

        <div className="metadata-grid">
          <div className="metadata-item">
            <span className="metadata-label">ID</span>
            <span className="metadata-value mono">{entry.id}</span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">Source</span>
            <span className="metadata-value">{entry.source}</span>
          </div>

          <div className="metadata-item">
            <span className="metadata-label">Created</span>
            <span className="metadata-value">{entry.createdAt}</span>
          </div>

          {entry.score !== undefined && (
            <div className="metadata-item">
              <span className="metadata-label">Relevance Score</span>
              <span className="metadata-value score">
                {(entry.score * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </section>

      {entry.tags && entry.tags.length > 0 && (
        <section className="memory-detail-tags">
          <h3>Tags</h3>
          <div className="tags-list">
            {entry.tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="memory-detail-relations">
        <h3>Related Memories</h3>
        <p className="no-relations">No related memories found</p>
      </section>

      <footer className="memory-detail-footer">
        <span className="memory-id">Memory ID: {entry.id}</span>
      </footer>
    </div>
  );
}
