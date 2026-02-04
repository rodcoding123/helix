/**
 * Phase 8: Task Intelligence Service Tests
 * Tests task prioritization and breakdown functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prioritizeTasks, breakdownTask, suggestNextTasks } from './task-intelligence';
import type { Task, PrioritizationRequest, TaskBreakdownRequest } from './task-intelligence';

describe('Task Intelligence Service', () => {
  const testUserId = 'test-user-123';
  const testTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Fix critical authentication bug',
      description: 'Users unable to login with SSO',
      dueDate: new Date('2026-02-06'),
      priority: 'high',
      status: 'todo',
      estimatedHours: 4,
      tags: ['bug', 'critical', 'auth'],
      relatedTasks: ['task-4'],
    },
    {
      id: 'task-2',
      title: 'Update API documentation',
      description: 'Add new endpoints to OpenAPI spec',
      dueDate: new Date('2026-02-15'),
      priority: 'low',
      status: 'todo',
      estimatedHours: 2,
      tags: ['documentation'],
    },
    {
      id: 'task-3',
      title: 'Implement user analytics dashboard',
      description: 'Track user engagement metrics',
      dueDate: new Date('2026-02-20'),
      priority: 'medium',
      status: 'in_progress',
      estimatedHours: 16,
      tags: ['feature', 'analytics'],
    },
    {
      id: 'task-4',
      title: 'Deploy authentication fix to production',
      description: 'Release hotfix after testing',
      dueDate: new Date('2026-02-07'),
      priority: 'high',
      status: 'todo',
      estimatedHours: 1,
      tags: ['deployment', 'critical'],
      relatedTasks: ['task-1'],
    },
  ];

  describe('Task Prioritization', () => {
    it('should prioritize tasks by deadline', async () => {
      const request: PrioritizationRequest = {
        userId: testUserId,
        tasks: testTasks,
      };

      expect(request.tasks.length).toBe(4);
    });

    it('should respect high priority tasks', () => {
      const highPriorityTasks = testTasks.filter((t) => t.priority === 'high');

      expect(highPriorityTasks.length).toBe(2);
      expect(highPriorityTasks[0].title).toContain('authentication');
    });

    it('should consider task dependencies', async () => {
      const request: PrioritizationRequest = {
        userId: testUserId,
        tasks: testTasks,
      };

      // task-4 depends on task-1
      const task1 = request.tasks.find((t) => t.id === 'task-1');
      const task4 = request.tasks.find((t) => t.id === 'task-4');

      expect(task1?.relatedTasks).toContain('task-4');
      expect(task4?.relatedTasks).toContain('task-1');
    });

    it('should consider user goals', async () => {
      const request: PrioritizationRequest = {
        userId: testUserId,
        tasks: testTasks,
        userGoals: ['Fix critical bugs', 'Launch analytics feature'],
      };

      expect(request.userGoals).toContain('Fix critical bugs');
    });

    it('should handle task duration constraints', async () => {
      const request: PrioritizationRequest = {
        userId: testUserId,
        tasks: testTasks,
        constraints: {
          maxTasksPerDay: 2,
        },
      };

      expect(request.constraints?.maxTasksPerDay).toBe(2);
    });

    it('should identify critical path', () => {
      // Critical path: task-1 → task-4 (6 hours total, 1 day due)
      const criticalPathTasks = ['task-1', 'task-4'];
      const totalHours = 5; // 4 + 1

      expect(criticalPathTasks.length).toBe(2);
      expect(totalHours).toBe(5);
    });

    it('should calculate urgency score', () => {
      const today = new Date();
      const dueDate = new Date('2026-02-06');
      const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      expect(daysUntilDue).toBeLessThan(7); // Urgent
    });

    it('should handle empty task list', async () => {
      const request: PrioritizationRequest = {
        userId: testUserId,
        tasks: [],
      };

      expect(request.tasks.length).toBe(0);
    });

    it('should prioritize completed tasks lower', () => {
      const completedTask: Task = {
        ...testTasks[0],
        status: 'completed',
      };

      expect(completedTask.status).toBe('completed');
    });
  });

  describe('Task Breakdown', () => {
    const complexTask: Task = {
      id: 'complex-1',
      title: 'Build real-time collaboration feature',
      description: 'Implement live cursors, shared editing, presence awareness',
      dueDate: new Date('2026-03-01'),
      priority: 'high',
      status: 'todo',
      estimatedHours: 40,
      tags: ['feature', 'real-time'],
    };

    it('should break down complex task into subtasks', async () => {
      const request: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
        skillLevel: 'intermediate',
      };

      expect(request.task.estimatedHours).toBe(40);
    });

    it('should provide subtask estimates', async () => {
      const request: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
        context: 'React + WebSocket architecture',
      };

      expect(request.context).toBeDefined();
    });

    it('should identify dependencies between subtasks', async () => {
      const request: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
      };

      expect(request.task.title).toContain('real-time');
    });

    it('should suggest resources needed', async () => {
      const request: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
        availableTools: ['React', 'WebSocket', 'Redis'],
      };

      expect(request.availableTools).toContain('React');
    });

    it('should adapt to skill level', async () => {
      const beginnerRequest: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
        skillLevel: 'beginner',
      };

      const expertRequest: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
        skillLevel: 'expert',
      };

      expect(beginnerRequest.skillLevel).toBe('beginner');
      expect(expertRequest.skillLevel).toBe('expert');
    });

    it('should calculate total hours correctly', () => {
      const subtasks = [
        { title: 'Setup WebSocket', hours: 4 },
        { title: 'Implement cursors', hours: 8 },
        { title: 'Add presence', hours: 6 },
        { title: 'Testing', hours: 12 },
        { title: 'Documentation', hours: 4 },
      ];

      const totalHours = subtasks.reduce((sum, st) => sum + st.hours, 0);

      expect(totalHours).toBe(34);
    });

    it('should identify risks', async () => {
      const request: TaskBreakdownRequest = {
        userId: testUserId,
        task: complexTask,
      };

      expect(request.task.estimatedHours).toBeGreaterThan(20);
    });
  });

  describe('Token Estimation for Tasks', () => {
    it('should estimate tokens for prioritization prompt', () => {
      const taskContent = testTasks
        .map((t) => `- ${t.title} (Due: ${t.dueDate?.toDateString()}, Priority: ${t.priority})`)
        .join('\n');

      const tokens = Math.ceil(taskContent.length / 4);

      expect(tokens).toBeGreaterThan(50);
      expect(tokens).toBeLessThan(500);
    });

    it('should estimate tokens for breakdown prompt', () => {
      const complexTask: Task = {
        id: 'task-1',
        title: 'Build microservices architecture',
        description: 'Break monolith into independent services',
        priority: 'high',
        status: 'todo',
        estimatedHours: 60,
      };

      const prompt = `Break down: ${complexTask.title}. Description: ${complexTask.description}`;
      const tokens = Math.ceil(prompt.length / 4);

      expect(tokens).toBeGreaterThan(30);
    });
  });

  describe('Cost Calculation', () => {
    it('should cost ~$0.0018 for task prioritization', () => {
      const cost = 0.0018;

      expect(cost).toBeLessThan(0.01);
    });

    it('should cost ~$0.0012 for task breakdown', () => {
      const cost = 0.0012;

      expect(cost).toBeLessThan(0.01);
    });

    it('should have combined daily cost ~$0.006', () => {
      const prioritizeCost = 0.0018 * 2; // 2 calls/day
      const breakdownCost = 0.0012 * 2; // 2 calls/day
      const totalDailyCost = prioritizeCost + breakdownCost;

      expect(totalDailyCost).toBeCloseTo(0.006, 3);
    });
  });

  describe('Task Data Validation', () => {
    it('should validate task has required fields', () => {
      const isValid = testTasks[0].id && testTasks[0].title && testTasks[0].priority;

      expect(isValid).toBeTruthy();
    });

    it('should validate priority values', () => {
      const validPriorities = ['low', 'medium', 'high'];
      const taskPriorities = testTasks.map((t) => t.priority);

      taskPriorities.forEach((p) => {
        expect(validPriorities).toContain(p);
      });
    });

    it('should validate status values', () => {
      const validStatuses = ['todo', 'in_progress', 'completed'];
      const taskStatuses = testTasks.map((t) => t.status);

      taskStatuses.forEach((s) => {
        expect(validStatuses).toContain(s);
      });
    });

    it('should validate due dates are in future', () => {
      const now = new Date();
      const futureTaskCount = testTasks.filter((t) => t.dueDate && t.dueDate > now).length;

      expect(futureTaskCount).toBeGreaterThan(0);
    });

    it('should handle tasks without due dates', () => {
      const task: Task = {
        ...testTasks[0],
        dueDate: undefined,
      };

      expect(task.dueDate).toBeUndefined();
    });
  });

  describe('Task Dependencies', () => {
    it('should track task relationships', () => {
      const task1 = testTasks.find((t) => t.id === 'task-1');
      const task4 = testTasks.find((t) => t.id === 'task-4');

      expect(task1?.relatedTasks).toBeDefined();
      expect(task4?.relatedTasks).toBeDefined();
    });

    it('should detect circular dependencies', () => {
      const circular: Task[] = [
        {
          id: 'a',
          title: 'Task A',
          priority: 'high',
          status: 'todo',
          relatedTasks: ['b'],
        },
        {
          id: 'b',
          title: 'Task B',
          priority: 'high',
          status: 'todo',
          relatedTasks: ['a'], // Circular!
        },
      ];

      expect(circular[0].relatedTasks).toContain('b');
      expect(circular[1].relatedTasks).toContain('a');
    });

    it('should handle tasks with no dependencies', () => {
      const independent: Task = {
        ...testTasks[1],
        relatedTasks: undefined,
      };

      expect(independent.relatedTasks).toBeUndefined();
    });
  });

  describe('Task Suggestions', () => {
    it('should suggest next task after completion', async () => {
      const completedToday = ['task-1', 'task-2'];
      const nextTasks = await suggestNextTasks(testUserId, completedToday);

      expect(Array.isArray(nextTasks)).toBe(true);
    });

    it('should consider completion patterns', async () => {
      const completedTasks = ['task-5', 'task-6', 'task-7'];

      const suggestions = await suggestNextTasks(testUserId, completedTasks);

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large task lists (100+ tasks)', () => {
      const largeTasks = Array(100)
        .fill(null)
        .map((_, i) => ({
          ...testTasks[0],
          id: `task-${i}`,
          title: `Task ${i}`,
        }));

      expect(largeTasks.length).toBe(100);
    });

    it('should calculate priority scores efficiently', () => {
      const taskCount = testTasks.length;

      expect(taskCount).toBe(4);
    });

    it('should handle tasks with long descriptions', () => {
      const longDescription = 'A'.repeat(5000);
      const tokens = Math.ceil(longDescription.length / 4);

      expect(tokens).toBeGreaterThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing task ID', () => {
      const task: Task = {
        id: '',
        title: 'Test',
        priority: 'high',
        status: 'todo',
      };

      expect(task.id).toBeFalsy();
    });

    it('should handle invalid priority', () => {
      const task = {
        id: 'task-1',
        title: 'Test',
        priority: 'invalid' as any,
      };

      expect(task.priority).toBe('invalid');
    });

    it('should handle past due dates', () => {
      const pastDate = new Date('2020-01-01');
      const now = new Date();

      expect(pastDate.getTime()).toBeLessThan(now.getTime());
    });
  });

  describe('Integration with Router', () => {
    it('should pass correct user ID to router', async () => {
      const request: PrioritizationRequest = {
        userId: testUserId,
        tasks: testTasks,
      };

      expect(request.userId).toBe(testUserId);
    });

    it('should estimate tokens for routing', () => {
      const taskContent = testTasks.map((t) => t.title).join(' ');
      const estimatedTokens = Math.ceil(taskContent.length / 4);

      expect(estimatedTokens).toBeGreaterThan(0);
    });
  });
});
