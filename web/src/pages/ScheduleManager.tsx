/**
 * Phase 9A Week 22: Schedule Manager Page
 * UI for creating, managing, and monitoring scheduled AI operations
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getCronScheduler } from '../services/scheduling/cron-scheduler';
import type { ScheduleConfig } from '../services/scheduling/cron-scheduler';

interface ScheduleCardProps {
  schedule: ScheduleConfig & { last_execution_at?: string; execution_count: number };
  onSelect: () => void;
}

interface NewScheduleDialogProps {
  operations: Array<{ id: string; name: string; description: string }>;
  onCreate: (config: Partial<ScheduleConfig>) => Promise<void>;
  onCancel: () => void;
}

/**
 * Main Schedule Manager Page Component
 */
export function ScheduleManager(): React.ReactElement {
  const db = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );

  const [schedules, setSchedules] = useState<
    Array<ScheduleConfig & { last_execution_at?: string; execution_count: number }>
  >([]);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<
    (ScheduleConfig & { last_execution_at?: string; execution_count: number }) | null
  >(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const PHASE_8_OPERATIONS = [
    {
      id: 'email-compose',
      name: 'Email Composition',
      description: 'AI-powered email drafting assistance',
    },
    {
      id: 'email-classify',
      name: 'Email Classification',
      description: 'Auto-categorize emails into folders',
    },
    {
      id: 'email-respond',
      name: 'Response Suggestions',
      description: 'Generate smart reply suggestions',
    },
    {
      id: 'calendar-prep',
      name: 'Meeting Preparation',
      description: 'Auto-generate meeting prep notes',
    },
    {
      id: 'calendar-time',
      name: 'Optimal Meeting Times',
      description: 'Find best meeting slots for attendees',
    },
    {
      id: 'task-prioritize',
      name: 'Task Prioritization',
      description: 'AI-powered task prioritization and ordering',
    },
    {
      id: 'task-breakdown',
      name: 'Task Breakdown',
      description: 'Generate subtasks and action items',
    },
    {
      id: 'analytics-summary',
      name: 'Weekly Summary',
      description: 'AI-generated productivity reports',
    },
    {
      id: 'analytics-anomaly',
      name: 'Pattern Anomalies',
      description: 'Detect unusual patterns in data',
    },
  ];

  // Initialize user and load schedules
  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: session } = await db.auth.getSession();
        if (session?.user?.id) {
          setUserId(session.user.id);
          await loadSchedules(session.user.id);
        }
      } catch (error) {
        console.error('Failed to initialize user:', error);
      } finally {
        setLoading(false);
      }
    };

    initUser();
  }, []);

  async function loadSchedules(uid: string) {
    try {
      const { data, error } = await db
        .from('operation_schedules')
        .select('*')
        .eq('user_id', uid);

      if (error) throw error;
      setSchedules((data || []) as typeof schedules);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  }

  async function createSchedule(config: Partial<ScheduleConfig>) {
    if (!userId) return;

    try {
      const fullConfig = {
        user_id: userId,
        ...config,
      };

      const { data, error } = await db
        .from('operation_schedules')
        .insert(fullConfig)
        .select()
        .single();

      if (error) throw error;

      // Schedule the job
      const scheduler = getCronScheduler();
      await scheduler.scheduleJob(data as ScheduleConfig);

      await loadSchedules(userId);
      setShowNewSchedule(false);
    } catch (error) {
      console.error('Failed to create schedule:', error);
    }
  }

  async function deleteSchedule(scheduleId: string) {
    try {
      await db.from('operation_schedules').delete().eq('id', scheduleId);
      await loadSchedules(userId!);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading schedules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Operation Schedules</h1>
          <p className="text-gray-600 mt-2">
            Automate your AI operations with cron-based scheduling
          </p>
        </div>
        <button
          onClick={() => setShowNewSchedule(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + New Schedule
        </button>
      </div>

      {/* Schedules Grid */}
      <div className="grid gap-4">
        {schedules.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">No schedules yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Create your first scheduled operation to get started
            </p>
          </div>
        ) : (
          schedules.map(schedule => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onSelect={() => setSelectedSchedule(schedule)}
            />
          ))
        )}
      </div>

      {/* New Schedule Dialog */}
      {showNewSchedule && (
        <NewScheduleDialog
          operations={PHASE_8_OPERATIONS}
          onCreate={createSchedule}
          onCancel={() => setShowNewSchedule(false)}
        />
      )}

      {/* Schedule Detail Modal */}
      {selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
          onDelete={deleteSchedule}
        />
      )}
    </div>
  );
}

/**
 * Schedule Card Component
 */
function ScheduleCard({ schedule, onSelect }: ScheduleCardProps): React.ReactElement {
  const nextRun = schedule.next_execution_at ? new Date(schedule.next_execution_at) : null;
  const lastRun = schedule.last_execution_at ? new Date(schedule.last_execution_at) : null;

  return (
    <div
      onClick={onSelect}
      className="p-4 border rounded-lg hover:shadow-lg hover:border-blue-400 cursor-pointer transition bg-white"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{schedule.operation_id}</h3>
          <p className="text-sm text-gray-600 mt-1">{schedule.cron_expression}</p>
          <p className="text-xs text-gray-500 mt-2">
            Timezone: <span className="font-mono">{schedule.timezone}</span>
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-semibold ${
            schedule.enabled
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {schedule.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-xs">
        <div>
          <p className="text-gray-500">Executions</p>
          <p className="font-semibold text-gray-900">{schedule.execution_count}</p>
        </div>
        {nextRun && (
          <div>
            <p className="text-gray-500">Next Run</p>
            <p className="font-semibold text-gray-900">{nextRun.toLocaleString()}</p>
          </div>
        )}
        {lastRun && (
          <div>
            <p className="text-gray-500">Last Run</p>
            <p className="font-semibold text-gray-900">{lastRun.toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * New Schedule Dialog Component
 */
function NewScheduleDialog({
  operations,
  onCreate,
  onCancel,
}: NewScheduleDialogProps): React.ReactElement {
  const [selectedOp, setSelectedOp] = useState(operations[0]?.id);
  const [cronExpression, setCronExpression] = useState('0 18 * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [isCreating, setIsCreating] = useState(false);

  const commonExpressions = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Hourly', value: '0 * * * *' },
    { label: 'Daily at 6 PM', value: '0 18 * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Monday-Friday at 9 AM', value: '0 9 * * 1-5' },
    { label: 'Sundays at midnight', value: '0 0 * * 0' },
  ];

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];

  async function handleCreate() {
    setIsCreating(true);
    try {
      await onCreate({
        operation_id: selectedOp,
        cron_expression: cronExpression,
        timezone,
        enabled: true,
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create New Schedule</h2>

        <div className="space-y-4">
          {/* Operation Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operation
            </label>
            <select
              value={selectedOp}
              onChange={e => setSelectedOp(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {operations.map(op => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cron Expression */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cron Expression
            </label>
            <input
              type="text"
              value={cronExpression}
              onChange={e => setCronExpression(e.target.value)}
              placeholder="0 18 * * *"
              className="w-full border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">minute hour day month dayOfWeek</p>
          </div>

          {/* Common Expressions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Common Patterns
            </label>
            <div className="grid grid-cols-2 gap-2">
              {commonExpressions.map(expr => (
                <button
                  key={expr.value}
                  onClick={() => setCronExpression(expr.value)}
                  className="text-left text-xs p-2 border rounded hover:bg-gray-50 hover:border-blue-400"
                >
                  <p className="font-medium text-gray-900">{expr.label}</p>
                  <p className="text-gray-500 font-mono">{expr.value}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Schedule Detail Modal Component
 */
function ScheduleDetailModal({
  schedule,
  onClose,
  onDelete,
}: {
  schedule: ScheduleConfig & { last_execution_at?: string; execution_count: number };
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}): React.ReactElement {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(schedule.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">{schedule.operation_id}</h2>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm text-gray-600">Operation ID</p>
            <p className="font-mono text-gray-900">{schedule.operation_id}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Cron Expression</p>
            <p className="font-mono text-gray-900">{schedule.cron_expression}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Timezone</p>
            <p className="text-gray-900">{schedule.timezone}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className={schedule.enabled ? 'text-green-600' : 'text-gray-600'}>
              {schedule.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Total Executions</p>
            <p className="text-gray-900">{schedule.execution_count}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50 transition"
          >
            Close
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleManager;
