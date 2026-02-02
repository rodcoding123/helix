import './MemoryStats.css';

export interface MemoryStatsData {
  totalEntries: number;
  entriesByType: Record<string, number>;
  oldestEntry?: string;
  newestEntry?: string;
  totalSize?: string;
  avgEntriesPerDay?: number;
}

interface MemoryStatsProps {
  stats: MemoryStatsData;
  isLoading?: boolean;
}

const TYPE_ICONS = {
  conversation: '💬',
  knowledge: '📚',
  context: '🔗',
};

const TYPE_COLORS = {
  conversation: 'var(--color-primary)',
  knowledge: 'var(--color-success)',
  context: 'var(--color-warning)',
};

export function MemoryStats({ stats, isLoading = false }: MemoryStatsProps) {
  if (isLoading) {
    return (
      <div className="memory-stats loading">
        <div className="loading-spinner" />
        <p>Loading stats...</p>
      </div>
    );
  }

  const typeEntries = Object.entries(stats.entriesByType);
  const maxTypeCount = Math.max(...typeEntries.map(([, count]) => count), 1);

  return (
    <div className="memory-stats">
      <div className="stats-overview">
        <div className="stat-card primary">
          <span className="stat-icon">📊</span>
          <div className="stat-content">
            <span className="stat-value">{stats.totalEntries.toLocaleString()}</span>
            <span className="stat-label">Total Memories</span>
          </div>
        </div>

        {stats.totalSize && (
          <div className="stat-card">
            <span className="stat-icon">💾</span>
            <div className="stat-content">
              <span className="stat-value">{stats.totalSize}</span>
              <span className="stat-label">Storage Used</span>
            </div>
          </div>
        )}

        {stats.avgEntriesPerDay !== undefined && (
          <div className="stat-card">
            <span className="stat-icon">📈</span>
            <div className="stat-content">
              <span className="stat-value">{stats.avgEntriesPerDay.toFixed(1)}</span>
              <span className="stat-label">Avg/Day</span>
            </div>
          </div>
        )}
      </div>

      <div className="stats-breakdown">
        <h3>By Type</h3>
        <div className="type-bars">
          {typeEntries.map(([type, count]) => {
            const icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS] || '📄';
            const color = TYPE_COLORS[type as keyof typeof TYPE_COLORS] || 'var(--color-text-secondary)';
            const percentage = (count / maxTypeCount) * 100;

            return (
              <div key={type} className="type-bar-row">
                <div className="type-bar-label">
                  <span className="type-bar-icon">{icon}</span>
                  <span className="type-bar-name">{type}</span>
                </div>
                <div className="type-bar-container">
                  <div
                    className="type-bar-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="type-bar-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stats-timeline">
        <h3>Timeline</h3>
        <div className="timeline-info">
          {stats.oldestEntry && (
            <div className="timeline-item">
              <span className="timeline-label">Oldest</span>
              <span className="timeline-value">{stats.oldestEntry}</span>
            </div>
          )}
          {stats.newestEntry && (
            <div className="timeline-item">
              <span className="timeline-label">Newest</span>
              <span className="timeline-value">{stats.newestEntry}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Placeholder data for development
export const PLACEHOLDER_MEMORY_STATS: MemoryStatsData = {
  totalEntries: 1247,
  entriesByType: {
    conversation: 823,
    knowledge: 312,
    context: 112,
  },
  oldestEntry: 'Dec 1, 2023',
  newestEntry: '2 hours ago',
  totalSize: '4.2 MB',
  avgEntriesPerDay: 15.3,
};
