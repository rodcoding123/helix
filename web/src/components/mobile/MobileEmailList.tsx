/**
 * Mobile Email List Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Touch-optimized conversation list for mobile devices
 */

import React from 'react';
import { Conversation } from '../../types/email';

interface MobileEmailListProps {
  conversations: Conversation[];
  isLoading: boolean;
  onSelectConversation: (conversation: Conversation) => void;
  onRefresh: () => void;
}

export const MobileEmailList: React.FC<MobileEmailListProps> = ({
  conversations,
  isLoading,
  onSelectConversation,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Mobile Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-slate-100">Inbox</h1>
          <button
            onClick={handleRefresh}
            disabled={isLoading || refreshing}
            className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {refreshing ? '⟳' : '↻'}
          </button>
        </div>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search emails..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto touch-pan-y">
        {isLoading && !conversations.length ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading emails...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">No emails</div>
          </div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className="w-full px-4 py-3 border-b border-slate-800 text-left hover:bg-slate-900 active:bg-slate-800 transition-colors touch-target"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-white">
                    {conversation.participants[0]?.name?.[0] || 'U'}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-100 text-sm truncate">
                      {conversation.participants[0]?.name || conversation.participants[0]?.email}
                    </h3>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {new Date(conversation.last_message_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 truncate mt-1">
                    {conversation.subject}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                    {conversation.preview}
                  </p>
                </div>

                {/* Status Indicator */}
                {!conversation.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
