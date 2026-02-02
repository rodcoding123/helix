import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, HelpCircle, MessageSquare } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { useEffect } from 'react';

export function CheckoutCancel() {
  useEffect(() => {
    trackEvent('checkout_cancelled');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md text-center"
      >
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-4xl">🤔</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Checkout Cancelled</h1>
        <p className="text-text-secondary mb-8">
          No worries — your payment was not processed. You can try again whenever you're ready.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-helix-500 text-white font-medium hover:bg-helix-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pricing
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
          >
            Continue Exploring
          </Link>
        </div>

        {/* Help section */}
        <div className="bg-bg-secondary/50 rounded-xl border border-white/10 p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center justify-center gap-2">
            <HelpCircle className="h-5 w-5 text-helix-400" />
            Need help deciding?
          </h2>

          <div className="space-y-4 text-left">
            <div className="p-4 rounded-lg bg-white/5">
              <h3 className="font-medium text-text-primary mb-1">Start free, upgrade later</h3>
              <p className="text-sm text-text-tertiary">
                The free tier includes full 7-layer psychology. Try it first, then upgrade when you need more.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white/5">
              <h3 className="font-medium text-text-primary mb-1">Developer? Bring your own keys</h3>
              <p className="text-sm text-text-tertiary">
                The Developer tier is just $9.99/mo + your API costs. Unlimited messages, full control.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-text-tertiary">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm">Questions? Chat with Helix to learn more</span>
          </div>
        </div>

        {/* FAQ link */}
        <p className="mt-6 text-sm text-text-tertiary">
          Still have questions?{' '}
          <Link to="/pricing#faq" className="text-helix-400 hover:underline">
            Check our FAQ
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
