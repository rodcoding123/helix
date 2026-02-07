/**
 * Phase G: Session & Memory Intelligence - Gateway Methods
 *
 * Implements gateway methods for:
 * - Session configuration and token budget management
 * - Memory synthesis job monitoring
 * - Session template management
 * - Identity link management
 *
 * All LLM operations route through AIOperationRouter for centralized cost tracking.
 */

import type { GatewayRequestHandler, GatewayRequestContext } from '../types';
import { AIOperationRouter } from '../../helix/ai-operations/router';
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// TYPES
// ==============================================================================

export interface SessionTokenBudgetRequest {
  sessionKey: string;
}

export interface SessionTokenBudgetResponse {
  sessionKey: string;
  totalTokens: number;
  breakdown: {
    system: number;
    user: number;
    assistant: number;
    toolUse: number;
    toolResult: number;
  };
  messages: Array<{
    id: string;
    type: string;
    timestamp: number;
    tokens: number;
    preview: string;
  }>;
}

export interface SessionCompactRequest {
  sessionKey: string;
  mode: 'default' | 'safeguard' | 'aggressive';
  dryRun?: boolean;
}

export interface SessionCompactResponse {
  sessionKey: string;
  mode: string;
  tokensRecovered: number;
  estimatedTokensSaved: number;
  compactionMessages: string[];
  cost: number;
  dryRun: boolean;
}

export interface SynthesisHistoryRequest {
  jobType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SynthesisHistoryResponse {
  jobs: Array<{
    id: string;
    synthesisType: string;
    status: string;
    modelUsed: string;
    costUsd: number;
    executionTimeMs: number;
    patternsDetected: string[];
    createdAt: string;
  }>;
  total: number;
}

export interface SessionTemplateRequest {
  name: string;
  description?: string;
  config: {
    scope: 'per-sender' | 'per-channel' | 'per-channel-peer';
    resetMode: 'daily' | 'idle' | 'manual';
    resetHour?: number;
    idleTimeout?: number;
    budget: number;
    compaction: {
      enabled: boolean;
      threshold?: number;
    };
  };
}

export interface IdentityLinkRequest {
  identityA: string;
  identityB: string;
  confidence?: number;
  linkType: 'email' | 'phone' | 'username' | 'manual' | 'inferred';
}

export interface IdentityLinkResponse {
  id: string;
  identityA: string;
  identityB: string;
  confidence: number;
  linkType: string;
  createdAt: string;
}

// ==============================================================================
// GATEWAY METHOD HANDLERS
// ==============================================================================

/**
 * sessions.token_budget
 *
 * Get token usage breakdown for a session
 * Routes through AIOperationRouter for accurate token counting
 */
export const sessionsTokenBudget: GatewayRequestHandler<
  SessionTokenBudgetRequest,
  SessionTokenBudgetResponse
> = async (params: SessionTokenBudgetRequest, ctx: GatewayRequestContext) => {
  const { sessionKey } = params;

  // Get session from gateway's session manager
  const session = ctx.gateway?.sessions?.get(sessionKey);
  if (!session) {
    throw new Error(`Session not found: ${sessionKey}`);
  }

  // Use AIOperationRouter to get accurate token count
  const tokenCount = await AIOperationRouter.countSessionTokens(sessionKey);

  // Parse message breakdown
  const messages = session.messages || [];
  const messageBreakdown = messages.map((msg) => ({
    id: msg.id || '',
    type: msg.role || 'unknown',
    timestamp: msg.timestamp || Date.now(),
    tokens: Math.ceil((msg.content?.length || 0) / 4), // Estimate
    preview: (msg.content || '').substring(0, 100),
  }));

  return {
    sessionKey,
    totalTokens: tokenCount.total || 0,
    breakdown: {
      system: tokenCount.system || 0,
      user: tokenCount.user || 0,
      assistant: tokenCount.assistant || 0,
      toolUse: tokenCount.toolUse || 0,
      toolResult: tokenCount.toolResult || 0,
    },
    messages: messageBreakdown,
  };
};

/**
 * sessions.compact
 *
 * Compact a session with specified mode
 * Routes LLM calls through AIOperationRouter
 */
export const sessionsCompact: GatewayRequestHandler<
  SessionCompactRequest,
  SessionCompactResponse
> = async (params: SessionCompactRequest, ctx: GatewayRequestContext) => {
  const { sessionKey, mode, dryRun } = params;

  const session = ctx.gateway?.sessions?.get(sessionKey);
  if (!session) {
    throw new Error(`Session not found: ${sessionKey}`);
  }

  const beforeTokens =
    (await AIOperationRouter.countSessionTokens(sessionKey)).total || 0;

  const compactionConfig = {
    default: {
      minSalience: 0.3,
      summaryLength: 'medium' as const,
      preserveRecent: 5,
    },
    safeguard: {
      minSalience: 0.5,
      summaryLength: 'long' as const,
      preserveRecent: 10,
    },
    aggressive: {
      minSalience: 0.1,
      summaryLength: 'brief' as const,
      preserveRecent: 3,
    },
  };

  const config = compactionConfig[mode] || compactionConfig.default;

  // If dry run, estimate without executing
  if (dryRun) {
    const estimatedRecovery = Math.round(beforeTokens * 0.3);
    return {
      sessionKey,
      mode,
      tokensRecovered: 0, // Dry run doesn't actually compact
      estimatedTokensSaved: estimatedRecovery,
      compactionMessages: [
        `Dry run: ${mode} mode would recover ~${estimatedRecovery} tokens`,
        `Min salience threshold: ${config.minSalience}`,
        `Preserve recent: ${config.preserveRecent} messages`,
      ],
      cost: 0,
      dryRun: true,
    };
  }

  // Route compaction through AIOperationRouter
  const compactionResult =
    await AIOperationRouter.compactSessionContext(sessionKey, config);

  const afterTokens =
    (await AIOperationRouter.countSessionTokens(sessionKey)).total || 0;
  const recovered = beforeTokens - afterTokens;

  return {
    sessionKey,
    mode,
    tokensRecovered: recovered,
    estimatedTokensSaved: recovered,
    compactionMessages: [
      `Compacted ${recovered} tokens (${mode} mode)`,
      `Config: min salience ${config.minSalience}, preserve ${config.preserveRecent} messages`,
      `Before: ${beforeTokens} tokens, After: ${afterTokens} tokens`,
    ],
    cost: compactionResult.costUsd || 0,
    dryRun: false,
  };
};

/**
 * synthesis.history
 *
 * Get synthesis job history for current user
 */
export const synthesisHistory: GatewayRequestHandler<
  SynthesisHistoryRequest,
  SynthesisHistoryResponse
> = async (params: SynthesisHistoryRequest, ctx: GatewayRequestContext) => {
  const { jobType, status, limit = 50, offset = 0 } = params;
  const userId = ctx.auth?.userId;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  let query = supabase
    .from('memory_synthesis_jobs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (jobType) {
    query = query.eq('synthesis_type', jobType);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return {
    jobs: (data || []).map((job) => ({
      id: job.id,
      synthesisType: job.synthesis_type,
      status: job.status,
      modelUsed: job.model_used || 'unknown',
      costUsd: job.cost_usd || 0,
      executionTimeMs: job.execution_time_ms || 0,
      patternsDetected: job.patterns_detected || [],
      createdAt: job.created_at,
    })),
    total: count || 0,
  };
};

/**
 * templates.list
 *
 * Get session templates (system + user)
 */
export const templatesList: GatewayRequestHandler<
  object,
  {
    templates: Array<{
      id: string;
      name: string;
      description?: string;
      isSystem: boolean;
      config: Record<string, any>;
    }>;
  }
> = async (params: object, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('session_templates')
    .select('*')
    .or(
      `and(is_system.eq.true,user_id.is.null),and(user_id.eq.${userId})`
    )
    .order('is_system', { ascending: false })
    .order('name');

  if (error) {
    throw error;
  }

  return {
    templates: (data || []).map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      isSystem: template.is_system,
      config: template.config,
    })),
  };
};

/**
 * templates.create
 *
 * Create a user-defined session template
 */
export const templatesCreate: GatewayRequestHandler<
  SessionTemplateRequest,
  { id: string; name: string }
> = async (params: SessionTemplateRequest, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('session_templates')
    .insert({
      user_id: userId,
      name: params.name,
      description: params.description,
      is_system: false,
      config: params.config,
    })
    .select('id, name');

  if (error) {
    throw error;
  }

  return {
    id: data?.[0]?.id || '',
    name: data?.[0]?.name || '',
  };
};

/**
 * identity.list_links
 *
 * Get all identity links for user
 */
export const identityListLinks: GatewayRequestHandler<
  object,
  {
    links: IdentityLinkResponse[];
  }
> = async (params: object, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('identity_links')
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (error) {
    throw error;
  }

  return {
    links: (data || []).map((link) => ({
      id: link.id,
      identityA: link.identity_a,
      identityB: link.identity_b,
      confidence: link.confidence,
      linkType: link.link_type,
      createdAt: link.created_at,
    })),
  };
};

/**
 * identity.create_link
 *
 * Create a new identity link
 */
export const identityCreateLink: GatewayRequestHandler<
  IdentityLinkRequest,
  IdentityLinkResponse
> = async (params: IdentityLinkRequest, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('identity_links')
    .insert({
      user_id: userId,
      identity_a: params.identityA,
      identity_b: params.identityB,
      confidence: params.confidence || 0.95,
      link_type: params.linkType,
      created_by: ctx.auth?.username || 'user',
    })
    .select('*');

  if (error) {
    throw error;
  }

  const link = data?.[0];
  return {
    id: link?.id || '',
    identityA: link?.identity_a || '',
    identityB: link?.identity_b || '',
    confidence: link?.confidence || 0,
    linkType: link?.link_type || '',
    createdAt: link?.created_at || '',
  };
};

/**
 * identity.delete_link
 *
 * Delete an identity link
 */
export const identityDeleteLink: GatewayRequestHandler<
  { linkId: string },
  { success: boolean }
> = async (params: { linkId: string }, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;

  if (!userId) {
    throw new Error('Authentication required');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { error } = await supabase
    .from('identity_links')
    .delete()
    .eq('id', params.linkId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  return { success: true };
};

// ==============================================================================
// METHOD REGISTRY
// ==============================================================================

export const phaseGMethods = {
  'sessions.token_budget': sessionsTokenBudget,
  'sessions.compact': sessionsCompact,
  'synthesis.history': synthesisHistory,
  'templates.list': templatesList,
  'templates.create': templatesCreate,
  'identity.list_links': identityListLinks,
  'identity.create_link': identityCreateLink,
  'identity.delete_link': identityDeleteLink,
};
