/**
 * Channel Account Tabs Component
 *
 * Manage multiple accounts per channel with switching, creation, and deletion.
 * Displays active account status and allows account configuration.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Settings, Trash2, Check, AlertCircle } from 'lucide-react';
import { getGatewayClient } from '../../lib/gateway-client';

interface Account {
  id: string;
  channel: string;
  name: string;
  description?: string;
  isActive: boolean;
  isPrimary: boolean;
  metadata?: {
    displayName?: string;
    phoneNumber?: string;
    botUsername?: string;
    [key: string]: unknown;
  };
}

interface AccountStatus {
  accountId: string;
  online: boolean;
  connected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  messagesSent: number;
  messagesReceived: number;
}

interface ChannelAccountTabsProps {
  channelId: string;
  className?: string;
}

export const ChannelAccountTabs: React.FC<ChannelAccountTabsProps> = ({
  channelId,
  className = '',
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountStatuses, setAccountStatuses] = useState<Map<string, AccountStatus>>(
    new Map()
  );
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load accounts from gateway
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = await client.request('channels.accounts.list', { channel: channelId });
      if (result?.accounts) {
        setAccounts(result.accounts);
        setActiveAccountId(result.primaryAccountId || result.accounts[0]?.id);

        // Load statuses
        const statuses = new Map();
        for (const account of result.accounts) {
          const statusResult = await client.request('channels.accounts.status', {
            accountId: account.id,
          });
          if (statusResult?.status) {
            statuses.set(account.id, statusResult.status);
          }
        }
        setAccountStatuses(statuses);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  // Switch active account
  const switchAccount = useCallback(
    async (accountId: string) => {
      setLoading(true);
      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          setError('Gateway not connected');
          return;
        }

        await client.request('channels.accounts.switch', {
          channel: channelId,
          accountId,
        });

        setActiveAccountId(accountId);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to switch account');
      } finally {
        setLoading(false);
      }
    },
    [channelId]
  );

  // Create new account
  const createAccount = useCallback(async () => {
    if (!newAccountName.trim()) {
      setError('Account name required');
      return;
    }

    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) {
        setError('Gateway not connected');
        return;
      }

      const result = await client.request('channels.accounts.create', {
        channel: channelId,
        name: newAccountName.trim(),
      });

      if (result?.account) {
        setAccounts([...accounts, result.account]);
        setNewAccountName('');
        setShowNewAccountForm(false);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }, [channelId, newAccountName, accounts]);

  // Delete account
  const deleteAccount = useCallback(
    async (accountId: string) => {
      if (!confirm('Delete this account? This cannot be undone.')) return;

      setLoading(true);
      try {
        const client = getGatewayClient();
        if (!client?.connected) {
          setError('Gateway not connected');
          return;
        }

        await client.request('channels.accounts.delete', { accountId });
        setAccounts(accounts.filter(a => a.id !== accountId));

        if (activeAccountId === accountId) {
          setActiveAccountId(accounts[0]?.id || null);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete account');
      } finally {
        setLoading(false);
      }
    },
    [channelId, accounts, activeAccountId]
  );

  // Get status color
  const getStatusColor = (status: AccountStatus | undefined) => {
    if (!status) return 'text-text-tertiary';
    if (status.connectionStatus === 'error') return 'text-red-400';
    if (status.connected) return 'text-emerald-400';
    if (status.connectionStatus === 'connecting') return 'text-yellow-400';
    return 'text-text-tertiary';
  };

  const activeAccount = useMemo(
    () => accounts.find(a => a.id === activeAccountId),
    [accounts, activeAccountId]
  );

  if (accounts.length === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-helix-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Accounts</h3>
        </div>

        <div className="p-4 rounded-lg bg-bg-secondary/20 border border-border-secondary/30 text-center">
          <p className="text-xs text-text-tertiary mb-3">
            No accounts configured for {channelId}
          </p>
          <button
            onClick={() => setShowNewAccountForm(true)}
            className="px-3 py-2 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 text-xs font-medium text-helix-300 transition-colors"
          >
            Add Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-helix-400" />
          <h3 className="text-sm font-semibold text-text-secondary">Accounts</h3>
        </div>
        <button
          onClick={() => setShowNewAccountForm(!showNewAccountForm)}
          className="p-1 rounded hover:bg-bg-secondary/50 transition-colors"
        >
          <Plus className="w-4 h-4 text-text-tertiary" />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* New account form */}
      {showNewAccountForm && (
        <div className="p-3 rounded-lg bg-bg-secondary/20 border border-border-secondary/30 space-y-2">
          <input
            type="text"
            placeholder="Account name (e.g., Personal, Business)"
            value={newAccountName}
            onChange={e => setNewAccountName(e.target.value)}
            className="w-full px-2 py-1 bg-bg-secondary/50 border border-border-secondary/50 rounded text-xs text-text-secondary placeholder-text-tertiary focus:outline-none focus:border-helix-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={createAccount}
              disabled={!newAccountName.trim() || loading}
              className="flex-1 px-2 py-1 rounded bg-helix-500/30 border border-helix-500/40 hover:bg-helix-500/40 disabled:opacity-50 text-xs font-medium text-helix-300 transition-colors"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowNewAccountForm(false);
                setNewAccountName('');
              }}
              className="flex-1 px-2 py-1 rounded bg-bg-secondary/30 border border-border-secondary/30 hover:bg-bg-secondary/50 text-xs font-medium text-text-tertiary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Account tabs */}
      <div className="space-y-2">
        {accounts.map(account => {
          const status = accountStatuses.get(account.id);
          const isActive = account.id === activeAccountId;

          return (
            <div
              key={account.id}
              onClick={() => switchAccount(account.id)}
              className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-helix-500/20 border-helix-500/40'
                  : 'bg-bg-secondary/20 border-border-secondary/30 hover:bg-bg-secondary/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-text-secondary">
                      {account.name}
                    </h4>
                    {account.isPrimary && (
                      <span className="px-2 py-0.5 rounded bg-helix-500/30 border border-helix-500/40 text-xs text-helix-300">
                        Primary
                      </span>
                    )}
                    {isActive && (
                      <Check className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>

                  {/* Status */}
                  {status && (
                    <p className={`text-xs mt-1 ${getStatusColor(status)}`}>
                      {status.connectionStatus === 'connected'
                        ? `Connected • ${status.messagesSent} sent`
                        : status.connectionStatus === 'connecting'
                          ? 'Connecting...'
                          : status.connectionStatus === 'error'
                            ? `Error: ${status.connectionStatus}`
                            : 'Disconnected'}
                    </p>
                  )}

                  {/* Metadata */}
                  {account.metadata?.displayName && (
                    <p className="text-xs text-text-tertiary mt-1">
                      {account.metadata.displayName}
                    </p>
                  )}
                  {account.metadata?.phoneNumber && (
                    <p className="text-xs text-text-tertiary">
                      {account.metadata.phoneNumber}
                    </p>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    deleteAccount(account.id);
                  }}
                  disabled={accounts.length === 1 || loading}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reload button */}
      <button
        onClick={loadAccounts}
        disabled={loading}
        className="w-full px-3 py-2 rounded bg-bg-secondary/30 border border-border-secondary/30 hover:bg-bg-secondary/50 disabled:opacity-50 text-xs font-medium text-text-secondary transition-colors"
      >
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  );
};

export default ChannelAccountTabs;
