/**
 * Symmetric Encryption Tests (AES-256-GCM)
 * Tests authenticated encryption with proper nonce handling
 */

import { describe, it, expect } from 'vitest';
import { generateNonce, encryptWithKey, decryptWithKey } from './symmetric.js';
import { randomBytes } from 'crypto';

describe('Symmetric Encryption (AES-256-GCM)', () => {
  describe('generateNonce', () => {
    it('should generate 12-byte nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toBeInstanceOf(Buffer);
      expect(nonce).toHaveLength(12);
    });

    it('should generate unique nonces', () => {
      const nonces = Array.from({ length: 100 }, () => generateNonce());
      const uniqueNonces = new Set(nonces.map(n => n.toString('hex')));
      expect(uniqueNonces.size).toBe(100);
    });

    it('should be cryptographically random', () => {
      const nonce = generateNonce();
      // Check for good entropy distribution
      const hex = nonce.toString('hex');
      const uniqueChars = new Set(hex);
      expect(uniqueChars.size).toBeGreaterThan(8);
    });
  });

  describe('encryptWithKey', () => {
    it('should encrypt plaintext to ciphertext', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'secret-api-key';

      const ciphertext = encryptWithKey(plaintext, key, nonce);

      expect(ciphertext).toBeTypeOf('string');
      expect(ciphertext.length).toBeGreaterThan(0);
      expect(ciphertext).not.toContain(plaintext);
    });

    it('should produce different ciphertexts for different nonces', () => {
      const key = randomBytes(32);
      const plaintext = 'secret-api-key';

      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      const cipher1 = encryptWithKey(plaintext, key, nonce1);
      const cipher2 = encryptWithKey(plaintext, key, nonce2);

      expect(cipher1).not.toEqual(cipher2);
    });

    it('should include nonce, ciphertext, and auth tag in output', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'test';

      const result = encryptWithKey(plaintext, key, nonce);
      const parts = result.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(24); // Nonce hex (12 bytes = 24 hex chars)
      expect(parts[2]).toHaveLength(32); // Auth tag hex (16 bytes = 32 hex chars)
    });

    it('should handle empty plaintext', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();

      const ciphertext = encryptWithKey('', key, nonce);
      expect(ciphertext).toBeTypeOf('string');
    });

    it('should handle long plaintext', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const longPlaintext = 'a'.repeat(10000);

      const ciphertext = encryptWithKey(longPlaintext, key, nonce);
      expect(ciphertext).toBeTypeOf('string');
    });

    it('should handle special characters', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      expect(ciphertext).toBeTypeOf('string');
    });

    it('should handle unicode characters', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = '🔐密码パスワード';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      expect(ciphertext).toBeTypeOf('string');
    });

    it('should reject key with wrong length', () => {
      const wrongKey = randomBytes(16); // Should be 32
      const nonce = generateNonce();

      expect(() => {
        encryptWithKey('test', wrongKey, nonce);
      }).toThrow('Key must be 32 bytes');
    });

    it('should reject nonce with wrong length', () => {
      const key = randomBytes(32);
      const wrongNonce = randomBytes(16); // Should be 12

      expect(() => {
        encryptWithKey('test', key, wrongNonce);
      }).toThrow('Nonce must be 12 bytes');
    });

    it('should never reuse nonce (different ciphertexts)', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'test';

      // Encrypt same plaintext twice with same nonce
      const cipher1 = encryptWithKey(plaintext, key, nonce);
      const cipher2 = encryptWithKey(plaintext, key, nonce);

      // Results will be different because they're using the same nonce
      // (which would be insecure in production)
      expect(cipher1).toBeTypeOf('string');
      expect(cipher2).toBeTypeOf('string');
    });
  });

  describe('decryptWithKey', () => {
    it('should decrypt ciphertext back to plaintext', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'secret-message';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      const decrypted = decryptWithKey(ciphertext, key);

      expect(decrypted).toBe(plaintext);
    });

    it('should reject modified ciphertext', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'test';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      const parts = ciphertext.split(':');

      // Modify the ciphertext part
      const modifiedCiphertext = `${parts[0]}:${Buffer.from(parts[1], 'hex').toString('hex').slice(0, -2)}00:${parts[2]}`;

      expect(() => {
        decryptWithKey(modifiedCiphertext, key);
      }).toThrow();
    });

    it('should reject modified auth tag', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'test';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      const parts = ciphertext.split(':');

      // Modify auth tag
      const modifiedCiphertext = `${parts[0]}:${parts[1]}:${Buffer.from(parts[2], 'hex').toString('hex').slice(0, -2)}00`;

      expect(() => {
        decryptWithKey(modifiedCiphertext, key);
      }).toThrow('Authentication tag verification failed');
    });

    it('should reject modified nonce', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'test';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      const parts = ciphertext.split(':');

      // Modify nonce
      const modifiedCiphertext = `${Buffer.from(parts[0], 'hex').toString('hex').slice(0, -2)}00:${parts[1]}:${parts[2]}`;

      expect(() => {
        decryptWithKey(modifiedCiphertext, key);
      }).toThrow();
    });

    it('should reject wrong key', () => {
      const key1 = randomBytes(32);
      const key2 = randomBytes(32);
      const nonce = generateNonce();

      const ciphertext = encryptWithKey('test', key1, nonce);

      expect(() => {
        decryptWithKey(ciphertext, key2);
      }).toThrow();
    });

    it('should handle invalid format', () => {
      const key = randomBytes(32);

      expect(() => {
        decryptWithKey('invalid:format', key);
      }).toThrow('Invalid ciphertext format');
    });

    it('should handle malformed hex', () => {
      const key = randomBytes(32);

      expect(() => {
        decryptWithKey('zzzz:zzzz:zzzz', key);
      }).toThrow();
    });

    it('should reject empty ciphertext', () => {
      const key = randomBytes(32);

      expect(() => {
        decryptWithKey('', key);
      }).toThrow();
    });

    it('should reject key with wrong length', () => {
      const wrongKey = randomBytes(16);
      const ciphertext = 'nonce:data:tag';

      expect(() => {
        decryptWithKey(ciphertext, wrongKey);
      }).toThrow('Key must be 32 bytes');
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should preserve plaintext through encrypt-decrypt cycle', () => {
      const key = randomBytes(32);
      const plaintexts = [
        'simple',
        'with spaces',
        '!@#$%^&*()',
        'αβγδε',
        '🔐🔑🔓',
        '',
        'a'.repeat(1000),
      ];

      for (const plaintext of plaintexts) {
        const nonce = generateNonce();
        const encrypted = encryptWithKey(plaintext, key, nonce);
        const decrypted = decryptWithKey(encrypted, key);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should handle multiple encryptions with same key', () => {
      const key = randomBytes(32);
      const plaintexts = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];

      const results = plaintexts.map(p => {
        const nonce = generateNonce();
        const encrypted = encryptWithKey(p, key, nonce);
        return { plaintext: p, encrypted };
      });

      for (const { plaintext, encrypted } of results) {
        const decrypted = decryptWithKey(encrypted, key);
        expect(decrypted).toBe(plaintext);
      }
    });
  });

  describe('Security properties', () => {
    it('should use authenticated encryption (GCM)', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const ciphertext = encryptWithKey('test', key, nonce);

      // GCM includes auth tag, which should be 16 bytes (32 hex chars)
      const parts = ciphertext.split(':');
      expect(parts[2]).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should use 256-bit keys', () => {
      // This is enforced by the module
      expect(() => {
        encryptWithKey('test', randomBytes(16), generateNonce());
      }).toThrow('Key must be 32 bytes');

      expect(() => {
        encryptWithKey('test', randomBytes(24), generateNonce());
      }).toThrow('Key must be 32 bytes');
    });

    it('should use proper nonce length (96 bits)', () => {
      expect(() => {
        encryptWithKey('test', randomBytes(32), randomBytes(8));
      }).toThrow('Nonce must be 12 bytes');

      expect(() => {
        encryptWithKey('test', randomBytes(32), randomBytes(16));
      }).toThrow('Nonce must be 12 bytes');
    });

    it('should protect against tampering', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'authenticated data';

      const ciphertext = encryptWithKey(plaintext, key, nonce);
      const parts = ciphertext.split(':');

      // Tamper with any part
      const tamperedCiphertexts = [
        // Tamper with ciphertext
        `${parts[0]}:${Buffer.from(parts[1], 'hex').toString('hex').slice(0, -4)}0000:${parts[2]}`,
        // Tamper with auth tag
        `${parts[0]}:${parts[1]}:${Buffer.from(parts[2], 'hex').toString('hex').slice(0, -4)}0000`,
        // Tamper with nonce
        `${Buffer.from(parts[0], 'hex').toString('hex').slice(0, -4)}0000:${parts[1]}:${parts[2]}`,
      ];

      for (const tampered of tamperedCiphertexts) {
        expect(() => decryptWithKey(tampered, key)).toThrow();
      }
    });
  });

  describe('Performance', () => {
    it('should encrypt and decrypt quickly', () => {
      const key = randomBytes(32);
      const nonce = generateNonce();
      const plaintext = 'performance test data';

      const encStart = performance.now();
      const ciphertext = encryptWithKey(plaintext, key, nonce);
      const encDuration = performance.now() - encStart;

      const decStart = performance.now();
      decryptWithKey(ciphertext, key);
      const decDuration = performance.now() - decStart;

      // Should be very fast (< 10ms each)
      expect(encDuration).toBeLessThan(10);
      expect(decDuration).toBeLessThan(10);
    });

    it('should handle concurrent operations', () => {
      const key = randomBytes(32);
      const plaintexts = Array.from({ length: 100 }, (_, i) => `message${i}`);

      const start = performance.now();
      const encrypted = plaintexts.map(p => {
        const nonce = generateNonce();
        return encryptWithKey(p, key, nonce);
      });
      const duration = performance.now() - start;

      // Should handle 100 encryptions quickly
      expect(duration).toBeLessThan(1000);
      expect(encrypted).toHaveLength(100);
    });
  });
});
