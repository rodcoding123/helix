/**
 * FeatureToggles
 *
 * Hardcoded safety toggles that control Helix's permissions.
 * These toggles are immutable at runtime - cannot be changed by code.
 * Changes require direct database modification (admin only).
 *
 * Phase 0.5: AI Operations Control Plane
 * Created: 2026-02-04
 */

import { createClient } from '@supabase/supabase-js';
import { logToDiscord } from '../logging.js';
import { hashChain } from '../hash-chain.js';

export interface FeatureToggle {
  id: string;
  toggle_name: string;
  enabled: boolean;
  locked: boolean;
  controlled_by: 'ADMIN_ONLY' | 'USER' | 'BOTH';
  notes: string;
}

/**
 * Critical Safety Toggles
 *
 * These control fundamental permissions. All start LOCKED=true, ENABLED=false
 * to implement fail-safe default: Helix cannot do anything risky without explicit
 * admin approval.
 */
const CRITICAL_TOGGLES = {
  HELIX_CAN_CHANGE_MODELS: 'helix_can_change_models',
  HELIX_CAN_APPROVE_COSTS: 'helix_can_approve_costs',
  HELIX_CAN_RECOMMEND_OPTIMIZATIONS: 'helix_can_recommend_optimizations',
  HELIX_AUTONOMY_ENABLED: 'helix_autonomy_enabled',
};

/**
 * FeatureToggles - Hardcoded safety system
 *
 * Responsibilities:
 * 1. Check toggle states from database (cached)
 * 2. Enforce locked toggles (fail-closed)
 * 3. Log all toggle access to hash chain
 * 4. Prevent bypass of safety guardrails
 * 5. Provide admin UI with current states
 */
export class FeatureToggles {
  private supabase: ReturnType<typeof createClient> | null = null;
  private toggleCache: Map<string, { toggle: FeatureToggle; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize Supabase client lazily when first needed
  }

  private getSupabaseClient(): ReturnType<typeof createClient> {
    if (!this.supabase) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for FeatureToggles');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    return this.supabase;
  }

  /**
   * Check if feature is enabled
   *
   * Returns: true if enabled, false if disabled
   * Throws: If toggle is locked but disabled (safety guardrail active)
   */
  async isEnabled(toggleName: string): Promise<boolean> {
    const toggle = await this.getToggle(toggleName);

    // Safety check: locked toggles cannot be overridden
    if (toggle.locked && !toggle.enabled) {
      // This is an active safety guardrail
      await hashChain.add({
        type: 'security_event',
        event: 'locked_toggle_enforced',
        toggle: toggleName,
        enforced: true,
        timestamp: new Date().toISOString(),
      });

      // Return false (disabled) but don't throw - allows safe fallback
      return false;
    }

    return toggle.enabled;
  }

  /**
   * Enforce a toggle - throw if disabled and locked
   *
   * Usage: approvalGate.enforce('helix_can_change_models')
   * Throws: HelixSecurityError if toggle prevents operation
   */
  async enforce(toggleName: string, context?: string): Promise<void> {
    const toggle = await this.getToggle(toggleName);

    // If toggle is locked and disabled, this is a hard safety barrier
    if (toggle.locked && !toggle.enabled) {
      const message =
        `Security guardrail: ${toggleName} is locked and disabled. ` +
        `This prevents the operation. ${context || ''}`;

      logToDiscord({
        channel: 'helix-alerts',
        type: 'security_enforcement',
        toggle: toggleName,
        locked: true,
        message,
      });

      await hashChain.add({
        type: 'security_enforcement',
        event: 'toggle_enforcement_blocked',
        toggle: toggleName,
        context,
        timestamp: new Date().toISOString(),
      });

      throw new Error(message);
    }
  }

  /**
   * Get toggle configuration from database (cached)
   *
   * Cache: 5 minutes TTL
   */
  private async getToggle(toggleName: string): Promise<FeatureToggle> {
    // Check cache first
    const cached = this.toggleCache.get(toggleName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.toggle;
    }

    try {
      const { data, error } = await this.getSupabaseClient()
        .from('feature_toggles')
        .select('*')
        .eq('toggle_name', toggleName)
        .single();

      if (error) throw error;
      if (!data) throw new Error(`Toggle not found: ${toggleName}`);

      const toggle = data as FeatureToggle;
      this.toggleCache.set(toggleName, { toggle, timestamp: Date.now() });

      // Log toggle access
      await hashChain.add({
        type: 'toggle_accessed',
        toggle: toggleName,
        enabled: toggle.enabled,
        locked: toggle.locked,
        timestamp: new Date().toISOString(),
      });

      return toggle;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'toggle_fetch_failed',
        toggle: toggleName,
        error: String(error),
      });

      // Fail-closed: assume disabled if we can't fetch
      return {
        id: '',
        toggle_name: toggleName,
        enabled: false,
        locked: true,
        controlled_by: 'ADMIN_ONLY',
        notes: 'Toggle fetch failed - defaulting to disabled for safety',
      };
    }
  }

  /**
   * Get all toggles (for admin dashboard)
   *
   * Returns current state of all critical toggles
   */
  async getAllToggles(): Promise<FeatureToggle[]> {
    try {
      const { data, error } = await this.getSupabaseClient().from('feature_toggles').select('*');

      if (error) throw error;

      // Cache all results
      const toggles = (data as FeatureToggle[]) || [];
      toggles.forEach(toggle => {
        this.toggleCache.set(toggle.toggle_name, { toggle, timestamp: Date.now() });
      });

      return toggles;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'toggles_fetch_failed',
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Get toggle details by name
   */
  async getToggleDetails(toggleName: string): Promise<FeatureToggle> {
    return this.getToggle(toggleName);
  }

  /**
   * Check multiple toggles (convenience method)
   *
   * Returns object: { toggle_name: enabled }
   */
  async checkMultiple(toggleNames: string[]): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const name of toggleNames) {
      try {
        results[name] = await this.isEnabled(name);
      } catch {
        // Fail-closed
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * Admin: Set toggle state (database only, not here)
   *
   * NOTE: This method cannot be implemented safely in code.
   * Toggle changes MUST be made directly in the database by admins.
   * This ensures that no code path can override safety toggles.
   *
   * To change a toggle:
   * 1. Connect to Supabase directly (not via this app)
   * 2. UPDATE feature_toggles SET enabled = ... WHERE toggle_name = ...
   * 3. Verify in Discord hash chain
   * 4. Restart application to clear cache
   */
  async getAdminInstructions(): Promise<string> {
    return `
CRITICAL: Feature toggles can only be changed via direct database access.
You cannot change them through this API.

To change a toggle state:
1. Connect to Supabase console (https://supabase.com/dashboard)
2. Navigate to SQL Editor
3. Run: UPDATE feature_toggles SET enabled = true WHERE toggle_name = '...';
4. Verify the change appears in #helix-hash-chain on Discord
5. Restart the Helix application to clear cache

WARNING: Do not attempt to change toggles through this API.
This is intentional to prevent accidental or malicious bypass of safety guardrails.

Current toggle states:
${(await this.getAllToggles())
  .map(
    t =>
      `- ${t.toggle_name}: ${t.enabled ? 'ENABLED' : 'DISABLED'} (locked: ${t.locked ? 'YES' : 'NO'})`
  )
  .join('\n')}
    `;
  }

  /**
   * Clear all caches (for testing or after admin updates)
   */
  clearCache(): void {
    this.toggleCache.clear();
  }

  /**
   * Get cache statistics (for debugging)
   */
  getCacheStats(): { cached_toggles: number; cacheTTL: number } {
    return {
      cached_toggles: this.toggleCache.size,
      cacheTTL: this.cacheTTL,
    };
  }

  /**
   * Verify all critical toggles exist
   *
   * Should be called on startup to ensure database is initialized
   */
  async verifyCriticalToggles(): Promise<boolean> {
    try {
      const toggleNames = Object.values(CRITICAL_TOGGLES);
      const allToggles = await this.getAllToggles();
      const existingNames = new Set(allToggles.map(t => t.toggle_name));

      for (const name of toggleNames) {
        if (!existingNames.has(name)) {
          throw new Error(`Critical toggle missing: ${name}`);
        }
      }

      // All critical toggles exist
      logToDiscord({
        channel: 'helix-api',
        type: 'critical_toggles_verified',
        count: toggleNames.length,
      });

      return true;
    } catch (error) {
      logToDiscord({
        channel: 'helix-alerts',
        type: 'critical_toggles_verification_failed',
        error: String(error),
      });

      throw error;
    }
  }
}

// Singleton instance
export const featureToggles = new FeatureToggles();

// Export toggle names for convenient use
export const TOGGLES = CRITICAL_TOGGLES;
