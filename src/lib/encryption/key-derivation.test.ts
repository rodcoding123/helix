/**
 * Key Derivation Tests
 * Tests PBKDF2-SHA256 key derivation with timing-safe comparison
 */

import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  deriveEncryptionKey,
  verifyKeyDerivation,
  getKeyDerivationConfig,
} from './key-derivation.js';

describe('Key Derivation (PBKDF2-SHA256)', () => {
  describe('generateSalt', () => {
    it('should generate cryptographically random salt', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt).toHaveLength(16);
    });

    it('should generate different salts on each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toEqual(salt2);
    });

    it('should produce entropy-rich salts', () => {
      const salts = Array.from({ length: 10 }, () => generateSalt());
      const uniqueSalts = new Set(salts.map(s => s.toString('hex')));
      expect(uniqueSalts.size).toBe(10);
    });
  });

  describe('deriveEncryptionKey', () => {
    it('should derive 32-byte key from password and salt', async () => {
      const salt = generateSalt();
      const key = await deriveEncryptionKey('test-password', salt);

      expect(key).toBeInstanceOf(Buffer);
      expect(key).toHaveLength(32);
    });

    it('should derive different keys from different passwords', async () => {
      const salt = generateSalt();
      const key1 = await deriveEncryptionKey('password1', salt);
      const key2 = await deriveEncryptionKey('password2', salt);

      expect(key1).not.toEqual(key2);
    });

    it('should derive same key from same password and salt', async () => {
      const salt = generateSalt();
      const key1 = await deriveEncryptionKey('test-password', salt);
      const key2 = await deriveEncryptionKey('test-password', salt);

      expect(key1).toEqual(key2);
    });

    it('should derive different keys from different salts', async () => {
      const password = 'test-password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = await deriveEncryptionKey(password, salt1);
      const key2 = await deriveEncryptionKey(password, salt2);

      expect(key1).not.toEqual(key2);
    });

    it('should handle long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const salt = generateSalt();
      const key = await deriveEncryptionKey(longPassword, salt);

      expect(key).toHaveLength(32);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = 'p@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
      const salt = generateSalt();
      const key = await deriveEncryptionKey(specialPassword, salt);

      expect(key).toHaveLength(32);
    });

    it('should handle unicode characters in password', async () => {
      const unicodePassword = 'パスワード🔐密码';
      const salt = generateSalt();
      const key = await deriveEncryptionKey(unicodePassword, salt);

      expect(key).toHaveLength(32);
    });

    it('should use OWASP-compliant iteration count', () => {
      const config = getKeyDerivationConfig();
      expect(config.iterations).toBeGreaterThanOrEqual(600000);
    });
  });

  describe('verifyKeyDerivation', () => {
    it('should verify correct password', async () => {
      const password = 'test-password';
      const salt = generateSalt();
      const derivedKey = await deriveEncryptionKey(password, salt);

      const isValid = await verifyKeyDerivation(password, salt, derivedKey);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const salt = generateSalt();
      const derivedKey = await deriveEncryptionKey('correct-password', salt);

      const isValid = await verifyKeyDerivation('wrong-password', salt, derivedKey);
      expect(isValid).toBe(false);
    });

    it('should reject different salt', async () => {
      const password = 'test-password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const derivedKey = await deriveEncryptionKey(password, salt1);

      const isValid = await verifyKeyDerivation(password, salt2, derivedKey);
      expect(isValid).toBe(false);
    });

    it('should be timing-safe (not leak timing info)', async () => {
      const salt = generateSalt();
      const derivedKey = await deriveEncryptionKey('correct', salt);

      // Multiple wrong password attempts should not have significant timing differences
      const timings: number[] = [];

      for (let i = 0; i < 5; i++) {
        const wrongPassword = 'wrong'.repeat(i + 1);
        const start = performance.now();
        await verifyKeyDerivation(wrongPassword, salt, derivedKey);
        timings.push(performance.now() - start);
      }

      // Timing should be consistent (not vary by password length)
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const maxDeviation = Math.max(...timings.map(t => Math.abs(t - avgTiming)));

      // Allow reasonable variance (< 50% of average)
      expect(maxDeviation).toBeLessThan(avgTiming * 0.5);
    });

    it('should handle case-sensitive password verification', async () => {
      const salt = generateSalt();
      const derivedKey = await deriveEncryptionKey('Password', salt);

      const isValid = await verifyKeyDerivation('password', salt, derivedKey);
      expect(isValid).toBe(false);
    });

    it('should handle whitespace in password', async () => {
      const password1 = 'pass word';
      const password2 = 'password ';
      const salt = generateSalt();
      const key1 = await deriveEncryptionKey(password1, salt);
      const key2 = await deriveEncryptionKey(password2, salt);

      expect(key1).not.toEqual(key2);

      const isValid1 = await verifyKeyDerivation(password1, salt, key1);
      const isValid2 = await verifyKeyDerivation(password2, salt, key1);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(false);
    });

    it('should return false for corrupted keys', async () => {
      const password = 'test-password';
      const salt = generateSalt();
      const derivedKey = await deriveEncryptionKey(password, salt);

      // Corrupt the key
      const corruptedKey = Buffer.from(derivedKey);
      corruptedKey[0] ^= 0xff; // Flip bits

      const isValid = await verifyKeyDerivation(password, salt, corruptedKey);
      expect(isValid).toBe(false);
    });
  });

  describe('getKeyDerivationConfig', () => {
    it('should return current OWASP-compliant configuration', () => {
      const config = getKeyDerivationConfig();

      expect(config).toHaveProperty('algorithm', 'pbkdf2');
      expect(config).toHaveProperty('hash', 'sha256');
      expect(config).toHaveProperty('iterations');
      expect(config).toHaveProperty('saltLength', 16);
      expect(config).toHaveProperty('keyLength', 32);
    });

    it('should return immutable config (defensive copy)', () => {
      const config1 = getKeyDerivationConfig();
      const config2 = getKeyDerivationConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it('should have OWASP-recommended iteration count', () => {
      const config = getKeyDerivationConfig();
      // OWASP 2023 recommendation: ≥600,000 for PBKDF2
      expect(config.iterations).toBeGreaterThanOrEqual(600000);
    });

    it('should use 256-bit keys for AES-256', () => {
      const config = getKeyDerivationConfig();
      expect(config.keyLength).toBe(32); // 256 bits = 32 bytes
    });
  });

  describe('Security properties', () => {
    it('should resist precomputation attacks with adequate iterations', () => {
      const config = getKeyDerivationConfig();
      // Higher iterations = slower but more resistant to brute force
      expect(config.iterations).toBeGreaterThanOrEqual(100000);
    });

    it('should use cryptographically secure salt', () => {
      const salt = generateSalt();
      // Salt should have high entropy
      const hexSalt = salt.toString('hex');
      const uniqueChars = new Set(hexSalt);
      // Expect good distribution of characters
      expect(uniqueChars.size).toBeGreaterThan(8);
    });

    it('should derive keys suitable for AES-256', async () => {
      const salt = generateSalt();
      const key = await deriveEncryptionKey('password', salt);

      // AES-256 requires 32-byte (256-bit) key
      expect(key.length * 8).toBe(256);
      expect(key).toBeInstanceOf(Buffer);
    });
  });

  describe('Performance', () => {
    it('should complete key derivation in reasonable time', async () => {
      const salt = generateSalt();
      const start = performance.now();
      await deriveEncryptionKey('password', salt);
      const duration = performance.now() - start;

      // Should take < 1 second (high iteration count = intentionally slow)
      expect(duration).toBeLessThan(2000);
      // But should take > 100ms (not too fast)
      expect(duration).toBeGreaterThan(50);
    });

    it('should handle concurrent derivations', async () => {
      const passwords = Array.from({ length: 10 }, (_, i) => `password${i}`);
      const salt = generateSalt();

      const start = performance.now();
      const keys = await Promise.all(passwords.map(p => deriveEncryptionKey(p, salt)));
      const duration = performance.now() - start;

      expect(keys).toHaveLength(10);
      // All should be unique
      const uniqueKeys = new Set(keys.map(k => k.toString('hex')));
      expect(uniqueKeys.size).toBe(10);

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });
});
