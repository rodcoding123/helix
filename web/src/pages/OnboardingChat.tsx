/**
 * OnboardingChat — First-contact experience with Helix
 *
 * Full-screen, immersive chat interface shown after signup.
 * No navbar. No distractions. Just the user and Helix, meeting
 * for the first time.
 *
 * Design: Dark void background with gradient orbs, glass-morphism
 * input area, framer-motion message animations, and a subtle
 * particle atmosphere matching the Landing page aesthetic.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowRight, AlertCircle, X } from 'lucide-react';
import { useCloudChat } from '@/hooks/useCloudChat';
import type { ChatMessage } from '@/hooks/useCloudChat';
import { getCloudChatClient } from '@/lib/cloud-chat-client';
import clsx from 'clsx';

// ────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 4000;

// ────────────────────────────────────────────────────────
// Typing Indicator
// ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1" aria-label="Helix is typing">
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

function MessageBubble({ message, index }: { message: ChatMessage; index: number }) {
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
      className={clsx('flex gap-3 max-w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* Helix avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-helix-500/20"
            style={{
              background: 'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
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
// Background Atmosphere
// ────────────────────────────────────────────────────────

function BackgroundAtmosphere() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base void */}
      <div className="absolute inset-0 bg-[#050505]" />

      {/* Gradient orb - top left (blue) */}
      <div
        className="absolute w-[700px] h-[700px] -top-[250px] -left-[200px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(6, 134, 212, 0.5) 0%, transparent 70%)',
          animation: 'drift 35s ease-in-out infinite',
        }}
      />

      {/* Gradient orb - bottom right (purple) */}
      <div
        className="absolute w-[600px] h-[600px] -bottom-[200px] -right-[150px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(114, 52, 237, 0.6) 0%, transparent 70%)',
          animation: 'drift 28s ease-in-out infinite reverse',
          animationDelay: '4s',
        }}
      />

      {/* Subtle center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.06]"
        style={{
          background:
            'radial-gradient(circle, rgba(6, 134, 212, 0.4) 0%, rgba(114, 52, 237, 0.2) 40%, transparent 70%)',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.012]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
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
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="mx-4 mb-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl"
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
            {upgradeInfo?.message || "You've used all your messages for today."}
          </p>
          {upgradeInfo?.url && (
            <a
              href={upgradeInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Upgrade your plan
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
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
// Main Component
// ────────────────────────────────────────────────────────

export function OnboardingChat() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [showQuotaError, setShowQuotaError] = useState(false);

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
    onboardingReady,
    clearError,
  } = useCloudChat({ sessionKey: 'onboarding', isOnboarding: true });

  // ── Derived state ──────────────────────────────────

  const canContinue = onboardingReady;
  const quotaRemaining = quota?.remaining ?? null;

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

  // ── Redirect if onboarding already completed ──────

  useEffect(() => {
    let cancelled = false;
    getCloudChatClient()
      .getProfile()
      .then((profile) => {
        if (!cancelled && profile?.onboardingCompleted) {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch(() => {
        // Non-blocking: if profile fetch fails, show onboarding anyway
      });
    return () => { cancelled = true; };
  }, [navigate]);

  // ── Focus input on mount ───────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 600);
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
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    await sendMessage(trimmed);

    // Re-focus input after send
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleContinueToDashboard(): Promise<void> {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      await getCloudChatClient().completeOnboarding();
    } catch {
      // Non-blocking: if the profile update fails we still navigate
    }

    navigate('/dashboard');
  }

  function handleSkip(): void {
    getCloudChatClient().completeOnboarding().catch(() => {
      // Silent — skip should always succeed from the user's perspective
    });
    navigate('/dashboard');
  }

  // ── Render ────────────────────────────────────────

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <BackgroundAtmosphere />

      {/* ─── Top Bar ─── */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <img
            src="/logos/helix-icon.svg"
            alt="Helix"
            className="h-7 w-auto"
          />
          <span className="text-base font-display font-semibold text-white tracking-tight">
            Helix
          </span>
        </div>

        {/* Skip link */}
        <button
          onClick={handleSkip}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors font-body"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </header>

      {/* ─── Welcome State (no messages yet) ─── */}
      <AnimatePresence>
        {messages.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center px-6 text-center"
          >
            {/* Animated gradient logo mark */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="relative mb-8"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl"
                style={{
                  background: 'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
                  boxShadow: '0 0 60px rgba(6, 134, 212, 0.3), 0 0 120px rgba(114, 52, 237, 0.15)',
                }}
              >
                <img
                  src="/logos/helix-icon.svg"
                  alt=""
                  className="w-10 h-10 brightness-0 invert"
                  aria-hidden="true"
                />
              </div>
              {/* Pulse ring */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
                  animation: 'pulse 3s ease-in-out infinite',
                  opacity: 0.15,
                }}
              />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-2xl sm:text-3xl font-display font-bold text-white mb-3"
            >
              Meet Helix
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-base sm:text-lg text-text-secondary max-w-md leading-relaxed font-body"
            >
              Say hello. Ask a question. Share what brought you here.
              <br className="hidden sm:block" />
              This is where it begins.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Messages Area ─── */}
      {(messages.length > 0 || isLoading) && (
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4"
          role="log"
          aria-label="Conversation with Helix"
          aria-live="polite"
        >
          <div className="max-w-2xl mx-auto space-y-4">
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
                        background: 'linear-gradient(135deg, #0686D4 0%, #7234ED 100%)',
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
        </div>
      )}

      {/* ─── Bottom Area ─── */}
      <div className="relative z-10 flex-shrink-0">
        {/* Error display */}
        <AnimatePresence>
          {error && !quotaExceeded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mx-4 sm:mx-6 mb-3 max-w-2xl lg:mx-auto"
            >
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button
                  onClick={clearError}
                  className="p-0.5 rounded hover:bg-white/5 transition-colors flex-shrink-0"
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quota exceeded overlay */}
        <AnimatePresence>
          {showQuotaError && quotaExceeded && (
            <div className="max-w-2xl mx-auto">
              <QuotaExceededOverlay
                upgradeInfo={upgradeInfo}
                onDismiss={() => setShowQuotaError(false)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* "Continue to Dashboard" floating button */}
        <AnimatePresence>
          {canContinue && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-center mb-3"
            >
              <button
                onClick={handleContinueToDashboard}
                disabled={isCompleting}
                className={clsx(
                  'group inline-flex items-center gap-2 px-6 py-2.5 rounded-full',
                  'text-sm font-medium text-white font-body',
                  'border border-white/10 backdrop-blur-xl',
                  'transition-all duration-300',
                  'hover:border-helix-500/40 hover:shadow-glow-blue',
                  isCompleting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                )}
                style={{
                  background:
                    'linear-gradient(135deg, rgba(6, 134, 212, 0.2) 0%, rgba(114, 52, 237, 0.2) 100%)',
                }}
                aria-label="Continue to dashboard"
              >
                {isCompleting ? 'Setting up...' : 'Continue to Dashboard'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Input Area ─── */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
          <div className="max-w-2xl mx-auto">
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
                    : messages.length === 0
                      ? 'Say something to Helix...'
                      : 'Type a message...'
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
                onClick={handleSend}
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

            {/* Metadata row: quota + keyboard hint */}
            <div className="flex items-center justify-between mt-2 px-1">
              {/* Quota display */}
              <div className="text-[11px] text-text-tertiary font-mono">
                {quotaRemaining !== null && !quotaExceeded && (
                  <span>{quotaRemaining} messages remaining</span>
                )}
              </div>

              {/* Keyboard hint - desktop only */}
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
