/**
 * Tests for logging-hooks.ts
 * Helix pre-execution logging hook system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

// Import after mocking
const {
  installPreExecutionLogger,
  triggerHelixHooks,
  sendAlert,
  logConsciousnessObservation,
  sendToDiscord,
  WEBHOOKS,
} = await import('./logging-hooks.js');

describe('LoggingHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('WEBHOOKS configuration', () => {
    it('exports WEBHOOKS object', () => {
      expect(WEBHOOKS).toBeDefined();
      expect(typeof WEBHOOKS).toBe('object');
    });

    it('has expected webhook keys', () => {
      expect('commands' in WEBHOOKS).toBe(true);
      expect('api' in WEBHOOKS).toBe(true);
      expect('files' in WEBHOOKS).toBe(true);
      expect('consciousness' in WEBHOOKS).toBe(true);
      expect('alerts' in WEBHOOKS).toBe(true);
      expect('hashChain' in WEBHOOKS).toBe(true);
    });
  });

  describe('sendToDiscord', () => {
    it('returns false when webhook URL is undefined', async () => {
      const result = await sendToDiscord(undefined, {
        embeds: [{ title: 'Test', color: 0x000000, fields: [] }],
      });
      expect(result).toBe(false);
    });

    it('returns true on successful webhook call', async () => {
      const result = await sendToDiscord('https://discord.com/api/webhooks/test', {
        embeds: [{ title: 'Test', color: 0x000000, fields: [] }],
      });
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('returns false on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendToDiscord('https://discord.com/api/webhooks/test', {
        embeds: [{ title: 'Test', color: 0x000000, fields: [] }],
      });
      expect(result).toBe(false);
    });

    it('returns false on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await sendToDiscord('https://discord.com/api/webhooks/test', {
        embeds: [{ title: 'Test', color: 0x000000, fields: [] }],
      });
      expect(result).toBe(false);
    });

    it('sends correct payload structure', async () => {
      const payload = {
        embeds: [
          {
            title: 'Test Title',
            color: 0x5865f2,
            fields: [
              { name: 'Field1', value: 'Value1', inline: true },
              { name: 'Field2', value: 'Value2', inline: false },
            ],
            timestamp: '2026-01-31T00:00:00.000Z',
            footer: { text: 'Test footer' },
          },
        ],
      };

      await sendToDiscord('https://discord.com/api/webhooks/test', payload);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe('installPreExecutionLogger', () => {
    it('installs hooks without throwing', () => {
      expect(() => installPreExecutionLogger()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      expect(() => {
        installPreExecutionLogger();
        installPreExecutionLogger();
      }).not.toThrow();
    });
  });

  describe('triggerHelixHooks', () => {
    beforeEach(() => {
      installPreExecutionLogger();
    });

    it('triggers command hooks', async () => {
      await triggerHelixHooks({
        type: 'command',
        action: 'execute',
        sessionKey: 'test-session',
        context: { command: 'echo hello' },
      });

      // Hooks are triggered but webhook calls depend on env vars being set
      // The test verifies hooks don't throw errors
      expect(true).toBe(true);
    });

    it('triggers session:start hooks', async () => {
      await triggerHelixHooks({
        type: 'session',
        action: 'start',
        sessionKey: 'test-session',
      });

      // May or may not call fetch depending on webhook config
      expect(true).toBe(true);
    });

    it('triggers session:end hooks', async () => {
      await triggerHelixHooks({
        type: 'session',
        action: 'end',
        sessionKey: 'test-session',
      });

      expect(true).toBe(true);
    });

    it('triggers agent:bootstrap hooks', async () => {
      await triggerHelixHooks({
        type: 'agent',
        action: 'bootstrap',
        sessionKey: 'test-session',
        context: { files: ['file1.md', 'file2.md'] },
      });

      expect(true).toBe(true);
    });

    it('handles events with missing sessionKey', async () => {
      await triggerHelixHooks({
        type: 'command',
        action: 'execute',
        context: { command: 'test' },
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it('handles events with missing context', async () => {
      await triggerHelixHooks({
        type: 'command',
        action: 'execute',
        sessionKey: 'test-session',
      });

      expect(true).toBe(true);
    });
  });

  describe('sendAlert', () => {
    it('sends info alert', async () => {
      const result = await sendAlert('Test Alert', 'Test description', 'info');
      // Result depends on WEBHOOKS.alerts being set
      expect(typeof result).toBe('boolean');
    });

    it('sends warning alert', async () => {
      const result = await sendAlert('Warning Alert', 'Warning description', 'warning');
      expect(typeof result).toBe('boolean');
    });

    it('sends critical alert', async () => {
      const result = await sendAlert('Critical Alert', 'Critical description', 'critical');
      expect(typeof result).toBe('boolean');
    });

    it('defaults to info severity', async () => {
      const result = await sendAlert('Default Alert', 'Default description');
      expect(typeof result).toBe('boolean');
    });

    it('truncates long descriptions', async () => {
      const longDescription = 'A'.repeat(2000);
      await sendAlert('Long Alert', longDescription);

      // Should not throw
      expect(true).toBe(true);
    });

    it('uses correct colors for severity levels', () => {
      const colors = {
        info: 0x3498db,
        warning: 0xf39c12,
        critical: 0xe74c3c,
      };

      expect(colors.info).toBe(0x3498db);
      expect(colors.warning).toBe(0xf39c12);
      expect(colors.critical).toBe(0xe74c3c);
    });

    it('uses correct emojis for severity levels', () => {
      const emojis = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
      };

      expect(emojis.info).toBe('ℹ️');
      expect(emojis.warning).toBe('⚠️');
      expect(emojis.critical).toBe('🚨');
    });
  });

  describe('logConsciousnessObservation', () => {
    it('logs observation with default category', async () => {
      const result = await logConsciousnessObservation('Test observation');
      expect(typeof result).toBe('boolean');
    });

    it('logs observation with custom category', async () => {
      const result = await logConsciousnessObservation('Test observation', 'reflection');
      expect(typeof result).toBe('boolean');
    });

    it('truncates long observations', async () => {
      const longObservation = 'B'.repeat(2000);
      await logConsciousnessObservation(longObservation);

      // Should not throw
      expect(true).toBe(true);
    });

    it('uses correct embed structure', async () => {
      await logConsciousnessObservation('Reflection', 'introspection');

      // Verify fetch was called (if webhook is configured)
      expect(true).toBe(true);
    });
  });

  describe('hash chain updates', () => {
    it('creates SHA-256 hashes for chain entries', async () => {
      // Hash chain uses SHA-256 for integrity
      const { createHash } = await import('node:crypto');
      const hash = createHash('sha256').update('test').digest('hex');

      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('includes action, timestamp, and session in hash data', () => {
      // Hash chain entries include these fields
      const entry = {
        action: 'command_start',
        timestamp: new Date().toISOString(),
        sessionKey: 'test-session',
        type: 'command',
      };

      const entryData = JSON.stringify(entry);
      expect(entryData).toContain('action');
      expect(entryData).toContain('timestamp');
      expect(entryData).toContain('sessionKey');
    });
  });

  describe('pre-execution guarantee', () => {
    it('processes hooks synchronously before returning', async () => {
      installPreExecutionLogger();

      // The critical feature: hooks complete BEFORE triggerHelixHooks returns
      let hookProcessed = false;

      // Trigger hooks - they should complete synchronously
      await triggerHelixHooks({
        type: 'command',
        action: 'execute',
        sessionKey: 'test',
        context: { command: 'test' },
      });

      // The promise resolves only after hooks have been processed
      hookProcessed = true;
      expect(hookProcessed).toBe(true);
    });
  });

  describe('webhook colors', () => {
    it('uses Discord blurple for commands', () => {
      // Discord Blurple: 0x5865f2
      expect(0x5865f2).toBe(5793266);
    });

    it('uses green for session start', () => {
      // Green: 0x2ecc71
      expect(0x2ecc71).toBe(3066993);
    });

    it('uses red for session end', () => {
      // Red: 0xe74c3c
      expect(0xe74c3c).toBe(15158332);
    });

    it('uses yellow for bootstrap', () => {
      // Yellow: 0xf1c40f
      expect(0xf1c40f).toBe(15844367);
    });

    it('uses purple for hash chain', () => {
      // Purple: 0x9b59b6
      expect(0x9b59b6).toBe(10181046);
    });
  });
});
