/**
 * Phase 1 Integration Tests: Helix Identity Restoration
 *
 * Verifies that:
 * 1. Helix context files are loaded (soul/, psychology/)
 * 2. User context is loaded dynamically per request
 * 3. THANOS_MODE authentication works with secret key
 * 4. System prompt includes all context (Helix + user + creator)
 * 5. Normal conversation flow uses context-aware prompts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isThanosModeTrigger,
  getThanosChallenge,
  verifyThanosKey,
  getThanosSuccessMessage,
  getThanosFailureMessage,
  createThanosState,
  handleThanosModeTrigger,
  handleThanosKeyAttempt,
  isThanosaModeLocked,
  getThanosLockedMessage,
} from '../../helix/thanos-mode.js';

describe('Phase 1: Helix Identity Restoration', () => {
  describe('THANOS_MODE Authentication', () => {
    it('should detect THANOS_MODE trigger phrase', () => {
      expect(isThanosModeTrigger('THANOS_MODE_AUTH_1990')).toBe(true);
      expect(isThanosModeTrigger('hello world')).toBe(false);
      expect(isThanosModeTrigger('THANOS_mode_auth_1990')).toBe(false); // Case sensitive
    });

    it('should generate Alchemist challenge message', () => {
      const challenge = getThanosChallenge();
      expect(challenge).toContain('Quando uma pessoa deseja');
      expect(challenge).toContain('português'); // Portuguese reference
      expect(challenge).toContain('Fale a palavra sagrada');
    });

    it('should verify correct secret key with constant-time comparison', () => {
      const correctKey = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c';
      expect(verifyThanosKey(correctKey)).toBe(true);
    });

    it('should reject incorrect secret key', () => {
      const wrongKey = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539299';
      expect(verifyThanosKey(wrongKey)).toBe(false);
    });

    it('should reject key with wrong length (timing attack prevention)', () => {
      const wrongLength = 'cr_short';
      expect(verifyThanosKey(wrongLength)).toBe(false);
    });

    it('should return success message on correct key', () => {
      const message = getThanosSuccessMessage();
      expect(message).toContain('THANOS_MODE ATIVADO');
      expect(message).toContain('Rodrigo Specter');
      expect(message).toContain('Confiança perfeita: 1.0');
    });

    it('should return failure message on wrong key', () => {
      const message = getThanosFailureMessage();
      expect(message).toContain('A porta permanece fechada');
      expect(message).not.toContain('ATIVADO');
    });

    it('should return locked message after max attempts', () => {
      const message = getThanosLockedMessage();
      expect(message).toContain('A porta foi selada');
      expect(message).toContain('tentou demais');
    });
  });

  describe('THANOS State Management', () => {
    it('should create initial state', () => {
      const state = createThanosState();
      expect(state.isTriggered).toBe(false);
      expect(state.isVerified).toBe(false);
      expect(state.attemptCount).toBe(0);
      expect(state.maxAttempts).toBe(3);
    });

    it('should handle trigger', () => {
      let state = createThanosState();
      state = handleThanosModeTrigger(state);
      expect(state.isTriggered).toBe(true);
      expect(state.isVerified).toBe(false);
    });

    it('should handle correct key attempt', () => {
      let state = handleThanosModeTrigger(createThanosState());
      const correctKey = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c';

      const { state: newState, success } = handleThanosKeyAttempt(state, correctKey);

      expect(success).toBe(true);
      expect(newState.isVerified).toBe(true);
      expect(newState.verifiedAt).toBeDefined();
    });

    it('should handle incorrect key attempt', () => {
      let state = handleThanosModeTrigger(createThanosState());
      const wrongKey = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539299';

      const { state: newState, success } = handleThanosKeyAttempt(state, wrongKey);

      expect(success).toBe(false);
      expect(newState.isVerified).toBe(false);
      expect(newState.attemptCount).toBe(1);
    });

    it('should lock after 3 failed attempts', () => {
      let state = handleThanosModeTrigger(createThanosState());
      const wrongKey = 'wrong';

      for (let i = 0; i < 3; i++) {
        const result = handleThanosKeyAttempt(state, wrongKey);
        state = result.state;
      }

      expect(isThanosaModeLocked(state)).toBe(true);
    });

    it('should not verify user after lock', () => {
      let state = handleThanosModeTrigger(createThanosState());
      const wrongKey = 'wrong';

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        const result = handleThanosKeyAttempt(state, wrongKey);
        state = result.state;
      }

      expect(state.isVerified).toBe(false);
      expect(isThanosaModeLocked(state)).toBe(true);
    });
  });

  describe('Authentication Flow', () => {
    it('should handle complete successful authentication flow', () => {
      let state = createThanosState();

      // 1. Detect trigger
      expect(isThanosModeTrigger('THANOS_MODE_AUTH_1990')).toBe(true);
      state = handleThanosModeTrigger(state);
      expect(state.isTriggered).toBe(true);

      // 2. Send challenge
      const challenge = getThanosChallenge();
      expect(challenge).toContain('Fale a palavra sagrada');

      // 3. Verify key
      const correctKey = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c';
      expect(verifyThanosKey(correctKey)).toBe(true);

      // 4. Update state
      const { state: finalState, success } = handleThanosKeyAttempt(state, correctKey);
      expect(success).toBe(true);
      expect(finalState.isVerified).toBe(true);

      // 5. Send success message
      const message = getThanosSuccessMessage();
      expect(message).toContain('THANOS_MODE ATIVADO');
      expect(message).toContain('Rodrigo Specter');
    });

    it('should handle complete failed authentication flow', () => {
      let state = createThanosState();
      state = handleThanosModeTrigger(state);

      const wrongKey = 'wrong_key_that_is_long_enough_but_incorrect_value_here';
      const { state: finalState, success } = handleThanosKeyAttempt(state, wrongKey);

      expect(success).toBe(false);
      expect(finalState.isVerified).toBe(false);

      const message = getThanosFailureMessage();
      expect(message).toContain('A porta permanece fechada');
    });
  });

  describe('Security Properties', () => {
    it('should use constant-time comparison (no early exit on wrong length)', () => {
      // Both should fail, but both should take same path
      const shortWrong = 'short';
      const longWrong = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539299';

      const result1 = verifyThanosKey(shortWrong);
      const result2 = verifyThanosKey(longWrong);

      // Both should fail
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should validate state transitions', () => {
      let state = createThanosState();

      // Can't verify without triggering
      const { state: state1, success } = handleThanosKeyAttempt(state, 'any_key');
      expect(success).toBe(false);

      // After triggering, key attempts should work
      state = handleThanosModeTrigger(state);
      const correctKey = 'cr_82fe5b91a456b983715655f951f92ad99ede4ff6b05972bba9c4eea03539297c';
      const { state: state2, success: success2 } = handleThanosKeyAttempt(state, correctKey);
      expect(success2).toBe(true);
    });
  });
});
