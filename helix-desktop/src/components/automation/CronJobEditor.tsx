/**
 * Cron Job Editor - Visual scheduler for creating/editing cron jobs
 */

import { useState, useEffect } from 'react';
import './CronJobEditor.css';

interface CronJob {
  id?: string;
  name: string;
  schedule: string;
  payload: string;
  agentId?: string;
  enabled: boolean;
}

interface CronJobEditorProps {
  job?: CronJob | null;
  agents?: { id: string; name: string }[];
  onSave: (job: Omit<CronJob, 'id'>) => void;
  onCancel: () => void;
}

interface SchedulePreset {
  label: string;
  cron: string;
  description: string;
}

const SCHEDULE_PRESETS: SchedulePreset[] = [
  { label: 'Every minute', cron: '* * * * *', description: 'Runs every minute' },
  { label: 'Every 5 minutes', cron: '*/5 * * * *', description: 'Runs every 5 minutes' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *', description: 'Runs every 15 minutes' },
  { label: 'Hourly', cron: '0 * * * *', description: 'Runs at the start of every hour' },
  { label: 'Daily at midnight', cron: '0 0 * * *', description: 'Runs at 00:00 every day' },
  { label: 'Daily at 9 AM', cron: '0 9 * * *', description: 'Runs at 9:00 AM every day' },
  { label: 'Weekly (Sunday)', cron: '0 0 * * 0', description: 'Runs at midnight every Sunday' },
  { label: 'Monthly (1st)', cron: '0 0 1 * *', description: 'Runs at midnight on the 1st of each month' },
  { label: 'Weekdays 9 AM', cron: '0 9 * * 1-5', description: 'Runs at 9 AM Monday-Friday' },
  { label: 'Custom', cron: '', description: 'Enter your own cron expression' },
];

const CRON_HELP = {
  minute: { label: 'Minute', range: '0-59', description: 'Minute of the hour' },
  hour: { label: 'Hour', range: '0-23', description: 'Hour of the day (24h format)' },
  day: { label: 'Day', range: '1-31', description: 'Day of the month' },
  month: { label: 'Month', range: '1-12', description: 'Month of the year' },
  weekday: { label: 'Weekday', range: '0-6', description: 'Day of week (0=Sun, 6=Sat)' },
};

function parseCron(cron: string): { minute: string; hour: string; day: string; month: string; weekday: string } {
  const parts = cron.split(' ');
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    day: parts[2] || '*',
    month: parts[3] || '*',
    weekday: parts[4] || '*',
  };
}

function buildCron(parts: { minute: string; hour: string; day: string; month: string; weekday: string }): string {
  return `${parts.minute} ${parts.hour} ${parts.day} ${parts.month} ${parts.weekday}`;
}


export function CronJobEditor({ job, agents = [], onSave, onCancel }: CronJobEditorProps) {
  const [name, setName] = useState(job?.name || '');
  const [schedule, setSchedule] = useState(job?.schedule || '0 9 * * *');
  const [payload, setPayload] = useState(job?.payload || '');
  const [agentId, setAgentId] = useState(job?.agentId || '');
  const [enabled, setEnabled] = useState(job?.enabled ?? true);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cronParts, setCronParts] = useState(parseCron(job?.schedule || '0 9 * * *'));

  // Update schedule when cron parts change
  useEffect(() => {
    setSchedule(buildCron(cronParts));
  }, [cronParts]);

  // Detect preset from schedule
  useEffect(() => {
    const preset = SCHEDULE_PRESETS.find(p => p.cron === schedule);
    setSelectedPreset(preset?.label || 'Custom');
  }, [schedule]);

  const handlePresetChange = (presetLabel: string) => {
    const preset = SCHEDULE_PRESETS.find(p => p.label === presetLabel);
    if (preset && preset.cron) {
      setSchedule(preset.cron);
      setCronParts(parseCron(preset.cron));
    }
    setSelectedPreset(presetLabel);
    if (presetLabel === 'Custom') {
      setShowAdvanced(true);
    }
  };

  const handleCronPartChange = (part: keyof typeof cronParts, value: string) => {
    setCronParts(prev => ({ ...prev, [part]: value }));
  };

  const handleSubmit = () => {
    if (!name.trim() || !payload.trim()) return;

    onSave({
      name: name.trim(),
      schedule,
      payload: payload.trim(),
      agentId: agentId || undefined,
      enabled,
    });
  };

  const isValid = name.trim() && payload.trim() && schedule;

  return (
    <div className="cron-editor">
      <h2>{job ? 'Edit Task' : 'Create Scheduled Task'}</h2>

      <div className="editor-section">
        <label className="editor-label">
          <span className="label-text">Task Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Daily Summary Report"
            className="editor-input"
          />
        </label>
      </div>

      <div className="editor-section">
        <label className="editor-label">
          <span className="label-text">Schedule</span>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="editor-select"
          >
            {SCHEDULE_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
          <span className="label-hint">
            {SCHEDULE_PRESETS.find(p => p.label === selectedPreset)?.description}
          </span>
        </label>

        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? '▼' : '▶'} Advanced (cron syntax)
        </button>

        {showAdvanced && (
          <div className="cron-builder">
            <div className="cron-fields">
              {(Object.keys(CRON_HELP) as Array<keyof typeof CRON_HELP>).map((key) => (
                <div key={key} className="cron-field">
                  <label>
                    <span className="cron-field-label">{CRON_HELP[key].label}</span>
                    <input
                      type="text"
                      value={cronParts[key]}
                      onChange={(e) => handleCronPartChange(key, e.target.value)}
                      className="cron-field-input"
                      placeholder={CRON_HELP[key].range}
                    />
                    <span className="cron-field-hint">{CRON_HELP[key].range}</span>
                  </label>
                </div>
              ))}
            </div>

            <div className="cron-preview">
              <span className="cron-preview-label">Cron Expression:</span>
              <code className="cron-preview-value">{schedule}</code>
            </div>

            <div className="cron-help">
              <p>Special characters:</p>
              <ul>
                <li><code>*</code> - Any value</li>
                <li><code>*/n</code> - Every n units</li>
                <li><code>n-m</code> - Range from n to m</li>
                <li><code>n,m</code> - List of values</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="editor-section">
        <label className="editor-label">
          <span className="label-text">What should Helix do?</span>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Describe the task in natural language, e.g., 'Generate a summary of today's emails and send it to Slack'"
            className="editor-textarea"
            rows={4}
          />
        </label>
      </div>

      {agents.length > 0 && (
        <div className="editor-section">
          <label className="editor-label">
            <span className="label-text">Agent (optional)</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="editor-select"
            >
              <option value="">Default Agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <span className="label-hint">
              Choose which agent should execute this task
            </span>
          </label>
        </div>
      )}

      <div className="editor-section">
        <label className="editor-toggle-label">
          <span className="label-text">Enabled</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </label>
        <span className="label-hint">
          {enabled ? 'Task will run on schedule' : 'Task is paused'}
        </span>
      </div>

      <div className="editor-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!isValid}
        >
          {job ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
