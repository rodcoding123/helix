/**
 * Orchestrator Panel - Phase 2 Job Submission & Monitoring
 *
 * Provides UI for:
 * - Submitting orchestration jobs
 * - Monitoring job status in real-time
 * - Viewing execution history
 * - Cost tracking and budget management
 * - Approval workflows for high-cost jobs
 */

import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './OrchestratorPanel.css';

interface OrchestratorJob {
  job_id: string;
  task: string;
  status: 'pending' | 'routing' | 'executing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: number;
  completed_at?: number;
  budget_cents: number;
  cost_cents: number;
  requires_approval: boolean;
  approved_at?: number;
  result?: unknown;
  error?: string;
}

interface OrchestratorStats {
  total_jobs: number;
  completed: number;
  in_progress: number;
  failed: number;
  total_cost_cents: number;
  avg_execution_time_ms: number;
}

export function OrchestratorPanel() {
  const { getClient, connected } = useGateway();

  // State
  const [jobs, setJobs] = useState<OrchestratorJob[]>([]);
  const [stats, setStats] = useState<OrchestratorStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Job submission
  const [taskInput, setTaskInput] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [budget, setBudget] = useState(10000); // cents (default $100)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load stats
  const loadStats = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      return;
    }

    try {
      const result = await client.request('getOrchestratorStats');
      setStats(result as OrchestratorStats);
    } catch (err) {
      console.error('Failed to load orchestrator stats:', err);
    }
  }, [getClient]);

  // Load recent jobs
  const loadJobs = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await client.request('getRecentJobs', { limit: 10 });
      setJobs((result as any).jobs || []);
      setError(null);
    } catch (err) {
      setError(`Failed to load jobs: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [getClient]);

  // Submit job
  const handleSubmitJob = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) {
      setError('Please enter a task');
      return;
    }

    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected. Please ensure the backend is running.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await client.request('submitOrchestratorJob', {
        task: taskInput.trim(),
        priority,
        budget_cents: budget,
      });

      if ((result as any).success) {
        setTaskInput('');
        setPriority('normal');
        setBudget(10000);
        // Refresh jobs list
        loadJobs();
      } else {
        setError((result as any).error || 'Failed to submit job');
      }
    } catch (err) {
      setError(`Job submission failed: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [taskInput, priority, budget, getClient, loadJobs]);

  // Approve job
  const approveJob = useCallback(async (jobId: string) => {
    const client = getClient();
    if (!client?.connected) {
      setError('Gateway not connected');
      return;
    }

    try {
      await client.request('approveOrchestratorJob', { jobId });
      loadJobs(); // Refresh
    } catch (err) {
      setError(`Approval failed: ${String(err)}`);
    }
  }, [getClient, loadJobs]);

  // Load initial data
  useEffect(() => {
    if (connected) {
      loadStats();
      loadJobs();

      // Refresh every 5 seconds
      const interval = setInterval(() => {
        loadJobs();
        loadStats();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [connected, loadStats, loadJobs]);

  return (
    <div className="orchestrator-panel">
      <div className="orchestrator-header">
        <h2>Orchestrator Control Center</h2>
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="orchestrator-stats">
          <div className="stat-card">
            <div className="stat-label">Total Jobs</div>
            <div className="stat-value">{stats.total_jobs}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value success">{stats.completed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value warning">{stats.in_progress}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Failed</div>
            <div className="stat-value error">{stats.failed}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Cost</div>
            <div className="stat-value">${(stats.total_cost_cents / 100).toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Execution Time</div>
            <div className="stat-value">{(stats.avg_execution_time_ms / 1000).toFixed(1)}s</div>
          </div>
        </div>
      )}

      {/* Job Submission Form */}
      <div className="job-submission">
        <h3>Submit New Orchestration Job</h3>
        <form onSubmit={handleSubmitJob}>
          <div className="form-group">
            <label htmlFor="task">Task Description</label>
            <textarea
              id="task"
              value={taskInput}
              onChange={(e) => {
                setTaskInput(e.target.value);
                setError(null);
              }}
              placeholder="Describe the task you want the orchestrator to handle..."
              disabled={isSubmitting || !connected}
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                disabled={isSubmitting || !connected}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budget">Budget (USD)</label>
              <div className="budget-input">
                <span>$</span>
                <input
                  id="budget"
                  type="number"
                  value={(budget / 100).toFixed(2)}
                  onChange={(e) => setBudget(Math.round(parseFloat(e.target.value) * 100))}
                  min="1"
                  max="1000"
                  step="0.01"
                  disabled={isSubmitting || !connected}
                />
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting || !connected || !taskInput.trim()}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Job'}
          </button>
        </form>
      </div>

      {/* Recent Jobs */}
      <div className="recent-jobs">
        <h3>Recent Jobs</h3>
        {isLoading ? (
          <div className="loading">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">No jobs yet. Submit a task to get started!</div>
        ) : (
          <div className="jobs-list">
            {jobs.map((job) => (
              <div key={job.job_id} className={`job-card status-${job.status}`}>
                <div className="job-header">
                  <div className="job-info">
                    <div className="job-id">{job.job_id}</div>
                    <div className="job-priority">
                      <span className={`priority-badge priority-${job.priority}`}>
                        {job.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="job-status">
                    <span className={`status-badge status-${job.status}`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="job-description">{job.task}</div>

                <div className="job-details">
                  <div className="detail">
                    <span className="label">Created:</span>
                    <span className="value">{new Date(job.created_at).toLocaleString()}</span>
                  </div>
                  <div className="detail">
                    <span className="label">Cost:</span>
                    <span className="value">${(job.cost_cents / 100).toFixed(2)} / ${(job.budget_cents / 100).toFixed(2)}</span>
                  </div>
                  {job.completed_at && (
                    <div className="detail">
                      <span className="label">Duration:</span>
                      <span className="value">{((job.completed_at - job.created_at) / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                </div>

                {/* Approval section */}
                {job.requires_approval && !job.approved_at && (
                  <div className="job-approval">
                    <p>⚠️ This high-cost job requires approval before execution</p>
                    <button
                      className="btn-approve"
                      onClick={() => approveJob(job.job_id)}
                      disabled={isSubmitting}
                    >
                      Approve Job
                    </button>
                  </div>
                )}

                {/* Error display */}
                {job.status === 'failed' && job.error && (
                  <div className="job-error">
                    <span className="error-icon">✕</span>
                    <div className="error-text">{job.error}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
