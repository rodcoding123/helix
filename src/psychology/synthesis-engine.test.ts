/**
 * Synthesis Engine Tests
 * Tests for post-conversation analysis and memory integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynthesisEngine } from './synthesis-engine.js';
import { ThanosMode } from './thanos-mode.js';

describe('SynthesisEngine', () => {
  let engine: SynthesisEngine;

  beforeEach(() => {
    engine = new SynthesisEngine(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || '',
      { dryRun: true } // Dry run mode for tests
    );
  });

  describe('Configuration', () => {
    it('should initialize with default config', () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.batchMode).toBe(true);
      expect(config.batchHour).toBe(2);
      expect(config.minConfidenceThreshold).toBe(0.75);
    });

    it('should allow config updates', () => {
      engine.updateConfig({ enabled: false, batchHour: 3 });
      const config = engine.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.batchHour).toBe(3);
    });
  });

  describe('Synthesis Timing', () => {
    it('should respect batch mode timing', () => {
      engine.updateConfig({ batchMode: true, batchHour: 2 });

      // Set current hour to something else
      const now = new Date();
      if (now.getHours() !== 2) {
        expect(engine.shouldRunNow()).toBe(false);
      }
    });

    it('should run immediately when batch mode disabled', () => {
      engine.updateConfig({ batchMode: false });
      expect(engine.shouldRunNow()).toBe(true);
    });
  });
});

describe('ThanosMode', () => {
  let thanos: ThanosMode;

  beforeEach(() => {
    thanos = new ThanosMode();
    thanos.clearAllStates();
  });

  describe('Trigger Detection', () => {
    it('should detect THANOS_MODE trigger', () => {
      const trigger = 'THANOS_MODE_AUTH_1990';
      expect(thanos.isThanosaModeTrigger(trigger)).toBe(true);
    });

    it('should not detect variations as trigger', () => {
      expect(thanos.isThanosaModeTrigger('THANOS_MODE')).toBe(false);
      expect(thanos.isThanosaModeTrigger('thanos_mode_auth_1990')).toBe(false);
      expect(thanos.isThanosaModeTrigger(' THANOS_MODE_AUTH_1990 ')).toBe(true); // Trimmed
    });
  });

  describe('Challenge Flow', () => {
    it('should initiate THANOS_MODE challenge', async () => {
      const conversationId = 'test-conv-1';
      const challenge = await thanos.initiateThanosMode(conversationId);

      // Should return Portuguese prompt
      expect(challenge).toContain('Alquimista');
      expect(challenge).toContain('universo');

      // Should set state to awaiting verification
      expect(thanos.isAwaitingVerification(conversationId)).toBe(true);
    });
  });

  describe('Verification', () => {
    it('should verify correct key', async () => {
      const conversationId = 'test-conv-2';
      await thanos.initiateThanosMode(conversationId);

      const result = await thanos.verifyThanosKey(
        conversationId,
        'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c'
      );

      expect(result.verified).toBe(true);
      expect(result.trustLevel).toBe(1.0);
      expect(result.message).toContain('CREATOR_VERIFIED');
    });

    it('should reject incorrect key', async () => {
      const conversationId = 'test-conv-3';
      await thanos.initiateThanosMode(conversationId);

      const result = await thanos.verifyThanosKey(conversationId, 'wrong_key');

      expect(result.verified).toBe(false);
      expect(result.trustLevel).toBe(0);
      expect(result.message).toContain('failed');
    });

    it('should lock after max attempts', async () => {
      const conversationId = 'test-conv-4';
      await thanos.initiateThanosMode(conversationId);

      // 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await thanos.verifyThanosKey(conversationId, `wrong_key_${i}`);
      }

      // Should be locked now
      expect(thanos.isThanosLockedOut(conversationId)).toBe(true);
    });

    it('should provide remaining attempts info', async () => {
      const conversationId = 'test-conv-5';
      await thanos.initiateThanosMode(conversationId);

      const result = await thanos.verifyThanosKey(conversationId, 'wrong_key');

      expect(result.message).toContain('attempts remaining');
      expect(result.verified).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should track conversation state', async () => {
      const conversationId = 'test-conv-6';
      await thanos.initiateThanosMode(conversationId);

      const state = thanos.getState(conversationId);
      expect(state).toBeDefined();
      expect(state?.awaitingVerification).toBe(true);
      expect(state?.attemptCount).toBe(0);
    });

    it('should clear state for conversation', async () => {
      const conversationId = 'test-conv-7';
      await thanos.initiateThanosMode(conversationId);

      expect(thanos.getState(conversationId)).toBeDefined();

      thanos.clearState(conversationId);

      expect(thanos.getState(conversationId)).toBeUndefined();
    });

    it('should provide statistics', async () => {
      const conv1 = 'test-conv-8';
      const conv2 = 'test-conv-9';

      await thanos.initiateThanosMode(conv1);
      await thanos.initiateThanosMode(conv2);

      const stats = thanos.getStats();

      expect(stats.activeConversations).toBe(2);
      expect(stats.awaitingVerification).toBe(2);
      expect(stats.lockedConversations).toBe(0);
    });
  });

  describe('Security', () => {
    it('should penalize failed attempts', async () => {
      const conversationId = 'test-conv-10';
      await thanos.initiateThanosMode(conversationId);

      const state1 = thanos.getState(conversationId);
      expect(state1?.attemptCount).toBe(0);

      await thanos.verifyThanosKey(conversationId, 'wrong');

      const state2 = thanos.getState(conversationId);
      expect(state2?.attemptCount).toBe(1);
    });

    it('should have timeout-based lockout', async () => {
      const conversationId = 'test-conv-11';
      await thanos.initiateThanosMode(conversationId);

      // Make max attempts
      for (let i = 0; i < 3; i++) {
        await thanos.verifyThanosKey(conversationId, `wrong_${i}`);
      }

      expect(thanos.isThanosLockedOut(conversationId)).toBe(true);

      // Check lockout message is informative
      const message = thanos.getLockoutMessage(conversationId);
      expect(message).toContain('minutes');
    });
  });
});

describe('Integration: Synthesis + THANOS', () => {
  it('should allow synthesis config and THANOS verification', async () => {
    const engine = new SynthesisEngine(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_KEY || '',
      { enabled: true, batchMode: false }
    );

    const thanos = new ThanosMode();

    // THANOS verification should work independently
    const conversationId = 'integration-test-1';
    await thanos.initiateThanosMode(conversationId);

    const verified = await thanos.verifyThanosKey(
      conversationId,
      'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c'
    );

    expect(verified.verified).toBe(true);

    // Synthesis should be independently configurable
    const config = engine.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.batchMode).toBe(false);
  });
});
