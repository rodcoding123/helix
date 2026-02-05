/**
 * Task Management Service
 * Phase 5 Track 3: Task CRUD, dependencies, priority scoring, time tracking
 *
 * Features:
 * - Create, read, update, delete tasks
 * - Kanban board management
 * - Task dependencies and blocking
 * - Priority and urgency scoring
 * - Time tracking and estimates
 * - Task analytics
 */

import { supabase } from '@/lib/supabase';

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

export interface TaskBoard {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  columnOrder: string[];
  defaultColumn: string;
  autoArchiveEnabled: boolean;
  archiveAfterDays: number;
  showEstimates: boolean;
  trackTime: boolean;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class TaskManagementService {
  /**
   * Get all boards for user
   */
  async getTaskBoards(userId: string): Promise<TaskBoard[]> {
    try {
      const { data, error } = await supabase
        .from('task_boards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map((board) => this.mapToTaskBoard(board));
    } catch (error) {
      console.error('Get boards error:', error);
      throw error;
    }
  }

  /**
   * Get tasks for board
   */
  async getTasksForBoard(
    userId: string,
    boardId: string,
    options?: { status?: string }
  ): Promise<Task[]> {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('board_id', boardId)
        .eq('is_deleted', false);

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      query = query.order('urgency_score', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return data.map((task) => this.mapToTask(task));
    } catch (error) {
      console.error('Get tasks error:', error);
      throw error;
    }
  }

  /**
   * Create task
   */
  async createTask(
    userId: string,
    boardId: string,
    taskData: Partial<Task>
  ): Promise<Task> {
    try {
      // Calculate urgency and importance scores
      const urgencyScore = this.calculateUrgencyScore(taskData.dueDate);
      const importanceScore = this.calculateImportanceScore(taskData.priority);

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            user_id: userId,
            board_id: boardId,
            title: taskData.title,
            description: taskData.description,
            status: taskData.status || 'todo',
            priority: taskData.priority || 'medium',
            urgency_score: urgencyScore,
            importance_score: importanceScore,
            effort_estimate_minutes: taskData.effortEstimateMinutes,
            due_date: taskData.dueDate?.toISOString(),
            tags: taskData.tags || [],
          },
        ])
        .select()
        .single();

      if (error) throw error;

      return this.mapToTask(data);
    } catch (error) {
      console.error('Create task error:', error);
      throw error;
    }
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Recalculate scores if priority or due date changed
      if (updates.dueDate) {
        updateData.urgency_score = this.calculateUrgencyScore(updates.dueDate);
      }
      if (updates.priority) {
        updateData.importance_score = this.calculateImportanceScore(updates.priority);
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      return this.mapToTask(data);
    } catch (error) {
      console.error('Update task error:', error);
      throw error;
    }
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string, hardDelete = false): Promise<void> {
    try {
      if (hardDelete) {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('id', taskId);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Delete task error:', error);
      throw error;
    }
  }

  /**
   * Add task dependency
   */
  async addDependency(
    userId: string,
    taskId: string,
    dependsOnTaskId: string,
    type: 'blocking' | 'related' | 'duplicate' = 'blocking'
  ): Promise<void> {
    try {
      const { error } = await supabase.from('task_dependencies').insert([
        {
          user_id: userId,
          task_id: taskId,
          depends_on_task_id: dependsOnTaskId,
          dependency_type: type,
        },
      ]);

      if (error) throw error;

      // Update blocked_by_task_ids on the dependent task
      const dependentTask = await supabase
        .from('tasks')
        .select('blocked_by_task_ids')
        .eq('id', taskId)
        .single();

      if (dependentTask.data) {
        const blockedIds = dependentTask.data.blocked_by_task_ids || [];
        if (!blockedIds.includes(dependsOnTaskId)) {
          await supabase
            .from('tasks')
            .update({
              blocked_by_task_ids: [...blockedIds, dependsOnTaskId],
            })
            .eq('id', taskId);
        }
      }
    } catch (error) {
      console.error('Add dependency error:', error);
      throw error;
    }
  }

  /**
   * Check if task can be started (dependencies met)
   * Uses atomic RPC function to avoid N+1 query pattern
   * Performance: 1+N queries → 1 query (where N = number of dependencies)
   */
  async canStartTask(taskId: string): Promise<boolean> {
    try {
      // Use RPC function for atomic dependency checking
      const { data, error } = await supabase
        .rpc('can_start_task', {
          p_task_id: taskId,
        });

      if (error) throw error;

      if (!data || data.length === 0) return true;

      // RPC returns { can_start: boolean, blocked_by_count: int, blocking_task_ids: uuid[] }
      return data[0]?.can_start ?? true;
    } catch (error) {
      console.error('Check can start error:', error);
      return false;
    }
  }

  /**
   * Log time entry
   * Uses atomic RPC function to avoid race condition
   * Performance: 3 queries (read + calc + update) → 2 queries (insert + RPC)
   * Correctness: Eliminates race condition in concurrent time logging
   */
  async logTimeEntry(
    userId: string,
    taskId: string,
    durationMinutes: number,
    description?: string,
    isBillable = false
  ): Promise<void> {
    try {
      // Insert time entry
      const { error: insertError } = await supabase
        .from('task_time_entries')
        .insert([
          {
            user_id: userId,
            task_id: taskId,
            start_time: new Date().toISOString(),
            duration_minutes: durationMinutes,
            description,
            is_billable: isBillable,
          },
        ]);

      if (insertError) throw insertError;

      // Use atomic RPC to increment task time (prevents race condition)
      const { data, error: updateError } = await supabase
        .rpc('increment_task_time', {
          p_task_id: taskId,
          p_time_spent_minutes: durationMinutes,
        });

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Log time error:', error);
      throw error;
    }
  }

  /**
   * Get task analytics
   */
  async getTaskAnalytics(userId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
    avgCompletionDays: number;
    totalTimeLogged: number;
  }> {
    try {
      const now = new Date();

      const [total, completed, inProgress, overdue] = await Promise.all([
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_deleted', false),
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'done'),
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'in_progress'),
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .lt('due_date', now.toISOString())
          .neq('status', 'done'),
      ]);

      const timeEntries = await supabase
        .from('task_time_entries')
        .select('duration_minutes')
        .eq('user_id', userId);

      const totalTime = timeEntries.data?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) || 0;

      const completedCount = completed.count || 0;
      const totalCount = total.count || 1;
      const completionRate = (completedCount / totalCount) * 100;

      return {
        totalTasks: totalCount,
        completedTasks: completedCount,
        inProgressTasks: inProgress.count || 0,
        overdueTasks: overdue.count || 0,
        completionRate: Math.round(completionRate),
        avgCompletionDays: 5, // Simplified for now
        totalTimeLogged: totalTime,
      };
    } catch (error) {
      console.error('Get analytics error:', error);
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
        avgCompletionDays: 0,
        totalTimeLogged: 0,
      };
    }
  }

  /**
   * Calculate urgency score based on due date
   */
  private calculateUrgencyScore(dueDate?: Date): number {
    if (!dueDate) return 0;

    const now = new Date();
    const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilDue < 0) return 1.0; // Overdue
    if (daysUntilDue < 1) return 0.9;
    if (daysUntilDue < 3) return 0.7;
    if (daysUntilDue < 7) return 0.5;
    return 0.3;
  }

  /**
   * Calculate importance score based on priority
   */
  private calculateImportanceScore(priority?: string): number {
    switch (priority) {
      case 'critical':
        return 1.0;
      case 'high':
        return 0.75;
      case 'medium':
        return 0.5;
      case 'low':
        return 0.25;
      default:
        return 0.5;
    }
  }

  /**
   * Map database record to Task
   */
  private mapToTask(data: any): Task {
    return {
      id: data.id,
      userId: data.user_id,
      boardId: data.board_id,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      urgencyScore: Number(data.urgency_score),
      importanceScore: Number(data.importance_score),
      effortEstimateMinutes: data.effort_estimate_minutes,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      timeSpentMinutes: data.time_spent_minutes || 0,
      parentTaskId: data.parent_task_id,
      blockedByTaskIds: data.blocked_by_task_ids || [],
      blocksTaskIds: data.blocks_task_ids || [],
      dependentCount: data.dependent_count || 0,
      tags: data.tags || [],
      assigneeId: data.assignee_id,
      isArchived: data.is_archived,
      isDeleted: data.is_deleted,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Map database record to TaskBoard
   */
  private mapToTaskBoard(data: any): TaskBoard {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      color: data.color,
      columnOrder: data.column_order || ['todo', 'in_progress', 'review', 'done'],
      defaultColumn: data.default_column,
      autoArchiveEnabled: data.auto_archive_enabled,
      archiveAfterDays: data.archive_after_days,
      showEstimates: data.show_estimates,
      trackTime: data.track_time,
      isDefault: data.is_default,
      isArchived: data.is_archived,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export const taskManagementService = new TaskManagementService();
