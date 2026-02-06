/**
 * User Context Loader
 *
 * Loads user-specific context for each conversation:
 * - User profile (name, email, preferences)
 * - Conversation history count
 * - Trust level with Helix
 * - Prior interaction patterns
 *
 * This is called per-request to provide Helix awareness of
 * who she's talking to and her relationship with them.
 */

export interface UserContext {
  userId: string;
  userName?: string;
  userEmail?: string;
  trustLevel: number;
  conversationCount: number;
  firstInteractionDate?: string;
  preferredLanguage?: string;
  customPreferences?: Record<string, unknown>;
}

/**
 * Load user context from Supabase
 * Called on every chat request
 */
export async function loadUserContext(
  userId: string,
  supabaseClient: any // Type would be SupabaseClient
): Promise<UserContext> {
  const context: UserContext = {
    userId,
    trustLevel: 0.5, // Default to neutral trust
    conversationCount: 0,
  };

  try {
    // 1. Get user profile from auth.users + user_profiles
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error loading user profile:', profileError);
      // Continue with defaults if profile doesn't exist
    } else if (userProfile) {
      context.userName = userProfile.display_name || userProfile.full_name;
      context.userEmail = userProfile.email;
      context.trustLevel = userProfile.trust_level ?? 0.5;
      context.firstInteractionDate = userProfile.created_at;
      context.preferredLanguage = userProfile.preferred_language;
      context.customPreferences = userProfile.custom_preferences || {};
    }

    // 2. Get conversation count for this user
    const { count, error: countError } = await supabaseClient
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (!countError && count !== null) {
      context.conversationCount = count;
    }

    // 3. Special case: Check if this is the creator (Rodrigo)
    const creatorId = process.env.RODRIGO_CREATOR_ID;
    if (creatorId && userId === creatorId) {
      context.trustLevel = 1.0; // Creator always has perfect trust
      context.customPreferences = context.customPreferences || {};
      context.customPreferences.isCreator = true;
    }
  } catch (error) {
    console.error('Error in loadUserContext:', error);
    // Continue with defaults
  }

  return context;
}

/**
 * Update user trust level (only for learning/feedback, not admin)
 * Called after significant positive/negative interactions
 */
export async function updateUserTrustLevel(
  userId: string,
  newTrustLevel: number,
  supabaseClient: any
): Promise<void> {
  // Ensure trust level is bounded
  const bounded = Math.max(0, Math.min(1, newTrustLevel));

  const { error } = await supabaseClient
    .from('user_profiles')
    .update({ trust_level: bounded, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating user trust level:', error);
  }
}

/**
 * Record user interaction for future context
 */
export async function recordUserInteraction(
  userId: string,
  sessionKey: string,
  interactionType: 'positive' | 'negative' | 'neutral',
  supabaseClient: any
): Promise<void> {
  const { error } = await supabaseClient.from('user_interactions').insert({
    user_id: userId,
    session_key: sessionKey,
    interaction_type: interactionType,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error recording user interaction:', error);
  }
}
