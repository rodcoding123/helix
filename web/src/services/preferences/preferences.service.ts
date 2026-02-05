/**
 * Phase 9C: User Preferences Service
 * Manages operation preferences and UI theme settings
 */

import { createClient } from '@supabase/supabase-js';

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
   * Get all operation preferences for a user
   */
  async getOperationPreferences(userId: string): Promise<OperationPreference[]> {
    const { data, error } = await getDb()
      .from('user_operation_preferences')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch operation preferences:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get preference for a specific operation
   */
  async getOperationPreference(userId: string, operationId: string): Promise<OperationPreference | null> {
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
  }

  /**
   * Update operation preference
   */
  async setOperationPreference(userId: string, pref: Omit<OperationPreference, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<OperationPreference> {
    const existing = await this.getOperationPreference(userId, pref.operation_id);

    if (existing) {
      // Update existing
      const { data, error } = await getDb()
        .from('user_operation_preferences')
        .update({
          ...pref,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('operation_id', pref.operation_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new
      const { data, error } = await getDb()
        .from('user_operation_preferences')
        .insert({
          user_id: userId,
          ...pref,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Get theme preferences
   */
  async getThemePreferences(userId: string): Promise<ThemePreference | null> {
    const { data, error } = await getDb()
      .from('ui_theme_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch theme preferences:', error);
    }

    return data || null;
  }

  /**
   * Update theme preferences
   */
  async setThemePreferences(userId: string, theme: Partial<Omit<ThemePreference, 'user_id' | 'updated_at'>>): Promise<ThemePreference> {
    const existing = await this.getThemePreferences(userId);

    if (existing) {
      // Update
      const { data, error } = await getDb()
        .from('ui_theme_preferences')
        .update({
          ...theme,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert with defaults
      const { data, error } = await getDb()
        .from('ui_theme_preferences')
        .insert({
          user_id: userId,
          color_scheme: 'auto',
          accent_color: '#3B82F6',
          compact_mode: false,
          email_list_view: 'grid',
          calendar_view: 'month',
          tasks_sort_by: 'priority',
          notify_on_operation_completion: true,
          notify_on_operation_failure: true,
          notify_on_cost_limit_warning: true,
          notify_on_cost_limit_exceeded: true,
          sidebar_collapsed: false,
          ...theme,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  /**
   * Bulk update operation preferences
   */
  async bulkUpdateOperationPreferences(
    userId: string,
    updates: Array<Partial<OperationPreference> & { operation_id: string }>
  ): Promise<OperationPreference[]> {
    const results: OperationPreference[] = [];

    for (const update of updates) {
      const result = await this.setOperationPreference(userId, {
        operation_id: update.operation_id,
        enabled: update.enabled !== undefined ? update.enabled : true,
        preferred_model: update.preferred_model,
        default_parameters: update.default_parameters,
        cost_budget_monthly: update.cost_budget_monthly,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Reset preferences to defaults for a user
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
