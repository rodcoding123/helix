/**
 * Channel Accounts Gateway Methods
 *
 * Manage multiple accounts per channel:
 * - channels.accounts.list - List all accounts for a channel
 * - channels.accounts.create - Create new account
 * - channels.accounts.setActive - Switch active account
 * - channels.accounts.config - Get/set account config
 * - channels.accounts.delete - Remove account
 */

import { loadConfig, writeConfigFile } from '../../config/config.js';
import type { OpenClawConfig } from '../../config/config.js';
import {
  ErrorCodes,
  errorShape,
} from '../protocol/index.js';
import type { GatewayRequestHandlers } from './types.js';

interface ChannelAccount {
  id: string;
  name: string;
  isDefault?: boolean;
  createdAt: number;
  lastActive?: number;
  metadata?: Record<string, unknown>;
}

function getChannelAccounts(cfg: OpenClawConfig, channelId: string): ChannelAccount[] {
  return (cfg.channels as any)?.[channelId]?.accounts ?? [];
}

function saveChannelAccounts(
  cfg: OpenClawConfig,
  channelId: string,
  accounts: ChannelAccount[]
): OpenClawConfig {
  const channels = cfg.channels ?? {};
  const channelConfig = (channels as any)[channelId] ?? {};

  return {
    ...cfg,
    channels: {
      ...channels,
      [channelId]: {
        ...channelConfig,
        accounts,
      },
    },
  };
}

export const channelAccountsHandlers: GatewayRequestHandlers = {
  'channels.accounts.list': ({ params, respond }) => {
    const { channel: channelId } = params as { channel: string };

    if (!channelId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, 'channel required'));
      return;
    }

    try {
      const cfg = loadConfig();
      const accounts = getChannelAccounts(cfg, channelId);

      respond(true, { accounts, count: accounts.length }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to list accounts: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'channels.accounts.create': ({ params, respond }) => {
    const { channel: channelId, name } = params as {
      channel: string;
      name: string;
    };

    if (!channelId || !name) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'channel and name required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const accounts = getChannelAccounts(cfg, channelId);

      const newAccount: ChannelAccount = {
        id: `${channelId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        isDefault: accounts.length === 0, // First account is default
        createdAt: Date.now(),
      };

      const nextAccounts = [...accounts, newAccount];
      const nextCfg = saveChannelAccounts(cfg, channelId, nextAccounts);
      writeConfigFile(nextCfg);

      respond(true, { ok: true, account: newAccount }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to create account: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'channels.accounts.setActive': ({ params, respond }) => {
    const { channel: channelId, accountId } = params as {
      channel: string;
      accountId: string;
    };

    if (!channelId || !accountId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'channel and accountId required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const accounts = getChannelAccounts(cfg, channelId);

      // Verify account exists
      if (!accounts.find((a) => a.id === accountId)) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, 'Account not found')
        );
        return;
      }

      const nextAccounts = accounts.map((a) => ({
        ...a,
        isDefault: a.id === accountId,
        lastActive: a.id === accountId ? Date.now() : a.lastActive,
      }));

      const nextCfg = saveChannelAccounts(cfg, channelId, nextAccounts);
      writeConfigFile(nextCfg);

      respond(true, { ok: true, updatedAt: Date.now() }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to set active account: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'channels.accounts.config': ({ params, respond }) => {
    const { channel: channelId, accountId, config } = params as {
      channel: string;
      accountId: string;
      config?: Record<string, unknown>;
    };

    if (!channelId || !accountId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'channel and accountId required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const accounts = getChannelAccounts(cfg, channelId);

      if (!config) {
        // Get config
        const account = accounts.find((a) => a.id === accountId);
        respond(true, { config: account?.metadata ?? {} }, undefined);
      } else {
        // Set config
        const nextAccounts = accounts.map((a) => {
          if (a.id === accountId) {
            return {
              ...a,
              metadata: {
                ...a.metadata,
                ...config,
              },
            };
          }
          return a;
        });

        const nextCfg = saveChannelAccounts(cfg, channelId, nextAccounts);
        writeConfigFile(nextCfg);

        respond(true, { ok: true, updatedAt: Date.now() }, undefined);
      }
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to manage account config: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },

  'channels.accounts.delete': ({ params, respond }) => {
    const { channel: channelId, accountId } = params as {
      channel: string;
      accountId: string;
    };

    if (!channelId || !accountId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, 'channel and accountId required')
      );
      return;
    }

    try {
      const cfg = loadConfig();
      const accounts = getChannelAccounts(cfg, channelId);

      // Cannot delete last account
      if (accounts.length === 1) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, 'Cannot delete last account')
        );
        return;
      }

      // If deleting default, make first remaining account default
      const nextAccounts = accounts
        .filter((a) => a.id !== accountId)
        .map((a, index) => ({
          ...a,
          isDefault: index === 0 || a.isDefault,
        }));

      const nextCfg = saveChannelAccounts(cfg, channelId, nextAccounts);
      writeConfigFile(nextCfg);

      respond(true, { ok: true }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          `Failed to delete account: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  },
};
