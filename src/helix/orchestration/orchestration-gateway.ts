/**
 * Orchestration Gateway - Phase 2 Modules 10-16
 *
 * Gateway RPC methods and management APIs for orchestrator.
 * Modules 10-16 combined for brevity:
 *
 * - Module 10: Job submission & queue management
 * - Module 11: Cost tracking & budget enforcement
 * - Module 12: Approval workflows
 * - Module 13-15: Dashboard queries
 * - Module 16: Smart model routing
 *
 * **Architecture**:
 * These methods are exposed via OpenClaw gateway RPC.
 * Clients call these from web/mobile or internal orchestrator.
 */

import type { OrchestratorState, OrchestratorConfig } from './agents.js';
import type { ICheckpointer as _ICheckpointer } from './checkpointer.js';
import { runOrchestrator } from './supervisor-graph.js';
import { nanoid } from 'nanoid';

/**
 * Job metadata (Module 10: Job Management)
 */
export interface OrchestratorJob {
  job_id: string;
  user_id: string;
  task: string;
  status: 'pending' | 'routing' | 'executing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: number;
  completed_at?: number;
  result?: OrchestratorState;
  error?: string;

  // Module 11: Cost tracking
  budget_cents: number;
  cost_cents: number;

  // Module 12: Approvals
  requires_approval: boolean;
  approved_at?: number;
  approved_by?: string;
}

/**
 * Module 10: Submit orchestration job
 *
 * Main entry point for users to submit tasks to orchestrator.
 * Creates job, queues for processing, returns immediately.
 */
export async function submitOrchestratorJob(
  context: any,
  params: {
    task: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    budget_cents?: number;
    config?: OrchestratorConfig;
  }
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const userId = context.userId as string;
    const logger = context.logger as any;

    const jobId = nanoid();

    logger.info(`[PRE-EXEC] Orchestrator job submitted by ${userId}: ${jobId} for task: ${params.task}`);

    // Store job in Supabase (would be integrated)
    // await supabase.from('agent_jobs').insert(job);

    // Process job asynchronously
    processOrchestratorJob(jobId, params.task, params.config, context);

    return { success: true, jobId };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Module 11-12: Check job status & approvals
 *
 * Used for polling or dashboard updates.
 * Returns job with current status, costs, and approval state.
 */
export async function getOrchestratorJobStatus(
  _context: any,
  params: { jobId: string }
): Promise<any> {
  try {
    // Would fetch from Supabase
    // const { data } = await supabase.from('agent_jobs').select('*').eq('job_id', params.jobId).single();

    return {
      success: true,
      status: 'pending',
      job_id: params.jobId,
      message: 'Job status fetched',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Module 12: Approve job for execution
 *
 * Requires manual approval for high-cost jobs.
 */
export async function approveOrchestratorJob(
  context: any,
  params: { jobId: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = context.userId as string;
    const logger = context.logger as any;

    logger.info(`[PRE-EXEC] Job approved by ${userId}: ${params.jobId}`);

    // Would update Supabase
    // await supabase.from('agent_jobs').update({
    //   requires_approval: false,
    //   approved_at: Date.now(),
    //   approved_by: userId,
    // }).eq('job_id', jobId);

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Module 13-15: Dashboard queries
 *
 * Get data for admin dashboard visualization.
 */
export async function getOrchestratorStats(_context: any): Promise<any> {
  try {
    return {
      success: true,
      total_jobs: 0,
      completed: 0,
      in_progress: 0,
      failed: 0,
      total_cost_cents: 0,
      avg_execution_time_ms: 0,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get recent jobs for dashboard
 */
export async function getRecentJobs(
  _context: any,
  _params: { limit?: number }
): Promise<any> {
  try {
    return {
      success: true,
      jobs: [],
      count: 0,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get execution timeline for a job
 */
export async function getJobExecutionTimeline(
  _context: any,
  params: { jobId: string }
): Promise<any> {
  try {
    return {
      success: true,
      job_id: params.jobId,
      timeline: [],
    }; // params used in return value
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Module 16: Smart Model Routing
 *
 * Automatically select models based on:
 * - Task complexity
 * - Budget constraints
 * - Queue depth / SLA
 * - Model availability
 */
export function selectModelForAgent(
  agent: string,
  taskComplexity: 'low' | 'medium' | 'high',
  budgetRemaining: number,
  config?: OrchestratorConfig
): { provider: string; model: string } {
  // Default: use configured model
  if (config) {
    const agentKey = `${agent}Agent` as keyof OrchestratorConfig;
    const agentConfig = config[agentKey];
    if (agentConfig && typeof agentConfig === 'object' && 'provider' in agentConfig) {
      return {
        provider: (agentConfig as any).provider,
        model: (agentConfig as any).model,
      };
    }
  }

  // Fallback routing based on complexity and budget
  if (budgetRemaining < 30) {
    // Very limited budget: use fastest/cheapest
    return { provider: 'anthropic', model: 'claude-haiku-4.5' };
  }

  if (taskComplexity === 'high' && budgetRemaining > 100) {
    // Complex task with budget: use powerful model
    return { provider: 'anthropic', model: 'claude-opus-4.5' };
  }

  // Default: balanced
  return { provider: 'anthropic', model: 'claude-sonnet-4' };
}

/**
 * Process job asynchronously (background)
 */
async function processOrchestratorJob(
  jobId: string,
  task: string,
  _config?: OrchestratorConfig,
  context?: any
): Promise<void> {
  const logger = context?.logger;

  try {
    logger?.info(`Processing orchestrator job: ${jobId}`);

    await runOrchestrator(task, {
      config: _config,
      threadId: `job-${jobId}`,
    });

    logger?.info(`Orchestrator job completed: ${jobId}`);

    // Update job in database
    // await supabase.from('agent_jobs').update({
    //   status: 'completed',
    //   result,
    //   completed_at: Date.now(),
    // }).eq('job_id', jobId);
  } catch (error) {
    logger?.error(`Orchestrator job failed: ${jobId}`, error);

    // Update job with error
    // await supabase.from('agent_jobs').update({
    //   status: 'failed',
    //   error: String(error),
    //   completed_at: Date.now(),
    // }).eq('job_id', jobId);
  }
}

/**
 * List all orchestration gateway methods
 *
 * For client discovery
 */
export function listOrchestratorMethods(): any {
  return {
    success: true,
    methods: [
      {
        name: 'submitOrchestratorJob',
        description: 'Submit task for orchestrator processing',
        params: {
          task: 'string',
          priority: '?string',
          budget_cents: '?number',
          config: '?object',
        },
      },
      {
        name: 'getOrchestratorJobStatus',
        description: 'Get status of an orchestrator job',
        params: { jobId: 'string' },
      },
      {
        name: 'approveOrchestratorJob',
        description: 'Approve job for execution',
        params: { jobId: 'string' },
      },
      {
        name: 'getOrchestratorStats',
        description: 'Get overall orchestrator statistics',
        params: {},
      },
      {
        name: 'getRecentJobs',
        description: 'Get recent jobs for dashboard',
        params: { limit: '?number' },
      },
      {
        name: 'getJobExecutionTimeline',
        description: 'Get execution timeline for a job',
        params: { jobId: 'string' },
      },
    ],
  };
}
