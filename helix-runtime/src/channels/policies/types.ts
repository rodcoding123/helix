/**
 * Channel Policies
 *
 * Comprehensive messaging channel policy system supporting:
 * - Global DM/group policies
 * - Channel-specific policies
 * - Account-specific overrides
 * - Advanced message filtering
 */

export type PolicyScope = 'global' | 'channel' | 'account';
export type DmPolicyMode = 'pairing' | 'allowlist' | 'open' | 'disabled';
export type GroupPolicyMode = 'allowlist' | 'open' | 'disabled';
export type FilterType = 'regex' | 'keyword' | 'sender' | 'time' | 'media';

export interface PolicyCondition {
  type: 'sender' | 'content' | 'time' | 'media' | 'group';
  operator?: 'includes' | 'excludes' | 'matches' | 'equals';
  value?: string | string[] | number;
}

export interface PolicyAction {
  type: 'block' | 'allow' | 'route' | 'forward' | 'notify';
  targetAgent?: string;
  priority?: number;
}

export interface PolicyRule {
  id: string;
  name: string;
  enabled: boolean;
  scope: PolicyScope;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  createdAt: number;
  updatedAt: number;
  appliesTo?: string[]; // Channel IDs if scope is 'channel'
}

export interface ChannelPolicy {
  id: string;
  channelId: string;
  accountId?: string;
  dmMode: DmPolicyMode;
  groupMode: GroupPolicyMode;
  dmAllowlist?: string[];
  groupAllowlist?: string[];
  blockList?: string[];
  rateLimit?: {
    messagesPerMinute?: number;
    messagesPerHour?: number;
  };
  mediaSettings?: {
    maxSizeMb?: number;
    allowedTypes?: string[];
    blockTypes?: string[];
  };
  rules?: PolicyRule[];
  createdAt: number;
  updatedAt: number;
}

export interface MessageFilter {
  id: string;
  name: string;
  enabled: boolean;
  type: FilterType;
  pattern: string;
  action: 'block' | 'allow' | 'route';
  routeToAgent?: string;
  caseSensitive?: boolean;
  priority: number;
  appliesToChannels?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PolicySnapshot {
  policies: ChannelPolicy[];
  filters: MessageFilter[];
  globalDmMode: DmPolicyMode;
  globalGroupMode: GroupPolicyMode;
  timestamp: number;
}

export interface PolicyResolution {
  dmMode: DmPolicyMode;
  groupMode: GroupPolicyMode;
  appliedRules: PolicyRule[];
  rateLimit?: {
    messagesPerMinute?: number;
    messagesPerHour?: number;
  };
  mediaSettings?: {
    maxSizeMb?: number;
    allowedTypes?: string[];
  };
}
