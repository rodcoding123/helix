/**
 * Voicemail Inbox Component
 * Phase 4.1 Week 4: Display voicemail inbox with message list
 *
 * Features:
 * - List all voicemail messages
 * - Filter by unread/important
 * - Search voicemail transcripts
 * - Pagination with infinite scroll
 * - Click message to play
 * - Quick actions (mark read, important)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getVoicemails,
  searchVoicemails,
  getVoicemailStats,
  markVoicemailAsRead,
  toggleVoicemailImportant,
  formatDuration,
  formatReceivedTime,
} from '../../services/voicemail';
import { VoicemailPlayer } from './VoicemailPlayer';
import type { VoicemailMessage } from '../../lib/types/voice-memo';

interface VoicemailInboxProps {
  onUnreadCountChange?: (count: number) => void;
}

export const VoicemailInbox: React.FC<VoicemailInboxProps> = ({ onUnreadCountChange }) => {
  const [messages, setMessages] = useState<VoicemailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [selectedMessage, setSelectedMessage] = useState<VoicemailMessage | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    totalMessages: 0,
    unreadCount: 0,
    importantCount: 0,
    archivedCount: 0,
    averageDuration: 0,
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  /**
   * Load voicemails
   */
  const loadVoicemails = useCallback(
    async (newOffset = 0) => {
      setError(null);
      setIsLoading(newOffset === 0);

      try {
        const result = searchQuery
          ? await searchVoicemails(searchQuery, 20, newOffset)
          : await getVoicemails(20, newOffset);

        if (newOffset === 0) {
          setMessages(result.messages);
        } else {
          setMessages(prev => [...prev, ...result.messages]);
        }

        setHasMore(result.hasMore);
        setOffset(newOffset + 20);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load voicemails';
        setError(errorMsg);
      } finally {
        setIsLoading(newOffset === 0 ? false : undefined);
      }
    },
    [searchQuery]
  );

  /**
   * Load stats
   */
  const loadStats = useCallback(async () => {
    try {
      const stats = await getVoicemailStats();
      setStats(stats);
      if (onUnreadCountChange) {
        onUnreadCountChange(stats.unreadCount);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [onUnreadCountChange]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadVoicemails(0);
    loadStats();
  }, []);

  /**
   * Search debounce
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      loadVoicemails(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, loadVoicemails]);

  /**
   * Infinite scroll observer
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadVoicemails(offset);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, offset, loadVoicemails]);

  /**
   * Filter messages
   */
  const filteredMessages = messages.filter(msg => {
    if (filter === 'unread') return !msg.is_read;
    if (filter === 'important') return msg.is_important;
    return true;
  });

  /**
   * Handle message update
   */
  const handleMessageUpdate = (updated: VoicemailMessage) => {
    setMessages(prev =>
      prev.map(msg => (msg.id === updated.id ? updated : msg))
    );
    setSelectedMessage(updated);
    loadStats();
  };

  /**
   * Handle mark as read (quick action)
   */
  const handleQuickMarkAsRead = async (
    e: React.MouseEvent,
    voicemailId: string,
    currentStatus: boolean
  ) => {
    e.stopPropagation();

    try {
      const result = await markVoicemailAsRead(voicemailId, !currentStatus);

      if (result.success) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === voicemailId ? { ...msg, is_read: !currentStatus } : msg
          )
        );
        loadStats();
      }
    } catch (err) {
      console.error('Failed to update read status:', err);
    }
  };

  /**
   * Handle toggle important (quick action)
   */
  const handleQuickToggleImportant = async (
    e: React.MouseEvent,
    voicemailId: string
  ) => {
    e.stopPropagation();

    try {
      const result = await toggleVoicemailImportant(voicemailId);

      if (result.success) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === voicemailId
              ? { ...msg, is_important: !msg.is_important }
              : msg
          )
        );
        loadStats();
      }
    } catch (err) {
      console.error('Failed to toggle important:', err);
    }
  };

  return (
    <>
      <div className="voicemail-inbox space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Voicemail Inbox</h2>
          <p className="text-slate-400 text-sm">
            {stats.totalMessages} message{stats.totalMessages !== 1 ? 's' : ''} • {stats.unreadCount} unread
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">✗ {error}</p>
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search voicemail messages..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500"
        />

        {/* Filter Buttons */}
        <div className="flex gap-2">
          {(['all', 'unread', 'important'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {f === 'all' ? '📬 All' : f === 'unread' ? '◯ Unread' : '★ Important'}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && messages.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="animate-spin">⟳</span>
              <span>Loading voicemails...</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredMessages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-400">
              {messages.length === 0 ? 'No voicemails yet' : `No ${filter} voicemails`}
            </p>
          </div>
        )}

        {/* Messages List */}
        {filteredMessages.length > 0 && (
          <div className="space-y-2">
            {filteredMessages.map(message => (
              <button
                key={message.id}
                onClick={() => setSelectedMessage(message)}
                className={`w-full text-left p-4 border rounded-lg transition-all ${
                  message.is_read
                    ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                    : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-100 truncate">
                      {message.from_name || message.from_number || 'Unknown Caller'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatReceivedTime(message.received_at)}
                    </p>
                  </div>

                  {/* Duration Badge */}
                  <span className="ml-2 text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded whitespace-nowrap">
                    {formatDuration(message.audio_duration_ms)}
                  </span>
                </div>

                {/* Transcript Preview */}
                {message.transcript && (
                  <p className="text-sm text-slate-300 line-clamp-2 mb-2">
                    {message.transcript}
                  </p>
                )}

                {/* Status Indicators */}
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    {!message.is_read && (
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                    )}
                    {message.is_important && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-600/20 text-yellow-400 rounded">
                        ★ Important
                      </span>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={e =>
                        handleQuickMarkAsRead(e, message.id, message.is_read)
                      }
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        message.is_read
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400'
                      }`}
                    >
                      {message.is_read ? '✓ Read' : '○ Unread'}
                    </button>
                    <button
                      onClick={e =>
                        handleQuickToggleImportant(e, message.id)
                      }
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        message.is_important
                          ? 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                      }`}
                    >
                      {message.is_important ? '★' : '☆'}
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Infinite Scroll Target */}
        {hasMore && <div ref={observerTarget} className="h-4" />}

        {/* Loading More Indicator */}
        {isLoading && messages.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="animate-spin">⟳</span>
              <span>Loading more...</span>
            </div>
          </div>
        )}
      </div>

      {/* Voicemail Player Modal */}
      {selectedMessage && (
        <VoicemailPlayer
          voicemail={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onUpdate={handleMessageUpdate}
        />
      )}
    </>
  );
};
