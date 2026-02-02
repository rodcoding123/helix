import { describe, it, expect, beforeEach } from 'vitest';
import { encryptWithKey, decryptWithKey, generateNonce } from '../symmetric.js';
import { randomBytes } from 'crypto';

describe('Symmetric Encryption (AES-256-GCM)', () => {
  let encryptionKey: Buffer;

  beforeEach(() => {
    encryptionKey = randomBytes(32); // 256-bit key
  });

  it('should encrypt and decrypt plaintext', () => {
    const plaintext = 'sk_live_1234567890';
    const nonce = generateNonce();

    const encrypted = encryptWithKey(plaintext, encryptionKey, nonce);
    const decrypted = decryptWithKey(encrypted, encryptionKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext with different nonces', () => {
    const plaintext = 'sk_live_1234567890';

    const nonce1 = generateNonce();
    const nonce2 = generateNonce();

    const encrypted1 = encryptWithKey(plaintext, encryptionKey, nonce1);
    const encrypted2 = encryptWithKey(plaintext, encryptionKey, nonce2);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should fail decryption with wrong key', () => {
    const plaintext = 'sk_live_1234567890';
    const nonce = generateNonce();
    const wrongKey = randomBytes(32);

    const encrypted = encryptWithKey(plaintext, encryptionKey, nonce);

    expect(() => {
      decryptWithKey(encrypted, wrongKey);
    }).toThrow();
  });

  it('should detect tampering (authentication tag fails)', () => {
    const plaintext = 'sk_live_1234567890';
    const nonce = generateNonce();

    let encrypted = encryptWithKey(plaintext, encryptionKey, nonce);

    // Tamper with ciphertext component specifically
    const parts = encrypted.split(':');
    const ciphertextBuffer = Buffer.from(parts[1], 'hex');
    ciphertextBuffer[0] = ciphertextBuffer[0] ^ 0xff; // Flip bits in ciphertext
    parts[1] = ciphertextBuffer.toString('hex');
    encrypted = parts.join(':');

    expect(() => {
      decryptWithKey(encrypted, encryptionKey);
    }).toThrow();
  });

  it('should generate unique nonces', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    const nonce3 = generateNonce();

    expect(nonce1).not.toEqual(nonce2);
    expect(nonce2).not.toEqual(nonce3);
    expect(nonce1).not.toEqual(nonce3);
  });
});

describe('Input Validation', () => {
  it('should throw for invalid key length', () => {
    const shortKey = randomBytes(16); // 128-bit, not 256-bit
    const nonce = generateNonce();
    const plaintext = 'test';

    expect(() => {
      encryptWithKey(plaintext, shortKey, nonce);
    }).toThrow('Key must be 32 bytes');
  });

  it('should throw for invalid nonce length', () => {
    const invalidNonce = randomBytes(8); // 64-bit, not 96-bit
    const key = randomBytes(32);

    expect(() => {
      encryptWithKey('test', key, invalidNonce);
    }).toThrow('Nonce must be 12 bytes');
  });

  it('should throw for invalid ciphertext format', () => {
    const key = randomBytes(32);

    expect(() => {
      decryptWithKey('invalid:format', key);
    }).toThrow('Invalid');
  });

  it('should encrypt and decrypt empty string', () => {
    const plaintext = '';
    const nonce = generateNonce();
    const encryptionKey = randomBytes(32);

    const encrypted = encryptWithKey(plaintext, encryptionKey, nonce);
    const decrypted = decryptWithKey(encrypted, encryptionKey);

    expect(decrypted).toBe('');
  });
});
