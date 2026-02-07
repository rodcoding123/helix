/**
 * Synthesis Monitoring Dashboard
 *
 * Real-time monitoring of memory synthesis jobs with cost tracking
 * Phase G.2 - Integration with AIOperationRouter metrics
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SynthesisMonitoringDashboard.css';

interface SynthesisJob {
  id: string;
  synthesisType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string;
  completedAt?: string;
  patternsDetected: number;
  costUsd: number;
  model: string;
  error?: string;
}

export function SynthesisMonitoringDashboard() {
  const { getClient, connected } = useGateway();
  const [jobs, setJobs] = useState<SynthesisJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<SynthesisJob | null>(null);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [totalCostToday, setTotalCostToday] = useState(0);
  const [jobsCompletedToday, setJobsCompletedToday] = useState(0);

  // Load synthesis jobs
  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [connected]);

  const loadJobs = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      // Query synthesis job history
      const result = (await client.request('memory.synthesis_history', {
        limit: 20,
        status: filter === 'all' ? undefined : filter,
      })) as any;

      if (result?.jobs) {
        const jobsList = result.jobs as SynthesisJob[];
        setJobs(jobsList);

        // Calculate totals
        const today = new Date().toDateString();
        const todayJobs = jobsList.filter(
          j => new Date(j.startedAt).toDateString() === today
        );

        const totalCost = todayJobs.reduce((sum, j) => sum + (j.costUsd || 0), 0);
        const completed = todayJobs.filter(j => j.status === 'completed').length;

        setTotalCostToday(totalCost);
        setJobsCompletedToday(completed);
      }
    } catch (err) {
      console.error('Failed to load synthesis jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'running':
        return '#3b82f6'; // blue
      case 'completed':
        return '#10b981'; // green
      case 'failed':
        return '#ef4444'; // red
      default:
        return '#8b5cf6'; // purple
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return '⏳';
      case 'completed':
        return '✓';
      case 'failed':
        return '✕';
      default:
        return '◌';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const durationMs = endTime - startTime;

    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  const filteredJobs = jobs.filter(j => {
    if (filter === 'all') return true;
    return j.status === filter;
  });

  if (loading) {
    return <div className="synthesis-dashboard synthesis-loading">Loading synthesis jobs...</div>;
  }

  return (
    <div className="synthesis-dashboard">
      <style>{synthesisDashboardStyles}</style>

      {/* Header */}
      <header className="synthesis-header">
        <div className="header-left">
          <h2>Synthesis Job Monitor</h2>
          <span className="job-count">{filteredJobs.length} jobs</span>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-label">Today's Cost</div>
            <div className="stat-value">${totalCostToday.toFixed(4)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Today</div>
            <div className="stat-value">{jobsCompletedToday}</div>
          </div>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="synthesis-filters">
        {(['all', 'running', 'completed', 'failed'] as const).map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      <div className="synthesis-list">
        {filteredJobs.length === 0 ? (
          <div className="empty-state">
            <p>No {filter === 'all' ? 'synthesis' : filter} jobs found</p>
          </div>
        ) : (
          filteredJobs.map(job => (
            <div
              key={job.id}
              className={`job-row ${job.status === 'selected' ? 'selected' : ''}`}
              onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
            >
              <div className="job-status">
                <span
                  className="status-icon"
                  style={{ color: getStatusBadgeColor(job.status) }}
                >
                  {getStatusIcon(job.status)}
                </span>
                <span className="status-label">{job.status}</span>
              </div>

              <div className="job-info">
                <div className="job-type">{job.synthesisType}</div>
                <div className="job-time">
                  Started {new Date(job.startedAt).toLocaleTimeString()}
                </div>
              </div>

              <div className="job-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, job.progress * 100)}%` }}
                  />
                </div>
                <span className="progress-label">{Math.round(job.progress * 100)}%</span>
              </div>

              <div className="job-metrics">
                <span className="metric">
                  📊 {job.patternsDetected} patterns
                </span>
                <span className="metric">
                  💰 ${job.costUsd.toFixed(4)}
                </span>
                <span className="metric">
                  ⏱️ {formatDuration(job.startedAt, job.completedAt)}
                </span>
              </div>

              <div className="job-model">
                <span className="model-badge">{job.model}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail View */}
      {selectedJob && (
        <div className="job-detail-view">
          <div className="detail-card">
            <div className="detail-header">
              <h3>{selectedJob.synthesisType}</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedJob(null)}
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <label>Status</label>
                <div
                  className="detail-value"
                  style={{ color: getStatusBadgeColor(selectedJob.status) }}
                >
                  {selectedJob.status}
                </div>
              </div>

              <div className="detail-item">
                <label>Progress</label>
                <div className="detail-value">
                  {Math.round(selectedJob.progress * 100)}%
                </div>
              </div>

              <div className="detail-item">
                <label>Model Used</label>
                <div className="detail-value">{selectedJob.model}</div>
              </div>

              <div className="detail-item">
                <label>Cost</label>
                <div className="detail-value">${selectedJob.costUsd.toFixed(6)}</div>
              </div>

              <div className="detail-item">
                <label>Patterns Detected</label>
                <div className="detail-value">{selectedJob.patternsDetected}</div>
              </div>

              <div className="detail-item">
                <label>Duration</label>
                <div className="detail-value">
                  {formatDuration(selectedJob.startedAt, selectedJob.completedAt)}
                </div>
              </div>

              <div className="detail-item">
                <label>Started</label>
                <div className="detail-value">
                  {new Date(selectedJob.startedAt).toLocaleString()}
                </div>
              </div>

              {selectedJob.completedAt && (
                <div className="detail-item">
                  <label>Completed</label>
                  <div className="detail-value">
                    {new Date(selectedJob.completedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {selectedJob.error && (
                <div className="detail-item detail-error">
                  <label>Error</label>
                  <div className="detail-value error-text">{selectedJob.error}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const synthesisDashboardStyles = `
.synthesis-dashboard {
  padding: 1.5rem;
  background: var(--bg-primary, #0a0a1a);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.synthesis-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-tertiary, #606080);
}

.synthesis-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.header-left h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.job-count {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
}

.header-stats {
  display: flex;
  gap: 1rem;
}

.stat-card {
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  min-width: 140px;
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  text-transform: uppercase;
  margin-bottom: 0.25rem;
  display: block;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #818cf8;
}

.synthesis-filters {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  background: var(--bg-secondary, #111127);
  border-radius: 8px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.filter-tab {
  flex: 1;
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-tab:hover {
  color: var(--text-primary, #fff);
}

.filter-tab.active {
  background: var(--accent-color, #6366f1);
  color: #fff;
}

.synthesis-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.job-row {
  display: grid;
  grid-template-columns: 80px 1fr 120px 200px 120px;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.job-row:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.job-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-icon {
  font-size: 1.25rem;
}

.status-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #a0a0c0);
  text-transform: capitalize;
}

.job-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.job-type {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
  text-transform: capitalize;
}

.job-time {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.job-progress {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  text-align: center;
}

.job-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
}

.metric {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.job-model {
  text-align: right;
}

.model-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-tertiary, #606080);
}

.job-detail-view {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-card {
  background: rgba(99, 102, 241, 0.04);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  padding: 1.5rem;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.detail-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  text-transform: capitalize;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: color 0.15s ease;
}

.close-btn:hover {
  color: var(--text-primary, #fff);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.detail-item label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary, #606080);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--text-primary, #fff);
  word-break: break-all;
}

.detail-error {
  grid-column: 1 / -1;
}

.error-text {
  color: #ef4444;
  font-size: 0.8125rem;
}
`;
