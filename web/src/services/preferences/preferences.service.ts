/**
 * Phase 9C: User Preferences Service
 * Manages operation preferences and UI theme settings
 */

import { createClient } from '@supabase/supabase-js';
import { getCacheService } from '@/lib/cache/redis-cache';

export interface OperationPreference {
  id?: string;
  user_id: string;
  operation_id: string;
  preferred_model?: 'anthropic' | 'deepseek' | 'gemini' | 'openai';
  enabled: boolean;
  default_parameters?: Record<string, any>;
  cost_budget_monthly?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ThemePreference {
  user_id: string;
  color_scheme: 'light' | 'dark' | 'auto';
  accent_color: string;
  compact_mode: boolean;
  email_list_view: 'grid' | 'list' | 'compact';
  calendar_view: 'month' | 'week' | 'day' | 'agenda';
  tasks_sort_by: 'priority' | 'due_date' | 'created_at' | 'alphabetical';
  notify_on_operation_completion: boolean;
  notify_on_operation_failure: boolean;
  notify_on_cost_limit_warning: boolean;
  notify_on_cost_limit_exceeded: boolean;
  sidebar_collapsed: boolean;
  updated_at?: string;
}

let db: any;

function getDb() {
  if (!db) {
    db = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    );
  }
  return db;
}

export class PreferencesService {
  /**
   * Get all operation preferences for a user (with caching)
   */
  async getOperationPreferences(userId: string): Promise<OperationPreference[]> {
    const cache = getCacheService();
    const cacheKey = `op_prefs:${userId}`;

    return cache.getOrFetch(
      cacheKey,
      async () => {
        const { data, error } = await getDb()
          .from('user_operation_preferences')
          .select('*')
          .eq('user_id', userId);

        if (error) {
          console.error('Failed to fetch operation preferences:', error);
          return [];
        }

        return data || [];
      },
      15 * 60 // 15-minute TTL
    );
  }

  /**
   * Get preference for a specific operation (with caching)
   */
  async getOperationPreference(userId: string, operationId: string): Promise<OperationPreference | null> {
    const cache = getCacheService();
    const cacheKey = `op_pref:${userId}:${operationId}`;

    return cache.getOrFetch(
      cacheKey,
      async () => {
        const { data, error } = await getDb()
          .from('user_operation_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('operation_id', operationId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Failed to fetch operation preference:', error);
        }

        return data || null;
      },
      15 * 60 // 15-minute TTL
    );
  }

  /**
   * Update operation preference
   * Uses UPSERT for atomic insert-or-update (single query)
   * Invalidates relevant caches on success
   */
  async setOperationPreference(userId: string, pref: Omit<OperationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<OperationPreference> {
    const { data, error } = await getDb()
      .from('user_operation_preferences')
      .upsert(
        {
          user_id: userId,
          operation_id: pref.operation_id,
          enabled: pref.enabled !== undefined ? pref.enabled : true,
          preferred_model: pref.preferred_model,
          default_parameters: pref.default_parameters,
          cost_budget_monthly: pref.cost_budget_monthly,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,operation_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // Invalidate related caches
    const cache = getCacheService();
    cache.delete(`op_prefs:${userId}`).catch(err => {
      console.error('Failed to invalidate cache:', err);
    });
    cache.delete(`op_pref:${userId}:${pref.operation_id}`).catch(err => {
      console.error('Failed to invalidate cache:', err);
    });

    return data;
  }

  /**
   * Get theme preferences (with caching)
   */
  async getThemePreferences(userId: string): Promise<ThemePreference | null> {
    const cache = getCacheService();
    const cacheKey = `theme_prefs:${userId}`;

    return cache.getOrFetch(
      cacheKey,
      async () => {
        const { data, error } = await getDb()
          .from('ui_theme_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Failed to fetch theme preferences:', error);
        }

        return data || null;
      },
      60 * 60 // 1-hour TTL (themes change less frequently)
    );
  }

  /**
   * Update theme preferences
   * Uses UPSERT for atomic insert-or-update (single query)
   * Invalidates theme cache on success
   */
  async setThemePreferences(userId: string, theme: Partial<Omit<ThemePreference, 'user_id' | 'updated_at'>>): Promise<ThemePreference> {
    const { data, error } = await getDb()
      .from('ui_theme_preferences')
      .upsert(
        {
          user_id: userId,
          color_scheme: theme.color_scheme || 'auto',
          accent_color: theme.accent_color || '#3B82F6',
          compact_mode: theme.compact_mode !== undefined ? theme.compact_mode : false,
          email_list_view: theme.email_list_view || 'grid',
          calendar_view: theme.calendar_view || 'month',
          tasks_sort_by: theme.tasks_sort_by || 'priority',
          notify_on_operation_completion: theme.notify_on_operation_completion !== undefined ? theme.notify_on_operation_completion : true,
          notify_on_operation_failure: theme.notify_on_operation_failure !== undefined ? theme.notify_on_operation_failure : true,
          notify_on_cost_limit_warning: theme.notify_on_cost_limit_warning !== undefined ? theme.notify_on_cost_limit_warning : true,
          notify_on_cost_limit_exceeded: theme.notify_on_cost_limit_exceeded !== undefined ? theme.notify_on_cost_limit_exceeded : true,
          sidebar_collapsed: theme.sidebar_collapsed !== undefined ? theme.sidebar_collapsed : false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // Invalidate theme cache
    const cache = getCacheService();
    cache.delete(`theme_prefs:${userId}`).catch(err => {
      console.error('Failed to invalidate cache:', err);
    });

    return data;
  }

  /**
   * Bulk update operation preferences
   * Phase 9 Polish: Uses single UPSERT with multiple rows (N queries → 1 query)
   * Instead of looping through setOperationPreference (which was N+1), batch all at once
   */
  async bulkUpdateOperationPreferences(
    userId: string,
    updates: Array<Partial<OperationPreference> & { operation_id: string }>
  ): Promise<OperationPreference[]> {
    if (updates.length === 0) return [];

    // Build batch UPSERT payload - all updates in one payload
    const payload = updates.map(update => ({
      user_id: userId,
      operation_id: update.operation_id,
      enabled: update.enabled !== undefined ? update.enabled : true,
      preferred_model: update.preferred_model,
      default_parameters: update.default_parameters,
      cost_budget_monthly: update.cost_budget_monthly,
      updated_at: new Date().toISOString(),
    }));

    // Single UPSERT query for all updates (previously was N queries in a loop)
    const { data, error } = await getDb()
      .from('user_operation_preferences')
      .upsert(payload, { onConflict: 'user_id,operation_id' })
      .select();

    if (error) throw error;

    // Invalidate caches after batch update completes
    const cache = getCacheService();
    cache.delete(`op_prefs:${userId}`).catch(err => {
      console.error('Failed to invalidate cache:', err);
    });

    // Invalidate individual operation preference caches
    for (const update of updates) {
      cache.delete(`op_pref:${userId}:${update.operation_id}`).catch(err => {
        console.error('Failed to invalidate cache:', err);
      });
    }

    return data || [];
  }

  /**
   * Reset preferences to defaults for a user
   * Invalidates all user preference caches
   */
  async resetToDefaults(userId: string): Promise<void> {
    // Delete operation preferences
    await getDb()
      .from('user_operation_preferences')
      .delete()
      .eq('user_id', userId);

    // Delete theme preferences
    await getDb()
      .from('ui_theme_preferences')
      .delete()
      .eq('user_id', userId);

    // Invalidate all user preference caches
    const cache = getCacheService();
    cache.invalidateUserCache(userId).catch(err => {
      console.error('Failed to invalidate cache:', err);
    });
  }

  /**
   * Get cost budget remaining for operation this month
   */
  async getRemainingBudget(userId: string, operationId: string): Promise<number | null> {
    const pref = await this.getOperationPreference(userId, operationId);
    if (!pref?.cost_budget_monthly) return null;

    const { data } = await getDb()
      .rpc('get_operation_monthly_cost', {
        p_user_id: userId,
        p_operation_id: operationId,
      });

    const spent = data || 0;
    return Math.max(0, pref.cost_budget_monthly - spent);
  }

  /**
   * Check if operation is within budget
   */
  async isWithinBudget(userId: string, operationId: string, estimatedCost: number): Promise<boolean> {
    const remaining = await this.getRemainingBudget(userId, operationId);
    if (remaining === null) return true; // No limit
    return remaining >= estimatedCost;
  }
}

// Singleton instance
let preferencesService: PreferencesService | null = null;

export function getPreferencesService(): PreferencesService {
  if (!preferencesService) {
    preferencesService = new PreferencesService();
  }
  return preferencesService;
}
