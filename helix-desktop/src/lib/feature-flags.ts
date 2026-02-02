export interface FeatureFlags {
  'secrets.enabled': boolean;
  'secrets.rollout': boolean;
  'secrets.beta_features': boolean;
  'secrets.error_recovery': boolean;
  [key: string]: boolean | number;
}

const DEFAULT_FLAGS: Partial<FeatureFlags> = {
  'secrets.enabled': true,
  'secrets.rollout': true,
  'secrets.beta_features': false,
  'secrets.error_recovery': true,
};

function getStoredFlags(): Partial<FeatureFlags> {
  try {
    const stored = localStorage.getItem('feature_flags');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (_err) {
    console.warn('Failed to parse stored feature flags');
  }
  return {};
}

function saveFlags(flags: Partial<FeatureFlags>): void {
  try {
    localStorage.setItem('feature_flags', JSON.stringify(flags));
  } catch (_err) {
    console.warn('Failed to save feature flags');
  }
}

export function isFeatureEnabled(
  flag: keyof FeatureFlags,
  context?: { userId?: string; percentage?: number }
): boolean {
  const stored = getStoredFlags();
  const value = stored[flag] ?? DEFAULT_FLAGS[flag] ?? false;

  // Handle boolean flags
  if (typeof value === 'boolean') {
    return value;
  }

  // Handle percentage-based rollout
  if (typeof value === 'number' && context?.userId) {
    const hash = context.userId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const userPercentage = Math.abs(hash) % 100;
    return userPercentage < value;
  }

  return false;
}

export function setFeatureFlag(flag: keyof FeatureFlags, enabled: boolean | number): void {
  const stored = getStoredFlags();
  stored[flag] = enabled;
  saveFlags(stored);
}

export function getFeatureFlags(): Partial<FeatureFlags> {
  return { ...DEFAULT_FLAGS, ...getStoredFlags() };
}

export function resetFeatureFlags(): void {
  localStorage.removeItem('feature_flags');
}
