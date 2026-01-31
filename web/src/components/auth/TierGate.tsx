import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { hasTierAccess, SubscriptionTier, PRICING_TIERS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TierGateProps {
  requiredTier: SubscriptionTier;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
  className?: string;
}

export function TierGate({
  requiredTier,
  children,
  fallback,
  showUpgrade = true,
  className,
}: TierGateProps) {
  const { subscription, isLoading } = useSubscription();

  const userTier = subscription?.tier || 'awaken';
  const hasAccess = hasTierAccess(userTier, requiredTier);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <div className="animate-spin h-8 w-8 border-2 border-helix-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  // Get the required tier info
  const requiredTierInfo = PRICING_TIERS.find((t) => t.id === requiredTier);

  return (
    <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
      <div className="max-w-md text-center p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-slate-400" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">
          {requiredTierInfo?.name || requiredTier} Required
        </h2>

        <p className="text-slate-400 mb-6">
          This feature requires the {requiredTierInfo?.name || requiredTier} plan
          {requiredTierInfo && ` ($${requiredTierInfo.price}/month)`}.
          Upgrade to unlock this and other premium features.
        </p>

        {requiredTierInfo && (
          <div className="mb-8 text-left bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-helix-400" />
              What you'll get:
            </h3>
            <ul className="space-y-2">
              {requiredTierInfo.features.map((feature, i) => (
                <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                  <span className="text-helix-400 mt-0.5">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-helix-500 text-white font-medium hover:bg-helix-600 transition-colors"
          >
            View Plans
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
