/**
 * Phase H: Node & Device Network - Gateway Methods
 *
 * Implements gateway methods for:
 * - Device pairing and management (H.1)
 * - Node discovery via mDNS (H.2)
 * - Per-device execution policies (H.3)
 * - Device health monitoring (H.4)
 *
 * Integration Points:
 * - Supabase: Device registry, pairing workflow, health metrics
 * - mDNS: Local node discovery
 * - WebSocket: Real-time device status updates
 * - AIOperationRouter: Cost-aware command execution
 */

import type { GatewayRequestHandler, GatewayRequestContext } from '../types';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ==============================================================================
// TYPES
// ==============================================================================

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'desktop' | 'ios' | 'android' | 'web';
  status: 'pairing' | 'paired' | 'trusted' | 'offline' | 'error';
  lastSeen: string;
  trustLevel: number;
  capabilities: string[];
  healthScore: number;
}

export interface PairingRequestData {
  id: string;
  deviceName: string;
  devicePlatform: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'completed';
  expiresAt: string;
  requestCode: string;
}

export interface DiscoveredNodeInfo {
  id: string;
  nodeName: string;
  host: string;
  port: number;
  platform: string;
  version: string;
  isPaired: boolean;
}

export interface DeviceHealthData {
  deviceId: string;
  isOnline: boolean;
  latencyMs: number;
  healthScore: number;
  lastHeartbeat: string;
  batteryPercent?: number;
  memoryPercent?: number;
}

export interface ExecPolicyConfig {
  deviceId: string;
  allowedCommands: string[];
  blockedCommands?: string[];
  maxTokensPerCall: number;
  maxCostPerHour: number;
  requireApproval: boolean;
}

// ==============================================================================
// GATEWAY METHOD HANDLERS
// ==============================================================================

/**
 * devices.list
 *
 * Get all paired devices for current user
 */
export const devicesList: GatewayRequestHandler<
  object,
  {
    devices: DeviceInfo[];
  }
> = async (params: object, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return {
    devices: (data || []).map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      status: d.status,
      lastSeen: d.last_seen || d.created_at,
      trustLevel: d.trust_level,
      capabilities: d.capabilities || [],
      healthScore: 85, // Mock: would come from device_health table
    })),
  };
};

/**
 * devices.request_pairing
 *
 * Create a new pairing request for a device
 */
export const devicesRequestPairing: GatewayRequestHandler<
  {
    deviceName: string;
    devicePlatform: string;
    requestingIp: string;
  },
  PairingRequestData
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // Generate request code (user enters on device to confirm)
  const requestCode = crypto.randomInt(100000, 999999).toString();

  const { data, error } = await supabase
    .from('pairing_requests')
    .insert({
      user_id: userId,
      device_name: params.deviceName,
      device_platform: params.devicePlatform,
      requesting_ip: params.requestingIp,
      request_code: requestCode,
      status: 'pending',
    })
    .select('*');

  if (error) throw error;

  const request = data?.[0];
  return {
    id: request?.id || '',
    deviceName: request?.device_name || '',
    devicePlatform: request?.device_platform || '',
    status: 'pending',
    expiresAt: request?.expires_at || '',
    requestCode,
  };
};

/**
 * devices.approve_pairing
 *
 * Approve a pending pairing request
 */
export const devicesApprovePairing: GatewayRequestHandler<
  { requestId: string },
  { success: boolean; deviceId: string }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // Get pairing request
  const { data: request, error: fetchError } = await supabase
    .from('pairing_requests')
    .select('*')
    .eq('id', params.requestId)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;
  if (request.status !== 'pending') throw new Error('Request is not pending');

  // Update request status
  const { error: updateError } = await supabase
    .from('pairing_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by_user_id: userId,
    })
    .eq('id', params.requestId);

  if (updateError) throw updateError;

  // Create device entry
  const { data: device, error: createError } = await supabase
    .from('devices')
    .insert({
      user_id: userId,
      device_id: crypto.randomUUID(),
      name: request.device_name,
      platform: request.device_platform.toLowerCase(),
      ip_address: request.requesting_ip,
      port: request.port || 8765,
      status: 'paired',
      paired_at: new Date().toISOString(),
      device_token: crypto.randomBytes(32).toString('hex'),
    })
    .select('id');

  if (createError) throw createError;

  return {
    success: true,
    deviceId: device?.[0]?.id || '',
  };
};

/**
 * devices.reject_pairing
 *
 * Reject a pending pairing request
 */
export const devicesRejectPairing: GatewayRequestHandler<
  { requestId: string; reason?: string },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { error } = await supabase
    .from('pairing_requests')
    .update({
      status: 'rejected',
      rejection_reason: params.reason || 'User rejected',
    })
    .eq('id', params.requestId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true };
};

/**
 * nodes.discover
 *
 * Start mDNS discovery for local Helix nodes
 */
export const nodesDiscover: GatewayRequestHandler<
  {
    timeout?: number; // milliseconds
  },
  {
    nodes: DiscoveredNodeInfo[];
  }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // This would trigger actual mDNS discovery via gateway
  // For now, return cached discovered nodes
  const { data: nodes, error } = await supabase
    .from('discovered_nodes')
    .select('*')
    .eq('user_id', userId)
    .order('last_discovered', { ascending: false });

  if (error) throw error;

  // Update last_discovered timestamp
  await supabase
    .from('discovered_nodes')
    .update({ last_discovered: new Date().toISOString() })
    .eq('user_id', userId);

  return {
    nodes: (nodes || []).map((n) => ({
      id: n.id,
      nodeName: n.node_name,
      host: n.host,
      port: n.port,
      platform: n.platform || 'unknown',
      version: n.version || '0.0.0',
      isPaired: n.is_paired,
    })),
  };
};

/**
 * devices.get_health
 *
 * Get health status for a device
 */
export const devicesGetHealth: GatewayRequestHandler<
  { deviceId: string },
  DeviceHealthData
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('device_health')
    .select('*')
    .eq('device_id', params.deviceId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // Return default health if no record
    return {
      deviceId: params.deviceId,
      isOnline: false,
      latencyMs: 0,
      healthScore: 0,
      lastHeartbeat: new Date().toISOString(),
    };
  }

  return {
    deviceId: data.device_id,
    isOnline: data.is_online,
    latencyMs: data.latency_ms || 0,
    healthScore: data.health_score || 0,
    lastHeartbeat: data.last_heartbeat || new Date().toISOString(),
    batteryPercent: data.battery_percent,
    memoryPercent: data.memory_percent,
  };
};

/**
 * devices.update_health
 *
 * Update device health metrics (called by device via heartbeat)
 */
export const devicesUpdateHealth: GatewayRequestHandler<
  {
    deviceId: string;
    latencyMs: number;
    batteryPercent?: number;
    memoryPercent?: number;
    cpuPercent?: number;
  },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // Upsert health record
  const { error } = await supabase
    .from('device_health')
    .upsert(
      {
        device_id: params.deviceId,
        is_online: true,
        last_heartbeat: new Date().toISOString(),
        latency_ms: params.latencyMs,
        battery_percent: params.batteryPercent,
        memory_percent: params.memoryPercent,
        cpu_percent: params.cpuPercent,
        health_score: calculateHealthScore(params),
        health_status: 'healthy',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'device_id',
      }
    );

  if (error) throw error;
  return { success: true };
};

/**
 * policies.set_exec_policy
 *
 * Set execution policy for a device
 */
export const policiesSetExecPolicy: GatewayRequestHandler<
  ExecPolicyConfig,
  { success: boolean; policyId: string }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { data, error } = await supabase
    .from('device_exec_policies')
    .upsert({
      device_id: params.deviceId,
      user_id: userId,
      name: 'Default Policy',
      is_enabled: true,
      allowed_commands: params.allowedCommands,
      blocked_commands: params.blockedCommands || [],
      max_tokens_per_call: params.maxTokensPerCall,
      max_cost_per_hour: params.maxCostPerHour,
      require_approval: params.requireApproval,
      created_by_user_id: userId,
    })
    .select('id');

  if (error) throw error;
  return {
    success: true,
    policyId: data?.[0]?.id || '',
  };
};

/**
 * policies.resolve
 *
 * Resolve whether a device can execute a command
 */
export const policiesResolve: GatewayRequestHandler<
  { deviceId: string; command: string },
  { allowed: boolean; reason: string }
> = async (params, ctx: GatewayRequestContext) => {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  // Get active policy
  const { data: policy } = await supabase
    .from('device_exec_policies')
    .select('*')
    .eq('device_id', params.deviceId)
    .eq('is_enabled', true)
    .limit(1)
    .single();

  if (!policy) {
    return { allowed: true, reason: 'No policy configured; all commands allowed' };
  }

  // Check allowlist
  const isAllowed = checkCommandAllowed(params.command, policy.allowed_commands || []);
  if (!isAllowed) {
    return { allowed: false, reason: `Command '${params.command}' not in allowlist` };
  }

  // Check blocklist
  const isBlocked = (policy.blocked_commands || []).some((blocked) =>
    matchesPattern(params.command, blocked)
  );
  if (isBlocked) {
    return { allowed: false, reason: `Command '${params.command}' is blocked` };
  }

  return { allowed: true, reason: 'Command allowed by policy' };
};

/**
 * devices.unpair
 *
 * Unpair a device
 */
export const devicesUnpair: GatewayRequestHandler<
  { deviceId: string },
  { success: boolean }
> = async (params, ctx: GatewayRequestContext) => {
  const userId = ctx.auth?.userId;
  if (!userId) throw new Error('Authentication required');

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', params.deviceId)
    .eq('user_id', userId);

  if (error) throw error;
  return { success: true };
};

// ==============================================================================
// METHOD REGISTRY
// ==============================================================================

export const phaseHMethods = {
  'devices.list': devicesList,
  'devices.request_pairing': devicesRequestPairing,
  'devices.approve_pairing': devicesApprovePairing,
  'devices.reject_pairing': devicesRejectPairing,
  'devices.unpair': devicesUnpair,
  'devices.get_health': devicesGetHealth,
  'devices.update_health': devicesUpdateHealth,
  'nodes.discover': nodesDiscover,
  'policies.set_exec_policy': policiesSetExecPolicy,
  'policies.resolve': policiesResolve,
};

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

function calculateHealthScore(metrics: {
  latencyMs: number;
  batteryPercent?: number;
  memoryPercent?: number;
  cpuPercent?: number;
}): number {
  let score = 100;

  // Latency impact
  if (metrics.latencyMs > 1000) score -= 10;
  if (metrics.latencyMs > 5000) score -= 20;

  // Battery impact
  if (metrics.batteryPercent !== undefined) {
    if (metrics.batteryPercent < 20) score -= 15;
    if (metrics.batteryPercent < 10) score -= 25;
  }

  // Memory impact
  if (metrics.memoryPercent !== undefined) {
    if (metrics.memoryPercent > 90) score -= 10;
    if (metrics.memoryPercent > 95) score -= 20;
  }

  // CPU impact
  if (metrics.cpuPercent !== undefined) {
    if (metrics.cpuPercent > 90) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function checkCommandAllowed(command: string, allowedPatterns: string[]): boolean {
  if (allowedPatterns.length === 0) return true; // No restrictions
  return allowedPatterns.some((pattern) => matchesPattern(command, pattern));
}

function matchesPattern(text: string, pattern: string): boolean {
  // Simple glob pattern matching
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*') // * -> .*
    .replace(/\?/g, '.'); // ? -> .
  return new RegExp(`^${regex}$`).test(text);
}
