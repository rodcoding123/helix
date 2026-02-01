import { useEffect, useCallback } from 'react';
import { useUiStore, type Theme } from '../stores/uiStore';

/**
 * Hook for managing theme (dark/light mode) with system detection
 */
export function useTheme() {
  const { theme, resolvedTheme, setTheme, setResolvedTheme } = useUiStore();

  // Detect system preference
  const detectSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Resolve theme based on current setting
  const resolveTheme = useCallback(
    (currentTheme: Theme): 'light' | 'dark' => {
      if (currentTheme === 'system') {
        return detectSystemTheme();
      }
      return currentTheme;
    },
    [detectSystemTheme]
  );

  // Apply theme to document
  const applyTheme = useCallback((resolved: 'light' | 'dark') => {
    const root = document.documentElement;

    // Remove existing theme class
    root.classList.remove('light', 'dark');

    // Add new theme class
    root.classList.add(resolved);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolved === 'dark' ? '#0a0a0f' : '#ffffff'
      );
    }
  }, []);

  // Handle theme change
  const changeTheme = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
      const resolved = resolveTheme(newTheme);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    },
    [setTheme, resolveTheme, setResolvedTheme, applyTheme]
  );

  // Toggle between light and dark (skips system)
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    changeTheme(newTheme);
  }, [resolvedTheme, changeTheme]);

  // Cycle through all themes
  const cycleTheme = useCallback(() => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    changeTheme(themes[nextIndex]);
  }, [theme, changeTheme]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        const resolved = detectSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, detectSystemTheme, setResolvedTheme, applyTheme]);

  // Apply initial theme
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme, resolveTheme, setResolvedTheme, applyTheme]);

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSystem: theme === 'system',
    setTheme: changeTheme,
    toggleTheme,
    cycleTheme,
  };
}
