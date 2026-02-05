/**
 * usePreferences Hook
 * Manages user preferences with reactive updates
 */

import { useState, useEffect, useCallback } from 'react';
import { getPreferencesService, OperationPreference, ThemePreference } from '@/services/preferences/preferences.service';
import { useAuth } from './useAuth';

export function usePreferences() {
  const { user } = useAuth();
  const [operationPrefs, setOperationPrefs] = useState<OperationPreference[]>([]);
  const [themePrefs, setThemePrefs] = useState<ThemePreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = getPreferencesService();

  // Load preferences on mount or user change
  useEffect(() => {
    if (!user?.id) return;

    const loadPreferences = async () => {
      try {
        setLoading(true);
        setError(null);

        const [ops, theme] = await Promise.all([
          service.getOperationPreferences(user.id),
          service.getThemePreferences(user.id),
        ]);

        setOperationPrefs(ops);
        setThemePrefs(theme);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id, service]);

  // Apply theme preferences to document
  useEffect(() => {
    if (!themePrefs) return;

    const root = document.documentElement;

    // Set color scheme
    if (themePrefs.color_scheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', themePrefs.color_scheme === 'dark');
    }

    // Set accent color
    root.style.setProperty('--color-accent', themePrefs.accent_color);

    // Set compact mode
    root.classList.toggle('compact-mode', themePrefs.compact_mode);

    // Set sidebar state
    document.body.classList.toggle('sidebar-collapsed', themePrefs.sidebar_collapsed);
  }, [themePrefs]);

  const updateOperationPreference = useCallback(
    async (operationId: string, updates: Partial<OperationPreference>) => {
      if (!user?.id) return;

      try {
        const updated = await service.setOperationPreference(user.id, {
          operation_id: operationId,
          enabled: updates.enabled !== undefined ? updates.enabled : true,
          preferred_model: updates.preferred_model,
          default_parameters: updates.default_parameters,
          cost_budget_monthly: updates.cost_budget_monthly,
        });

        setOperationPrefs(prefs =>
          prefs.some(p => p.operation_id === operationId)
            ? prefs.map(p => (p.operation_id === operationId ? updated : p))
            : [...prefs, updated]
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update preference');
      }
    },
    [user?.id, service]
  );

  const updateThemePreference = useCallback(
    async (updates: Partial<ThemePreference>) => {
      if (!user?.id) return;

      try {
        const updated = await service.setThemePreferences(user.id, updates);
        setThemePrefs(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update theme');
      }
    },
    [user?.id, service]
  );

  const getOperationPreference = useCallback(
    (operationId: string): OperationPreference | undefined => {
      return operationPrefs.find(p => p.operation_id === operationId);
    },
    [operationPrefs]
  );

  const resetToDefaults = useCallback(async () => {
    if (!user?.id) return;

    try {
      await service.resetToDefaults(user.id);
      setOperationPrefs([]);
      setThemePrefs(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset preferences');
    }
  }, [user?.id, service]);

  return {
    operationPrefs,
    themePrefs,
    loading,
    error,
    updateOperationPreference,
    updateThemePreference,
    getOperationPreference,
    resetToDefaults,
  };
}
