/**
 * EmailAccountList - Account sidebar component
 *
 * Displays list of connected email accounts with sync status indicator.
 * Allows switching between accounts and adding new ones.
 */

import React, { useState, useCallback } from 'react';
import type { EmailAccount, SyncStatus } from '@/hooks/useEmailClient';

// =====================================================
// Types
// =====================================================

interface EmailAccountListProps {
  accounts: EmailAccount[];
  selectedAccount: EmailAccount | null;
  onSelectAccount: (account: EmailAccount) => void;
  syncStatus: SyncStatus;
}

// =====================================================
// Provider Icons
// =====================================================

function ProviderIcon({ provider }: { provider: string }): React.ReactElement {
  const iconClasses = 'w-5 h-5';

  switch (provider.toLowerCase()) {
    case 'gmail':
      return (
        <svg className={iconClasses} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
        </svg>
      );
    case 'outlook':
      return (
        <svg className={iconClasses} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      );
  }
}

// =====================================================
// Sync Status Indicator
// =====================================================

function SyncStatusIndicator({ status }: { status: SyncStatus }): React.ReactElement | null {
  switch (status) {
    case 'syncing':
      return (
        <span className="flex items-center gap-1 text-xs text-blue-400">
          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
          Syncing
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
          Error
        </span>
      );
    case 'paused':
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-400">
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          Paused
        </span>
      );
    default:
      return null;
  }
}

// =====================================================
// Component
// =====================================================

export const EmailAccountList: React.FC<EmailAccountListProps> = ({
  accounts,
  selectedAccount,
  onSelectAccount,
  syncStatus,
}) => {
  const [showAddAccount, setShowAddAccount] = useState(false);

  const handleAddAccount = useCallback(() => {
    setShowAddAccount(true);
    // In a real implementation, this would open a modal for OAuth flow
    console.log('Add account clicked - would trigger OAuth flow');
  }, []);

  const formatLastSync = (lastSyncAt: string | null): string => {
    if (!lastSyncAt) return 'Never synced';

    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full" data-testid="email-account-list">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Accounts</h2>
      </div>

      {/* Account List */}
      <div className="flex-1 overflow-y-auto">
        {accounts.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No email accounts connected
          </div>
        ) : (
          accounts.map((account) => {
            const isSelected = selectedAccount?.id === account.id;
            const showSyncStatus = isSelected && syncStatus !== 'idle';

            return (
              <button
                key={account.id}
                onClick={() => onSelectAccount(account)}
                className={`w-full px-4 py-3 text-left transition-colors border-b border-slate-800 ${
                  isSelected
                    ? 'bg-blue-900/50 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-800/50'
                }`}
                data-testid={`account-${account.id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 mt-0.5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`}
                  >
                    <ProviderIcon provider={account.provider} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-white truncate">{account.email}</div>
                    <div className="text-xs text-slate-500 mt-0.5 capitalize">
                      {account.provider}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {showSyncStatus ? (
                        <SyncStatusIndicator status={syncStatus} />
                      ) : (
                        formatLastSync(account.lastSyncAt)
                      )}
                    </div>
                  </div>
                  {account.messageCount > 0 && (
                    <span className="flex-shrink-0 text-xs text-slate-500">
                      {account.messageCount.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Add Account Button */}
      <div className="border-t border-slate-800">
        <button
          onClick={handleAddAccount}
          className="w-full px-4 py-3 text-sm font-medium text-blue-400 hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Add Account Modal (placeholder) */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Connect Email Account</h3>
            <p className="text-slate-400 text-sm mb-4">
              Choose a provider to connect your email account.
            </p>
            <div className="space-y-2">
              <button className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded text-left flex items-center gap-3">
                <ProviderIcon provider="gmail" />
                <span>Google (Gmail)</span>
              </button>
              <button className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded text-left flex items-center gap-3">
                <ProviderIcon provider="outlook" />
                <span>Microsoft (Outlook)</span>
              </button>
              <button className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded text-left flex items-center gap-3">
                <ProviderIcon provider="imap" />
                <span>Custom IMAP</span>
              </button>
            </div>
            <button
              onClick={() => setShowAddAccount(false)}
              className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailAccountList;
