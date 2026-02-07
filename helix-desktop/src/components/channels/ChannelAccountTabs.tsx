/**
 * Channel Account Tabs
 *
 * Switch between multiple accounts per channel with add/remove capabilities.
 */

import { useState, useEffect, useCallback } from 'react';
import { getGatewayClient } from '../../lib/gateway-client';

interface Account {
  id: string;
  name: string;
  [key: string]: unknown;
}

export function ChannelAccountTabs({
  channelId,
  onAccountChange
}: {
  channelId: string;
  onAccountChange: (accountId: string) => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    if (!channelId) return;

    setLoading(true);
    try {
      const client = getGatewayClient();
      if (!client?.connected) return;

      const result = await client.request('channels.accounts.list', {
        channel: channelId
      }) as { accounts: Account[] };

      setAccounts(result.accounts ?? []);
      setActiveId((result.accounts?.[0]?.id as string | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const createAccount = useCallback(async () => {
    if (!newAccountName.trim() || !channelId) return;

    try {
      const client = getGatewayClient();
      if (!client?.connected) return;

      const result = await client.request('channels.accounts.create', {
        channel: channelId,
        name: newAccountName.trim(),
      }) as { account: Account };

      setAccounts((prev) => [...prev, result.account as Account]);
      setNewAccountName('');
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    }
  }, [newAccountName, channelId]);

  const deleteAccount = useCallback(
    async (id: string) => {
      if (!confirm('Delete this account?') || !channelId) return;

      try {
        const client = getGatewayClient();
        if (!client?.connected) return;

        await client.request('channels.accounts.delete', {
          channel: channelId,
          accountId: id,
        });

        setAccounts((prev) => prev.filter((a) => a.id !== id));
        if (activeId === id) {
          setActiveId((accounts[0]?.id as string | null) ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete account');
      }
    },
    [channelId, activeId, accounts]
  );

  if (loading) return <div>Loading accounts...</div>;

  return (
    <div className="channel-account-tabs">
      <div className="tabs-header">
        <div className="tabs-list">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`tab ${activeId === account.id ? 'active' : ''}`}
              onClick={() => {
                setActiveId(account.id);
                onAccountChange?.(account.id);
              }}
            >
              <span>{account.name}</span>
              {accounts.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAccount(account.id);
                  }}
                  className="tab-close"
                  title="Remove account"
                >
                  X
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="btn-icon add-account"
          title="Add account"
        >
          +
        </button>
      </div>

      {showNewForm && (
        <div className="new-account-form">
          <input
            type="text"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            placeholder="Account name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAccount();
              if (e.key === 'Escape') setShowNewForm(false);
            }}
          />
          <button onClick={createAccount} className="btn-primary btn-sm">
            Create
          </button>
          <button onClick={() => setShowNewForm(false)} className="btn-secondary btn-sm">
            Cancel
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
