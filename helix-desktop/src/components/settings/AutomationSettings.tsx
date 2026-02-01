/**
 * Automation Settings - Cron jobs, webhooks, and auto-reply rules
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './SettingsSection.css';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  payload: string;
  agentId?: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
}

interface AutoReplyRule {
  id: string;
  pattern: string;
  response: string;
  channels: string[];
  enabled: boolean;
}

export function AutomationSettings() {
  const { getClient } = useGateway();
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [webhooks] = useState<Webhook[]>([]);
  const [autoReplies] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cron' | 'webhooks' | 'autoreplies'>('cron');
  const [showAddCron, setShowAddCron] = useState(false);

  useEffect(() => {
    loadAutomationData();
  }, []);

  const loadAutomationData = async () => {
    const client = getClient();
    if (!client?.connected) {
      setLoading(false);
      return;
    }

    try {
      const [cronResult] = await Promise.all([
        client.request('cron.list') as Promise<{ jobs: CronJob[] }>,
      ]);
      setCronJobs(cronResult.jobs || []);
    } catch (err) {
      console.error('Failed to load automation data:', err);
      // Mock data for demo
      setCronJobs([
        {
          id: '1',
          name: 'Daily Summary',
          schedule: '0 9 * * *',
          payload: 'Generate daily summary report',
          enabled: true,
          lastRun: '2026-02-01 09:00',
          nextRun: '2026-02-02 09:00',
        },
        {
          id: '2',
          name: 'Weekly Backup',
          schedule: '0 0 * * 0',
          payload: 'Run backup procedure',
          enabled: false,
          lastRun: '2026-01-26 00:00',
          nextRun: '2026-02-02 00:00',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleCronJob = async (jobId: string) => {
    const job = cronJobs.find(j => j.id === jobId);
    if (!job) return;

    setCronJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, enabled: !j.enabled } : j
    ));

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('cron.update', { jobId, enabled: !job.enabled });
      } catch (err) {
        console.error('Failed to toggle cron job:', err);
        setCronJobs(prev => prev.map(j =>
          j.id === jobId ? { ...j, enabled: job.enabled } : j
        ));
      }
    }
  };

  const runCronJob = async (jobId: string) => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('cron.run', { jobId });
      loadAutomationData();
    } catch (err) {
      console.error('Failed to run cron job:', err);
    }
  };

  const deleteCronJob = async (jobId: string) => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      await client.request('cron.remove', { jobId });
      setCronJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Failed to delete cron job:', err);
    }
  };

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <h1>Automation</h1>
        <p className="settings-section-description">
          Configure scheduled tasks, webhooks, and automated responses.
        </p>
      </header>

      <div className="automation-tabs">
        <button
          className={`tab-btn ${activeTab === 'cron' ? 'active' : ''}`}
          onClick={() => setActiveTab('cron')}
        >
          Scheduled Tasks ({cronJobs.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'webhooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('webhooks')}
        >
          Webhooks ({webhooks.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'autoreplies' ? 'active' : ''}`}
          onClick={() => setActiveTab('autoreplies')}
        >
          Auto-Reply ({autoReplies.length})
        </button>
      </div>

      {loading ? (
        <div className="settings-loading">Loading automation settings...</div>
      ) : (
        <>
          {activeTab === 'cron' && (
            <section className="settings-group">
              <div className="group-header">
                <h2>Scheduled Tasks</h2>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setShowAddCron(true)}
                >
                  + Add Task
                </button>
              </div>

              {cronJobs.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">⏰</span>
                  <p>No scheduled tasks configured.</p>
                  <button className="btn-primary" onClick={() => setShowAddCron(true)}>
                    Create your first task
                  </button>
                </div>
              ) : (
                <div className="cron-list">
                  {cronJobs.map((job) => (
                    <div key={job.id} className={`cron-item ${job.enabled ? 'enabled' : 'disabled'}`}>
                      <div className="cron-header">
                        <div className="cron-info">
                          <span className="cron-name">{job.name}</span>
                          <code className="cron-schedule">{job.schedule}</code>
                        </div>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={job.enabled}
                            onChange={() => toggleCronJob(job.id)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <p className="cron-payload">{job.payload}</p>
                      <div className="cron-meta">
                        {job.lastRun && (
                          <span className="meta-item">
                            Last run: {job.lastRun}
                          </span>
                        )}
                        {job.nextRun && job.enabled && (
                          <span className="meta-item">
                            Next run: {job.nextRun}
                          </span>
                        )}
                      </div>
                      <div className="cron-actions">
                        <button
                          className="btn-sm btn-secondary"
                          onClick={() => runCronJob(job.id)}
                        >
                          Run Now
                        </button>
                        <button className="btn-sm btn-secondary">Edit</button>
                        <button
                          className="btn-sm btn-danger"
                          onClick={() => deleteCronJob(job.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'webhooks' && (
            <section className="settings-group">
              <div className="group-header">
                <h2>Webhooks</h2>
                <button className="btn-primary btn-sm">+ Add Webhook</button>
              </div>

              <div className="empty-state">
                <span className="empty-icon">🪝</span>
                <p>No webhooks configured.</p>
                <button className="btn-primary">Create your first webhook</button>
              </div>
            </section>
          )}

          {activeTab === 'autoreplies' && (
            <section className="settings-group">
              <div className="group-header">
                <h2>Auto-Reply Rules</h2>
                <button className="btn-primary btn-sm">+ Add Rule</button>
              </div>

              <div className="empty-state">
                <span className="empty-icon">⚡</span>
                <p>No auto-reply rules configured.</p>
                <button className="btn-primary">Create your first rule</button>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">Default Thinking Level</span>
                  <span className="settings-item-description">
                    How much reasoning to apply by default
                  </span>
                </div>
                <select className="settings-select">
                  <option value="off">Off</option>
                  <option value="minimal">Minimal</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="xhigh">Extra High</option>
                </select>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <span className="settings-item-label">Verbose Mode</span>
                  <span className="settings-item-description">
                    Show detailed output in responses
                  </span>
                </div>
                <label className="toggle">
                  <input type="checkbox" />
                  <span className="toggle-slider" />
                </label>
              </div>
            </section>
          )}
        </>
      )}

      {showAddCron && (
        <div className="modal-overlay" onClick={() => setShowAddCron(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Scheduled Task</h3>
            <div className="form-group">
              <label>Name</label>
              <input type="text" className="settings-input" placeholder="Task name..." />
            </div>
            <div className="form-group">
              <label>Schedule (cron syntax)</label>
              <input type="text" className="settings-input" placeholder="0 9 * * *" />
              <span className="form-hint">minute hour day month weekday</span>
            </div>
            <div className="form-group">
              <label>Payload / Prompt</label>
              <textarea className="settings-textarea" placeholder="What should Helix do?" rows={3} />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddCron(false)}>
                Cancel
              </button>
              <button className="btn-primary">Create Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
