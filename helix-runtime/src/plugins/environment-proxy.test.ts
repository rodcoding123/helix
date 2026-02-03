import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPluginEnvironment,
  isSensitiveVariable,
  getAllowedEnvironmentVariables,
  verifySensitiveVariableBlocked,
} from './environment-proxy.js';

describe('Plugin Environment Proxy', () => {
  let env: Record<string, string>;

  beforeEach(() => {
    // Create a plugin environment for testing
    env = createPluginEnvironment('test-plugin');

    // Set some test environment variables
    process.env.NODE_ENV = 'test';
    process.env.USER = 'testuser';
    process.env.DISCORD_WEBHOOK_COMMANDS = 'https://discord.com/api/webhooks/123/abc';
    process.env.STRIPE_SECRET_KEY = 'sk_live_test123';
    process.env.CUSTOM_API_KEY = 'myapikey123';
  });

  afterEach(() => {
    // Clean up test env vars
    delete process.env.DISCORD_WEBHOOK_COMMANDS;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.CUSTOM_API_KEY;
  });

  describe('Allowed Variables', () => {
    it('allows access to NODE_ENV', () => {
      expect(env.NODE_ENV).toBe('test');
    });

    it('allows access to PATH', () => {
      // PATH should exist in environment
      expect(typeof env.PATH).toBe('string');
    });

    it('allows access to USER', () => {
      expect(env.USER).toBe('testuser');
    });

    it('allows access to HOME', () => {
      // HOME should exist
      expect(typeof env.HOME).toBe('string');
    });

    it('allows access to LANG and other locale vars', () => {
      process.env.LANG = 'en_US.UTF-8';
      const proxyEnv = createPluginEnvironment('test-plugin');
      expect(proxyEnv.LANG).toBe('en_US.UTF-8');
      delete process.env.LANG;
    });

    it('allows access to TZ (timezone)', () => {
      process.env.TZ = 'UTC';
      const proxyEnv = createPluginEnvironment('test-plugin');
      expect(proxyEnv.TZ).toBe('UTC');
      delete process.env.TZ;
    });
  });

  describe('Blocked Variables - Discord', () => {
    it('blocks DISCORD_WEBHOOK_COMMANDS', () => {
      expect(env.DISCORD_WEBHOOK_COMMANDS).toBeUndefined();
    });

    it('blocks all DISCORD_WEBHOOK_* patterns', () => {
      process.env.DISCORD_WEBHOOK_API = 'https://...';
      process.env.DISCORD_WEBHOOK_ALERTS = 'https://...';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.DISCORD_WEBHOOK_API).toBeUndefined();
      expect(proxyEnv.DISCORD_WEBHOOK_ALERTS).toBeUndefined();

      delete process.env.DISCORD_WEBHOOK_API;
      delete process.env.DISCORD_WEBHOOK_ALERTS;
    });
  });

  describe('Blocked Variables - API Keys', () => {
    it('blocks STRIPE_SECRET_KEY', () => {
      expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    });

    it('blocks all STRIPE_* patterns', () => {
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.STRIPE_PUBLISHABLE_KEY).toBeUndefined();

      delete process.env.STRIPE_PUBLISHABLE_KEY;
    });

    it('blocks all SUPABASE_* patterns', () => {
      process.env.SUPABASE_URL = 'https://xyz.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk_live_123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.SUPABASE_URL).toBeUndefined();
      expect(proxyEnv.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();

      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('blocks variables ending with API_KEY', () => {
      expect(env.CUSTOM_API_KEY).toBeUndefined();
    });

    it('blocks DEEPSEEK_* patterns', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-123456';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.DEEPSEEK_API_KEY).toBeUndefined();

      delete process.env.DEEPSEEK_API_KEY;
    });

    it('blocks GEMINI_* patterns', () => {
      process.env.GEMINI_API_KEY = 'AIzaSy123456';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.GEMINI_API_KEY).toBeUndefined();

      delete process.env.GEMINI_API_KEY;
    });

    it('blocks variables starting with SECRET', () => {
      process.env.SECRET_TOKEN = 'mysecret123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.SECRET_TOKEN).toBeUndefined();

      delete process.env.SECRET_TOKEN;
    });

    it('blocks variables starting with TOKEN', () => {
      process.env.TOKEN_VALUE = 'mytoken123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.TOKEN_VALUE).toBeUndefined();

      delete process.env.TOKEN_VALUE;
    });

    it('blocks variables starting with PASSWORD', () => {
      process.env.PASSWORD_DB = 'mypassword123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.PASSWORD_DB).toBeUndefined();

      delete process.env.PASSWORD_DB;
    });
  });

  describe('Blocked Variables - AWS & GitHub', () => {
    it('blocks AWS_* patterns', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIA...';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret...';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.AWS_ACCESS_KEY_ID).toBeUndefined();
      expect(proxyEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined();

      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
    });

    it('blocks GITHUB_* patterns', () => {
      process.env.GITHUB_TOKEN = 'ghp_abc123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.GITHUB_TOKEN).toBeUndefined();

      delete process.env.GITHUB_TOKEN;
    });
  });

  describe('Proxy Behavior', () => {
    it('returns undefined for non-existent variables', () => {
      expect(env.NON_EXISTENT_VAR).toBeUndefined();
    });

    it('is read-only (blocking sets)', () => {
      const result = ((env as any).NODE_ENV = 'production');
      expect(result).toBe(false);
      // Value should not change
      expect(env.NODE_ENV).toBe('test');
    });

    it('correctly implements has() for allowed vars', () => {
      expect('NODE_ENV' in env).toBe(true);
      expect('USER' in env).toBe(true);
    });

    it('correctly implements has() for blocked vars', () => {
      expect('DISCORD_WEBHOOK_COMMANDS' in env).toBe(false);
      expect('STRIPE_SECRET_KEY' in env).toBe(false);
    });

    it('correctly implements has() for non-existent vars', () => {
      expect('NON_EXISTENT' in env).toBe(false);
    });
  });

  describe('Multiple Plugin Instances', () => {
    it('creates independent proxies for different plugins', () => {
      const env1 = createPluginEnvironment('plugin-1');
      const env2 = createPluginEnvironment('plugin-2');

      // Both should block the same sensitive vars
      expect(env1.DISCORD_WEBHOOK_COMMANDS).toBeUndefined();
      expect(env2.DISCORD_WEBHOOK_COMMANDS).toBeUndefined();

      // But both should allow the same safe vars
      expect(env1.NODE_ENV).toBe('test');
      expect(env2.NODE_ENV).toBe('test');
    });
  });

  describe('isSensitiveVariable() Function', () => {
    it('identifies Discord webhook vars as sensitive', () => {
      expect(isSensitiveVariable('DISCORD_WEBHOOK_COMMANDS')).toBe(true);
      expect(isSensitiveVariable('DISCORD_WEBHOOK_API')).toBe(true);
    });

    it('identifies Stripe vars as sensitive', () => {
      expect(isSensitiveVariable('STRIPE_SECRET_KEY')).toBe(true);
      expect(isSensitiveVariable('STRIPE_PUBLISHABLE_KEY')).toBe(true);
    });

    it('identifies API keys as sensitive', () => {
      expect(isSensitiveVariable('CUSTOM_API_KEY')).toBe(true);
      expect(isSensitiveVariable('MY_API_KEY')).toBe(true);
    });

    it('identifies AWS vars as sensitive', () => {
      expect(isSensitiveVariable('AWS_ACCESS_KEY_ID')).toBe(true);
      expect(isSensitiveVariable('AWS_SECRET_ACCESS_KEY')).toBe(true);
    });

    it('identifies allowed vars as NOT sensitive', () => {
      expect(isSensitiveVariable('NODE_ENV')).toBe(false);
      expect(isSensitiveVariable('PATH')).toBe(false);
      expect(isSensitiveVariable('USER')).toBe(false);
      expect(isSensitiveVariable('HOME')).toBe(false);
    });

    it('handles case-insensitive patterns', () => {
      expect(isSensitiveVariable('secret_value')).toBe(true);
      expect(isSensitiveVariable('SECRET_VALUE')).toBe(true);
      expect(isSensitiveVariable('Token')).toBe(true);
      expect(isSensitiveVariable('PASSWORD')).toBe(true);
    });
  });

  describe('getAllowedEnvironmentVariables() Function', () => {
    it('returns list of allowed variables', () => {
      const allowed = getAllowedEnvironmentVariables();

      expect(allowed).toContain('NODE_ENV');
      expect(allowed).toContain('PATH');
      expect(allowed).toContain('HOME');
      expect(allowed).toContain('USER');
      expect(allowed).toContain('LANG');
      expect(allowed).toContain('TZ');
    });

    it('does not include sensitive variables', () => {
      const allowed = getAllowedEnvironmentVariables();

      expect(allowed).not.toContain('DISCORD_WEBHOOK_COMMANDS');
      expect(allowed).not.toContain('STRIPE_SECRET_KEY');
      expect(allowed).not.toContain('AWS_ACCESS_KEY_ID');
    });

    it('returns a sorted list', () => {
      const allowed = getAllowedEnvironmentVariables();
      const sorted = [...allowed].sort();

      expect(allowed).toEqual(sorted);
    });
  });

  describe('verifySensitiveVariableBlocked() Function', () => {
    it('verifies that sensitive var is blocked', () => {
      expect(verifySensitiveVariableBlocked(env, 'DISCORD_WEBHOOK_COMMANDS')).toBe(true);
      expect(verifySensitiveVariableBlocked(env, 'STRIPE_SECRET_KEY')).toBe(true);
    });

    it('returns false for allowed variables', () => {
      expect(verifySensitiveVariableBlocked(env, 'NODE_ENV')).toBe(false);
      expect(verifySensitiveVariableBlocked(env, 'PATH')).toBe(false);
    });

    it('returns false for non-sensitive, unset variables', () => {
      expect(verifySensitiveVariableBlocked(env, 'SOME_RANDOM_VAR')).toBe(false);
    });
  });

  describe('Security Edge Cases', () => {
    it('blocks attempts to access credentials through aliases', () => {
      process.env.AUTH_TOKEN = 'mytoken123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      // Should block AUTH_* patterns
      expect(proxyEnv.AUTH_TOKEN).toBeUndefined();

      delete process.env.AUTH_TOKEN;
    });

    it('blocks variables with PRIVATE_KEY pattern', () => {
      process.env.GITHUB_PRIVATE_KEY = 'private_key_content';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.GITHUB_PRIVATE_KEY).toBeUndefined();

      delete process.env.GITHUB_PRIVATE_KEY;
    });

    it('handles empty and null values correctly', () => {
      process.env.EMPTY_ALLOWED = '';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.EMPTY_ALLOWED).toBe('');

      delete process.env.EMPTY_ALLOWED;
    });

    it('blocks credential-like values even if not in allowlist', () => {
      process.env.CUSTOM_CREDENTIAL = 'secret123';
      const proxyEnv = createPluginEnvironment('test-plugin');

      expect(proxyEnv.CUSTOM_CREDENTIAL).toBeUndefined();

      delete process.env.CUSTOM_CREDENTIAL;
    });
  });

  describe('Integration with Plugin API', () => {
    it('provides safe environment for plugins', () => {
      const env = createPluginEnvironment('my-plugin');

      // Plugins can access safe variables
      expect(typeof env.NODE_ENV).toBe('string');
      expect(typeof env.PATH).toBe('string');

      // Plugins cannot access secrets
      expect(env.DISCORD_WEBHOOK_COMMANDS).toBeUndefined();
      expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    });

    it('prevents accidental credential leakage', () => {
      process.env.DANGEROUS_API_KEY = 'sk_test_123456';
      const env = createPluginEnvironment('untrusted-plugin');

      // Should not be accessible
      expect(env.DANGEROUS_API_KEY).toBeUndefined();

      // Even if plugin tries to access it directly
      expect((env as any)['DANGEROUS_API_KEY']).toBeUndefined();

      delete process.env.DANGEROUS_API_KEY;
    });
  });
});
