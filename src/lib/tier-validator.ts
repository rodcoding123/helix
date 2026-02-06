/**
 * Tier Validator - Backend tier access verification
 * MEDIUM FIX 4.2: Validates user tier on backend before allowing access to features
 * Works with Supabase RLS for defense-in-depth
 */

import { createClient } from '@supabase/supabase-js';

export enum SubscriptionTier {
  CORE = 'core',
  PHANTOM = 'phantom',
  OVERSEER = 'overseer',
  ARCHITECT = 'architect',
}

export interface TierLevel {
  tier: SubscriptionTier;
  level: number;
}

const TIER_LEVELS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.CORE]: 0,
  [SubscriptionTier.PHANTOM]: 1,
  [SubscriptionTier.OVERSEER]: 2,
  [SubscriptionTier.ARCHITECT]: 3,
};

/**
 * Get user's current subscription tier from Supabase
 * @param userId User ID from JWT
 * @param supabaseClient Authenticated Supabase client
 * @returns Current subscription tier or CORE (default)
 */
export async function getUserTier(
  userId: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<SubscriptionTier> {
  try {
    const { data, error } = await supabaseClient
      .from('subscriptions')
      .select('tier')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      // Default to CORE tier if no active subscription
      return SubscriptionTier.CORE;
    }

    // Validate tier is a known value
    const tier = data.tier as SubscriptionTier;
    if (!Object.values(SubscriptionTier).includes(tier)) {
      return SubscriptionTier.CORE;
    }

    return tier;
  } catch (error) {
    console.error('Error fetching user tier:', error);
    // Fail securely - default to CORE tier on error
    return SubscriptionTier.CORE;
  }
}

/**
 * Check if user has access to a required tier
 * @param userTier User's current tier
 * @param requiredTier Tier required for feature access
 * @returns true if user's tier >= required tier
 */
export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const userLevel = TIER_LEVELS[userTier];
  const requiredLevel = TIER_LEVELS[requiredTier];

  if (userLevel === undefined || requiredLevel === undefined) {
    return false;
  }

  return userLevel >= requiredLevel;
}

/**
 * Verify user has access to a feature (throws if not)
 * @param userId User ID from JWT
 * @param requiredTier Tier required for feature
 * @param supabaseClient Authenticated Supabase client
 * @throws Error if user doesn't have required tier
 */
export async function verifyTierAccess(
  userId: string,
  requiredTier: SubscriptionTier,
  supabaseClient: ReturnType<typeof createClient>
): Promise<void> {
  const userTier = await getUserTier(userId, supabaseClient);

  if (!hasAccess(userTier, requiredTier)) {
    throw new Error(`Tier upgrade required. Current: ${userTier}, Required: ${requiredTier}`);
  }
}

/**
 * Get tier level (for display/debugging)
 */
export function getTierLevel(tier: SubscriptionTier): number {
  return TIER_LEVELS[tier] ?? 0;
}

/**
 * Get all tiers equal to or below user's tier
 */
export function getAccessibleTiers(userTier: SubscriptionTier): SubscriptionTier[] {
  const userLevel = TIER_LEVELS[userTier];
  return Object.entries(TIER_LEVELS)
    .filter(([_, level]) => level <= userLevel)
    .map(([tier]) => tier as SubscriptionTier);
}

interface TierRequest {
  user?: { id: string };
}

interface TierResponse {
  status: (code: number) => { json: (data: unknown) => void };
}

/**
 * Middleware for Express/Fastify to verify tier access
 * Usage: app.get('/api/code', verifyTierMiddleware(SubscriptionTier.ARCHITECT), handler)
 */
export function verifyTierMiddleware(requiredTier: SubscriptionTier) {
  return async (req: TierRequest, res: TierResponse, next: () => void): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const supabaseUrl = process.env.SUPABASE_URL ?? '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      await verifyTierAccess(
        userId,
        requiredTier,
        supabaseClient as ReturnType<typeof createClient>
      );
      next();
    } catch (error) {
      res.status(403).json({
        error: 'Insufficient tier',
        message: error instanceof Error ? error.message : 'Tier verification failed',
      });
    }
  };
}
