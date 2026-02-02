import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Sparkles, ArrowRight, Clock, MessageSquare, Brain } from 'lucide-react';
import { trackUpgradePromptShown, trackUpgradePromptClicked } from '@/lib/analytics';
import { useEffect } from 'react';
import type { SubscriptionTier } from '@/lib/types';
import clsx from 'clsx';

export type UpgradeTrigger =
  | 'message_limit_80'
  | 'message_limit_reached'
  | 'feature_gate'
  | 'usage_7_days'
  | 'specialist_limit'
  | 'memory_limit';

interface UpgradePromptProps {
  trigger: UpgradeTrigger;
  currentTier: SubscriptionTier;
  onDismiss: () => void;
  variant?: 'modal' | 'banner' | 'inline';
  context?: {
    messagesUsed?: number;
    messagesLimit?: number;
    featureName?: string;
    daysActive?: number;
  };
}

const TRIGGER_CONTENT: Record<
  UpgradeTrigger,
  {
    title: string;
    description: string;
    icon: React.ElementType;
    urgency: 'low' | 'medium' | 'high';
    suggestedTier: Exclude<SubscriptionTier, 'core'>;
  }
> = {
  message_limit_80: {
    title: "You're almost at your daily limit",
    description: "Upgrade now to keep the conversation flowing without interruptions.",
    icon: MessageSquare,
    urgency: 'medium',
    suggestedTier: 'phantom',
  },
  message_limit_reached: {
    title: "You've hit your daily limit",
    description: "Upgrade to continue chatting — or come back tomorrow.",
    icon: MessageSquare,
    urgency: 'high',
    suggestedTier: 'phantom',
  },
  feature_gate: {
    title: 'Unlock this feature',
    description: 'This feature is available on higher tiers. Upgrade to access it.',
    icon: Zap,
    urgency: 'medium',
    suggestedTier: 'overseer',
  },
  usage_7_days: {
    title: "You've been using Helix for a week!",
    description: "Enjoying the experience? Upgrade for unlimited access and more features.",
    icon: Sparkles,
    urgency: 'low',
    suggestedTier: 'phantom',
  },
  specialist_limit: {
    title: 'Unlock more specialists',
    description: 'Your current plan limits specialist agents. Upgrade for unlimited access.',
    icon: Brain,
    urgency: 'medium',
    suggestedTier: 'overseer',
  },
  memory_limit: {
    title: 'Extend your memory',
    description: 'Helix can remember more with an upgraded plan.',
    icon: Clock,
    urgency: 'medium',
    suggestedTier: 'phantom',
  },
};

const TIER_BENEFITS: Record<Exclude<SubscriptionTier, 'core'>, string[]> = {
  phantom: ['Ghost Mode', 'No telemetry', 'Full psychology', 'Complete privacy'],
  overseer: ['Observatory access', 'Watch AI evolution', 'Aggregate patterns', 'Research participation'],
  architect: ['Full access everywhere', 'Shape development', 'Web & mobile', 'Research API'],
};

const TIER_PRICES: Record<Exclude<SubscriptionTier, 'core'>, string> = {
  phantom: '$9/mo',
  overseer: '$29/mo',
  architect: '$99/mo',
};

export function UpgradePrompt({
  trigger,
  currentTier,
  onDismiss,
  variant = 'modal',
  context,
}: UpgradePromptProps) {
  const content = TRIGGER_CONTENT[trigger];
  const Icon = content.icon;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    trackUpgradePromptShown(trigger);
  }, [trigger]);

  function handleUpgradeClick() {
    trackUpgradePromptClicked(trigger, content.suggestedTier);
  }

  // Don't show if already on a paid tier
  if (currentTier !== 'core') {
    return null;
  }

  function handleDismiss() {
    setDismissed(true);
    setTimeout(onDismiss, 300);
  }

  if (variant === 'banner') {
    return (
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={clsx(
              'w-full px-4 py-3 border-b',
              content.urgency === 'high'
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-helix-500/10 border-helix-500/20'
            )}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Icon
                  className={clsx(
                    'h-5 w-5',
                    content.urgency === 'high' ? 'text-amber-400' : 'text-helix-400'
                  )}
                />
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-white">{content.title}</span>
                  {context?.messagesUsed && context?.messagesLimit && (
                    <span className="ml-2">
                      ({context.messagesUsed}/{context.messagesLimit} messages used)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/pricing?tier=${content.suggestedTier}`}
                  onClick={handleUpgradeClick}
                  className="px-4 py-1.5 rounded-lg bg-helix-500 text-white text-sm font-medium hover:bg-helix-600 transition-colors"
                >
                  Upgrade
                </Link>
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded-lg text-text-tertiary hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (variant === 'inline') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-helix-500/10 border border-helix-500/20"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-helix-500/20">
            <Icon className="h-5 w-5 text-helix-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white">{content.title}</h3>
            <p className="text-sm text-text-tertiary mt-1">{content.description}</p>
            <Link
              to={`/pricing?tier=${content.suggestedTier}`}
              onClick={handleUpgradeClick}
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-helix-400 hover:text-helix-300 transition-colors"
            >
              View Plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // Modal variant (default)
  return (
    <AnimatePresence>
      {!dismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-bg-secondary rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Header gradient */}
            <div
              className={clsx(
                'h-2',
                content.urgency === 'high'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                  : 'bg-gradient-helix'
              )}
            />

            <div className="p-6">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-2 rounded-lg text-text-tertiary hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Icon */}
              <div
                className={clsx(
                  'w-14 h-14 rounded-xl flex items-center justify-center mb-4',
                  content.urgency === 'high' ? 'bg-amber-500/20' : 'bg-helix-500/20'
                )}
              >
                <Icon
                  className={clsx(
                    'h-7 w-7',
                    content.urgency === 'high' ? 'text-amber-400' : 'text-helix-400'
                  )}
                />
              </div>

              {/* Content */}
              <h2 className="text-xl font-bold text-white mb-2">{content.title}</h2>
              <p className="text-text-secondary mb-6">{content.description}</p>

              {/* Context info */}
              {context?.messagesUsed !== undefined && context?.messagesLimit !== undefined && (
                <div className="mb-6 p-3 rounded-lg bg-white/5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text-tertiary">Messages today</span>
                    <span className="text-text-secondary">
                      {context.messagesUsed} / {context.messagesLimit}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        (context.messagesUsed / context.messagesLimit) >= 1
                          ? 'bg-danger'
                          : (context.messagesUsed / context.messagesLimit) >= 0.8
                            ? 'bg-amber-500'
                            : 'bg-helix-500'
                      )}
                      style={{ width: `${Math.min(100, (context.messagesUsed / context.messagesLimit) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Suggested tier */}
              <div className="p-4 rounded-xl bg-helix-500/10 border border-helix-500/20 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-white capitalize">
                    {content.suggestedTier} Plan
                  </span>
                  <span className="text-helix-400 font-medium">
                    {TIER_PRICES[content.suggestedTier]}
                  </span>
                </div>
                <ul className="space-y-2">
                  {TIER_BENEFITS[content.suggestedTier].map((benefit, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Sparkles className="h-3.5 w-3.5 text-helix-400" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Link
                  to={`/pricing?tier=${content.suggestedTier}`}
                  onClick={handleUpgradeClick}
                  className="flex-1 btn btn-primary justify-center"
                >
                  Upgrade Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 rounded-lg text-text-tertiary hover:text-white transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
