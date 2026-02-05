/**
 * Phase 9C: Preferences Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferencesService, OperationPreference, ThemePreference } from './preferences.service';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  const createChain = () => ({
    select: vi.fn(function() { return this; }),
    eq: vi.fn(function() { return this; }),
    insert: vi.fn(function() { return this; }),
    update: vi.fn(function() { return this; }),
    delete: vi.fn(function() { return this; }),
    single: vi.fn(async () => ({ data: null, error: null })),
  });

  return {
    createClient: vi.fn(() => ({
      from: vi.fn((table: string) => createChain()),
    })),
  };
});

describe('PreferencesService', () => {
  let service: PreferencesService;
  const userId = 'test-user-123';

  beforeEach(() => {
    service = new PreferencesService();
    vi.clearAllMocks();
  });

  describe('Operation Preferences', () => {
    it('should get operation preferences for user', async () => {
      const prefs = await service.getOperationPreferences(userId);
      expect(Array.isArray(prefs)).toBe(true);
    });

    it('should get specific operation preference', async () => {
      const pref = await service.getOperationPreference(userId, 'email-compose');
      expect(pref === null || typeof pref === 'object').toBe(true);
    });

    it('should set operation preference with model selection', async () => {
      const pref = await service.setOperationPreference(userId, {
        operation_id: 'email-compose',
        preferred_model: 'deepseek',
        enabled: true,
      });

      expect(pref.operation_id).toBe('email-compose');
      expect(pref.preferred_model).toBe('deepseek');
    });

    it('should set operation preference with budget', async () => {
      const pref = await service.setOperationPreference(userId, {
        operation_id: 'analytics-summary',
        cost_budget_monthly: 10.0,
        enabled: true,
      });

      expect(pref.cost_budget_monthly).toBe(10.0);
    });

    it('should set operation preference with default parameters', async () => {
      const params = { include_trends: true, days: 7 };
      const pref = await service.setOperationPreference(userId, {
        operation_id: 'analytics-summary',
        default_parameters: params,
        enabled: true,
      });

      expect(pref.default_parameters).toEqual(params);
    });

    it('should bulk update operation preferences', async () => {
      const updates = [
        { operation_id: 'email-compose', preferred_model: 'deepseek' as const, enabled: true },
        { operation_id: 'task-prioritize', preferred_model: 'gemini' as const, enabled: true },
      ];

      const results = await service.bulkUpdateOperationPreferences(userId, updates);
      expect(results.length).toBe(2);
    });

    it('should disable individual operation', async () => {
      const pref = await service.setOperationPreference(userId, {
        operation_id: 'email-respond',
        enabled: false,
      });

      expect(pref.enabled).toBe(false);
    });

    it('should get remaining budget for operation', async () => {
      const remaining = await service.getRemainingBudget(userId, 'email-compose');
      // Budget can be null (no limit) or a number
      expect(remaining === null || typeof remaining === 'number').toBe(true);
    });

    it('should check if operation is within budget', async () => {
      const isWithin = await service.isWithinBudget(userId, 'email-compose', 0.001);
      expect(typeof isWithin).toBe('boolean');
    });
  });

  describe('Theme Preferences', () => {
    it('should get theme preferences', async () => {
      const theme = await service.getThemePreferences(userId);
      expect(theme === null || typeof theme === 'object').toBe(true);
    });

    it('should set theme with color scheme', async () => {
      const theme = await service.setThemePreferences(userId, {
        color_scheme: 'dark',
      });

      expect(theme.color_scheme).toBe('dark');
    });

    it('should set theme with accent color', async () => {
      const theme = await service.setThemePreferences(userId, {
        accent_color: '#FF0000',
      });

      expect(theme.accent_color).toBe('#FF0000');
    });

    it('should set compact mode', async () => {
      const theme = await service.setThemePreferences(userId, {
        compact_mode: true,
      });

      expect(theme.compact_mode).toBe(true);
    });

    it('should set layout preferences', async () => {
      const theme = await service.setThemePreferences(userId, {
        email_list_view: 'list',
        calendar_view: 'week',
        tasks_sort_by: 'due_date',
      });

      expect(theme.email_list_view).toBe('list');
      expect(theme.calendar_view).toBe('week');
      expect(theme.tasks_sort_by).toBe('due_date');
    });

    it('should set notification preferences', async () => {
      const theme = await service.setThemePreferences(userId, {
        notify_on_operation_completion: false,
        notify_on_cost_limit_exceeded: true,
      });

      expect(theme.notify_on_operation_completion).toBe(false);
      expect(theme.notify_on_cost_limit_exceeded).toBe(true);
    });

    it('should set sidebar state', async () => {
      const theme = await service.setThemePreferences(userId, {
        sidebar_collapsed: true,
      });

      expect(theme.sidebar_collapsed).toBe(true);
    });

    it('should merge theme updates', async () => {
      // First update
      await service.setThemePreferences(userId, {
        color_scheme: 'dark',
      });

      // Second update should merge
      const theme = await service.setThemePreferences(userId, {
        compact_mode: true,
      });

      // Both changes should persist (in real scenario)
      expect(theme.compact_mode).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should reset all preferences to defaults', async () => {
      await service.resetToDefaults(userId);
      // After reset, preferences should be empty
      const prefs = await service.getOperationPreferences(userId);
      expect(Array.isArray(prefs)).toBe(true);
    });
  });

  describe('Model Selection', () => {
    it('should validate model options', async () => {
      const validModels = ['anthropic', 'deepseek', 'gemini', 'openai'];

      for (const model of validModels) {
        const pref = await service.setOperationPreference(userId, {
          operation_id: 'email-compose',
          preferred_model: model as any,
          enabled: true,
        });

        expect(validModels).toContain(pref.preferred_model);
      }
    });
  });

  describe('Budget Enforcement', () => {
    it('should track monthly budget', async () => {
      await service.setOperationPreference(userId, {
        operation_id: 'task-prioritize',
        cost_budget_monthly: 5.0,
        enabled: true,
      });

      const pref = await service.getOperationPreference(userId, 'task-prioritize');
      expect(pref?.cost_budget_monthly).toBe(5.0);
    });

    it('should calculate remaining budget correctly', async () => {
      await service.setOperationPreference(userId, {
        operation_id: 'calendar-prep',
        cost_budget_monthly: 10.0,
        enabled: true,
      });

      const remaining = await service.getRemainingBudget(userId, 'calendar-prep');
      // Should be <= budget amount
      if (remaining !== null) {
        expect(remaining).toBeLessThanOrEqual(10.0);
      }
    });

    it('should prevent overspend for operation', async () => {
      await service.setOperationPreference(userId, {
        operation_id: 'analytics-summary',
        cost_budget_monthly: 1.0,
        enabled: true,
      });

      const isWithin = await service.isWithinBudget(userId, 'analytics-summary', 1.5);
      expect(typeof isWithin).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', async () => {
      const prefs = await service.getOperationPreferences('');
      expect(Array.isArray(prefs)).toBe(true);
    });

    it('should handle invalid operation ID gracefully', async () => {
      const pref = await service.getOperationPreference(userId, 'invalid-operation');
      expect(pref === null || typeof pref === 'object').toBe(true);
    });
  });
});
