/**
 * CloudChat -- Regular post-onboarding chat interface
 *
 * Sits within the standard app layout (navbar visible).
 * Glass-morphism header and input area, framer-motion message
 * animations, quota tracking with upgrade prompts, and the same
 * Void Pulse aesthetic as OnboardingChat but in a layout-aware frame.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  AlertCircle,
  X,
  Zap,
  ArrowUp,
} from 'lucide-react';
import { useCloudChat } from '@/hooks/useCloudChat';
import type { ChatMessage } from '@/hooks/useCloudChat';
import clsx from 'clsx';

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 4000;
const LOW_QUOTA_THRESHOLD = 3;

// ────────────────────────────────────────────────────────
// Typing Indicator
// ────────────────────────────────────────────────────────

function TypingIndicator(): JSX.Element {
  return (
    <div
      className="flex items-center gap-1.5 px-1 py-1"
      aria-label="Helix is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-2 h-2 rounded-full bg-gradient-to-br from-helix-400 to-accent-400"
          animate={{
            y: [0, -6, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Message Bubble
// ────────────────────────────────────────────────────────

function MessageBubble({
  message,
  index,
}: {
  message: ChatMessage;
  index: number;
}): JSX.Element {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index * 0.05, 0.15),
      }}
      className={clsx(
        'flex gap-3 max-w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Helix avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-helix-500/20"
            style={{
              background:
                'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
            }}
          >
            <img
              src="/logos/helix-icon.svg"
              alt=""
              className="w-5 h-5 brightness-0 invert"
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      {/* Message content */}
      <div
        className={clsx(
          'relative max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm sm:text-[15px] leading-relaxed',
          isUser
            ? 'bg-helix-500/20 border border-helix-500/30 text-text-primary rounded-br-md'
            : 'bg-white/[0.04] border border-white/[0.06] text-text-secondary rounded-bl-md'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>

      {/* Spacer for user messages (balances the avatar) */}
      {isUser && <div className="flex-shrink-0 w-8" aria-hidden="true" />}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────
// Low-Quota Warning Banner
// ────────────────────────────────────────────────────────

function LowQuotaBanner({
  remaining,
  upgradeUrl,
  onDismiss,
}: {
  remaining: number;
  upgradeUrl: string | null;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] backdrop-blur-sm px-4 py-2.5 text-sm">
        <Zap className="h-4 w-4 text-amber-400 flex-shrink-0" />
        <span className="flex-1 text-amber-300/90 font-body">
          {remaining === 0
            ? 'No messages remaining today.'
            : `${remaining} message${remaining === 1 ? '' : 's'} remaining today.`}
          {upgradeUrl && (
            <>
              {' '}
              <Link
                to={upgradeUrl}
                className="inline-flex items-center gap-1 font-medium text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
              >
                Upgrade for unlimited
                <ArrowUp className="h-3 w-3" />
              </Link>
            </>
          )}
        </span>
        <button
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label="Dismiss quota warning"
        >
          <X className="h-3.5 w-3.5 text-amber-400/60" />
        </button>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────
// Quota Exceeded Overlay
// ────────────────────────────────────────────────────────

function QuotaExceededOverlay({
  upgradeInfo,
  onDismiss,
}: {
  upgradeInfo: { message: string; url: string } | null;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-white text-sm">
            Message limit reached
          </h3>
          <p className="text-sm text-text-tertiary mt-1">
            {upgradeInfo?.message ||
              "You've used all your messages for today."}
          </p>
          {upgradeInfo?.url && (
            <Link
              to={upgradeInfo.url}
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Upgrade your plan
              <ArrowUp className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-text-tertiary hover:text-white transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────
// Empty State
// ────────────────────────────────────────────────────────

function EmptyState(): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col items-center justify-center px-6 text-center"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1],
          delay: 0.1,
        }}
        className="relative mb-6"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(6, 134, 212, 0.2) 0%, rgba(114, 52, 237, 0.2) 100%)',
            boxShadow:
              '0 0 40px rgba(6, 134, 212, 0.15), 0 0 80px rgba(114, 52, 237, 0.08)',
          }}
        >
          <MessageSquare className="w-7 h-7 text-helix-400" />
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-lg sm:text-xl font-display font-semibold text-white mb-2"
      >
        Start a conversation with Helix
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-sm sm:text-base text-text-tertiary max-w-sm leading-relaxed font-body"
      >
        Ask anything, brainstorm ideas, or let Helix help you think through
        a problem.
      </motion.p>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────
// Quota Bar
// ────────────────────────────────────────────────────────

function QuotaBar({
  quota,
}: {
  quota: { used: number; limit: number; remaining: number } | null;
}): JSX.Element | null {
  if (!quota) return null;

  const isUnlimited = quota.limit <= 0;
  const percentage = isUnlimited
    ? 0
    : Math.round((quota.used / quota.limit) * 100);
  const isLow = !isUnlimited && quota.remaining <= LOW_QUOTA_THRESHOLD;

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      {isUnlimited ? (
        <span className="text-helix-400 flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Unlimited
        </span>
      ) : (
        <>
          <span
            className={clsx(
              isLow ? 'text-amber-400' : 'text-text-tertiary'
            )}
          >
            {quota.used}/{quota.limit} messages used today
          </span>
          {/* Mini progress bar */}
          <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                isLow
                  ? 'bg-amber-400'
                  : percentage > 50
                    ? 'bg-helix-400'
                    : 'bg-helix-500'
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────

export function CloudChat(): JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showLowQuotaBanner, setShowLowQuotaBanner] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    isLoading,
    error,
    quota,
    quotaExceeded,
    upgradeInfo,
    clearError,
  } = useCloudChat({ sessionKey: 'cloud-chat-default' });

  // ── Derived state ──────────────────────────────────

  const quotaRemaining = quota?.remaining ?? null;
  const isLowQuota =
    quotaRemaining !== null && quotaRemaining <= LOW_QUOTA_THRESHOLD && quotaRemaining > 0;
  const isUnlimited = quota !== null && quota.limit <= 0;

  // ── Auto-scroll on new messages ────────────────────

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Show quota exceeded state ──────────────────────

  useEffect(() => {
    if (quotaExceeded) {
      setShowQuotaError(true);
    }
  }, [quotaExceeded]);

  // ── Focus input on mount ───────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Auto-resize textarea ──────────────────────────

  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // ── Handlers ──────────────────────────────────────

  async function handleSend(): Promise<void> {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading || quotaExceeded) return;

    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    await sendMessage(trimmed);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  // ── Render ────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-void">
      {/* ─── Header ─── */}
      <header
        className={clsx(
          'relative z-10 flex-shrink-0',
          'px-4 sm:px-6 py-3.5',
          'bg-white/[0.02] backdrop-blur-xl',
          'border-b border-white/[0.06]'
        )}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
              }}
            >
              <img
                src="/logos/helix-icon.svg"
                alt=""
                className="w-5 h-5 brightness-0 invert"
                aria-hidden="true"
              />
            </div>
            <div>
              <h1 className="text-sm font-display font-semibold text-white leading-tight">
                Cloud Chat
              </h1>
              <p className="text-[11px] text-text-tertiary font-body leading-tight">
                Powered by Helix Intelligence
              </p>
            </div>
          </div>

          {/* Quota summary in header (desktop) */}
          <div className="hidden sm:block">
            <QuotaBar quota={quota} />
          </div>
        </div>
      </header>

      {/* ─── Low Quota Warning Banner ─── */}
      <AnimatePresence>
        {isLowQuota && !isUnlimited && showLowQuotaBanner && !quotaExceeded && (
          <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <LowQuotaBanner
                remaining={quotaRemaining ?? 0}
                upgradeUrl={upgradeInfo?.url ?? '/pricing'}
                onDismiss={() => setShowLowQuotaBanner(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Empty State / Messages Area ─── */}
      <AnimatePresence mode="wait">
        {messages.length === 0 && !isLoading ? (
          <EmptyState key="empty" />
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4"
            role="log"
            aria-label="Conversation with Helix"
            aria-live="polite"
          >
            <div className="max-w-3xl mx-auto space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                  <MessageBubble key={msg.id} message={msg} index={idx} />
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="flex gap-3"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-helix-500/20"
                        style={{
                          background:
                            'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
                        }}
                      >
                        <img
                          src="/logos/helix-icon.svg"
                          alt=""
                          className="w-5 h-5 brightness-0 invert"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3">
                      <TypingIndicator />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scroll anchor */}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bottom Area ─── */}
      <div className="relative z-10 flex-shrink-0">
        {/* Error display */}
        <AnimatePresence>
          {error && !quotaExceeded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-4 sm:mx-6 mb-3"
            >
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 font-body">{error}</span>
                  <button
                    onClick={clearError}
                    className="p-0.5 rounded hover:bg-white/5 transition-colors flex-shrink-0"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quota exceeded overlay */}
        <AnimatePresence>
          {showQuotaError && quotaExceeded && (
            <div className="mx-4 sm:mx-6 mb-3">
              <div className="max-w-3xl mx-auto">
                <QuotaExceededOverlay
                  upgradeInfo={upgradeInfo}
                  onDismiss={() => setShowQuotaError(false)}
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── Input Area ─── */}
        <div
          className={clsx(
            'px-4 sm:px-6 pb-4 sm:pb-5 pt-3',
            'bg-white/[0.02] backdrop-blur-xl',
            'border-t border-white/[0.06]'
          )}
        >
          <div className="max-w-3xl mx-auto">
            <div
              className={clsx(
                'relative flex items-end gap-2 rounded-2xl px-4 py-3',
                'bg-white/[0.05] backdrop-blur-xl',
                'border border-white/10',
                'transition-all duration-300',
                'focus-within:border-helix-500/40 focus-within:shadow-[0_0_24px_rgba(6,134,212,0.08)]'
              )}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  quotaExceeded
                    ? 'Message limit reached'
                    : 'Message Helix...'
                }
                disabled={quotaExceeded}
                maxLength={MAX_INPUT_LENGTH}
                rows={1}
                className={clsx(
                  'flex-1 resize-none bg-transparent text-sm sm:text-[15px] text-text-primary',
                  'placeholder:text-text-tertiary',
                  'focus:outline-none',
                  'font-body leading-relaxed',
                  'min-h-[24px] max-h-[160px]',
                  quotaExceeded && 'opacity-50 cursor-not-allowed'
                )}
                aria-label="Message input"
              />

              <button
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isLoading || quotaExceeded}
                className={clsx(
                  'flex-shrink-0 p-2 rounded-xl transition-all duration-200',
                  inputValue.trim() && !isLoading && !quotaExceeded
                    ? 'text-white bg-helix-500 hover:bg-helix-600 shadow-lg shadow-helix-500/25'
                    : 'text-text-tertiary bg-white/5 cursor-not-allowed'
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Metadata row: quota (mobile) + keyboard hint */}
            <div className="flex items-center justify-between mt-2 px-1">
              {/* Quota display (mobile) */}
              <div className="sm:hidden">
                <QuotaBar quota={quota} />
              </div>
              {/* Spacer on desktop where quota is in header */}
              <div className="hidden sm:block" />

              {/* Keyboard hint -- desktop only */}
              <div className="hidden sm:block text-[11px] text-text-tertiary">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">
                  Enter
                </kbd>
                <span className="mx-1">to send</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">
                  Shift+Enter
                </kbd>
                <span className="ml-1">for newline</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
