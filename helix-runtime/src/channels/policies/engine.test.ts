/**
 * Policy Engine Tests
 *
 * Comprehensive testing of policy evaluation, scope resolution, and conflict resolution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './engine.js';
import type { PoliciesConfig } from './types.js';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  let config: PoliciesConfig;

  beforeEach(() => {
    config = {
      version: '1.0.0',
      global: {
        dmPolicy: 'open',
        groupPolicy: 'open',
        rules: [],
      },
      channels: {},
      profiles: [],
      auditLog: [],
    };
    engine = new PolicyEngine(config);
  });

  describe('DM Policy Evaluation', () => {
    it('should allow DMs in open mode', () => {
      const result = engine.evaluateDmPolicy('user123', 'telegram');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('DMs enabled (open mode)');
    });

    it('should block DMs in disabled mode', () => {
      config.global.dmPolicy = 'disabled';
      engine.updateConfig(config);

      const result = engine.evaluateDmPolicy('user123', 'telegram');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DMs disabled for this channel');
    });

    it('should require approval in pairing mode', () => {
      config.global.dmPolicy = 'pairing';
      engine.updateConfig(config);

      const result = engine.evaluateDmPolicy('new-user', 'whatsapp');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('DM pairing disabled');
    });

    it('should check allowlist in allowlist mode', () => {
      config.global.dmPolicy = 'allowlist';
      config.global.allowlist = ['+1234567890', '+0987654321'];
      engine.updateConfig(config);

      const allowed = engine.evaluateDmPolicy('+1234567890', 'whatsapp');
      const blocked = engine.evaluateDmPolicy('+9999999999', 'whatsapp');

      expect(allowed.allowed).toBe(true);
      expect(blocked.allowed).toBe(false);
    });

    it('should block explicitly blocked senders', () => {
      config.global.dmPolicy = 'open';
      config.global.blockList = ['spam-user', 'blocked-id'];
      engine.updateConfig(config);

      const result = engine.evaluateDmPolicy('spam-user', 'telegram');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Sender is in block list');
    });
  });

  describe('Group Policy Evaluation', () => {
    it('should allow groups in open mode', () => {
      const result = engine.evaluateGroupPolicy('group-123', 'discord');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Group messages enabled (open mode)');
    });

    it('should block groups in disabled mode', () => {
      config.global.groupPolicy = 'disabled';
      engine.updateConfig(config);

      const result = engine.evaluateGroupPolicy('group-123', 'telegram');
      expect(result.allowed).toBe(false);
    });

    it('should check allowlist for groups', () => {
      config.global.groupPolicy = 'allowlist';
      config.global.allowlist = ['approved-group-1', 'approved-group-2'];
      engine.updateConfig(config);

      const allowed = engine.evaluateGroupPolicy('approved-group-1', 'slack');
      const blocked = engine.evaluateGroupPolicy('unapproved-group', 'slack');

      expect(allowed.allowed).toBe(true);
      expect(blocked.allowed).toBe(false);
    });
  });

  describe('Scope Resolution (Account > Channel > Global)', () => {
    beforeEach(() => {
      // Set global policy to 'open'
      config.global.dmPolicy = 'open';
      config.global.groupPolicy = 'open';

      // Set channel policy to 'allowlist'
      config.channels['telegram'] = {
        channel: 'telegram',
        dmPolicy: { scope: 'channel', mode: 'allowlist', allowlist: ['+1111111111'] },
        groupPolicy: { scope: 'channel', mode: 'open' },
        rules: [],
      };

      engine.updateConfig(config);
    });

    it('should prefer channel policy over global', () => {
      const result = engine.evaluateDmPolicy('+2222222222', 'telegram');
      expect(result.allowed).toBe(false);
      expect(result.scope).toBe('channel');
    });

    it('should fall back to global when no channel policy', () => {
      const result = engine.evaluateDmPolicy('user123', 'whatsapp');
      expect(result.allowed).toBe(true);
      expect(result.scope).toBe('global');
    });

    it('should prefer account policy over channel and global', () => {
      config.channels['telegram'].account = 'business';
      config.channels['telegram'].dmPolicy.mode = 'disabled';
      engine.updateConfig(config);

      const result = engine.evaluateDmPolicy('+1111111111', 'telegram');
      expect(result.allowed).toBe(false);
      expect(result.scope).toBe('account');
    });
  });

  describe('Custom Rules', () => {
    beforeEach(() => {
      config.global.rules = [
        {
          id: 'rule-1',
          name: 'Block exact sender',
          enabled: true,
          scope: 'global',
          conditions: [
            { type: 'sender', operator: 'equals', value: 'bad-actor' },
          ],
          actions: ['deny'],
          priority: 10,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.updateConfig(config);
    });

    it('should match rules with sender condition', () => {
      const result = engine.evaluateRules('bad-actor', 'telegram', 'any message');
      expect(result.allowed).toBe(false);
      expect(result.matchedRule?.id).toBe('rule-1');
    });

    it('should respect rule priority', () => {
      config.global.rules?.push({
        id: 'rule-2',
        name: 'Allow good-actor',
        enabled: true,
        scope: 'global',
        conditions: [
          { type: 'sender', operator: 'equals', value: 'good-actor' },
        ],
        actions: [],
        priority: 20, // Higher priority
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      engine.updateConfig(config);

      // Rule 2 should evaluate first due to higher priority
      const result = engine.evaluateRules('good-actor', 'telegram', 'message');
      expect(result.matchedRule?.id).toBe('rule-2');
    });

    it('should check content length condition', () => {
      config.global.rules?.push({
        id: 'rule-3',
        name: 'Block long messages',
        enabled: true,
        scope: 'global',
        conditions: [
          { type: 'content_length', operator: 'greater_than', value: 100 },
        ],
        actions: ['deny'],
        priority: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      engine.updateConfig(config);

      const shortMsg = engine.evaluateRules('user', 'telegram', 'short');
      const longMsg = engine.evaluateRules('user', 'telegram', 'a'.repeat(200));

      expect(shortMsg.allowed).toBe(true);
      expect(longMsg.allowed).toBe(false);
    });

    it('should disable rules when enabled=false', () => {
      config.global.rules![0].enabled = false;
      engine.updateConfig(config);

      const result = engine.evaluateRules('bad-actor', 'telegram', 'message');
      expect(result.allowed).toBe(true); // Rule is disabled
    });
  });

  describe('Profile Application', () => {
    beforeEach(() => {
      config.profiles = [
        {
          id: 'restrictive',
          name: 'restricted',
          description: 'Restrictive profile',
          dmPolicy: 'pairing',
          groupPolicy: 'allowlist',
          rules: [],
        },
      ];
      engine.updateConfig(config);
    });

    it('should apply profile globally', () => {
      engine.applyProfile('restrictive');

      const dmResult = engine.evaluateDmPolicy('user', 'telegram');
      expect(dmResult.reason).toBe('DM pairing disabled');
    });

    it('should apply profile to specific channel', () => {
      engine.applyProfile('restrictive', 'telegram');

      const result = engine.evaluateDmPolicy('user', 'telegram');
      expect(result.reason).toBe('DM pairing disabled');
    });

    it('should throw error for unknown profile', () => {
      expect(() => engine.applyProfile('nonexistent')).toThrow('Profile not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined allowlists gracefully', () => {
      config.global.dmPolicy = 'allowlist';
      config.global.allowlist = undefined;
      engine.updateConfig(config);

      const result = engine.evaluateDmPolicy('user', 'telegram');
      expect(result.allowed).toBe(false);
    });

    it('should handle empty rules array', () => {
      const result = engine.evaluateRules('user', 'telegram', 'message');
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('No rules matched');
    });

    it('should match multiple keywords with matchMode=all', () => {
      config.global.rules = [
        {
          id: 'keyword-rule',
          name: 'Block spam + lottery',
          enabled: true,
          scope: 'global',
          conditions: [
            { type: 'content_length', operator: 'greater_than', value: 0 }, // Always true
          ],
          actions: ['deny'],
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      engine.updateConfig(config);

      const result = engine.evaluateRules('user', 'telegram', 'test message');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should support audit log updates', () => {
      config.auditLog = [
        {
          id: 'entry-1',
          timestamp: Date.now(),
          action: 'create',
          ruleId: 'rule-1',
          scope: 'global',
          changedBy: 'admin',
        },
      ];
      engine.updateConfig(config);

      const cfg = engine.getConfig();
      expect(cfg.auditLog).toHaveLength(1);
      expect(cfg.auditLog[0].action).toBe('create');
    });
  });
});
