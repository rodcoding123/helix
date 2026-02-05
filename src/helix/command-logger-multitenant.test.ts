/**
 * Phase 11: Per-Tenant Discord Logger Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TenantDiscordLogger,
  getDiscordLoggerForTenant,
  GlobalDiscordLogger,
} from './command-logger-multitenant.js';

// Mock Supabase
const mockQuery = {
  from: vi.fn(function () { return this; }),
  select: vi.fn(function () { return this; }),
  eq: vi.fn(function () { return this; }),
  single: vi.fn(),
};

// Mock hash chain
vi.mock('./hash-chain-multitenant', () => ({
  getHashChainForTenant: vi.fn(() => ({
    addEntry: vi.fn().mockResolvedValue({}),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

describe('TenantDiscordLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('Constructor', () => {
    it('should create logger for valid tenant ID', () => {
      const logger = new TenantDiscordLogger('tenant-123');
      expect(logger).toBeDefined();
    });

    it('should throw for missing tenant ID', () => {
      expect(() => new TenantDiscordLogger('')).toThrow('Tenant ID required');
    });

    it('should throw for null tenant ID', () => {
      expect(() => new TenantDiscordLogger(null as any)).toThrow('Tenant ID required');
    });
  });

  describe('Initialization', () => {
    it('should load webhook from database', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      expect(mockQuery.from).toHaveBeenCalledWith('tenants');
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'tenant-123');
    });

    it('should handle missing webhook gracefully', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: null },
        error: null,
      });

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      // Should not throw, just skip Discord logging
      expect(logger).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      // Should not throw
      expect(logger).toBeDefined();
    });

    it('should only initialize once', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      const logger = new TenantDiscordLogger('tenant-123');

      await logger.initialize();
      await logger.initialize();

      // Should only query database once
      expect(mockQuery.single).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging messages', () => {
    it('should log message with default values', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.log({
        type: 'command',
        content: 'test command',
      });

      expect(global.fetch).toHaveBeenCalled();
      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds[0].title).toContain('command');
      expect(body.embeds[0].description).toBe('test command');
    });

    it('should include tenant ID in logs', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-abc');
      await logger.log({
        type: 'test',
        content: 'test content',
      });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds[0].title).toContain('tenant-abc');
    });

    it('should include metadata in logs', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.log({
        type: 'operation',
        content: 'operation completed',
        metadata: { duration_ms: 1000, success: true },
      });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds[0].fields).toBeDefined();
      expect(body.embeds[0].fields.some((f: any) => f.name === 'Details')).toBe(true);
    });

    it('should set correct color based on status', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-123');

      // Test failed status (red)
      await logger.log({
        type: 'error',
        content: 'error occurred',
        status: 'failed',
      });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds[0].color).toBe(0xff0000); // Red
    });
  });

  describe('Special logging methods', () => {
    beforeEach(async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValue({ ok: true });
    });

    it('should log command execution', async () => {
      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      await logger.logCommand('npm run build', { success: true });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should log API calls', async () => {
      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      await logger.logAPI('GET', '/api/users', 200, 150);

      expect(global.fetch).toHaveBeenCalled();
      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds[0].description).toContain('GET');
      expect(body.embeds[0].description).toContain('/api/users');
    });

    it('should log operation execution', async () => {
      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      await logger.logOperation('op-123', 'email_compose', true, { cost: 0.05 });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Verification', () => {
    it('should verify webhook accessibility', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-123');
      const verified = await logger.verify();

      expect(verified).toBe(true);
    });

    it('should return false if webhook not accessible', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: false });

      const logger = new TenantDiscordLogger('tenant-123');
      const verified = await logger.verify();

      expect(verified).toBe(false);
    });

    it('should return false if webhook not configured', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: null },
        error: null,
      });

      const logger = new TenantDiscordLogger('tenant-123');
      const verified = await logger.verify();

      expect(verified).toBe(false);
    });
  });

  describe('Status', () => {
    it('should return logger status', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-123');
      const status = await logger.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.webhookUrl).toBeTruthy();
      expect(status.verified).toBe(true);
    });

    it('should show uninitialized status', async () => {
      const logger = new TenantDiscordLogger('tenant-123');
      const status = await logger.getStatus();

      expect(status.initialized).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should not throw on fetch error', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      await expect(
        logger.log({ type: 'test', content: 'test' })
      ).resolves.not.toThrow();
    });

    it('should not throw on webhook error', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: false });

      const logger = new TenantDiscordLogger('tenant-123');
      await logger.initialize();

      await expect(
        logger.log({ type: 'test', content: 'test' })
      ).resolves.not.toThrow();
    });
  });

  describe('Factory function', () => {
    it('should create logger for tenant', () => {
      const logger = getDiscordLoggerForTenant('tenant-xyz');
      expect(logger).toBeInstanceOf(TenantDiscordLogger);
    });

    it('should create different loggers for different tenants', () => {
      const logger1 = getDiscordLoggerForTenant('tenant-1');
      const logger2 = getDiscordLoggerForTenant('tenant-2');

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Isolation', () => {
    it('should only access own tenant webhook', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      const logger = new TenantDiscordLogger('tenant-1');
      await logger.initialize();

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'tenant-1');
    });

    it('should log tenant ID in all messages', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: { webhook_url: 'https://discord.com/api/webhooks/123' },
        error: null,
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const logger = new TenantDiscordLogger('tenant-isolated');
      await logger.initialize();
      await logger.log({ type: 'test', content: 'message' });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds[0].title).toContain('tenant-isolated');
      expect(body.embeds[0].fields.some((f: any) => f.value === 'tenant-isolated')).toBe(true);
    });
  });
});

describe('GlobalDiscordLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  it('should create global logger', () => {
    const logger = new GlobalDiscordLogger('https://discord.com/api/webhooks/global');
    expect(logger).toBeDefined();
  });

  it('should log without tenant context', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    const logger = new GlobalDiscordLogger('https://discord.com/api/webhooks/global');
    await logger.log({
      type: 'system',
      content: 'system event',
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('should not throw if not initialized', async () => {
    const logger = new GlobalDiscordLogger();
    await expect(
      logger.log({ type: 'test', content: 'test' })
    ).resolves.not.toThrow();
  });
});
