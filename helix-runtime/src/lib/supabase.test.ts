/**
 * Test Suite: Supabase Client Initialization
 *
 * Validates that the Supabase client properly initializes with environment variables
 * and fails gracefully when not configured.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSupabaseClient, initializeSupabase, shutdownSupabase } from './supabase.js';

describe('Supabase Client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment
    process.env = { ...originalEnv };
    vi.resetModules();
    shutdownSupabase();
  });

  afterEach(() => {
    process.env = originalEnv;
    shutdownSupabase();
  });

  describe('getSupabaseClient', () => {
    it('should return null when SUPABASE_URL is not configured', () => {
      process.env.SUPABASE_URL = undefined;
      process.env.SUPABASE_SERVICE_ROLE = 'test-key';

      const client = getSupabaseClient();
      expect(client).toBeNull();
    });

    it('should return null when SUPABASE_SERVICE_ROLE is not configured', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE = undefined;

      const client = getSupabaseClient();
      expect(client).toBeNull();
    });

    it('should return null when both credentials are missing', () => {
      process.env.SUPABASE_URL = undefined;
      process.env.SUPABASE_SERVICE_ROLE = undefined;

      const client = getSupabaseClient();
      expect(client).toBeNull();
    });

    it('should create a client when both SUPABASE_URL and SUPABASE_SERVICE_ROLE are configured', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const client = getSupabaseClient();
      expect(client).not.toBeNull();
      expect(client).toBeDefined();
    });

    it('should return the same instance on subsequent calls (singleton pattern)', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const client1 = getSupabaseClient();
      const client2 = getSupabaseClient();

      expect(client1).toBe(client2);
    });
  });

  describe('shutdownSupabase', () => {
    it('should clear the client on shutdown', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const client1 = getSupabaseClient();
      expect(client1).not.toBeNull();

      shutdownSupabase();

      // After shutdown, a new call should return null (credentials are still set, but singleton is cleared)
      // In real scenario, new instance would be created, but we're testing cleanup
      process.env.SUPABASE_URL = undefined;
      process.env.SUPABASE_SERVICE_ROLE = undefined;
      const client2 = getSupabaseClient();
      expect(client2).toBeNull();
    });
  });

  describe('initializeSupabase', () => {
    it('should return false when credentials are not configured', async () => {
      process.env.SUPABASE_URL = undefined;
      process.env.SUPABASE_SERVICE_ROLE = undefined;

      const result = await initializeSupabase();
      expect(result).toBe(false);
    });
  });

  describe('Environment Configuration', () => {
    it('should accept SUPABASE_URL in https format', () => {
      process.env.SUPABASE_URL = 'https://myproject.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const client = getSupabaseClient();
      expect(client).not.toBeNull();
    });

    it('should handle SUPABASE_SERVICE_ROLE as JWT token', () => {
      process.env.SUPABASE_URL = 'https://myproject.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhteXp3d3d4eXp3d3d4eXp3IiwiYWN0b3IiOiJzZXJ2aWNlX3JvbGUifQ.test123';

      const client = getSupabaseClient();
      expect(client).not.toBeNull();
    });
  });
});
