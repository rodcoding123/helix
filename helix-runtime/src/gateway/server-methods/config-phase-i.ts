/**
 * Phase I: Advanced Configuration - Gateway Methods
 *
 * Implements gateway methods for:
 * - Model failover chains with cost/latency optimization
 * - Auth profile management (multi-auth strategies)
 * - Hook system for event-based automation
 * - Gateway configuration (WebSocket, caching, rate limiting)
 *
 * Integration Points:
 * - Supabase: Configuration persistence
 * - AIOperationRouter: Model selection and failover
 * - Event system: Hook triggering
 * - WebSocket: Real-time configuration updates
 */

import type { GatewayRequestHandler, GatewayRequestContext } from '../types';
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// TYPES
// ==============================================================================

export interface ModelProvider {
  provider: string;
  model: string;
  fallbackEnabled: boolean;
  costMax?: number;
  latencyMaxMs?: number;
}

export interface FailoverChainConfig {
  id: string;
  name: string;
  providers: ModelProvider[];
  strategy: 'sequential' | 'cost_optimized' | 'latency_optimized' | 'quality_prioritized';
  isDefault: boolean;
}

export interface AuthProfileConfig {
  id: string;
  name: string;
  authType: 'api_key' | 'oauth2' | 'service_account' | 'bearer_token' | 'custom';
  allowedOperations: string[];
  rateLimitRpm?: number;
  dailyQuota?: number;
  costLimitUsd?: number;
  isDefault: boolean;
}

export interface HookConfig {
  id: string;
  name: string;
  eventPattern: string;
  handlerType: 'webhook' | 'discord' | 'email' | 'slack' | 'custom_function';
  isEnabled: boolean;
}

export interface GatewayConfig {
  batchMessages?: boolean;
  batchTimeoutMs?: number;
  enableCompression?: boolean;
  maxRequestsPerSecond?: number;
  enableResponseCaching?: boolean;
  cacheTtlSeconds?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  featureFlags?: Record<string, boolean>;
}

// ==============================================================================
// MODEL FAILOVER CHAIN METHODS
// ==============================================================================

/**
 * failover.list_chains
 *
 * Get all failover chains for user
 */
export const failoverListChains: GatewayRequestHandler<
  object,
  {
    chains: FailoverChainConfig[];
  }
> = async (params: object, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('model_failover_chains')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at');

  if (error) throw error;

  return {
    chains: (data || []).map((chain) => ({
      id: chain.id,
      name: chain.name,
      providers: chain.providers || [],
      strategy: chain.fallback_strategy,
      isDefault: chain.is_default,
    })),
  };
};

/**
 * failover.create_chain
 *
 * Create a new failover chain
 */
export const failoverCreateChain: GatewayRequestHandler<
  {
    name: string;
    providers: ModelProvider[];
    strategy: string;
  },
  { id: string; name: string }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('model_failover_chains')
    .insert({
      user_id: userId,
      name: params.name,
      providers: params.providers,
      fallback_strategy: params.strategy,
      is_enabled: true,
    })
    .select('id, name');

  if (error) throw error;

  return {
    id: data?.[0]?.id || '',
    name: data?.[0]?.name || '',
  };
};

/**
 * failover.activate_chain
 *
 * Set a chain as default
 */
export const failoverActivateChain: GatewayRequestHandler<
  { chainId: string },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // Deactivate all chains for this user
  await supabase
    .from('model_failover_chains')
    .update({ is_default: false })
    .eq('user_id', userId);

  // Activate selected chain
  const { error } = await supabase
    .from('model_failover_chains')
    .update({ is_default: true })
    .eq('id', params.chainId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true };
};

// ==============================================================================
// AUTH PROFILE METHODS
// ==============================================================================

/**
 * auth.list_profiles
 *
 * Get all auth profiles for user
 */
export const authListProfiles: GatewayRequestHandler<
  object,
  {
    profiles: AuthProfileConfig[];
  }
> = async (params: object, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('auth_profiles')
    .select('id, name, auth_type, allowed_operations, rate_limit_rpm, daily_quota, cost_limit_usd, is_default')
    .eq('user_id', userId)
    .eq('is_enabled', true)
    .order('is_default', { ascending: false });

  if (error) throw error;

  return {
    profiles: (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      authType: p.auth_type as any,
      allowedOperations: p.allowed_operations || [],
      rateLimitRpm: p.rate_limit_rpm,
      dailyQuota: p.daily_quota,
      costLimitUsd: p.cost_limit_usd,
      isDefault: p.is_default,
    })),
  };
};

/**
 * auth.create_profile
 *
 * Create new auth profile
 */
export const authCreateProfile: GatewayRequestHandler<
  {
    name: string;
    authType: string;
    credentials: Record<string, any>;
    allowedOperations?: string[];
  },
  { id: string; name: string }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // In production, credentials should be encrypted before storage
  const { data, error } = await supabase
    .from('auth_profiles')
    .insert({
      user_id: userId,
      name: params.name,
      auth_type: params.authType,
      credentials: params.credentials,
      allowed_operations: params.allowedOperations || [],
      is_enabled: true,
      created_by_user_id: userId,
    })
    .select('id, name');

  if (error) throw error;

  return {
    id: data?.[0]?.id || '',
    name: data?.[0]?.name || '',
  };
};

// ==============================================================================
// HOOK SYSTEM METHODS
// ==============================================================================

/**
 * hooks.list
 *
 * Get all hooks for user
 */
export const hooksList: GatewayRequestHandler<
  object,
  {
    hooks: HookConfig[];
  }
> = async (params: object, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('hooks')
    .select('id, name, event_pattern, handler_type, is_enabled')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return {
    hooks: (data || []).map((h) => ({
      id: h.id,
      name: h.name,
      eventPattern: h.event_pattern,
      handlerType: h.handler_type as any,
      isEnabled: h.is_enabled,
    })),
  };
};

/**
 * hooks.create
 *
 * Create new hook
 */
export const hooksCreate: GatewayRequestHandler<
  {
    name: string;
    eventPattern: string;
    handlerType: string;
    handlerConfig: Record<string, any>;
    eventFilters?: Record<string, any>;
  },
  { id: string; name: string }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('hooks')
    .insert({
      user_id: userId,
      name: params.name,
      event_pattern: params.eventPattern,
      handler_type: params.handlerType,
      handler_config: params.handlerConfig,
      event_filters: params.eventFilters || {},
      is_enabled: true,
      created_by_user_id: userId,
    })
    .select('id, name');

  if (error) throw error;

  return {
    id: data?.[0]?.id || '',
    name: data?.[0]?.name || '',
  };
};

/**
 * hooks.toggle
 *
 * Enable/disable a hook
 */
export const hooksToggle: GatewayRequestHandler<
  { hookId: string; enabled: boolean },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { error } = await supabase
    .from('hooks')
    .update({ is_enabled: params.enabled })
    .eq('id', params.hookId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true };
};

/**
 * hooks.delete
 *
 * Delete a hook
 */
export const hooksDelete: GatewayRequestHandler<
  { hookId: string },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { error } = await supabase
    .from('hooks')
    .delete()
    .eq('id', params.hookId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true };
};

/**
 * hooks.list_executions
 *
 * Get hook execution history
 */
export const hooksListExecutions: GatewayRequestHandler<
  { hookId: string; limit?: number },
  {
    executions: Array<{
      id: string;
      status: string;
      eventType: string;
      duration: number;
      error?: string;
      executedAt: string;
    }>;
  }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('hook_execution_log')
    .select('id, status, event_type, duration_ms, error_message, executed_at')
    .eq('hook_id', params.hookId)
    .eq('user_id', userId)
    .order('executed_at', { ascending: false })
    .limit(params.limit || 50);

  if (error) throw error;

  return {
    executions: (data || []).map((e) => ({
      id: e.id,
      status: e.status,
      eventType: e.event_type,
      duration: e.duration_ms || 0,
      error: e.error_message,
      executedAt: e.executed_at,
    })),
  };
};

// ==============================================================================
// GATEWAY CONFIGURATION METHODS
// ==============================================================================

/**
 * gateway.get_config
 *
 * Get gateway configuration for user
 */
export const gatewayGetConfig: GatewayRequestHandler<
  { scope?: string; scopeId?: string },
  GatewayConfig
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const scope = params.scope || 'user';
  let query = supabase
    .from('gateway_configuration')
    .select('*')
    .eq('user_id', userId)
    .eq('scope', scope);

  if (params.scopeId) {
    query = query.eq('scope_id', params.scopeId);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

  // Return defaults if not configured
  if (!data) {
    return {
      batchMessages: true,
      batchTimeoutMs: 100,
      enableCompression: true,
      maxRequestsPerSecond: 10,
      enableResponseCaching: true,
      cacheTtlSeconds: 300,
      logLevel: 'info',
      featureFlags: {},
    };
  }

  return {
    batchMessages: data.batch_messages,
    batchTimeoutMs: data.batch_timeout_ms,
    enableCompression: data.enable_compression,
    maxRequestsPerSecond: parseFloat(data.max_requests_per_second),
    enableResponseCaching: data.enable_response_caching,
    cacheTtlSeconds: data.cache_ttl_seconds,
    logLevel: data.log_level,
    featureFlags: data.feature_flags || {},
  };
};

/**
 * gateway.update_config
 *
 * Update gateway configuration
 */
export const gatewayUpdateConfig: GatewayRequestHandler<
  GatewayConfig & { scope?: string; scopeId?: string },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const scope = params.scope || 'user';
  const { error } = await supabase
    .from('gateway_configuration')
    .upsert({
      user_id: userId,
      scope: scope,
      scope_id: params.scopeId,
      batch_messages: params.batchMessages,
      batch_timeout_ms: params.batchTimeoutMs,
      enable_compression: params.enableCompression,
      max_requests_per_second: params.maxRequestsPerSecond,
      enable_response_caching: params.enableResponseCaching,
      cache_ttl_seconds: params.cacheTtlSeconds,
      log_level: params.logLevel,
      feature_flags: params.featureFlags,
    });

  if (error) throw error;
  return { success: true };
};

// ==============================================================================
// METHOD REGISTRY
// ==============================================================================

export const phaseIMethods = {
  'failover.list_chains': failoverListChains,
  'failover.create_chain': failoverCreateChain,
  'failover.activate_chain': failoverActivateChain,
  'auth.list_profiles': authListProfiles,
  'auth.create_profile': authCreateProfile,
  'hooks.list': hooksList,
  'hooks.create': hooksCreate,
  'hooks.toggle': hooksToggle,
  'hooks.delete': hooksDelete,
  'hooks.list_executions': hooksListExecutions,
  'gateway.get_config': gatewayGetConfig,
  'gateway.update_config': gatewayUpdateConfig,
};
