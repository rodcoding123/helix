/**
 * EmailClient - Main email client container component
 *
 * 4-column layout:
 * 1. Account sidebar (EmailAccountList)
 * 2. Conversation list with search (ConversationList)
 * 3. Message detail view (ConversationDetail)
 * 4. Compose modal overlay (ComposeModal)
 */

import { useState, useCallback, useMemo } from 'react';
import { useEmailClient, EmailConversation } from '@/hooks/useEmailClient';
import { EmailAccountList } from '@/components/email/EmailAccountList';
import { ConversationList } from '@/components/email/ConversationList';
import { ConversationDetail } from '@/components/email/ConversationDetail';
import { ComposeModal } from '@/components/email/ComposeModal';

// =====================================================
// Debounce utility
// =====================================================

function useDebounce<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, timeoutRef]
  );
}

// =====================================================
// Component
// =====================================================

export function EmailClient(): React.ReactElement {
  const {
    accounts,
    conversations,
    selectedAccount,
    selectedConversation,
    isLoading,
    syncStatus,
    error,
    setSelectedAccount,
    setSelectedConversation,
    loadConversations,
    startSync,
    sendMessage,
    clearError,
  } = useEmailClient();

  const [isComposing, setIsComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyToConversation, setReplyToConversation] = useState<string | null>(null);

  // Debounced search
  const debouncedSearch = useDebounce((query: string) => {
    loadConversations(query || undefined);
  }, 300);

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      debouncedSearch(query);
    },
    [debouncedSearch]
  );

  const handleSelectConversation = useCallback(
    (conversation: EmailConversation) => {
      setSelectedConversation(conversation);
    },
    [setSelectedConversation]
  );

  const handleReply = useCallback(() => {
    if (selectedConversation) {
      setReplyToConversation(selectedConversation.id);
      setIsComposing(true);
    }
  }, [selectedConversation]);

  const handleCompose = useCallback(() => {
    setReplyToConversation(null);
    setIsComposing(true);
  }, []);

  const handleCloseCompose = useCallback(() => {
    setIsComposing(false);
    setReplyToConversation(null);
  }, []);

  const handleSendMessage = useCallback(
    async (params: { to: string[]; cc?: string[]; subject: string; body: string }) => {
      try {
        await sendMessage({
          to: params.to,
          cc: params.cc,
          subject: params.subject,
          bodyPlain: params.body,
          inReplyTo: replyToConversation || undefined,
        });
        handleCloseCompose();
      } catch (err) {
        console.error('Failed to send message:', err);
        throw err;
      }
    },
    [sendMessage, replyToConversation, handleCloseCompose]
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Email</h1>
          {syncStatus === 'syncing' && (
            <span className="text-xs text-blue-400 animate-pulse">Syncing...</span>
          )}
          {syncStatus === 'error' && <span className="text-xs text-red-400">Sync error</span>}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={startSync}
            disabled={syncStatus === 'syncing'}
            className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleCompose}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors font-medium"
          >
            Compose
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-3 bg-red-900/50 border-b border-red-800 flex items-center justify-between">
          <span className="text-sm text-red-200">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-sm">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Account Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-800 overflow-hidden">
          <EmailAccountList
            accounts={accounts}
            selectedAccount={selectedAccount}
            onSelectAccount={setSelectedAccount}
            syncStatus={syncStatus}
          />
        </aside>

        {/* Column 2: Conversation List */}
        <div className="w-80 flex-shrink-0 border-r border-slate-800 flex flex-col overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-slate-800">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              aria-label="Search conversations"
            />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-hidden">
            <ConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={handleSelectConversation}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Column 3: Conversation Detail */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedConversation ? (
            <ConversationDetail conversation={selectedConversation} onReply={handleReply} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-slate-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-lg">Select a conversation</p>
                <p className="text-sm text-slate-600 mt-1">
                  Choose from your messages on the left
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Compose Modal */}
      {isComposing && selectedAccount && (
        <ComposeModal
          conversationId={replyToConversation}
          accountId={selectedAccount.id}
          replyTo={
            replyToConversation && selectedConversation
              ? {
                  subject: selectedConversation.subject,
                  to: selectedConversation.participants.map((p) => p.email),
                }
              : undefined
          }
          onClose={handleCloseCompose}
          onSend={handleSendMessage}
        />
      )}
    </div>
  );
}

export default EmailClient;
