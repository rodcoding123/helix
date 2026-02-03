/**
 * Task Card Component
 * Phase 5 Track 3: Detailed task information display
 */

import React, { FC } from 'react';
import { X, Edit2, Trash2, Lock, Tag, Clock, Target, AlertCircle } from 'lucide-react';

export interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgencyScore: number;
  importanceScore: number;
  effortEstimateMinutes?: number;
  dueDate?: Date;
  timeSpentMinutes: number;
  blockedByTaskIds: string[];
  blocksTaskIds: string[];
  tags: string[];
  assigneeId?: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (newStatus: string) => void;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500' },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  archived: 'Archived',
};

export const TaskCard: FC<TaskCardProps> = ({
  id,
  title,
  description,
  status,
  priority,
  urgencyScore,
  importanceScore,
  effortEstimateMinutes,
  dueDate,
  timeSpentMinutes,
  blockedByTaskIds,
  blocksTaskIds,
  tags,
  assigneeId,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const isBlocked = blockedByTaskIds.length > 0;
  const isOverdue = dueDate && dueDate.getTime() < Date.now() && status !== 'done';
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const completionPercent = effortEstimateMinutes
    ? Math.min(100, Math.round((timeSpentMinutes / effortEstimateMinutes) * 100))
    : 0;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div
          className={`sticky top-0 ${PRIORITY_COLORS[priority].bg} border-b border-slate-700 px-6 py-4 flex items-start justify-between`}
        >
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
            {description && <p className="text-slate-300 mt-2">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 hover:border-slate-500 transition-colors"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Priority</label>
              <div
                className={`px-3 py-2 rounded border ${PRIORITY_COLORS[priority].border} ${PRIORITY_COLORS[priority].bg} ${PRIORITY_COLORS[priority].text} font-semibold text-center`}
              >
                {PRIORITY_LABELS[priority]}
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-400">Urgency</label>
                <span className="text-sm font-bold text-slate-200">
                  {Math.round(urgencyScore * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    urgencyScore > 0.7
                      ? 'bg-red-500'
                      : urgencyScore > 0.4
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${urgencyScore * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-400">Importance</label>
                <span className="text-sm font-bold text-slate-200">
                  {Math.round(importanceScore * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${importanceScore * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Time Tracking */}
          {effortEstimateMinutes && (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-slate-100">Time Tracking</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Progress</span>
                    <span className="text-sm font-bold text-slate-200">{completionPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <p className="text-slate-400 text-xs">Estimate</p>
                    <p className="text-slate-100 font-bold">{formatTime(effortEstimateMinutes)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <p className="text-slate-400 text-xs">Spent</p>
                    <p className="text-blue-300 font-bold">{formatTime(timeSpentMinutes)}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <p className="text-slate-400 text-xs">Remaining</p>
                    <p className="text-green-300 font-bold">
                      {formatTime(Math.max(0, effortEstimateMinutes - timeSpentMinutes))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Due Date */}
          {dueDate && (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-100">Due Date</h3>
              </div>
              <div
                className={`text-sm font-semibold px-3 py-2 rounded ${
                  isOverdue
                    ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                    : daysUntilDue! <= 3
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                }`}
              >
                {dueDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {daysUntilDue && (
                  <span className="ml-2 text-xs">
                    {isOverdue ? `(${Math.abs(daysUntilDue)} days overdue)` : `(${daysUntilDue} days)`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {(blockedByTaskIds.length > 0 || blocksTaskIds.length > 0) && (
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-100">Dependencies</h3>
              </div>

              {blockedByTaskIds.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-slate-400 mb-2">Blocked by</p>
                  <div className="flex flex-wrap gap-2">
                    {blockedByTaskIds.map((id) => (
                      <span key={id} className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs border border-red-500/50">
                        {id.slice(0, 8)}...
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {blocksTaskIds.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Blocks</p>
                  <div className="flex flex-wrap gap-2">
                    {blocksTaskIds.map((id) => (
                      <span key={id} className="bg-green-500/20 text-green-300 px-2 py-1 rounded text-xs border border-green-500/50">
                        {id.slice(0, 8)}...
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-slate-700 px-3 py-1 rounded text-sm text-slate-300"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {(isBlocked || isOverdue) && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {isBlocked && (
                    <p className="text-sm text-yellow-300">
                      This task is blocked by {blockedByTaskIds.length} other task
                      {blockedByTaskIds.length > 1 ? 's' : ''}.
                    </p>
                  )}
                  {isOverdue && (
                    <p className="text-sm text-red-300">
                      This task is overdue by {Math.abs(daysUntilDue!)} day
                      {Math.abs(daysUntilDue!) > 1 ? 's' : ''}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
