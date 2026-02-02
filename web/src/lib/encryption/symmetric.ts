/**
 * Symmetric encryption module for secrets
 * Uses AES-256-GCM for authenticated encryption
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Generate a cryptographically secure nonce for AES-GCM
 * AES-GCM requires 12 bytes (96 bits)
 */
export async function generateNonce(): Promise<Buffer> {
  return randomBytes(12);
}

/**
 * Encrypt data using AES-256-GCM with a given key
 *
 * @param plaintext - Data to encrypt
 * @param encryptionKey - 32-byte AES-256 key
 * @param nonce - 12-byte nonce for GCM mode
 * @returns Encrypted data as hex string: "nonce:iv:ciphertext:authTag"
 */
export async function encryptWithKey(
  plaintext: string,
  encryptionKey: Buffer,
  nonce: Buffer
): Promise<string> {
  if (encryptionKey.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)');
  }

  if (nonce.length !== 12) {
    throw new Error('Nonce must be 12 bytes (96 bits)');
  }

  const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Return as: nonce:ciphertext:authTag
  return `${nonce.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param encryptedData - Encrypted data as hex string: "nonce:ciphertext:authTag"
 * @param encryptionKey - 32-byte AES-256 key
 * @returns Plaintext as UTF-8 string
 */
export async function decryptWithKey(
  encryptedData: string,
  encryptionKey: Buffer
): Promise<string> {
  if (encryptionKey.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [nonceHex, ciphertext, authTagHex] = parts;
  const nonce = Buffer.from(nonceHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (nonce.length !== 12) {
    throw new Error('Invalid nonce length in encrypted data');
  }

  if (authTag.length !== 16) {
    throw new Error('Invalid authentication tag length');
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, nonce);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
