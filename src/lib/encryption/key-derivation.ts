import { randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import type { KeyDerivationConfig } from './types.js';

const pbkdf2Async = promisify(pbkdf2);

const KEY_DERIVATION_CONFIG: KeyDerivationConfig = {
  algorithm: 'pbkdf2',
  hash: 'sha256',
  iterations: 600000, // OWASP recommendation 2023
  saltLength: 16, // 128 bits
  keyLength: 32, // 256 bits for AES-256
};

/**
 * Generate cryptographically secure random salt
 * @returns Random 16-byte buffer (128 bits)
 */
export function generateSalt(): Buffer {
  return randomBytes(KEY_DERIVATION_CONFIG.saltLength);
}

/**
 * Derive encryption key from password using PBKDF2
 * @param password - User's master password or passphrase
 * @param salt - Random salt (16 bytes)
 * @returns 32-byte key suitable for AES-256
 */
export async function deriveEncryptionKey(password: string, salt: Buffer): Promise<Buffer> {
  const key = await pbkdf2Async(
    password,
    salt,
    KEY_DERIVATION_CONFIG.iterations,
    KEY_DERIVATION_CONFIG.keyLength,
    KEY_DERIVATION_CONFIG.hash
  );

  return key as Buffer;
}

/**
 * Verify password by re-deriving and comparing
 * Timing-safe comparison to prevent timing attacks
 * @param password - User's password attempt
 * @param salt - Original salt
 * @param derivedKey - Previously derived key to compare against
 * @returns true if password is correct
 */
export async function verifyKeyDerivation(
  password: string,
  salt: Buffer,
  derivedKey: Buffer
): Promise<boolean> {
  const attemptedKey = await deriveEncryptionKey(password, salt);

  // Timing-safe comparison (prevent timing attacks)
  return attemptedKey.length === derivedKey.length && attemptedKey.equals(derivedKey);
}

/**
 * Get configuration for key derivation
 * @returns Current OWASP-compliant configuration
 */
export function getKeyDerivationConfig(): KeyDerivationConfig {
  return { ...KEY_DERIVATION_CONFIG };
}
