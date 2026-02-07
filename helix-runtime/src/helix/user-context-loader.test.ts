/**
 * Test Suite: User Context Loader with Creator Identification
 *
 * Validates user context loading and RODRIGO_CREATOR_ID detection.
 * Verifies that creator is identified and granted perfect trust (1.0).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadUserContext, UserContext } from './user-context-loader.js';

// Mock Supabase client with proper chaining
const createMockSupabaseClient = (options: { includeProfile?: boolean; profileTrustLevel?: number } = {}) => {
  const { includeProfile = true, profileTrustLevel = 0.5 } = options;

  return {
    from: vi.fn((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((field: string, value: string) => ({
              single: vi.fn(async () => ({
                data: includeProfile
                  ? {
                      user_id: value,
                      display_name: `User ${value}`,
                      full_name: `User ${value}`,
                      email: `${value}@example.com`,
                      trust_level: profileTrustLevel,
                      created_at: '2025-01-01T00:00:00Z',
                      preferred_language: 'en',
                      custom_preferences: {},
                    }
                  : null,
                error: null,
              })),
            })),
          })),
        };
      } else if (table === 'conversations') {
        return {
          select: vi.fn((fields: string, options: any) => ({
            eq: vi.fn((field: string, value: string) => ({
              count: 5,
              error: null,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
          insert: vi.fn(async () => ({ error: null })),
        };
      } else if (table === 'user_interactions') {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      return {};
    }),
  };
};

describe('User Context Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadUserContext - Creator Identification', () => {
    it('should identify creator and set perfect trust (1.0) when RODRIGO_CREATOR_ID matches', async () => {
      const supabase = createMockSupabaseClient();
      process.env.RODRIGO_CREATOR_ID = 'rodrigo_specter';

      const context = await loadUserContext('rodrigo_specter', supabase);

      expect(context.userId).toBe('rodrigo_specter');
      expect(context.trustLevel).toBe(1.0); // Perfect trust for creator
      expect(context.customPreferences?.isCreator).toBe(true);
    });

    it('should NOT grant perfect trust to non-creator users', async () => {
      const supabase = createMockSupabaseClient();
      process.env.RODRIGO_CREATOR_ID = 'rodrigo_specter';

      const context = await loadUserContext('generic_user_123', supabase);

      expect(context.userId).toBe('generic_user_123');
      expect(context.trustLevel).toBe(0.5); // Default neutral trust (from Supabase profile)
      expect(context.customPreferences?.isCreator).toBeUndefined();
    });

    it('should handle missing RODRIGO_CREATOR_ID gracefully', async () => {
      const supabase = createMockSupabaseClient();
      delete process.env.RODRIGO_CREATOR_ID;

      const context = await loadUserContext('rodrigo_specter', supabase);

      // Without environment variable set, creator should not be identified
      expect(context.trustLevel).toBe(0.5); // Uses Supabase profile value
      expect(context.customPreferences?.isCreator).toBeUndefined();
    });

    it('should use case-sensitive matching for creator ID', async () => {
      const supabase = createMockSupabaseClient();
      process.env.RODRIGO_CREATOR_ID = 'rodrigo_specter';

      const contextLower = await loadUserContext('rodrigo_specter', supabase);
      const contextUpper = await loadUserContext('RODRIGO_SPECTER', supabase);

      expect(contextLower.trustLevel).toBe(1.0); // Matches
      expect(contextUpper.trustLevel).toBe(0.5); // Doesn't match
    });

    it('should preserve custom preferences when setting creator flag', async () => {
      const supabase = {
        from: vi.fn((table: string) => {
          if (table === 'user_profiles') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn((field: string, value: string) => ({
                  single: vi.fn(async () => ({
                    data: {
                      user_id: value,
                      display_name: 'Rodrigo',
                      email: 'rodrigo@example.com',
                      trust_level: 0.5,
                      created_at: '2025-01-01T00:00:00Z',
                      preferred_language: 'pt-BR',
                      custom_preferences: { theme: 'dark', notifications: true },
                    },
                    error: null,
                  })),
                })),
              })),
            };
          } else if (table === 'conversations') {
            return {
              select: vi.fn(() => ({ eq: vi.fn(() => ({ count: 5, error: null })) })),
            };
          }
          return {};
        }),
      };

      process.env.RODRIGO_CREATOR_ID = 'rodrigo_specter';
      const context = await loadUserContext('rodrigo_specter', supabase);

      // Should preserve existing preferences and add isCreator
      expect(context.customPreferences?.theme).toBe('dark');
      expect(context.customPreferences?.notifications).toBe(true);
      expect(context.customPreferences?.isCreator).toBe(true);
    });
  });

  describe('loadUserContext - User Profile Loading', () => {
    it('should load user profile data including name, email, and preferences', async () => {
      const supabase = createMockSupabaseClient();
      process.env.RODRIGO_CREATOR_ID = 'not_this_user';

      const context = await loadUserContext('user_123', supabase);

      expect(context.userId).toBe('user_123');
      expect(context.userName).toBe('User user_123');
      expect(context.userEmail).toBe('user_123@example.com');
      expect(context.firstInteractionDate).toBe('2025-01-01T00:00:00Z');
      expect(context.preferredLanguage).toBe('en');
    });

    it('should set default trust level (0.5) from user profile', async () => {
      const supabase = createMockSupabaseClient({ profileTrustLevel: 0.5 });
      process.env.RODRIGO_CREATOR_ID = 'not_the_user';

      const context = await loadUserContext('user_456', supabase);

      expect(context.trustLevel).toBe(0.5);
    });

    it('should load conversation count from database', async () => {
      const supabase = createMockSupabaseClient();
      process.env.RODRIGO_CREATOR_ID = 'rodrigo_specter';

      const context = await loadUserContext('user_789', supabase);

      // Mock returns count of 5
      expect(context.conversationCount).toBe(5);
    });
  });

  describe('Context Structure', () => {
    it('should return UserContext with all required fields', async () => {
      const supabase = createMockSupabaseClient();
      process.env.RODRIGO_CREATOR_ID = 'not_the_user';

      const context = await loadUserContext('user_123', supabase);

      // Verify required fields exist
      expect(context).toHaveProperty('userId');
      expect(context).toHaveProperty('trustLevel');
      expect(context).toHaveProperty('conversationCount');
      expect(typeof context.trustLevel).toBe('number');
      expect(context.trustLevel).toBeGreaterThanOrEqual(0);
      expect(context.trustLevel).toBeLessThanOrEqual(1);
    });

    it('should handle error scenarios gracefully', async () => {
      const errorSupabase = {
        from: vi.fn(() => {
          throw new Error('Connection error');
        }),
      };

      // Should handle errors without throwing to caller
      const context = await loadUserContext('user_123', errorSupabase);

      // Should return context with sensible defaults
      expect(context.userId).toBe('user_123');
      expect(context.trustLevel).toBe(0.5); // Default
      expect(context.conversationCount).toBe(0); // Default
    });
  });
});
