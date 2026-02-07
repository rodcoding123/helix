/**
 * Channel Policy Types
 *
 * Policy system for managing DM/group message rules,
 * allowlists, and routing decisions across channels.
 */

export type PolicyScope = 'global' | 'channel' | 'account';
export type DmPolicyMode = 'pairing' | 'allowlist' | 'open' | 'disabled';
export type GroupPolicyMode = 'allowlist' | 'open' | 'disabled';
export type PolicyProfile = 'minimal' | 'standard' | 'trusted' | 'open' | 'custom';

/**
 * Policy condition for routing decisions
 */
export interface PolicyCondition {
  type: 'sender' | 'channel' | 'group' | 'time' | 'frequency';
  value: string | string[] | number;
  operator?: 'equals' | 'contains' | 'matches' | 'in' | 'greater' | 'less';
}

/**
 * Policy action to execute
 */
export interface PolicyAction {
  type: 'allow' | 'block' | 'route' | 'delay' | 'notify';
  target?: string; // Agent ID for route, delay in ms, etc.
  metadata?: Record<string, unknown>;
}

/**
 * Single policy rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  enabled: boolean;
  scope: PolicyScope;
  scopeTarget?: string; // Channel ID or account ID
  priority: number; // Higher = evaluated first
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * DM policy for a scope
 */
export interface DmPolicy {
  mode: DmPolicyMode;
  allowlist?: string[]; // Phone numbers, user IDs, emails
  autoApprove?: boolean; // Auto-approve pairing requests from known contacts
  maxDailyMessages?: number; // Rate limiting
  queueUnknown?: boolean; // Queue messages from unknown senders for approval
}

/**
 * Group policy for a scope
 */
export interface GroupPolicy {
  mode: GroupPolicyMode;
  allowlist?: string[]; // Group IDs or names
  maxDailyMessages?: number;
  autoJoinBroadcasts?: boolean; // Join broadcast lists automatically
  threadingMode?: 'off' | 'replies' | 'all'; // How to handle thread creation
}

/**
 * Complete policy configuration for a scope
 */
export interface PolicyConfig {
  scope: PolicyScope;
  scopeTarget?: string;
  profile: PolicyProfile;
  dmPolicy: DmPolicy;
  groupPolicy: GroupPolicy;
  customRules: PolicyRule[];
  rateLimitPerMinute?: number; // Global rate limit
  rateLimitPerHour?: number;
  quarantineUnknownSenders?: boolean; // Hold messages pending review
  trustOnFirstUse?: boolean; // Auto-trust after first successful message
  logAllDecisions?: boolean; // Debug mode: log every policy decision
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  actions: PolicyAction[];
  matchedRule?: PolicyRule;
  reason: string;
  confidence: number; // 0.0-1.0
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Policy decision log entry
 */
export interface PolicyDecision {
  id: string;
  timestamp: number;
  channelId: string;
  sender: string;
  messageId?: string;
  type: 'dm' | 'group';
  result: PolicyEvaluationResult;
  responseTimeMs: number;
}

/**
 * Policy preset profiles
 */
export const POLICY_PROFILES = {
  minimal: {
    dm: { mode: 'pairing' as const, queueUnknown: true },
    group: { mode: 'allowlist' as const },
    rateLimitPerMinute: 10,
    rateLimitPerHour: 100,
  },
  standard: {
    dm: { mode: 'allowlist' as const, maxDailyMessages: 500 },
    group: { mode: 'allowlist' as const, maxDailyMessages: 100 },
    rateLimitPerMinute: 30,
    rateLimitPerHour: 500,
    trustOnFirstUse: true,
  },
  trusted: {
    dm: { mode: 'open' as const },
    group: { mode: 'open' as const },
    rateLimitPerMinute: 100,
    rateLimitPerHour: 1000,
  },
  open: {
    dm: { mode: 'open' as const },
    group: { mode: 'open' as const },
    rateLimitPerMinute: 1000,
    rateLimitPerHour: 10000,
  },
} as const;

/**
 * Conflict resolution for overlapping policies
 */
export const POLICY_SCOPE_PRIORITY = ['account', 'channel', 'global'] as const;
// Account-specific > Channel-specific > Global (first match wins)
