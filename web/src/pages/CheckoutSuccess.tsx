import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [tierName, setTierName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    async function verifyCheckout() {
      if (!user || !sessionId) {
        // If no session ID, this might be a direct navigation
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
        return;
      }

      try {
        // Verify the checkout session with our backend
        const response = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to verify checkout session');
        }

        const { tier, success } = await response.json();

        if (success) {
          setTierName(tier);
          setStatus('success');

          // Track conversion event
          trackEvent('checkout_complete', { tier, sessionId });

          // Update local subscription state
          await supabase
            .from('subscriptions')
            .upsert({
              user_id: user.id,
              tier,
              updated_at: new Date().toISOString(),
            });
        } else {
          throw new Error('Checkout was not successful');
        }
      } catch (err) {
        console.error('Checkout verification error:', err);
        setError(err instanceof Error ? err.message : 'Verification failed');
        setStatus('error');
      }
    }

    verifyCheckout();
  }, [user, sessionId, navigate]);

  // Redirect after success
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="h-12 w-12 animate-spin text-helix-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Verifying your subscription...</h1>
          <p className="text-text-secondary">This will only take a moment</p>
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verification Issue</h1>
          <p className="text-text-secondary mb-6">
            {error || "We couldn't verify your subscription. Don't worry - if payment was successful, your subscription will be activated shortly."}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 rounded-lg bg-helix-500 text-white font-medium hover:bg-helix-600 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="px-6 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
            >
              Check Settings
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4 overflow-hidden">
      {/* Celebration particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ['#0686D4', '#7234ED', '#16c0cf', '#10b981'][i % 4],
              left: `${Math.random() * 100}%`,
              top: '-20px',
            }}
            animate={{
              y: ['0vh', '100vh'],
              rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
              opacity: [1, 0],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: Math.random() * 1,
              ease: 'easeIn',
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="text-center max-w-md relative"
      >
        {/* Success Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2, damping: 12 }}
          className="relative mx-auto mb-8"
        >
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <motion.div
            className="absolute inset-0"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-24 h-24 mx-auto rounded-full border-2 border-emerald-400/30" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to {tierName || 'Helix'}!</h1>
          <p className="text-xl text-text-secondary mb-2">Your subscription is now active</p>
          <p className="text-text-tertiary mb-8">Redirecting to your dashboard...</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
        >
          <Sparkles className="h-4 w-4 text-helix-400" />
          <span className="text-sm text-text-secondary">Full access unlocked</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
