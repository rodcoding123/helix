/**
 * Channel Policy Engine
 *
 * Resolves effective channel policies based on scope hierarchy:
 * Account > Channel > Global
 */

import type { OpenClawConfig } from '../../config/config.js';
import type {
  ChannelPolicy,
  DmPolicyMode,
  GroupPolicyMode,
  PolicyResolution,
} from './types.js';

const DEFAULT_DM_MODE: DmPolicyMode = 'pairing';
const DEFAULT_GROUP_MODE: GroupPolicyMode = 'open';

/**
 * Get channel policies from config
 */
export function getChannelPolicies(
  cfg: OpenClawConfig,
  channelId: string,
  accountId?: string
): ChannelPolicy | undefined {
  const policies = (cfg.channels as any)?.[channelId]?.policies;
  if (!policies) return undefined;

  // Account-level policy takes precedence
  if (accountId) {
    const accountPolicy = policies.find(
      (p: ChannelPolicy) => p.accountId === accountId
    );
    if (accountPolicy) return accountPolicy;
  }

  // Channel-level policy
  return policies.find((p: ChannelPolicy) => !p.accountId);
}

/**
 * Get global channel policies
 */
export function getGlobalChannelPolicy(cfg: OpenClawConfig): {
  dmMode: DmPolicyMode;
  groupMode: GroupPolicyMode;
} {
  const globalPolicy = (cfg as any).policies?.channels;
  if (!globalPolicy) {
    return {
      dmMode: DEFAULT_DM_MODE,
      groupMode: DEFAULT_GROUP_MODE,
    };
  }

  return {
    dmMode: globalPolicy.dmMode ?? DEFAULT_DM_MODE,
    groupMode: globalPolicy.groupMode ?? DEFAULT_GROUP_MODE,
  };
}

/**
 * Resolve effective policy for a channel/account
 *
 * Priority: Account > Channel > Global > Default
 */
export function resolvePolicyForChannel(
  cfg: OpenClawConfig,
  channelId: string,
  accountId?: string
): PolicyResolution {
  const channelPolicy = getChannelPolicies(cfg, channelId, accountId);
  const globalPolicy = getGlobalChannelPolicy(cfg);

  if (channelPolicy) {
    return {
      dmMode: channelPolicy.dmMode ?? globalPolicy.dmMode,
      groupMode: channelPolicy.groupMode ?? globalPolicy.groupMode,
      appliedRules: channelPolicy.rules?.filter((r) => r.enabled) ?? [],
      rateLimit: channelPolicy.rateLimit,
      mediaSettings: channelPolicy.mediaSettings,
    };
  }

  return {
    dmMode: globalPolicy.dmMode,
    groupMode: globalPolicy.groupMode,
    appliedRules: [],
  };
}

/**
 * Check if a sender is allowed by DM policy
 */
export function isDmAllowed(
  policy: PolicyResolution,
  senderId: string,
  senderAllowlist?: string[]
): boolean {
  if (policy.dmMode === 'disabled') return false;
  if (policy.dmMode === 'open') return true;
  if (policy.dmMode === 'pairing') return true; // Assume paired if we got here
  if (policy.dmMode === 'allowlist') {
    return senderAllowlist?.includes(senderId) ?? false;
  }
  return false;
}

/**
 * Check if a group is allowed by group policy
 */
export function isGroupAllowed(
  policy: PolicyResolution,
  groupId: string,
  groupAllowlist?: string[]
): boolean {
  if (policy.groupMode === 'disabled') return false;
  if (policy.groupMode === 'open') return true;
  if (policy.groupMode === 'allowlist') {
    return groupAllowlist?.includes(groupId) ?? false;
  }
  return false;
}

/**
 * Validate media based on policy settings
 */
export function validateMedia(
  policy: PolicyResolution,
  mediaSize: number,
  mediaType: string
): { valid: boolean; reason?: string } {
  const { mediaSettings } = policy;

  if (!mediaSettings) return { valid: true };

  // Check size limit
  if (mediaSettings.maxSizeMb && mediaSize > mediaSettings.maxSizeMb * 1024 * 1024) {
    return {
      valid: false,
      reason: `Media exceeds size limit (${mediaSettings.maxSizeMb}MB)`,
    };
  }

  // Check allowed types (whitelist takes precedence)
  if (mediaSettings.allowedTypes?.length) {
    const isAllowed = mediaSettings.allowedTypes.some((type) =>
      mediaType.toLowerCase().includes(type.toLowerCase())
    );
    if (!isAllowed) {
      return {
        valid: false,
        reason: `Media type not allowed (${mediaType})`,
      };
    }
  }

  return { valid: true };
}

/**
 * Save channel policies to config
 */
export function savePolicies(
  cfg: OpenClawConfig,
  channelId: string,
  policies: ChannelPolicy[]
): OpenClawConfig {
  const channels = cfg.channels ?? {};
  const channelConfig = (channels as any)[channelId] ?? {};

  return {
    ...cfg,
    channels: {
      ...channels,
      [channelId]: {
        ...channelConfig,
        policies,
      },
    },
  };
}
