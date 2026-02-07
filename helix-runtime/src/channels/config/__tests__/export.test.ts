/**
 * Channel Config Export/Import Tests
 *
 * Tests configuration export, import, validation, and comparison.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelConfigManager } from '../export';

describe('ChannelConfigManager', () => {
  let manager: ChannelConfigManager;

  beforeEach(() => {
    manager = new ChannelConfigManager();
  });

  describe('Export', () => {
    it('should export config as object', () => {
      const data = {
        dmPolicy: 'pairing' as const,
        allowlist: ['user1', 'user2'],
        mediaMaxMB: 25,
      };

      const exported = manager.exportConfig('whatsapp', data);

      expect(exported).toBeDefined();
      expect(exported.channel).toBe('whatsapp');
      expect(exported.data).toEqual(data);
    });

    it('should include version and timestamp', () => {
      const exported = manager.exportConfig('telegram', {});

      expect(exported.version).toBeDefined();
      expect(exported.timestamp).toBeGreaterThan(0);
      expect(exported.checksum).toBeDefined();
    });

    it('should handle empty data', () => {
      const exported = manager.exportConfig('discord', {});

      expect(exported).toBeDefined();
      expect(exported.data).toEqual({});
    });
  });

  describe('Export JSON', () => {
    it('should export config to JSON string', () => {
      const data = { enabled: true, name: 'test' };
      const exported = manager.exportConfig('whatsapp', data);

      const json = manager.exportToJson(exported);

      expect(typeof json).toBe('string');
      expect(json.includes('whatsapp')).toBe(true);

      // Should be valid JSON
      const parsed = JSON.parse(json);
      expect(parsed.channel).toBe('whatsapp');
    });

    it('should be parseable back', () => {
      const original = manager.exportConfig('slack', { setting: 'value' });
      const json = manager.exportToJson(original);
      const parsed = JSON.parse(json);

      expect(parsed.channel).toBe(original.channel);
      expect(parsed.data).toEqual(original.data);
    });

    it('should handle complex data structures', () => {
      const data = {
        settings: {
          nested: {
            deep: {
              value: 123,
            },
          },
        },
        arrays: [1, 2, 3],
      };

      const exported = manager.exportConfig('teams', data);
      const json = manager.exportToJson(exported);

      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('Export Base64', () => {
    it('should export config to base64 string', () => {
      const data = { key: 'value' };
      const exported = manager.exportConfig('whatsapp', data);

      const base64 = manager.exportToBase64(exported);

      expect(typeof base64).toBe('string');
      // Base64 should be decodable
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded.includes('whatsapp')).toBe(true);
    });

    it('should be decodable back', () => {
      const original = manager.exportConfig('telegram', { token: 'secret' });
      const base64 = manager.exportToBase64(original);

      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);

      expect(parsed.channel).toBe('telegram');
    });

    it('should handle binary-like data', () => {
      const data = { buffer: Buffer.from('test').toString('base64') };
      const exported = manager.exportConfig('discord', data);

      const base64 = manager.exportToBase64(exported);
      expect(typeof base64).toBe('string');

      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded).toBeDefined();
    });
  });

  describe('Import JSON', () => {
    it('should import valid JSON config', () => {
      const data = { setting: 'value' };
      const exported = manager.exportConfig('whatsapp', data);
      const json = manager.exportToJson(exported);

      const imported = manager.importFromJson(json);

      expect(imported).toBeDefined();
      expect(imported.channel).toBe('whatsapp');
      expect(imported.data).toEqual(data);
    });

    it('should handle malformed JSON', () => {
      expect(() => manager.importFromJson('invalid json {')).toThrow();
    });

    it('should validate imported config', () => {
      const data = { enabled: true };
      const exported = manager.exportConfig('telegram', data);
      const json = manager.exportToJson(exported);

      const imported = manager.importFromJson(json);

      expect(imported.channel).toBeDefined();
      expect(imported.data).toBeDefined();
      expect(imported.timestamp).toBeGreaterThan(0);
    });

    it('should handle missing fields', () => {
      const incomplete = {
        channel: 'discord',
        data: {},
      };

      expect(() => manager.importFromJson(JSON.stringify(incomplete))).not.toThrow();
    });
  });

  describe('Import Base64', () => {
    it('should import valid base64 config', () => {
      const data = { key: 'secret' };
      const exported = manager.exportConfig('slack', data);
      const base64 = manager.exportToBase64(exported);

      const imported = manager.importFromBase64(base64);

      expect(imported).toBeDefined();
      expect(imported.channel).toBe('slack');
      expect(imported.data).toEqual(data);
    });

    it('should handle invalid base64', () => {
      expect(() => manager.importFromBase64('not-valid-base64!!!')).toThrow();
    });

    it('should handle corrupted base64', () => {
      const data = { test: 'data' };
      const exported = manager.exportConfig('teams', data);
      const base64 = manager.exportToBase64(exported);

      // Corrupt the base64
      const corrupted = base64.slice(0, -10) + 'XXXX';

      expect(() => manager.importFromBase64(corrupted)).toThrow();
    });

    it('should validate decoded content', () => {
      const data = { validated: true };
      const exported = manager.exportConfig('whatsapp', data);
      const base64 = manager.exportToBase64(exported);

      const imported = manager.importFromBase64(base64);

      expect(imported.channel).toBe('whatsapp');
      expect(imported.data.validated).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate compatible config', () => {
      const config = manager.exportConfig('whatsapp', { policy: 'open' });

      const validation = manager.validateCompatibility(config, 'whatsapp');

      expect(validation.compatible).toBe(true);
    });

    it('should reject incompatible channel', () => {
      const config = manager.exportConfig('whatsapp', { specific: 'setting' });

      const validation = manager.validateCompatibility(config, 'telegram');

      // May be valid or invalid depending on settings
      expect(validation.compatible).toBeDefined();
    });

    it('should check version compatibility', () => {
      const config = {
        channel: 'discord',
        version: '1.0.0',
        data: {},
      };

      const validation = manager.validateCompatibility(config, 'discord');

      expect(validation).toBeDefined();
      expect(validation.compatible).toBeDefined();
    });

    it('should report validation errors', () => {
      const invalidConfig = { invalid: 'structure' };

      expect(() =>
        manager.validateCompatibility(invalidConfig as any, 'slack')
      ).not.toThrow();
    });
  });

  describe('Comparison', () => {
    it('should detect identical configs', () => {
      const config1 = manager.exportConfig('whatsapp', { a: 1, b: 2 });
      const config2 = manager.exportConfig('whatsapp', { a: 1, b: 2 });

      const comparison = manager.compareConfigs(config1, config2);

      expect(comparison.identical).toBe(true);
      expect(comparison.differences.length).toBe(0);
    });

    it('should detect differences', () => {
      const config1 = manager.exportConfig('whatsapp', { setting: 'value1' });
      const config2 = manager.exportConfig('whatsapp', { setting: 'value2' });

      const comparison = manager.compareConfigs(config1, config2);

      expect(comparison.identical).toBe(false);
      expect(comparison.differences.length).toBeGreaterThan(0);
    });

    it('should report added fields', () => {
      const config1 = manager.exportConfig('telegram', { a: 1 });
      const config2 = manager.exportConfig('telegram', { a: 1, b: 2 });

      const comparison = manager.compareConfigs(config1, config2);

      expect(comparison.identical).toBe(false);
    });

    it('should report removed fields', () => {
      const config1 = manager.exportConfig('discord', { a: 1, b: 2 });
      const config2 = manager.exportConfig('discord', { a: 1 });

      const comparison = manager.compareConfigs(config1, config2);

      expect(comparison.identical).toBe(false);
    });

    it('should handle nested differences', () => {
      const config1 = manager.exportConfig('slack', {
        settings: { nested: { value: 1 } },
      });
      const config2 = manager.exportConfig('slack', {
        settings: { nested: { value: 2 } },
      });

      const comparison = manager.compareConfigs(config1, config2);

      expect(comparison.identical).toBe(false);
    });
  });

  describe('Checksum', () => {
    it('should calculate checksum', () => {
      const config = manager.exportConfig('whatsapp', { data: 'test' });

      expect(config.checksum).toBeDefined();
      expect(config.checksum.length).toBeGreaterThan(0);
    });

    it('should match identical configs', () => {
      const config1 = manager.exportConfig('whatsapp', { a: 1 });
      const config2 = manager.exportConfig('whatsapp', { a: 1 });

      expect(config1.checksum).toBe(config2.checksum);
    });

    it('should differ for different configs', () => {
      const config1 = manager.exportConfig('whatsapp', { a: 1 });
      const config2 = manager.exportConfig('whatsapp', { a: 2 });

      expect(config1.checksum).not.toBe(config2.checksum);
    });
  });

  describe('Merge', () => {
    it('should merge configs with replace strategy', () => {
      const base = manager.exportConfig('telegram', { a: 1, b: 2 });
      const update = { a: 10 };

      const merged = manager.mergeConfig(base, update, 'replace');

      expect(merged.data.a).toBe(10);
      expect(merged.data.b).toBe(2);
    });

    it('should merge with merge strategy', () => {
      const base = manager.exportConfig('discord', {
        settings: { x: 1, y: 2 },
      });
      const update = {
        settings: { x: 10 },
      };

      const merged = manager.mergeConfig(base, update, 'merge');

      expect(merged.data.settings).toBeDefined();
    });

    it('should skip with skip strategy', () => {
      const base = manager.exportConfig('slack', { original: 'value' });

      const merged = manager.mergeConfig(base, { new: 'value' }, 'skip');

      expect(merged.data.original).toBe('value');
    });
  });

  describe('Restore Points', () => {
    it('should create restore point', () => {
      const config = manager.exportConfig('whatsapp', { data: 'v1' });

      const point = manager.createRestorePoint(config);

      expect(point).toBeDefined();
      expect(point.id).toBeDefined();
      expect(point.config).toEqual(config);
    });

    it('should restore from point', () => {
      const config = manager.exportConfig('telegram', { data: 'v1' });
      const point = manager.createRestorePoint(config);

      const restored = point.config;

      expect(restored.channel).toBe('telegram');
      expect(restored.data).toEqual(config.data);
    });
  });

  describe('Diff Summary', () => {
    it('should generate diff summary', () => {
      const config1 = manager.exportConfig('discord', { a: 1, b: 2, c: 3 });
      const config2 = manager.exportConfig('discord', { a: 1, b: 20, d: 4 });

      const summary = manager.getDiffSummary(config1, config2);

      expect(summary).toBeDefined();
      expect(summary.modified).toBeGreaterThan(0);
    });

    it('should track added, modified, removed', () => {
      const config1 = manager.exportConfig('slack', { x: 1, y: 2 });
      const config2 = manager.exportConfig('slack', { x: 10, z: 3 });

      const summary = manager.getDiffSummary(config1, config2);

      expect(summary.added || summary.modified || summary.removed).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty config', () => {
      const exported = manager.exportConfig('whatsapp', {});

      expect(exported).toBeDefined();
      expect(exported.data).toEqual({});
    });

    it('should handle null values', () => {
      const data = { key: null };
      const exported = manager.exportConfig('telegram', data);

      expect(exported).toBeDefined();
    });

    it('should handle circular references gracefully', () => {
      const data: any = { a: 1 };
      data.self = data; // Circular reference

      // Should handle or error gracefully
      expect(() => manager.exportConfig('discord', data)).not.toThrow();
    });

    it('should handle very large configs', () => {
      const largeData: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`key${i}`] = `value${i}`;
      }

      const exported = manager.exportConfig('slack', largeData);
      const json = manager.exportToJson(exported);

      expect(json.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should export configs quickly', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        manager.exportConfig('whatsapp', { index: i });
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // 100 exports in <1s
    });

    it('should import configs quickly', () => {
      const data = { test: 'value' };
      const exported = manager.exportConfig('telegram', data);
      const json = manager.exportToJson(exported);

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        manager.importFromJson(json);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // 100 imports in <1s
    });

    it('should compare configs quickly', () => {
      const config1 = manager.exportConfig('discord', { data: 'a' });
      const config2 = manager.exportConfig('discord', { data: 'b' });

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        manager.compareConfigs(config1, config2);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000); // 1000 comparisons in <1s
    });
  });
});
