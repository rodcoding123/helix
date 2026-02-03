/**
 * ComposeModal - Modal for composing/replying to emails
 *
 * Features:
 * - To/CC/Subject fields
 * - Body textarea with auto-resize
 * - Send button with loading state
 * - Close button and escape key handling
 * - Reply mode with pre-filled fields
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';

// =====================================================
// Types
// =====================================================

interface ComposeModalProps {
  conversationId?: string | null;
  accountId: string;
  replyTo?: {
    subject: string;
    to: string[];
  };
  onClose: () => void;
  onSend: (params: { to: string[]; cc?: string[]; subject: string; body: string }) => Promise<void>;
}

// =====================================================
// Helper Functions
// =====================================================

function parseEmailList(input: string): string[] {
  return input
    .split(/[,;]/)
    .map((email) => email.trim())
    .filter((email) => email.length > 0 && email.includes('@'));
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateEmailList(input: string): { valid: boolean; emails: string[]; invalid: string[] } {
  const parts = input
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
  const valid: string[] = [];
  const invalid: string[] = [];

  parts.forEach((email) => {
    if (isValidEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  });

  return { valid: invalid.length === 0, emails: valid, invalid };
}

// =====================================================
// Main Component
// =====================================================

export const ComposeModal: React.FC<ComposeModalProps> = ({
  conversationId,
  accountId: _accountId, // Reserved for future use (sending via specific account)
  replyTo,
  onClose,
  onSend,
}) => {
  const [to, setTo] = useState(replyTo?.to.join(', ') || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(
    replyTo?.subject ? (replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`) : ''
  );
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Focus body textarea on mount
  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSending]);

  // Handle click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isSending) {
        onClose();
      }
    },
    [onClose, isSending]
  );

  // Auto-resize textarea
  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.max(192, e.target.scrollHeight)}px`;
  }, []);

  // Send handler
  const handleSend = useCallback(async () => {
    setError(null);

    // Validate to field
    const toValidation = validateEmailList(to);
    if (toValidation.emails.length === 0) {
      setError('Please enter at least one valid recipient');
      return;
    }

    if (!toValidation.valid) {
      setError(`Invalid email addresses: ${toValidation.invalid.join(', ')}`);
      return;
    }

    // Validate body
    if (!body.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsSending(true);

    try {
      const ccEmails = cc ? parseEmailList(cc) : undefined;

      await onSend({
        to: toValidation.emails,
        cc: ccEmails,
        subject: subject || '(No subject)',
        body: body.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsSending(false);
    }
  }, [to, cc, subject, body, onSend]);

  // Keyboard shortcut for send (Cmd/Ctrl + Enter)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const isReply = !!conversationId;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="compose-modal"
    >
      <div
        ref={modalRef}
        className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            {isReply ? 'Reply' : 'New Message'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSending}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-6 py-3 bg-red-900/50 border-b border-red-800 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" onKeyDown={handleKeyDown}>
          {/* To Field */}
          <div>
            <label htmlFor="to" className="block text-sm text-slate-400 mb-1">
              To
            </label>
            <div className="flex items-center gap-2">
              <input
                id="to"
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                disabled={isSending}
                className="flex-1 px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                data-testid="compose-to"
              />
              {!showCc && (
                <button
                  onClick={() => setShowCc(true)}
                  className="text-sm text-slate-400 hover:text-slate-300"
                >
                  Cc
                </button>
              )}
            </div>
          </div>

          {/* CC Field */}
          {showCc && (
            <div>
              <label htmlFor="cc" className="block text-sm text-slate-400 mb-1">
                Cc
              </label>
              <input
                id="cc"
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                disabled={isSending}
                className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                data-testid="compose-cc"
              />
            </div>
          )}

          {/* Subject Field */}
          <div>
            <label htmlFor="subject" className="block text-sm text-slate-400 mb-1">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={isSending}
              className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              data-testid="compose-subject"
            />
          </div>

          {/* Body Field */}
          <div>
            <label htmlFor="body" className="block text-sm text-slate-400 mb-1">
              Message
            </label>
            <textarea
              id="body"
              ref={bodyRef}
              value={body}
              onChange={handleBodyChange}
              placeholder="Write your message..."
              disabled={isSending}
              className="w-full px-3 py-2 bg-slate-800 text-white border border-slate-700 rounded text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 min-h-[192px] resize-none font-sans"
              data-testid="compose-body"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/50">
          <span className="text-xs text-slate-500">
            Press {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Enter to send
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !to.trim() || !body.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              data-testid="compose-send"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
