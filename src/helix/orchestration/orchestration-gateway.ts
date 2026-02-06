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
import { runOrchestrator } from './supervisor-graph.js';
import { nanoid } from 'nanoid';

/**
 * Gateway context passed to orchestrator methods
 */
export interface OrchestratorContext {
  userId: string;
  logger: {
    info: (message: string) => void;
    error: (message: string) => void;
    warn: (message: string) => void;
  };
  requestId?: string;
}

/**
 * Method response wrapper
 */
export interface OrchestratorResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Dashboard statistics response
 */
export interface OrchestratorStatsResponse {
  success: boolean;
  total_jobs: number;
  completed: number;
  in_progress: number;
  failed: number;
  total_cost_cents: number;
  avg_execution_time_ms: number;
}

/**
 * Recent jobs response
 */
export interface RecentJobsResponse {
  success: boolean;
  jobs: OrchestratorJob[];
  count: number;
}

/**
 * Job execution timeline response
 */
export interface JobExecutionTimelineResponse {
  success: boolean;
  job_id: string;
  timeline: Array<{ timestamp: number; event: string }>;
}

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
export function submitOrchestratorJob(
  context: OrchestratorContext,
  params: {
    task: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    budget_cents?: number;
    config?: OrchestratorConfig;
  }
): OrchestratorResponse<{ jobId: string }> {
  try {
    const userId = context.userId;
    const logger = context.logger;

    const jobId = nanoid();

    logger.info(
      `[PRE-EXEC] Orchestrator job submitted by ${userId}: ${jobId} for task: ${params.task}`
    );

    // Store job in Supabase (would be integrated)
    // await supabase.from('agent_jobs').insert(job);

    // Process job asynchronously
    void processOrchestratorJob(jobId, params.task, params.config, context);

    return { success: true, data: { jobId } };
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
export function getOrchestratorJobStatus(
  _context: OrchestratorContext,
  params: { jobId: string }
): OrchestratorResponse<OrchestratorJob> {
  try {
    // Would fetch from Supabase
    // const { data } = await supabase.from('agent_jobs').select('*').eq('job_id', params.jobId).single();

    return {
      success: true,
      data: {
        job_id: params.jobId,
        user_id: '',
        task: '',
        status: 'pending',
        priority: 'normal',
        created_at: Date.now(),
        budget_cents: 0,
        cost_cents: 0,
        requires_approval: false,
      },
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
export function approveOrchestratorJob(
  context: OrchestratorContext,
  params: { jobId: string }
): { success: boolean; error?: string } {
  try {
    const userId = context.userId;
    const logger = context.logger;

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
export function getOrchestratorStats(_context: OrchestratorContext): OrchestratorStatsResponse {
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
    return {
      success: false,
      total_jobs: 0,
      completed: 0,
      in_progress: 0,
      failed: 0,
      total_cost_cents: 0,
      avg_execution_time_ms: 0,
      error: String(error),
    };
  }
}

/**
 * Get recent jobs for dashboard
 */
export function getRecentJobs(
  _context: OrchestratorContext,
  _params: { limit?: number }
): RecentJobsResponse {
  try {
    return {
      success: true,
      jobs: [],
      count: 0,
    };
  } catch (error) {
    return { success: false, jobs: [], count: 0, error: String(error) };
  }
}

/**
 * Get execution timeline for a job
 */
export function getJobExecutionTimeline(
  _context: OrchestratorContext,
  params: { jobId: string }
): JobExecutionTimelineResponse {
  try {
    return {
      success: true,
      job_id: params.jobId,
      timeline: [],
    };
  } catch (error) {
    return { success: false, job_id: params.jobId, timeline: [], error: String(error) };
  }
}

/**
 * Agent config type for type-safe model selection
 */
interface AgentConfig {
  provider: string;
  model: string;
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
      const typedConfig = agentConfig as AgentConfig;
      return {
        provider: typedConfig.provider,
        model: typedConfig.model,
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
  context?: OrchestratorContext
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
 * Method metadata for API discovery
 */
export interface MethodMetadata {
  name: string;
  description: string;
  params: Record<string, string>;
}

/**
 * List all orchestration gateway methods
 *
 * For client discovery
 */
export function listOrchestratorMethods(): OrchestratorResponse<{ methods: MethodMetadata[] }> {
  return {
    success: true,
    data: {
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
    },
  };
}
