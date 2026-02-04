/**
 * Phase 8: Task Intelligence Service
 * Integrates with Phase 0.5 AIOperationRouter for task prioritization and breakdown
 *
 * Cost Tracking:
 * - task-prioritize: ~$0.0018/call × 2/day = $0.0036/day
 * - task-breakdown: ~$0.0012/call × 2/day = $0.0024/day
 */

import { aiRouter } from './router-client';
import { getProviderClient } from '../../lib/ai-provider-client';
import type { AIOperationRouter } from '../../lib/ai-router';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed';
  estimatedHours?: number;
  tags?: string[];
  relatedTasks?: string[];
}

interface PrioritizationRequest {
  userId: string;
  tasks: Task[];
  userGoals?: string[];
  deadlines?: Array<{ date: Date; importance: number }>;
  constraints?: {
    maxTasksPerDay?: number;
    skillLevelsRequired?: Record<string, number>;
  };
}

interface PrioritizationResponse {
  reorderedTasks: Array<Task & { score: number; reasoning: string }>;
  suggestedDailyLoad: number;
  criticalPath: string[];
}

interface TaskBreakdownRequest {
  userId: string;
  task: Task;
  context?: string;
  skillLevel?: 'beginner' | 'intermediate' | 'expert';
  availableTools?: string[];
}

interface SubTask {
  title: string;
  estimatedHours: number;
  dependencies?: string[];
  skillRequired?: string;
  description?: string;
}

interface TaskBreakdownResponse {
  subtasks: SubTask[];
  estimatedTotalHours: number;
  criticalDependencies: string[];
  suggestedSequence: string[];
  riskFactors: string[];
}

/**
 * AI-powered task prioritization and reordering
 * Considers deadlines, dependencies, and user goals
 */
export async function prioritizeTasks(request: PrioritizationRequest): Promise<PrioritizationResponse> {
  // Estimate tokens from task content
  const contentSize = request.tasks.reduce((sum, task) => sum + task.title.length + (task.description?.length || 0), 0);
  const estimatedTokens = Math.ceil((contentSize + (request.userGoals?.join('').length || 0)) / 4);

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'task-prioritize',
    userId: request.userId,
    input: {
      tasks: request.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate?.toISOString(),
        priority: t.priority,
        estimatedHours: t.estimatedHours,
        tags: t.tags,
      })),
      goals: request.userGoals,
      constraints: request.constraints,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildPrioritizationPrompt(request),
    maxTokens: 1000,
  });

  // Parse response
  return parsePrioritizationResponse(response, request);
}

/**
 * Break down large tasks into actionable subtasks
 * Provides step-by-step instructions and resource recommendations
 */
export async function breakdownTask(request: TaskBreakdownRequest): Promise<TaskBreakdownResponse> {
  // Estimate tokens from task content
  const contentSize =
    request.task.title.length +
    (request.task.description?.length || 0) +
    (request.context?.length || 0);

  const estimatedTokens = Math.ceil(contentSize / 4);

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'task-breakdown',
    userId: request.userId,
    input: {
      task: {
        title: request.task.title,
        description: request.task.description,
        priority: request.task.priority,
        estimatedHours: request.task.estimatedHours,
      },
      context: request.context,
      skillLevel: request.skillLevel,
      availableTools: request.availableTools,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildTaskBreakdownPrompt(request),
    maxTokens: 1200,
  });

  // Parse response
  return parseTaskBreakdownResponse(response);
}

/**
 * Get intelligent task suggestions based on user's work patterns
 * (Can be extended for daily recommendations)
 */
export async function suggestNextTasks(userId: string, completedToday: string[]): Promise<string[]> {
  // This would integrate with analytics to suggest tasks aligned with productivity
  return [];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildPrioritizationPrompt(request: PrioritizationRequest): string {
  const taskList = request.tasks
    .map((t) => `- ${t.title} (Due: ${t.dueDate?.toDateString() || 'No date'}, Priority: ${t.priority})`)
    .join('\n');

  return `You are a task prioritization expert. Re-order these tasks by importance and urgency.
Consider deadlines, dependencies, and business impact.

Tasks:
${taskList}

${request.userGoals ? `User Goals: ${request.userGoals.join(', ')}` : ''}

For each task, provide a prioritization score (0-100) and brief reasoning.
Format as JSON with fields: id, title, score, reasoning.

Return a reordered list with highest priority first.`;
}

function buildTaskBreakdownPrompt(request: TaskBreakdownRequest): string {
  return `You are a task breakdown specialist. Break down this complex task into specific, actionable subtasks.

Task: ${request.task.title}
${request.task.description ? `Description: ${request.task.description}` : ''}
Estimated Hours: ${request.task.estimatedHours || '?'}
${request.context ? `Context: ${request.context}` : ''}
Skill Level: ${request.skillLevel || 'intermediate'}
${request.availableTools ? `Available Tools: ${request.availableTools.join(', ')}` : ''}

Provide:
1. List of subtasks with estimated hours each
2. Task dependencies (which must be done first)
3. Suggested sequence
4. Potential risks or challenges
5. Resources or tools needed

Format as structured JSON with fields: subtasks, estimatedTotalHours, dependencies, sequence, risks.`;
}

function parsePrioritizationResponse(response: string, request: PrioritizationRequest): PrioritizationResponse {
  try {
    // Try to parse JSON response
    const parsed = JSON.parse(response);

    const reorderedTasks = parsed.reorderedTasks
      .map((item: { id: string; score: number; reasoning: string }) => {
        const task = request.tasks.find((t) => t.id === item.id);
        return {
          ...task,
          score: item.score,
          reasoning: item.reasoning,
        };
      })
      .filter(Boolean);

    // Extract critical path from response
    const criticalPath = parsed.criticalPath || [];

    return {
      reorderedTasks,
      suggestedDailyLoad: parsed.suggestedDailyLoad || Math.ceil(request.tasks.length / 5),
      criticalPath,
    };
  } catch {
    // Fallback: return tasks in original order with default scores
    return {
      reorderedTasks: request.tasks.map((t, index) => ({
        ...t,
        score: 100 - index * 10,
        reasoning: 'Default prioritization',
      })),
      suggestedDailyLoad: 3,
      criticalPath: [],
    };
  }
}

function parseTaskBreakdownResponse(response: string): TaskBreakdownResponse {
  try {
    const parsed = JSON.parse(response);
    return {
      subtasks: parsed.subtasks || [],
      estimatedTotalHours: parsed.estimatedTotalHours || 0,
      criticalDependencies: parsed.dependencies || [],
      suggestedSequence: parsed.sequence || [],
      riskFactors: parsed.risks || [],
    };
  } catch {
    // Fallback: parse text response into subtasks
    const lines = response.split('\n').filter((l) => l.trim().startsWith('-'));
    const subtasks = lines.map((line) => ({
      title: line.replace('-', '').trim(),
      estimatedHours: 2,
      description: '',
    }));

    return {
      subtasks,
      estimatedTotalHours: subtasks.length * 2,
      criticalDependencies: [],
      suggestedSequence: subtasks.map((_, i) => `Step ${i + 1}`),
      riskFactors: [],
    };
  }
}

async function callAIModel(
  routing: Awaited<ReturnType<AIOperationRouter['route']>>,
  options: { prompt: string; maxTokens: number }
): Promise<string> {
  const provider = getProviderClient();

  try {
    const response = await provider.callModel(routing, {
      model: routing.model as any,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
      temperature: 0.6,
      systemPrompt: 'You are a task management and project planning expert. Help break down work and prioritize tasks effectively.',
    });

    return response.content;
  } catch (error) {
    console.error(`Task intelligence error with ${routing.model}:`, error);
    return 'Task assistance unavailable. Please try again.';
  }
}
