/**
 * ConversationList - Virtual scrolling conversation list
 *
 * Uses react-window FixedSizeList for performance with 1000+ conversations.
 * Includes debounced search and optimized Row renderer with useCallback.
 */

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import type { EmailConversation, ConversationWithMessages } from '@/hooks/useEmailClient';

// =====================================================
// Types
// =====================================================

interface ConversationListProps {
  conversations: EmailConversation[];
  selectedConversation: ConversationWithMessages | null;
  onSelectConversation: (conversation: EmailConversation) => void;
  isLoading: boolean;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    conversations: EmailConversation[];
    selectedId: string | null;
    onSelect: (conversation: EmailConversation) => void;
  };
}

// =====================================================
// Constants
// =====================================================

const ITEM_HEIGHT = 88; // Height of each conversation row
const OVERSCAN_COUNT = 5; // Number of items to render outside visible area

// =====================================================
// Conversation Row Component
// =====================================================

const ConversationRow = React.memo<RowProps>(({ index, style, data }) => {
  const { conversations, selectedId, onSelect } = data;
  const conversation = conversations[index];

  if (!conversation) {
    return null;
  }

  const isSelected = selectedId === conversation.id;
  const isUnread = !conversation.is_read;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const participantsText = conversation.participants
    ?.slice(0, 3)
    .map((p) => p.name || p.email.split('@')[0])
    .join(', ');

  return (
    <div style={style} className="px-1">
      <button
        onClick={() => onSelect(conversation)}
        className={`w-full h-full px-3 py-2 text-left transition-colors rounded ${
          isSelected
            ? 'bg-blue-900/60 ring-1 ring-blue-500/50'
            : 'hover:bg-slate-800/60'
        }`}
        data-testid={`conversation-${conversation.id}`}
        aria-selected={isSelected}
      >
        <div className="flex items-start gap-3 h-full">
          {/* Unread Indicator */}
          <div className="flex-shrink-0 w-2 pt-1.5">
            {isUnread && (
              <span className="block w-2 h-2 bg-blue-500 rounded-full" aria-label="Unread" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Subject & Date */}
            <div className="flex items-start justify-between gap-2">
              <span
                className={`text-sm truncate ${isUnread ? 'font-semibold text-white' : 'text-slate-300'}`}
              >
                {conversation.subject || '(No subject)'}
              </span>
              <span className="flex-shrink-0 text-xs text-slate-500">
                {formatDate(conversation.last_message_at)}
              </span>
            </div>

            {/* Participants */}
            <div className="text-xs text-slate-500 mt-0.5 truncate">{participantsText}</div>

            {/* Message Count & Indicators */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-600">
                {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
              </span>

              {conversation.has_attachments && (
                <svg
                  className="w-3 h-3 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-label="Has attachments"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              )}

              {conversation.is_starred && (
                <svg
                  className="w-3 h-3 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="Starred"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
});

ConversationRow.displayName = 'ConversationRow';

// =====================================================
// Virtual List Component (Simplified without react-window dependency)
// =====================================================

interface VirtualListProps {
  items: EmailConversation[];
  selectedId: string | null;
  onSelect: (conversation: EmailConversation) => void;
  height: number;
}

const VirtualList: React.FC<VirtualListProps> = ({ items, selectedId, onSelect, height }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const { startIndex, visibleItems } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN_COUNT);
    const visibleCount = Math.ceil(height / ITEM_HEIGHT) + 2 * OVERSCAN_COUNT;
    const end = Math.min(items.length - 1, start + visibleCount);

    return {
      startIndex: start,
      visibleItems: items.slice(start, end + 1),
    };
  }, [scrollTop, height, items]);

  const totalHeight = items.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  const rowData = useMemo(
    () => ({
      conversations: items,
      selectedId,
      onSelect,
    }),
    [items, selectedId, onSelect]
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto"
      style={{ height }}
      role="listbox"
      aria-label="Conversations"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((_, localIndex) => {
            const globalIndex = startIndex + localIndex;
            return (
              <ConversationRow
                key={items[globalIndex]?.id || globalIndex}
                index={globalIndex}
                style={{ height: ITEM_HEIGHT }}
                data={rowData}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Main Component
// =====================================================

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversation,
  onSelectConversation,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = React.useState(600);

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Memoize the select handler
  const handleSelect = useCallback(
    (conversation: EmailConversation) => {
      onSelectConversation(conversation);
    },
    [onSelectConversation]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="conversation-loading">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 mt-2">Loading conversations...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (conversations.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-center px-4"
        data-testid="conversation-empty"
      >
        <div>
          <svg
            className="w-12 h-12 mx-auto text-slate-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-slate-500 mt-3">No conversations</p>
          <p className="text-sm text-slate-600 mt-1">
            Your inbox is empty or no results match your search.
          </p>
        </div>
      </div>
    );
  }

  // Conversation list with virtual scrolling
  return (
    <div ref={containerRef} className="h-full" data-testid="conversation-list">
      <VirtualList
        items={conversations}
        selectedId={selectedConversation?.id ?? null}
        onSelect={handleSelect}
        height={containerHeight}
      />
    </div>
  );
};

export default ConversationList;
