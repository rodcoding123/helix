import { useState, useEffect } from 'react';
import type { SubscriptionTier } from '@/lib/types';
import type { UpgradeTrigger } from '@/components/upsell/UpgradePrompt';

/**
 * Hook to manage upgrade prompts based on usage
 */
export function useUpgradePrompt(
  currentTier: SubscriptionTier,
  messagesUsed: number,
  messagesLimit: number
) {
  const [showPrompt, setShowPrompt] = useState<UpgradeTrigger | null>(null);

  useEffect(() => {
    if (currentTier !== 'core') return;

    const usagePercent = messagesLimit > 0 ? messagesUsed / messagesLimit : 0;

    if (usagePercent >= 1) {
      setShowPrompt('message_limit_reached');
    } else if (usagePercent >= 0.8) {
      // Only show 80% prompt once per session
      const hasShown80 = sessionStorage.getItem('upgrade_prompt_80_shown');
      if (!hasShown80) {
        setShowPrompt('message_limit_80');
        sessionStorage.setItem('upgrade_prompt_80_shown', 'true');
      }
    }
  }, [currentTier, messagesUsed, messagesLimit]);

  const dismissPrompt = () => setShowPrompt(null);

  return { showPrompt, dismissPrompt };
}
