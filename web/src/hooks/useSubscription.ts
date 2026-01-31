import { useState, useEffect, useCallback } from 'react';
import { getSubscription } from '@/lib/api';
import type { Subscription, SubscriptionTier } from '@/lib/types';
import { useAuth } from './useAuth';

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  loading: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasAccess: (requiredTier: SubscriptionTier) => boolean;
}

const TIER_LEVELS: Record<SubscriptionTier, number> = {
  core: 0,
  phantom: 1,
  overseer: 2,
  architect: 3,
};

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const data = await getSubscription();
    if (data) {
      setSubscription(data);
    } else {
      // Default to free tier if no subscription found
      setSubscription({
        id: '',
        user_id: user.id,
        tier: 'core',
        cancel_at_period_end: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const hasAccess = useCallback(
    (requiredTier: SubscriptionTier) => {
      const currentLevel = TIER_LEVELS[subscription?.tier || 'core'];
      const requiredLevel = TIER_LEVELS[requiredTier];
      return currentLevel >= requiredLevel;
    },
    [subscription]
  );

  return {
    subscription,
    tier: subscription?.tier || 'core',
    loading,
    isLoading: loading,
    error,
    refresh: fetchSubscription,
    hasAccess,
  };
}
