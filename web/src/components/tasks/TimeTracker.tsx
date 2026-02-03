/**
 * Time Tracker Component
 * Phase 5 Track 3: Log time spent on tasks
 */

import React, { FC, useState } from 'react';
import { Clock, Plus, Trash2, Check } from 'lucide-react';

export interface TimeEntry {
  id?: string;
  taskId: string;
  durationMinutes: number;
  description?: string;
  isBillable: boolean;
  createdAt: Date;
}

export interface TimeTrackerProps {
  taskId: string;
  taskTitle: string;
  currentTimeSpent: number;
  estimatedMinutes?: number;
  onLogTime: (entry: TimeEntry) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  recentEntries?: TimeEntry[];
  isLoading?: boolean;
}

export const TimeTracker: FC<TimeTrackerProps> = ({
  taskId,
  taskTitle,
  currentTimeSpent,
  estimatedMinutes,
  onLogTime,
  onDeleteEntry,
  recentEntries = [],
  isLoading = false,
}) => {
  const [duration, setDuration] = useState<string>('30');
  const [description, setDescription] = useState<string>('');
  const [isBillable, setIsBillable] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showEntries, setShowEntries] = useState<boolean>(false);

  const durationMinutes = parseInt(duration) || 0;
  const completionPercent = estimatedMinutes
    ? Math.min(100, Math.round(((currentTimeSpent + durationMinutes) / estimatedMinutes) * 100))
    : 0;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (durationMinutes <= 0) return;

    setIsSubmitting(true);
    try {
      await onLogTime({
        taskId,
        durationMinutes,
        description: description || undefined,
        isBillable,
        createdAt: new Date(),
      });

      setDuration('30');
      setDescription('');
      setIsBillable(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOverEstimate = estimatedMinutes && currentTimeSpent + durationMinutes > estimatedMinutes;

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700/50 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-slate-100">Time Tracking</h3>
        <span className="ml-auto text-sm text-slate-400">{taskTitle}</span>
      </div>

      {/* Current Time Summary */}
      <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Time Spent</p>
            <p className="text-lg font-bold text-blue-300">{formatTime(currentTimeSpent)}</p>
          </div>

          {estimatedMinutes && (
            <>
              <div>
                <p className="text-xs text-slate-400 mb-1">Estimate</p>
                <p className="text-lg font-bold text-slate-300">{formatTime(estimatedMinutes)}</p>
              </div>

              <div>
                <p className="text-xs text-slate-400 mb-1">Remaining</p>
                <p
                  className={`text-lg font-bold ${
                    currentTimeSpent >= estimatedMinutes
                      ? 'text-red-300'
                      : 'text-green-300'
                  }`}
                >
                  {formatTime(Math.max(0, estimatedMinutes - currentTimeSpent))}
                </p>
              </div>
            </>
          )}
        </div>

        {estimatedMinutes && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Progress</span>
              <span
                className={`text-xs font-bold ${
                  isOverEstimate ? 'text-red-300' : 'text-slate-300'
                }`}
              >
                {completionPercent}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isOverEstimate
                    ? 'bg-red-500'
                    : completionPercent > 75
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, completionPercent)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Log Time Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3 border-b border-slate-700">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Duration (minutes)</label>
          <input
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="What did you work on?"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(e) => setIsBillable(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-700 border-slate-600 cursor-pointer"
            />
            <span className="text-sm text-slate-300">Billable</span>
          </label>

          {isOverEstimate && estimatedMinutes && (
            <div className="ml-auto text-xs text-red-300 font-semibold">
              ⚠ Will exceed estimate by {formatTime(currentTimeSpent + durationMinutes - estimatedMinutes)}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || durationMinutes <= 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Log Time
        </button>
      </form>

      {/* Recent Entries */}
      {recentEntries.length > 0 && (
        <div className="border-t border-slate-700">
          <button
            onClick={() => setShowEntries(!showEntries)}
            className="w-full px-4 py-3 text-left text-sm font-medium text-slate-300 hover:bg-slate-700/50 transition-colors flex items-center justify-between"
          >
            <span>Recent Entries ({recentEntries.length})</span>
            <span
              className={`text-xs transition-transform ${showEntries ? 'rotate-180' : ''}`}
            >
              ▼
            </span>
          </button>

          {showEntries && (
            <div className="px-4 py-3 space-y-2 bg-slate-900/30 max-h-48 overflow-y-auto">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id || `${entry.createdAt.getTime()}`}
                  className="flex items-start justify-between p-2 rounded bg-slate-700/50 hover:bg-slate-700/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100">
                      {formatTime(entry.durationMinutes)}
                    </p>
                    {entry.description && (
                      <p className="text-xs text-slate-400 truncate">{entry.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {entry.createdAt.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {entry.isBillable && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/50">
                          Billable
                        </span>
                      )}
                    </div>
                  </div>

                  {entry.id && (
                    <button
                      onClick={() => onDeleteEntry(entry.id!)}
                      className="ml-2 text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {recentEntries.length === 0 && (
        <div className="px-4 py-6 text-center">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No time entries yet</p>
        </div>
      )}
    </div>
  );
};

export default TimeTracker;
