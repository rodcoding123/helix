/**
 * Cron Job Manager - Full CRUD interface for scheduled tasks
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { CronJobEditor } from './CronJobEditor';
import './CronJobManager.css';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  payload: string;
  agentId?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount?: number;
  lastResult?: 'success' | 'error' | 'running';
}

interface Agent {
  id: string;
  name: string;
}

export function CronJobManager() {
  const { getClient } = useGateway();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      // Mock data for demo
      setJobs([
        {
          id: '1',
          name: 'Daily Summary',
          schedule: '0 9 * * *',
          payload: 'Generate a summary of today\'s tasks and send to Slack',
          enabled: true,
          lastRun: '2026-02-01 09:00',
          nextRun: '2026-02-02 09:00',
          runCount: 45,
          lastResult: 'success',
        },
        {
          id: '2',
          name: 'Weekly Backup',
          schedule: '0 0 * * 0',
          payload: 'Run backup procedure for all projects',
          enabled: false,
          lastRun: '2026-01-26 00:00',
          nextRun: '2026-02-02 00:00',
          runCount: 12,
          lastResult: 'success',
        },
        {
          id: '3',
          name: 'Hourly Health Check',
          schedule: '0 * * * *',
          payload: 'Check system health and alert if issues found',
          enabled: true,
          lastRun: '2026-02-01 14:00',
          nextRun: '2026-02-01 15:00',
          runCount: 1240,
          lastResult: 'error',
        },
      ]);
      setAgents([
        { id: 'default', name: 'Default Agent' },
        { id: 'dev', name: 'Developer Agent' },
        { id: 'ops', name: 'Operations Agent' },
      ]);
      return;
    }

    try {
      const [cronResult, agentResult] = await Promise.all([
        client.request('cron.list') as Promise<{ jobs: CronJob[] }>,
        client.request('agent.list') as Promise<{ agents: Agent[] }>,
      ]);
      setJobs(cronResult.jobs || []);
      setAgents(agentResult.agents || []);
    } catch (err) {
      console.error('Failed to load cron data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // Optimistic update
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, enabled: !j.enabled } : j
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('cron.update', { jobId, enabled: !job.enabled });
      } catch (err) {
        console.error('Failed to toggle job:', err);
        // Revert on error
        setJobs(prev => prev.map(j =>
          j.id === jobId ? { ...j, enabled: job.enabled } : j
        ));
      }
    }
  };

  const runJob = async (jobId: string) => {
    setRunningJobs(prev => new Set(prev).add(jobId));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('cron.run', { jobId });
        loadData();
      } catch (err) {
        console.error('Failed to run job:', err);
      }
    } else {
      // Simulate run for demo
      await new Promise(resolve => setTimeout(resolve, 2000));
      setJobs(prev => prev.map(j =>
        j.id === jobId
          ? { ...j, lastRun: new Date().toISOString().slice(0, 16).replace('T', ' '), runCount: (j.runCount || 0) + 1 }
          : j
      ));
    }

    setRunningJobs(prev => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('cron.remove', { jobId });
      } catch (err) {
        console.error('Failed to delete job:', err);
        return;
      }
    }

    setJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleSave = async (jobData: Omit<CronJob, 'id'>) => {
    const client = getClient();

    if (editingJob) {
      // Update existing
      if (client?.connected) {
        try {
          await client.request('cron.update', { jobId: editingJob.id, ...jobData });
        } catch (err) {
          console.error('Failed to update job:', err);
          return;
        }
      }
      setJobs(prev => prev.map(j =>
        j.id === editingJob.id ? { ...j, ...jobData } : j
      ));
    } else {
      // Create new
      const newJob: CronJob = {
        ...jobData,
        id: String(Date.now()),
        runCount: 0,
      };

      if (client?.connected) {
        try {
          const result = await client.request('cron.create', jobData) as { job: CronJob };
          newJob.id = result.job.id;
        } catch (err) {
          console.error('Failed to create job:', err);
          return;
        }
      }

      setJobs(prev => [...prev, newJob]);
    }

    setShowEditor(false);
    setEditingJob(null);
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingJob(null);
    setShowEditor(true);
  };

  const filteredJobs = jobs.filter(job => {
    if (searchQuery && !job.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    switch (filter) {
      case 'enabled': return job.enabled;
      case 'disabled': return !job.enabled;
      default: return true;
    }
  });

  const formatSchedule = (schedule: string): string => {
    const presets: Record<string, string> = {
      '* * * * *': 'Every minute',
      '*/5 * * * *': 'Every 5 minutes',
      '*/15 * * * *': 'Every 15 minutes',
      '0 * * * *': 'Hourly',
      '0 0 * * *': 'Daily at midnight',
      '0 9 * * *': 'Daily at 9 AM',
      '0 0 * * 0': 'Weekly (Sunday)',
      '0 0 1 * *': 'Monthly',
      '0 9 * * 1-5': 'Weekdays at 9 AM',
    };
    return presets[schedule] || schedule;
  };

  if (loading) {
    return <div className="cron-manager-loading">Loading scheduled tasks...</div>;
  }

  if (showEditor) {
    return (
      <div className="cron-manager">
        <CronJobEditor
          job={editingJob}
          agents={agents}
          onSave={handleSave}
          onCancel={() => {
            setShowEditor(false);
            setEditingJob(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="cron-manager">
      <header className="cron-header">
        <div className="header-title">
          <h2>Scheduled Tasks</h2>
          <span className="job-count">{jobs.length} tasks</span>
        </div>
        <button className="btn-primary" onClick={handleCreate}>
          + New Task
        </button>
      </header>

      <div className="cron-toolbar">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({jobs.length})
          </button>
          <button
            className={`filter-btn ${filter === 'enabled' ? 'active' : ''}`}
            onClick={() => setFilter('enabled')}
          >
            Enabled ({jobs.filter(j => j.enabled).length})
          </button>
          <button
            className={`filter-btn ${filter === 'disabled' ? 'active' : ''}`}
            onClick={() => setFilter('disabled')}
          >
            Disabled ({jobs.filter(j => !j.enabled).length})
          </button>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="cron-empty">
          <span className="empty-icon">⏰</span>
          <p>No scheduled tasks found</p>
          <button className="btn-primary" onClick={handleCreate}>
            Create your first task
          </button>
        </div>
      ) : (
        <div className="cron-list">
          {filteredJobs.map((job) => (
            <div key={job.id} className={`cron-card ${job.enabled ? 'enabled' : 'disabled'}`}>
              <div className="card-header">
                <div className="card-info">
                  <span className="job-name">{job.name}</span>
                  <div className="job-schedule">
                    <span className="schedule-label">{formatSchedule(job.schedule)}</span>
                    <code className="schedule-cron">{job.schedule}</code>
                  </div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={job.enabled}
                    onChange={() => toggleJob(job.id)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <p className="job-payload">{job.payload}</p>

              <div className="job-stats">
                {job.lastRun && (
                  <span className="stat">
                    <span className="stat-label">Last run:</span>
                    <span className={`stat-value ${job.lastResult}`}>
                      {job.lastResult === 'success' && '✓ '}
                      {job.lastResult === 'error' && '✗ '}
                      {job.lastRun}
                    </span>
                  </span>
                )}
                {job.nextRun && job.enabled && (
                  <span className="stat">
                    <span className="stat-label">Next run:</span>
                    <span className="stat-value">{job.nextRun}</span>
                  </span>
                )}
                {job.runCount !== undefined && (
                  <span className="stat">
                    <span className="stat-label">Total runs:</span>
                    <span className="stat-value">{job.runCount}</span>
                  </span>
                )}
              </div>

              <div className="card-actions">
                <button
                  className="btn-sm btn-secondary"
                  onClick={() => runJob(job.id)}
                  disabled={runningJobs.has(job.id)}
                >
                  {runningJobs.has(job.id) ? (
                    <>
                      <span className="spinner-mini" />
                      Running...
                    </>
                  ) : (
                    'Run Now'
                  )}
                </button>
                <button
                  className="btn-sm btn-secondary"
                  onClick={() => handleEdit(job)}
                >
                  Edit
                </button>
                <button
                  className="btn-sm btn-danger"
                  onClick={() => deleteJob(job.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
