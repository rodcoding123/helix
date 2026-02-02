import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16; // bytes
const NONCE_LENGTH = 12; // 96 bits (standard for GCM)

/**
 * Generate random nonce for GCM mode
 * CRITICAL: Never reuse nonce with same key
 * @returns 12-byte nonce (96 bits)
 */
export async function generateNonce(): Promise<Buffer> {
  return randomBytes(NONCE_LENGTH);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - Data to encrypt (e.g., API key)
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce (must be unique per key)
 * @returns Hex string of nonce + ciphertext + authTag
 */
export async function encryptWithKey(
  plaintext: string,
  key: Buffer,
  nonce: Buffer
): Promise<string> {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes (256 bits) for AES-256');
  }

  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Nonce must be ${NONCE_LENGTH} bytes`);
  }

  const cipher = createCipheriv(ALGORITHM, key, nonce);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: nonce (hex) + ':' + ciphertext (hex) + ':' + authTag (hex)
  // This allows decryption to extract all components
  return `${nonce.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt AES-256-GCM ciphertext
 * @param ciphertext - Output from encryptWithKey (nonce:ciphertext:authTag)
 * @param key - 32-byte decryption key (same as encryption key)
 * @returns Decrypted plaintext
 * @throws If authentication tag verification fails (tampering detected)
 */
export async function decryptWithKey(
  ciphertext: string,
  key: Buffer
): Promise<string> {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes (256 bits) for AES-256');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected nonce:ciphertext:authTag');
  }

  const [nonceHex, encryptedHex, authTagHex] = parts;
  const nonce = Buffer.from(nonceHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${NONCE_LENGTH}, got ${nonce.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');

  try {
    decrypted += decipher.final('utf8');
  } catch (error) {
    throw new Error('Authentication tag verification failed - ciphertext may be tampered');
  }

  return decrypted;
}
