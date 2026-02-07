/**
 * Message Filter Types
 *
 * Interfaces for message filtering and channel policies
 */

export type PolicyScope = 'global' | 'channel' | 'account';
export type DmPolicyMode = 'pairing' | 'allowlist' | 'open' | 'disabled';
export type GroupPolicyMode = 'allowlist' | 'open' | 'disabled';
export type FilterType = 'regex' | 'keyword' | 'sender' | 'time' | 'media';

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
  rules?: any[];
  createdAt: number;
  updatedAt: number;
}
