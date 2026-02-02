import { describe, it, expect, beforeEach } from 'vitest';
import { encryptWithKey, decryptWithKey, generateNonce } from '../symmetric.js';
import { randomBytes } from 'crypto';

describe('Symmetric Encryption (AES-256-GCM)', () => {
  let encryptionKey: Buffer;

  beforeEach(() => {
    encryptionKey = randomBytes(32); // 256-bit key
  });

  it('should encrypt and decrypt plaintext', async () => {
    const plaintext = 'sk_live_1234567890';
    const nonce = await generateNonce();

    const encrypted = await encryptWithKey(plaintext, encryptionKey, nonce);
    const decrypted = await decryptWithKey(encrypted, encryptionKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same plaintext with different nonces', async () => {
    const plaintext = 'sk_live_1234567890';

    const nonce1 = await generateNonce();
    const nonce2 = await generateNonce();

    const encrypted1 = await encryptWithKey(plaintext, encryptionKey, nonce1);
    const encrypted2 = await encryptWithKey(plaintext, encryptionKey, nonce2);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should fail decryption with wrong key', async () => {
    const plaintext = 'sk_live_1234567890';
    const nonce = await generateNonce();
    const wrongKey = randomBytes(32);

    const encrypted = await encryptWithKey(plaintext, encryptionKey, nonce);

    await expect(async () => {
      await decryptWithKey(encrypted, wrongKey);
    }).rejects.toThrow();
  });

  it('should detect tampering (authentication tag fails)', async () => {
    const plaintext = 'sk_live_1234567890';
    const nonce = await generateNonce();

    let encrypted = await encryptWithKey(plaintext, encryptionKey, nonce);

    // Tamper with ciphertext component specifically
    const parts = encrypted.split(':');
    const ciphertextBuffer = Buffer.from(parts[1], 'hex');
    ciphertextBuffer[0] = ciphertextBuffer[0] ^ 0xff; // Flip bits in ciphertext
    parts[1] = ciphertextBuffer.toString('hex');
    encrypted = parts.join(':');

    await expect(async () => {
      await decryptWithKey(encrypted, encryptionKey);
    }).rejects.toThrow();
  });

  it('should generate unique nonces', async () => {
    const nonce1 = await generateNonce();
    const nonce2 = await generateNonce();
    const nonce3 = await generateNonce();

    expect(nonce1).not.toEqual(nonce2);
    expect(nonce2).not.toEqual(nonce3);
    expect(nonce1).not.toEqual(nonce3);
  });
});

describe('Input Validation', () => {
  it('should throw for invalid key length', async () => {
    const shortKey = randomBytes(16); // 128-bit, not 256-bit
    const nonce = await generateNonce();
    const plaintext = 'test';

    await expect(async () => {
      await encryptWithKey(plaintext, shortKey, nonce);
    }).rejects.toThrow('Key must be 32 bytes');
  });

  it('should throw for invalid nonce length', async () => {
    const invalidNonce = randomBytes(8); // 64-bit, not 96-bit
    const key = randomBytes(32);

    await expect(async () => {
      await encryptWithKey('test', key, invalidNonce);
    }).rejects.toThrow('Nonce must be 12 bytes');
  });

  it('should throw for invalid ciphertext format', async () => {
    const key = randomBytes(32);

    await expect(async () => {
      await decryptWithKey('invalid:format', key);
    }).rejects.toThrow('Invalid');
  });

  it('should encrypt and decrypt empty string', async () => {
    const plaintext = '';
    const nonce = await generateNonce();
    const encryptionKey = randomBytes(32);

    const encrypted = await encryptWithKey(plaintext, encryptionKey, nonce);
    const decrypted = await decryptWithKey(encrypted, encryptionKey);

    expect(decrypted).toBe('');
  });
});
