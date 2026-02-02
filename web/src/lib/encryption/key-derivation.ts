/**
 * Key derivation module for secrets
 * Uses PBKDF2-SHA256 to derive encryption keys from passwords and nonces
 */

import { pbkdf2 } from 'crypto';

/**
 * Derive an AES-256 encryption key from a password using PBKDF2-SHA256
 *
 * @param password - Password to derive key from (typically "userId:secretType")
 * @param salt - Random salt as Buffer (typically the nonce)
 * @param iterations - PBKDF2 iterations (default: 100000)
 * @returns 32-byte AES-256 key
 */
export async function deriveEncryptionKey(
  password: string,
  salt: Buffer,
  iterations: number = 100000
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, 32, 'sha256', (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Derive multiple keys from a single password (for key hierarchy)
 *
 * @param password - Master password
 * @param salt - Random salt
 * @param keyCount - Number of keys to derive
 * @param iterations - PBKDF2 iterations
 * @returns Array of derived keys
 */
export async function deriveMultipleKeys(
  password: string,
  salt: Buffer,
  keyCount: number,
  iterations: number = 100000
): Promise<Buffer[]> {
  const keys: Buffer[] = [];

  for (let i = 0; i < keyCount; i++) {
    // Create a unique password for each key by appending the index
    const indexedPassword = `${password}:key:${i}`;
    const key = await deriveEncryptionKey(indexedPassword, salt, iterations);
    keys.push(key);
  }

  return keys;
}
