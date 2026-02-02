import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, CheckCircle, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

interface ExitIntentModalProps {
  /** Only show on specific pages (default: homepage only) */
  allowedPaths?: string[];
  /** Delay before allowing modal to show (ms) */
  initialDelay?: number;
}

export function ExitIntentModal({
  allowedPaths = ['/'],
  initialDelay = 5000,
}: ExitIntentModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasTriggered, setHasTriggered] = useState(false);

  // Check if modal was already dismissed in this session or recently shown
  const wasRecentlyDismissed = () => {
    const lastDismissed = localStorage.getItem('exit_intent_dismissed');
    if (!lastDismissed) return false;

    const dismissedTime = parseInt(lastDismissed, 10);
    const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
    return hoursSinceDismissed < 24; // Don't show again for 24 hours
  };

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    // Only trigger when mouse leaves through top of viewport
    if (e.clientY > 50) return;
    if (hasTriggered) return;
    if (wasRecentlyDismissed()) return;
    if (!allowedPaths.includes(window.location.pathname)) return;

    setHasTriggered(true);
    setIsVisible(true);
    trackEvent('exit_intent_shown');
  }, [hasTriggered, allowedPaths]);

  useEffect(() => {
    // Don't set up listener on mobile or if already dismissed
    if ('ontouchstart' in window) return;
    if (wasRecentlyDismissed()) return;

    // Wait for initial delay before enabling exit intent
    const timeout = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, initialDelay);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseLeave, initialDelay]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('exit_intent_dismissed', Date.now().toString());
    trackEvent('exit_intent_dismissed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      // Submit to your email capture endpoint
      const response = await fetch('/api/marketing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'exit_intent',
          offer: 'psychology_guide',
        }),
      });

      if (!response.ok) {
        throw new Error('Subscription failed');
      }

      setStatus('success');
      trackEvent('exit_intent_email_captured');
      localStorage.setItem('exit_intent_dismissed', Date.now().toString());

      // Close after success animation
      setTimeout(() => setIsVisible(false), 2000);
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-bg-secondary rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid md:grid-cols-2">
              {/* Left side - Image/Visual */}
              <div className="hidden md:block relative bg-gradient-to-br from-helix-600 to-purple-700 p-6">
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/20 blur-xl" />
                  <div className="absolute bottom-1/4 right-1/4 w-24 h-24 rounded-full bg-white/20 blur-xl" />
                </div>
                <div className="relative h-full flex flex-col justify-center">
                  <div className="w-16 h-16 mb-4 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Download className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Free Guide</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    The 7-Layer Psychology Architecture explained. Learn what makes Helix different from every other AI.
                  </p>
                </div>
              </div>

              {/* Right side - Form */}
              <div className="p-6 md:p-8">
                {status === 'success' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">You're in!</h3>
                    <p className="text-text-secondary">
                      Check your inbox for the guide. See you soon.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <div className="md:hidden mb-4">
                      <div className="w-12 h-12 mb-3 rounded-xl bg-helix-500/20 flex items-center justify-center">
                        <Download className="h-6 w-6 text-helix-400" />
                      </div>
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">Wait! Before you go...</h2>
                    <p className="text-text-secondary mb-6">
                      Get our free guide to the 7-Layer Psychology Architecture that powers Helix.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-text-tertiary focus:outline-none focus:border-helix-500/50 focus:ring-1 focus:ring-helix-500/20"
                          disabled={status === 'loading'}
                        />
                        {status === 'error' && errorMessage && (
                          <p className="mt-2 text-sm text-danger">{errorMessage}</p>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full btn btn-primary justify-center py-3 disabled:opacity-50"
                      >
                        {status === 'loading' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Send Me the Guide'
                        )}
                      </button>

                      <p className="text-xs text-text-tertiary text-center">
                        No spam, ever. Unsubscribe anytime.
                      </p>
                    </form>

                    <div className="mt-6 pt-4 border-t border-white/10">
                      <p className="text-sm text-text-tertiary">
                        <span className="font-medium text-text-secondary">What you'll learn:</span>
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-text-tertiary">
                        <li>• How narrative identity creates AI continuity</li>
                        <li>• Why emotional memory matters for AI</li>
                        <li>• The transformation cycle explained</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
