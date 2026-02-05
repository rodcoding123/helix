/**
 * Kanban Board Component
 * Phase 5 Track 3: Displays tasks organized by status columns
 */

import { FC, useState } from 'react';
import { ChevronDown, Plus, Filter } from 'lucide-react';

export interface Task {
  id: string;
  userId: string;
  boardId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgencyScore: number;
  importanceScore: number;
  effortEstimateMinutes?: number;
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  timeSpentMinutes: number;
  parentTaskId?: string;
  blockedByTaskIds: string[];
  blocksTaskIds: string[];
  dependentCount: number;
  tags: string[];
  assigneeId?: string;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface KanbanBoardProps {
  tasks: Task[];
  boardId: string;
  columnOrder: string[];
  isLoading: boolean;
  onTaskSelect: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onAddTask: (status: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  archived: 'Archived',
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-700/50',
  in_progress: 'bg-blue-700/50',
  review: 'bg-yellow-700/50',
  done: 'bg-green-700/50',
  archived: 'bg-gray-700/50',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'border-blue-500 bg-blue-500/10',
  medium: 'border-yellow-500 bg-yellow-500/10',
  high: 'border-orange-500 bg-orange-500/10',
  critical: 'border-red-500 bg-red-500/10',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const KanbanBoard: FC<KanbanBoardProps> = ({
  tasks,
  _boardId,
  columnOrder,
  isLoading,
  onTaskSelect,
  _onStatusChange,
  onAddTask,
}) => {
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'due' | 'effort'>('priority');

  const getTasksForStatus = (status: string): Task[] => {
    let filtered = tasks.filter(
      (t) =>
        t.status === status &&
        !t.isDeleted &&
        !t.isArchived &&
        (filterPriority ? t.priority === filterPriority : true)
    );

    // Sort by selected criteria
    switch (sortBy) {
      case 'priority':
        filtered.sort((a, b) => b.importanceScore - a.importanceScore);
        break;
      case 'due':
        filtered.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
        });
        break;
      case 'effort':
        filtered.sort((a, b) => {
          const aEffort = a.effortEstimateMinutes || 0;
          const bEffort = b.effortEstimateMinutes || 0;
          return bEffort - aEffort;
        });
        break;
    }

    return filtered;
  };

  const getCompletionPercentage = (task: Task): number => {
    if (!task.effortEstimateMinutes || task.effortEstimateMinutes === 0) return 0;
    return Math.min(100, Math.round((task.timeSpentMinutes / task.effortEstimateMinutes) * 100));
  };

  const formatTimeRemaining = (task: Task): string => {
    if (!task.effortEstimateMinutes) return 'No estimate';
    const remaining = task.effortEstimateMinutes - task.timeSpentMinutes;
    if (remaining <= 0) return 'Complete';
    const hours = Math.floor(remaining / 60);
    const mins = remaining % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isOverdue = (task: Task): boolean => {
    if (!task.dueDate) return false;
    return task.dueDate.getTime() < Date.now() && task.status !== 'done';
  };

  const getDaysUntilDue = (task: Task): number | null => {
    if (!task.dueDate) return null;
    const now = new Date();
    const due = new Date(task.dueDate);
    const diffMs = due.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400">Loading board...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 px-4 py-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <Filter className="w-4 h-4 text-slate-400" />

        {/* Priority Filter */}
        <select
          value={filterPriority || ''}
          onChange={(e) => setFilterPriority(e.target.value || null)}
          className="px-3 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-100 hover:border-slate-500"
        >
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Sort By */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'priority' | 'due' | 'effort')}
          className="px-3 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-100 hover:border-slate-500"
        >
          <option value="priority">Sort: Importance</option>
          <option value="due">Sort: Due Date</option>
          <option value="effort">Sort: Effort</option>
        </select>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
        {columnOrder.map((status) => {
          const tasksInColumn = getTasksForStatus(status);
          const isExpanded = expandedColumn === status;

          return (
            <div
              key={status}
              className={`flex-shrink-0 w-80 rounded-lg border border-slate-700 overflow-hidden bg-slate-900/30`}
            >
              {/* Column Header */}
              <div className={`${STATUS_COLORS[status]} px-4 py-3 border-b border-slate-700`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">{STATUS_LABELS[status]}</h3>
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                      {tasksInColumn.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedColumn(isExpanded ? null : status)}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Tasks */}
              <div className="p-3 space-y-2 max-h-96 overflow-y-auto min-h-32">
                {tasksInColumn.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-400">No tasks</p>
                  </div>
                ) : (
                  tasksInColumn.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onTaskSelect(task.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${PRIORITY_COLORS[task.priority]}`}
                    >
                      {/* Task Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-100 truncate">
                            {task.title}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
                        </div>
                        <span className="text-xs font-bold px-2 py-1 rounded bg-slate-700/70 text-slate-200 whitespace-nowrap">
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>

                      {/* Tags */}
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {task.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                          {task.tags.length > 2 && (
                            <span className="text-xs px-2 py-0.5 text-slate-400">
                              +{task.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Time Progress */}
                      {task.effortEstimateMinutes && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400">Progress</span>
                            <span className="text-xs font-semibold text-slate-300">
                              {getCompletionPercentage(task)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-700 rounded overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                              style={{ width: `${getCompletionPercentage(task)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-slate-400">
                              {task.timeSpentMinutes}m / {task.effortEstimateMinutes}m
                            </span>
                            <span className="text-xs text-slate-400">{formatTimeRemaining(task)}</span>
                          </div>
                        </div>
                      )}

                      {/* Due Date & Urgency */}
                      {task.dueDate && (
                        <div
                          className={`text-xs px-2 py-1 rounded mb-2 ${
                            isOverdue(task)
                              ? 'bg-red-500/20 text-red-300'
                              : getDaysUntilDue(task)! <= 3
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-slate-700/50 text-slate-400'
                          }`}
                        >
                          Due in {getDaysUntilDue(task)} days
                        </div>
                      )}

                      {/* Blocking Indicator */}
                      {task.blockedByTaskIds.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-orange-400 mb-2">
                          🔒 Blocked by {task.blockedByTaskIds.length}
                        </div>
                      )}

                      {/* Urgency Score */}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-400">
                          Urgency: {Math.round(task.urgencyScore * 100)}%
                        </div>
                        <div
                          className="w-16 h-1 bg-slate-700 rounded overflow-hidden"
                          title={`Urgency: ${Math.round(task.urgencyScore * 100)}%`}
                        >
                          <div
                            className={`h-full ${
                              task.urgencyScore > 0.7
                                ? 'bg-red-500'
                                : task.urgencyScore > 0.4
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${task.urgencyScore * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Task Button */}
              <div className="px-3 py-2 border-t border-slate-700">
                <button
                  onClick={() => onAddTask(status)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanBoard;
