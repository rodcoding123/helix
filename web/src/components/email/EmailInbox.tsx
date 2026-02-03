/**
 * Email Inbox Component
 * Phase 5 Track 1: Display, filtering, and basic management of emails
 *
 * Features:
 * - Email list with sorting and filtering
 * - Unread/starred indicators
 * - Quick actions (mark read, star, delete)
 * - Account selection
 * - Real-time sync status
 */

import React, { FC, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  emailAccountsService,
  type EmailAccount,
} from '@/services/email-accounts';
import { Mail, Inbox, Star, Trash2, RefreshCw, ChevronDown } from 'lucide-react';

interface EmailListItem {
  id: string;
  subject: string;
  from: string;
  fromName?: string;
  dateReceived: Date;
  preview: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  accountId: string;
}

interface EmailInboxProps {
  onEmailSelected?: (emailId: string) => void;
}

export const EmailInbox: FC<EmailInboxProps> = ({ onEmailSelected }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterTab, setFilterTab] = useState<'inbox' | 'unread' | 'starred'>('inbox');

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [user?.id]);

  const loadAccounts = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const accounts = await emailAccountsService.getEmailAccounts(user.id);
      setAccounts(accounts);

      // Select primary account or first one
      const primary = accounts.find((a) => a.isPrimary) || accounts[0];
      if (primary) {
        setSelectedAccount(primary);
        await loadEmails(primary.id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmails = async (accountId: string) => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      // In production, this would call the emails service
      // For now, mock data
      const mockEmails: EmailListItem[] = [
        {
          id: '1',
          subject: 'Welcome to Helix',
          from: 'team@helix.ai',
          fromName: 'Helix Team',
          dateReceived: new Date(),
          preview: 'Welcome! Your email integration is now complete...',
          isRead: false,
          isStarred: true,
          hasAttachments: false,
          accountId,
        },
      ];

      setEmails(mockEmails);
    } catch (error) {
      console.error('Failed to load emails:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedAccount) return;

    try {
      setIsSyncing(true);
      await emailAccountsService.startSync(selectedAccount.id);

      // Reload emails after sync
      await loadEmails(selectedAccount.id);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredEmails = emails.filter((email) => {
    if (filterTab === 'unread') return !email.isRead;
    if (filterTab === 'starred') return email.isStarred;
    return true;
  });

  const getSyncStatusIcon = () => {
    if (!selectedAccount) return null;

    switch (selectedAccount.syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />;
      case 'error':
        return <span className="text-xs text-red-400">⚠ Error</span>;
      default:
        return <span className="text-xs text-green-400">✓ Synced</span>;
    }
  };

  return (
    <div className="email-inbox space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Inbox className="w-6 h-6 text-blue-400" />
          Inbox
        </h2>
        <button
          onClick={handleSync}
          disabled={isSyncing || !selectedAccount}
          className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-5 h-5 ${isSyncing ? 'animate-spin text-blue-400' : 'text-slate-400'}`}
          />
        </button>
      </div>

      {/* Account Selector */}
      {accounts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => {
                setSelectedAccount(account);
                loadEmails(account.id);
              }}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedAccount?.id === account.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              <Mail className="w-4 h-4" />
              {account.displayName}
              {account.unreadCount > 0 && (
                <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                  {account.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-4 border-b border-slate-700">
        {(['inbox', 'unread', 'starred'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              filterTab === tab
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Sync Status */}
      {selectedAccount && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-4 py-2 bg-slate-800/30 rounded">
          <span>
            {selectedAccount.totalEmails} emails • {selectedAccount.unreadCount} unread
          </span>
          <div className="flex items-center gap-2">
            {getSyncStatusIcon()}
            {selectedAccount.lastSync && (
              <span>
                Last sync:{' '}
                {new Date(selectedAccount.lastSync).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Email List */}
      <div className="space-y-1">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin text-2xl mb-2">⟳</div>
            <p className="text-slate-400 text-sm">Loading emails...</p>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="text-center py-8">
            <Mail className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No emails to display</p>
          </div>
        ) : (
          filteredEmails.map((email) => (
            <div
              key={email.id}
              onClick={() => onEmailSelected?.(email.id)}
              className={`p-4 border border-slate-700 rounded-lg cursor-pointer transition-all hover:bg-slate-800/50 ${
                !email.isRead ? 'bg-slate-800/50 border-blue-500/30' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox / Indicator */}
                <div className="flex items-center gap-2 mt-1">
                  {!email.isRead && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  )}
                </div>

                {/* Email Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-medium truncate ${!email.isRead ? 'text-slate-100' : 'text-slate-300'}`}>
                      {email.fromName || email.from}
                    </h3>
                    <time className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(email.dateReceived)}
                    </time>
                  </div>

                  <p className={`text-sm truncate ${!email.isRead ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                    {email.subject}
                  </p>

                  <p className="text-xs text-slate-500 truncate">
                    {email.preview}
                  </p>

                  {/* Attachments */}
                  {email.hasAttachments && (
                    <span className="text-xs text-slate-500 mt-2">📎 Attachment</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    className={`p-1 hover:bg-slate-700/50 rounded transition-colors ${
                      email.isStarred ? 'text-yellow-400' : 'text-slate-600'
                    }`}
                  >
                    <Star className="w-4 h-4" fill={email.isStarred ? 'currentColor' : 'none'} />
                  </button>
                  <button className="p-1 hover:bg-slate-700/50 rounded transition-colors text-slate-600 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default EmailInbox;
