/**
 * Channel Policies Gateway Methods
 *
 * HTTP-like methods for managing channel policies and filters:
 * - policies.get - Read current policies
 * - policies.update - Update channel policies
 * - policies.setGlobal - Set global policies
 */

import { loadConfig, writeConfigFile } from '../../config/config.js';
import { resolvePolicyForChannel, getGlobalChannelPolicy, savePolicies } from '../../channels/policies/engine.js';
import type { ChannelPolicy, DmPolicyMode, GroupPolicyMode } from '../../channels/policies/types.js';
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
} from '../protocol/index.js';
import type { GatewayRequestHandlers } from './types.js';

export const policiesHandlers: GatewayRequestHandlers = {
  'policies.get': ({ params, respond }) => {
    const cfg = loadConfig();
    const { channel: channelId, accountId } = params as {
      channel?: string;
      accountId?: string;
    };

    if (!channelId) {
      // Return global policies if no channel specified
      const global = getGlobalChannelPolicy(cfg);
      respond(true, { policies: null, global }, undefined);
      return;
    }

    // Get channel-specific policies
    const policies = (cfg.channels as any)?.[channelId]?.policies ?? [];
    const resolved = resolvePolicyForChannel(cfg, channelId, accountId);

    respond(true, { policies, resolved }, undefined);
  },

  'policies.update': ({ params, respond }) => {
    if (!params || typeof params !== 'object') {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'params required'));
      return;
    }

    const { channel: channelId, policy } = params as {
      channel: string;
      policy: Partial<ChannelPolicy>;
    };

    if (!channelId || !policy) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'channel and policy required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const policies = (cfg.channels as any)?.[channelId]?.policies ?? [];

      const updatedPolicies = policies.map((p: ChannelPolicy) => {
        if (p.id === policy.id || (!p.id && !policy.id)) {
          return {
            ...p,
            ...policy,
            updatedAt: Date.now(),
          };
        }
        return p;
      });

      const nextCfg = savePolicies(cfg, channelId, updatedPolicies);
      writeConfigFile(nextCfg);

      respond(true, { ok: true, updatedAt: Date.now() }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to update policy: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'policies.setGlobal': ({ params, respond }) => {
    if (!params || typeof params !== 'object') {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'params required'));
      return;
    }

    const { dmMode, groupMode } = params as {
      dmMode?: DmPolicyMode;
      groupMode?: GroupPolicyMode;
    };

    if (!dmMode && !groupMode) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'dmMode or groupMode required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const policies = (cfg as any).policies ?? {};
      const channelPolicies = policies.channels ?? {};

      const nextCfg = {
        ...cfg,
        policies: {
          ...policies,
          channels: {
            ...channelPolicies,
            ...(dmMode && { dmMode }),
            ...(groupMode && { groupMode }),
          },
        },
      };

      writeConfigFile(nextCfg);

      respond(true, { ok: true, updatedAt: Date.now() }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to set global policy: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },
};
