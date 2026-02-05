/**
 * Mobile Email Detail Component
 * Week 5 Track 6.2: Mobile PWA Responsive Components
 * Touch-optimized conversation detail view
 */

import React from 'react';
import { Conversation, EmailMessage } from '../../types/email';

interface MobileEmailDetailProps {
  conversation: Conversation;
  messages: EmailMessage[];
  isLoading: boolean;
  onBack: () => void;
  onReply: (text: string) => void;
  onDelete: () => void;
}

export const MobileEmailDetail: React.FC<MobileEmailDetailProps> = ({
  conversation,
  messages,
  isLoading,
  onBack,
  onReply,
  onDelete,
}) => {
  const [replyText, setReplyText] = React.useState('');
  const [showReplyBox, setShowReplyBox] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(replyText);
      setReplyText('');
      setShowReplyBox(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Mobile Header */}
      <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-4 py-3 z-10">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-slate-100 text-sm truncate">
              {conversation.subject}
            </h2>
            <p className="text-xs text-slate-400">
              {typeof conversation.participants?.[0] === 'string'
                ? conversation.participants[0]
                : (conversation.participants?.[0] as any)?.name || (conversation.participants?.[0] as any)?.email}
            </p>
          </div>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-slate-800 rounded-lg"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 touch-pan-y"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400">No messages</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="bg-slate-900 rounded-lg p-3 border border-slate-800"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-100 text-sm">
                    {message.from_name || message.from_email}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(message.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {message.body}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Reply Box */}
      {!showReplyBox ? (
        <button
          onClick={() => setShowReplyBox(true)}
          className="mx-4 mb-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white text-sm touch-target"
        >
          Reply
        </button>
      ) : (
        <div className="border-t border-slate-800 px-4 py-4 space-y-2">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium text-white text-sm"
            >
              Send
            </button>
            <button
              onClick={() => setShowReplyBox(false)}
              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium text-slate-100 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
