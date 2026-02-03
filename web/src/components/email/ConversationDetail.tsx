/**
 * ConversationDetail - Thread detail view component
 *
 * Displays all messages in a conversation thread with expand/collapse
 * functionality. Last message is expanded by default.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { ConversationWithMessages } from '@/hooks/useEmailClient';
import { EmailMessageItem } from './EmailMessageItem';

// =====================================================
// Types
// =====================================================

interface ConversationDetailProps {
  conversation: ConversationWithMessages;
  onReply: () => void;
}

interface ThreadHeaderProps {
  conversation: ConversationWithMessages;
  onReply: () => void;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

// =====================================================
// Thread Header Component
// =====================================================

const ThreadHeader: React.FC<ThreadHeaderProps> = ({
  conversation,
  onReply,
  onStar,
  onArchive,
  onDelete,
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
      <div className="flex items-start justify-between gap-4">
        {/* Subject & Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">
            {conversation.subject || '(No subject)'}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
            <span>{conversation.messages.length} messages</span>
            {conversation.labels && conversation.labels.length > 0 && (
              <div className="flex items-center gap-1">
                {conversation.labels.slice(0, 3).map((label) => (
                  <span
                    key={label}
                    className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onReply}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
          >
            Reply
          </button>

          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
              aria-label="More actions"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 rounded-lg shadow-xl z-20 py-1">
                  <button
                    onClick={() => {
                      onStar();
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill={conversation.is_starred ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                    {conversation.is_starred ? 'Unstar' : 'Star'}
                  </button>
                  <button
                    onClick={() => {
                      onArchive();
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                    Archive
                  </button>
                  <hr className="my-1 border-slate-700" />
                  <button
                    onClick={() => {
                      onDelete();
                      setShowActions(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Participants Summary Component
// =====================================================

const ParticipantsSummary: React.FC<{ conversation: ConversationWithMessages }> = ({
  conversation,
}) => {
  const uniqueParticipants = Array.from(
    new Map(conversation.participants?.map((p) => [p.email, p]) || []).values()
  );

  if (uniqueParticipants.length === 0) {
    return null;
  }

  return (
    <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="font-medium">Participants:</span>
        <span className="truncate">
          {uniqueParticipants.map((p) => p.name || p.email).join(', ')}
        </span>
      </div>
    </div>
  );
};

// =====================================================
// Main Component
// =====================================================

export const ConversationDetail: React.FC<ConversationDetailProps> = ({ conversation, onReply }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Initialize expanded state - expand last message by default
  useEffect(() => {
    if (conversation.messages.length > 0) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      setExpandedMessages(new Set([lastMessage.id]));
    }
  }, [conversation.id]);

  // Scroll to bottom when conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.id]);

  const handleToggleExpand = useCallback((messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedMessages(new Set(conversation.messages.map((m) => m.id)));
  }, [conversation.messages]);

  const handleCollapseAll = useCallback(() => {
    if (conversation.messages.length > 0) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      setExpandedMessages(new Set([lastMessage.id]));
    }
  }, [conversation.messages]);

  const handleStar = useCallback(() => {
    // Would call toggleStar from useEmailClient
    console.log('Toggle star:', conversation.id);
  }, [conversation.id]);

  const handleArchive = useCallback(() => {
    // Would call archive endpoint
    console.log('Archive:', conversation.id);
  }, [conversation.id]);

  const handleDelete = useCallback(() => {
    // Would call deleteConversation from useEmailClient
    console.log('Delete:', conversation.id);
  }, [conversation.id]);

  // Loading state
  if (!conversation.messages) {
    return (
      <div
        className="flex items-center justify-center h-full"
        data-testid="conversation-detail-loading"
      >
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 mt-3">Loading messages...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (conversation.messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="conversation-detail-empty">
        <div className="text-center">
          <p className="text-slate-500">No messages in this conversation</p>
        </div>
      </div>
    );
  }

  const allExpanded = expandedMessages.size === conversation.messages.length;

  return (
    <div className="flex flex-col h-full bg-slate-950" data-testid="conversation-detail">
      {/* Header */}
      <ThreadHeader
        conversation={conversation}
        onReply={onReply}
        onStar={handleStar}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />

      {/* Participants */}
      <ParticipantsSummary conversation={conversation} />

      {/* Expand/Collapse Controls */}
      {conversation.messages.length > 1 && (
        <div className="px-6 py-2 border-b border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-800">
          {conversation.messages.map((message, index) => (
            <EmailMessageItem
              key={message.id}
              message={message}
              isExpanded={expandedMessages.has(message.id)}
              onToggleExpand={() => handleToggleExpand(message.id)}
              onReply={onReply}
              isLast={index === conversation.messages.length - 1}
            />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Bar */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={onReply}
          className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded text-left text-slate-400 transition-colors"
        >
          Click to reply...
        </button>
      </div>
    </div>
  );
};

export default ConversationDetail;
