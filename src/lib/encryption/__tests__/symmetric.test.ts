import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptWithKey,
  decryptWithKey,
  generateNonce,
} from '../symmetric';
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

    // Tamper with ciphertext
    const buffer = Buffer.from(encrypted, 'hex');
    buffer[10] = buffer[10] ^ 0xff; // Flip bits
    encrypted = buffer.toString('hex');

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
