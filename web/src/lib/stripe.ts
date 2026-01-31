// Stripe Integration for Helix Observatory

import type { SubscriptionTier } from './types';

const STRIPE_PRICE_IDS: Record<Exclude<SubscriptionTier, 'core'>, string> = {
  phantom: import.meta.env.VITE_STRIPE_PRICE_PHANTOM || 'price_phantom',
  overseer: import.meta.env.VITE_STRIPE_PRICE_OVERSEER || 'price_overseer',
  architect: import.meta.env.VITE_STRIPE_PRICE_ARCHITECT || 'price_architect',
};

export async function createCheckoutSession(tier: SubscriptionTier): Promise<string> {
  if (tier === 'core') {
    throw new Error('Cannot create checkout for free tier');
  }

  const response = await fetch('/api/stripe/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      priceId: STRIPE_PRICE_IDS[tier],
      tier,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const { url } = await response.json();
  return url;
}

export async function createPortalSession(): Promise<string> {
  const response = await fetch('/api/stripe/create-portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create portal session');
  }

  const { url } = await response.json();
  return url;
}

export async function cancelSubscription(): Promise<void> {
  const response = await fetch('/api/stripe/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel subscription');
  }
}

export function getTierPrice(tier: SubscriptionTier): number {
  const prices: Record<SubscriptionTier, number> = {
    core: 0,
    phantom: 9,
    overseer: 29,
    architect: 99,
  };
  return prices[tier];
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
