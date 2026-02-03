/**
 * Tasks Hub Page
 * Phase 5 Track 3: Central interface for task management
 *
 * Features:
 * - Board selection and switching
 * - Kanban board view
 * - Task creation and editing
 * - Time tracking
 * - Task analytics
 */

import React, { FC, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TimeTracker } from '@/components/tasks/TimeTracker';
import { CheckSquare, Plus, Settings, BarChart3, Trash2 } from 'lucide-react';

type TaskTab = 'board' | 'analytics' | 'settings';

/**
 * Tasks Hub Page - Main interface for task management
 */
export const TasksPage: FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TaskTab>('board');
  const [selectedBoardId, setSelectedBoardId] = useState<string>('default');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [boards, setBoards] = useState<any[]>([
    {
      id: 'default',
      userId: user?.id,
      name: 'Default Board',
      description: 'Default task board',
      color: 'blue',
      columnOrder: ['todo', 'in_progress', 'review', 'done'],
      defaultColumn: 'todo',
      autoArchiveEnabled: true,
      archiveAfterDays: 30,
      showEstimates: true,
      trackTime: true,
      isDefault: true,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);

  // Mock task data for demo
  useEffect(() => {
    if (user) {
      setTasks([
        {
          id: 'task-1',
          userId: user.id,
          boardId: selectedBoardId,
          title: 'Review pull requests',
          description: 'Code review for team PRs',
          status: 'in_progress',
          priority: 'high',
          urgencyScore: 0.8,
          importanceScore: 0.75,
          effortEstimateMinutes: 120,
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          startedAt: new Date(),
          completedAt: null,
          timeSpentMinutes: 45,
          blockedByTaskIds: [],
          blocksTaskIds: [],
          dependentCount: 0,
          tags: ['review', 'code'],
          assigneeId: user.id,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          userId: user.id,
          boardId: selectedBoardId,
          title: 'Implement task filtering',
          description: 'Add advanced filtering options',
          status: 'todo',
          priority: 'medium',
          urgencyScore: 0.4,
          importanceScore: 0.5,
          effortEstimateMinutes: 480,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          startedAt: null,
          completedAt: null,
          timeSpentMinutes: 0,
          blockedByTaskIds: [],
          blocksTaskIds: [],
          dependentCount: 2,
          tags: ['feature', 'tasks'],
          assigneeId: null,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-3',
          userId: user.id,
          boardId: selectedBoardId,
          title: 'Fix time tracking bug',
          description: 'Time entries not persisting correctly',
          status: 'review',
          priority: 'critical',
          urgencyScore: 0.95,
          importanceScore: 1.0,
          effortEstimateMinutes: 240,
          dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          completedAt: null,
          timeSpentMinutes: 90,
          blockedByTaskIds: [],
          blocksTaskIds: ['task-2'],
          dependentCount: 0,
          tags: ['bug', 'tracking'],
          assigneeId: user.id,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-4',
          userId: user.id,
          boardId: selectedBoardId,
          title: 'Update documentation',
          description: 'Task management feature docs',
          status: 'done',
          priority: 'low',
          urgencyScore: 0.1,
          importanceScore: 0.25,
          effortEstimateMinutes: 180,
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          timeSpentMinutes: 160,
          blockedByTaskIds: [],
          blocksTaskIds: [],
          dependentCount: 0,
          tags: ['docs'],
          assigneeId: null,
          isArchived: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    }
  }, [user]);

  // Permission check
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="animate-spin mb-4 text-2xl">⟳</div>
          <p className="text-slate-400">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <p className="text-slate-400">Please log in to use task management</p>
        </div>
      </div>
    );
  }

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-green-400" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
                <p className="text-sm text-slate-400">Organize and track your work</p>
              </div>
            </div>
            <button
              onClick={() => console.log('New board')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Board
            </button>
          </div>
        </div>
      </div>

      {/* Board Selection */}
      <div className="border-b border-slate-700 bg-slate-900/30 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-2 overflow-x-auto py-3">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => setSelectedBoardId(board.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  selectedBoardId === board.id
                    ? `bg-${board.color}-600/20 text-${board.color}-300 border border-${board.color}-500`
                    : 'bg-slate-700/50 text-slate-400 hover:text-slate-300'
                }`}
              >
                {board.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-700 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8 overflow-x-auto" role="tablist">
            <button
              onClick={() => setActiveTab('board')}
              role="tab"
              aria-selected={activeTab === 'board'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'board'
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <CheckSquare className="w-4 h-4 inline mr-2" />
              Board
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              role="tab"
              aria-selected={activeTab === 'analytics'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Analytics
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              role="tab"
              aria-selected={activeTab === 'settings'}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Board Tab */}
        {activeTab === 'board' && (
          <div className="space-y-6">
            <KanbanBoard
              tasks={tasks}
              boardId={selectedBoardId}
              columnOrder={selectedBoard?.columnOrder || ['todo', 'in_progress', 'review', 'done']}
              isLoading={isLoadingBoard}
              onTaskSelect={setSelectedTaskId}
              onStatusChange={(taskId, newStatus) => {
                setTasks(
                  tasks.map((t) =>
                    t.id === taskId ? { ...t, status: newStatus } : t
                  )
                );
              }}
              onAddTask={(status) => console.log('Add task for status:', status)}
            />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Task Analytics</h2>
            <p className="text-slate-400 mb-6">
              Insights into your task progress and team productivity
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Total Tasks</p>
                <p className="text-2xl font-bold text-blue-400">{tasks.filter(t => !t.isDeleted && !t.isArchived).length}</p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">In Progress</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {tasks.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-400">
                  {tasks.filter(t => t.status === 'done').length}
                </p>
              </div>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Completion Rate</p>
                <p className="text-2xl font-bold text-purple-400">
                  {Math.round(
                    (tasks.filter(t => t.status === 'done').length /
                      Math.max(1, tasks.filter(t => !t.isDeleted && !t.isArchived).length)) * 100
                  )}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-100 mb-2">Board Settings</h2>
            <p className="text-slate-400 mb-6">
              Customize your task board and preferences
            </p>

            <div className="max-w-2xl mx-auto text-left space-y-4">
              {selectedBoard && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-100 mb-2">
                      Board Name
                    </label>
                    <input
                      type="text"
                      defaultValue={selectedBoard.name}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        defaultChecked={selectedBoard.autoArchiveEnabled}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">Auto-archive completed tasks after</span>
                    </label>
                    <input
                      type="number"
                      defaultValue={selectedBoard.archiveAfterDays}
                      className="mt-2 w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 max-w-xs"
                    />
                    <span className="text-sm text-slate-400">days</span>
                  </div>

                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        defaultChecked={selectedBoard.trackTime}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                      />
                      <span className="text-sm text-slate-300">Enable time tracking</span>
                    </label>
                  </div>

                  <button className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Delete Board
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskCard
          id={selectedTask.id}
          title={selectedTask.title}
          description={selectedTask.description}
          status={selectedTask.status}
          priority={selectedTask.priority}
          urgencyScore={selectedTask.urgencyScore}
          importanceScore={selectedTask.importanceScore}
          effortEstimateMinutes={selectedTask.effortEstimateMinutes}
          dueDate={selectedTask.dueDate}
          timeSpentMinutes={selectedTask.timeSpentMinutes}
          blockedByTaskIds={selectedTask.blockedByTaskIds}
          blocksTaskIds={selectedTask.blocksTaskIds}
          tags={selectedTask.tags}
          assigneeId={selectedTask.assigneeId}
          onClose={() => setSelectedTaskId(null)}
          onEdit={() => console.log('Edit task')}
          onDelete={() => {
            setTasks(tasks.filter(t => t.id !== selectedTask.id));
            setSelectedTaskId(null);
          }}
          onStatusChange={(newStatus) => {
            setTasks(
              tasks.map((t) =>
                t.id === selectedTask.id ? { ...t, status: newStatus } : t
              )
            );
          }}
        />
      )}

      {/* Footer */}
      <div className="border-t border-slate-700 bg-slate-900/30 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">📋</div>
              <p className="text-slate-400 text-sm mt-2">Organize Tasks</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-400">⏱️</div>
              <p className="text-slate-400 text-sm mt-2">Track Time</p>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-400">📊</div>
              <p className="text-slate-400 text-sm mt-2">Analyze Progress</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
