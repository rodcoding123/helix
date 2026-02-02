import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isFeatureEnabled, setFeatureFlag, getFeatureFlags, resetFeatureFlags } from '../feature-flags';

describe('Feature Flags', () => {
  let storedFlags: Record<string, string> = {};

  beforeEach(() => {
    // Reset to defaults
    storedFlags = {};

    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storedFlags[key] || null,
      setItem: (key: string, value: string) => {
        storedFlags[key] = value;
      },
      removeItem: (key: string) => {
        delete storedFlags[key];
      },
      clear: () => {
        storedFlags = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return default flag value', () => {
    const enabled = isFeatureEnabled('secrets.enabled');
    expect(enabled).toBe(true); // Default enabled
  });

  it('should allow setting feature flag', () => {
    setFeatureFlag('secrets.rollout', false);
    expect(isFeatureEnabled('secrets.rollout')).toBe(false);
  });

  it('should persist flag value in localStorage', () => {
    setFeatureFlag('secrets.beta_features', true);
    const stored = localStorage.getItem('feature_flags');
    expect(stored).toContain('secrets.beta_features');
  });

  it('should support percentage-based rollout', () => {
    setFeatureFlag('secrets.rollout_percentage', 50);
    const enabled = isFeatureEnabled('secrets.rollout_percentage', { userId: 'user-123' });
    expect(typeof enabled).toBe('boolean');
  });
});
