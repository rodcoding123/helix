import { describe, it, expect } from 'vitest';
import { deriveEncryptionKey, generateSalt, verifyKeyDerivation } from '../key-derivation.js';

describe('Key Derivation', () => {
  it('should derive same key from same password and salt', async () => {
    const password = 'test-password-123';
    const salt = await generateSalt();

    const key1 = await deriveEncryptionKey(password, salt);
    const key2 = await deriveEncryptionKey(password, salt);

    expect(key1).toEqual(key2);
  });

  it('should derive different key from different password', async () => {
    const salt = await generateSalt();

    const key1 = await deriveEncryptionKey('password1', salt);
    const key2 = await deriveEncryptionKey('password2', salt);

    expect(key1).not.toEqual(key2);
  });

  it('should produce 32-byte keys for AES-256', async () => {
    const password = 'test-password';
    const salt = await generateSalt();

    const key = await deriveEncryptionKey(password, salt);

    expect(key.byteLength).toBe(32); // 256 bits = 32 bytes
  });

  it('should generate salt of sufficient length', async () => {
    const salt = await generateSalt();

    expect(salt.byteLength).toBe(16); // 128 bits for PBKDF2
  });

  it('should verify correct password', async () => {
    const password = 'test-password';
    const salt = await generateSalt();

    const derivedKey = await deriveEncryptionKey(password, salt);
    const isValid = await verifyKeyDerivation(password, salt, derivedKey);

    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'test-password';
    const wrongPassword = 'wrong-password';
    const salt = await generateSalt();

    const derivedKey = await deriveEncryptionKey(password, salt);
    const isValid = await verifyKeyDerivation(wrongPassword, salt, derivedKey);

    expect(isValid).toBe(false);
  });
});
