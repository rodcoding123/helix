/**
 * Remote Executor Gateway RPC Methods - Modules 13-15
 *
 * **Module 13**: Gateway method registration
 * **Module 14**: RPC handler functions
 * **Module 15**: Web hook integration
 *
 * Exposes RemoteCommandExecutor functionality via OpenClaw gateway RPC.
 * Called by orchestrator (Phase 2) and sync relay.
 *
 * **Methods**:
 * - submitRemoteCommand: Web client submits command for execution
 * - getQueueStatus: Monitor executor queue state
 * - cancelCommand: Cancel pending or executing command
 * - getCommandResult: Poll for command completion
 * - listRecentResults: Get execution history
 *
 * **Real-Time vs Polling**:
 * - Preferred: Real-time subscriptions via Supabase (WebSocket)
 * - Fallback: Polling via getCommandResult for unreliable connections
 */

import type { OpenClawMethod } from '../../types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteCommandExecutor } from '../remote-command-executor.js';
import type { RemoteCommand } from '../protocol/schema/remote-command.js';
import { nanoid } from 'nanoid';

/**
 * Submit a remote command for execution
 *
 * Called by web clients to queue commands for the local device.
 * Validates input, stores in Supabase, queues for execution.
 *
 * **Flow**:
 * 1. Web client calls this RPC
 * 2. Inserts row to remote_commands table
 * 3. Sync relay sees change via subscription
 * 4. RemoteCommandExecutor processes
 * 5. Results broadcast back to all devices
 */
export const submitRemoteCommand: OpenClawMethod = async (
  context: any,
  params: {
    agentId?: string;
    provider: string;
    content: string;
    sessionId: string;
    channelId?: string;
    timeoutMs?: number;
  }
): Promise<{ success: boolean; commandId?: string; error?: string }> => {
  try {
    const supabase = context.supabase as SupabaseClient;
    const userId = context.userId as string;
    const executor = context.executor as RemoteCommandExecutor;
    const logger = context.logger as any;

    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!params.content.trim()) {
      return { success: false, error: 'Command content is required' };
    }

    // Create command with defaults
    const commandId = nanoid();
    const timeoutMs = params.timeoutMs || 5 * 60 * 1000; // Default 5 min
    const expiresAt = new Date(Date.now() + timeoutMs).toISOString();

    // Create command object
    const command: RemoteCommand = {
      commandId,
      sourceDeviceId: context.deviceId || 'web-unknown',
      sourceUserId: userId as any, // Type mismatch in test
      agentId: params.agentId || 'main',
      provider: params.provider,
      content: params.content,
      sessionId: params.sessionId,
      channelId: params.channelId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: new Date(expiresAt).getTime(),
    };

    // Pre-execution logging (Helix pattern)
    logger.info(`[PRE-EXEC] submitRemoteCommand: ${commandId} from ${context.deviceId}`);

    // Insert to Supabase
    const { error: insertError } = await supabase.from('remote_commands').insert({
      command_id: command.commandId,
      source_device_id: command.sourceDeviceId,
      source_user_id: command.sourceUserId,
      agent_id: command.agentId,
      provider: command.provider,
      content: command.content,
      session_id: command.sessionId,
      channel_id: command.channelId,
      status: command.status,
      created_at: new Date(command.createdAt).toISOString(),
      expires_at: new Date(command.expiresAt).toISOString(),
    });

    if (insertError) {
      logger.error('Failed to insert command:', insertError);
      return { success: false, error: `Database error: ${insertError.message}` };
    }

    // Queue for local execution
    try {
      await executor.queueCommand(command);
    } catch (queueError) {
      logger.error('Failed to queue command:', queueError);
      return { success: false, error: `Queue error: ${String(queueError)}` };
    }

    logger.info(`Command queued: ${commandId}`);
    return { success: true, commandId };
  } catch (error) {
    context.logger?.error('submitRemoteCommand error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Get current executor queue status
 *
 * Returns pending, executing, and completed command counts.
 * Used by admin dashboard and orchestrator for load balancing.
 */
export const getQueueStatus: OpenClawMethod = async (context: any): Promise<any> => {
  try {
    const executor = context.executor as RemoteCommandExecutor;
    const stats = executor.getQueueStats();

    return {
      success: true,
      pending: stats.pending,
      executing: stats.executing,
      maxConcurrent: stats.maxConcurrent,
      isAtCapacity: stats.executing >= stats.maxConcurrent,
      executingCommandIds: executor.getExecutingCommandIds(),
    };
  } catch (error) {
    context.logger?.error('getQueueStatus error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Cancel a pending command
 *
 * Can only cancel commands in 'pending' state.
 * Once execution starts, cancellation is not supported.
 */
export const cancelCommand: OpenClawMethod = async (
  context: any,
  params: { commandId: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const executor = context.executor as RemoteCommandExecutor;
    const supabase = context.supabase as SupabaseClient;
    const logger = context.logger as any;

    // Try to cancel in executor
    const cancelled = executor.cancelCommand(params.commandId);

    if (cancelled) {
      // Update Supabase to mark as cancelled
      const { error: updateError } = await supabase
        .from('remote_commands')
        .update({ status: 'failed' })
        .eq('command_id', params.commandId);

      if (updateError) {
        logger.warn('Failed to update cancel status in DB:', updateError);
      }

      logger.info(`Command cancelled: ${params.commandId}`);
      return { success: true };
    }

    return { success: false, error: 'Command not found or already executing' };
  } catch (error) {
    context.logger?.error('cancelCommand error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Get command result (polling fallback)
 *
 * Retrieves result from Supabase if command completed.
 * Prefer real-time subscriptions for immediate updates.
 */
export const getCommandResult: OpenClawMethod = async (
  context: any,
  params: { commandId: string }
): Promise<any> => {
  try {
    const supabase = context.supabase as SupabaseClient;

    const { data, error } = await supabase
      .from('remote_commands')
      .select('*')
      .eq('command_id', params.commandId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Command not found' };
    }

    return {
      success: true,
      status: data.status,
      result: data.result,
      createdAt: data.created_at,
      executedAt: data.executed_at,
    };
  } catch (error) {
    context.logger?.error('getCommandResult error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * List recent command results
 *
 * Returns execution history for a session or user.
 * Used for debugging and result review.
 */
export const listRecentResults: OpenClawMethod = async (
  context: any,
  params: { sessionId?: string; limit?: number }
): Promise<any> => {
  try {
    const supabase = context.supabase as SupabaseClient;
    const userId = context.userId as string;
    const limit = params.limit || 50;

    let query = supabase
      .from('remote_commands')
      .select('*')
      .eq('source_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (params.sessionId) {
      query = query.eq('session_id', params.sessionId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      results: data || [],
      count: (data || []).length,
    };
  } catch (error) {
    context.logger?.error('listRecentResults error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Get executor health status
 *
 * Used for monitoring and diagnostic purposes.
 */
export const getExecutorHealth: OpenClawMethod = async (context: any): Promise<any> => {
  try {
    const executor = context.executor as RemoteCommandExecutor;
    const stats = executor.getQueueStats();

    const health = {
      healthy: stats.pending < 100, // Alert if queue > 100
      queueSize: stats.pending,
      executingCount: stats.executing,
      maxConcurrent: stats.maxConcurrent,
      utilizationPercent: Math.round((stats.executing / stats.maxConcurrent) * 100),
      alerts: [] as string[],
    };

    if (stats.pending > 100) {
      health.alerts.push('Queue backlog growing');
    }

    if (stats.executing >= stats.maxConcurrent) {
      health.alerts.push('Executor at capacity');
    }

    return { success: true, ...health };
  } catch (error) {
    context.logger?.error('getExecutorHealth error:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * List all available remote executor RPC methods
 *
 * Returns method names, descriptions, and parameters.
 * Used by clients to discover available endpoints.
 */
export const listRemoteExecutorMethods: OpenClawMethod = async (context: any): Promise<any> => {
  return {
    success: true,
    methods: [
      {
        name: 'submitRemoteCommand',
        description: 'Submit command for execution on local device',
        params: {
          agentId: '?string',
          provider: 'string',
          content: 'string',
          sessionId: 'string',
          channelId: '?string',
          timeoutMs: '?number',
        },
      },
      {
        name: 'getQueueStatus',
        description: 'Get executor queue statistics',
        params: {},
      },
      {
        name: 'cancelCommand',
        description: 'Cancel a pending command',
        params: { commandId: 'string' },
      },
      {
        name: 'getCommandResult',
        description: 'Poll for command result',
        params: { commandId: 'string' },
      },
      {
        name: 'listRecentResults',
        description: 'Get recent command execution history',
        params: { sessionId: '?string', limit: '?number' },
      },
      {
        name: 'getExecutorHealth',
        description: 'Get executor health status',
        params: {},
      },
    ],
  };
};
