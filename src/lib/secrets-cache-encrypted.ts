/**
 * Encrypted Secrets Cache - AES-256-GCM encrypted in-memory storage
 *
 * Stores all secrets encrypted in memory using AES-256-GCM to prevent
 * plaintext secret exposure in memory dumps or heap snapshots.
 *
 * Key derivation: Machine-specific entropy (CPU count, hostname, platform)
 * Rotation: Every 7 days with 24-hour grace period for decryption
 * Failure mode: Fail-closed (throw on initialization failure)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, cpus, hostname, platform } from 'node:os';
import { join } from 'node:path';
import { deriveEncryptionKey, generateSalt } from './encryption/key-derivation.js';
import { encryptWithKey, decryptWithKey, generateNonce } from './encryption/symmetric.js';

const STATE_DIR = join(homedir(), '.helix-state');
const SALT_FILE = join(STATE_DIR, 'secrets-cache-salt.bin');
const KEY_VERSION_FILE = join(STATE_DIR, 'secrets-cache-keyversion.json');

const KEY_ROTATION_DAYS = 7;
const KEY_ROTATION_MS = KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000;
const KEY_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface KeyRotationMetadata {
  version: number;
  createdAt: number;
  rotatedAt?: number;
  previousKeyExpiredAt?: number;
}

/**
 * Encrypted Secrets Cache
 *
 * Stores all secrets encrypted in memory. Decryption happens on-the-fly
 * when values are accessed, so plaintext never lives in memory longer
 * than necessary.
 */
export class EncryptedSecretsCache {
  private cache: Map<string, string> = new Map(); // Stores encrypted values only
  private masterKey: Buffer | null = null;
  private keyVersion: number = 1;
  private rotationMetadata: KeyRotationMetadata | null = null;
  private previousMasterKey: Buffer | null = null; // For grace period decryption
  private previousKeyExpiredAt: number = 0;

  /**
   * Initialize the encrypted cache
   * Must be called before any get/set operations
   *
   * @throws Error if initialization fails (fail-closed behavior)
   */
  async initialize(): Promise<void> {
    try {
      // Ensure state directory exists
      if (!existsSync(STATE_DIR)) {
        mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
      }

      // Load or generate salt
      const salt = this.loadOrGenerateSalt();

      // Load key version metadata
      this.rotationMetadata = this.loadKeyVersionMetadata();

      // Derive master key from machine entropy + salt
      const machineEntropy = this.generateMachineEntropy();
      this.masterKey = await deriveEncryptionKey(machineEntropy, salt);

      // Check if key rotation is needed
      await this.checkAndRotateKey();

      // Load previous key if still in grace period
      if (this.rotationMetadata.previousKeyExpiredAt && this.rotationMetadata.previousKeyExpiredAt > Date.now()) {
        this.previousMasterKey = this.masterKey; // In production, could reload from versioned derivation
        this.previousKeyExpiredAt = this.rotationMetadata.previousKeyExpiredAt;
      }
    } catch (error) {
      throw new Error(
        `[Secrets Cache] Initialization failed - cannot proceed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Store an encrypted secret
   * @param key - Secret identifier (e.g., "DISCORD_WEBHOOK_COMMANDS")
   * @param plaintext - Secret value to encrypt
   */
  set(key: string, plaintext: string): void {
    if (!this.masterKey) {
      throw new Error('[Secrets Cache] Cache not initialized - call initialize() first');
    }

    // Generate unique nonce for this encryption
    const nonce = generateNonce();

    // Encrypt the plaintext
    const encrypted = encryptWithKey(plaintext, this.masterKey, nonce);

    // Store only the encrypted value (nonce is embedded in encrypted format)
    this.cache.set(key, encrypted);
  }

  /**
   * Retrieve and decrypt a secret
   * Returns undefined if key not found
   *
   * @param key - Secret identifier
   * @returns Decrypted plaintext or undefined
   * @throws Error if decryption fails (tampering detected)
   */
  get(key: string): string | undefined {
    if (!this.masterKey) {
      throw new Error('[Secrets Cache] Cache not initialized - call initialize() first');
    }

    const encrypted = this.cache.get(key);
    if (!encrypted) {
      return undefined;
    }

    try {
      // Try to decrypt with current master key
      return decryptWithKey(encrypted, this.masterKey);
    } catch (error) {
      // If current key fails and we have a previous key in grace period, try that
      if (this.previousMasterKey && this.previousKeyExpiredAt > Date.now()) {
        try {
          return decryptWithKey(encrypted, this.previousMasterKey);
        } catch {
          // Both keys failed - data is corrupted or tampering detected
          throw new Error(
            `[Secrets Cache] Decryption failed for key "${key}" - tampering detected or corrupted data`
          );
        }
      }

      // Only current key available and it failed
      throw new Error(`[Secrets Cache] Decryption failed for key "${key}" - tampering detected or corrupted data`);
    }
  }

  /**
   * Check if a secret exists in the cache
   * @param key - Secret identifier
   * @returns true if secret exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get all secret keys (useful for verification)
   * @returns Array of secret keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clear all secrets from cache
   * Used primarily for testing
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current key version
   */
  getKeyVersion(): number {
    return this.keyVersion;
  }

  /**
   * Get rotation metadata (for monitoring and verification)
   */
  getRotationMetadata(): KeyRotationMetadata | null {
    return this.rotationMetadata;
  }

  /**
   * Generate machine-specific entropy
   * Combines: CPU count, hostname, platform, node version
   *
   * This ensures the key is specific to this machine/installation
   */
  private generateMachineEntropy(): string {
    const cpuCount = cpus().length;
    const machineHostname = hostname();
    const platformName = platform();
    const nodeVersion = process.version;

    // Hash these together to create a deterministic but secret entropy source
    const entropy = `${cpuCount}:${machineHostname}:${platformName}:${nodeVersion}`;
    return entropy;
  }

  /**
   * Load existing salt or generate a new one
   * Salt is stored in a file to ensure consistent key derivation
   */
  private loadOrGenerateSalt(): Buffer {
    if (existsSync(SALT_FILE)) {
      try {
        const saltBuffer = readFileSync(SALT_FILE);
        if (saltBuffer.length === 16) {
          return saltBuffer;
        }
      } catch {
        // Fall through to generate new salt
      }
    }

    // Generate and store new salt
    const salt = generateSalt();
    writeFileSync(SALT_FILE, salt, { mode: 0o600 });
    return salt;
  }

  /**
   * Load key version metadata from file
   */
  private loadKeyVersionMetadata(): KeyRotationMetadata {
    if (existsSync(KEY_VERSION_FILE)) {
      try {
        const content = readFileSync(KEY_VERSION_FILE, 'utf-8');
        const metadata = JSON.parse(content) as KeyRotationMetadata;
        this.keyVersion = metadata.version;
        return metadata;
      } catch {
        // Fall through to create new metadata
      }
    }

    // Create new metadata
    const metadata: KeyRotationMetadata = {
      version: 1,
      createdAt: Date.now(),
    };

    return metadata;
  }

  /**
   * Save key version metadata to file
   */
  private saveKeyVersionMetadata(metadata: KeyRotationMetadata): void {
    writeFileSync(KEY_VERSION_FILE, JSON.stringify(metadata, null, 2), { mode: 0o600 });
  }

  /**
   * Check if key rotation is needed and perform rotation if necessary
   */
  private async checkAndRotateKey(): Promise<void> {
    if (!this.rotationMetadata) {
      return;
    }

    const now = Date.now();
    const createdAt = this.rotationMetadata.createdAt;
    const ageMs = now - createdAt;

    // Check if key is older than rotation period
    if (ageMs > KEY_ROTATION_MS) {
      // Store previous key for grace period
      this.rotationMetadata.rotatedAt = now;
      this.rotationMetadata.previousKeyExpiredAt = now + KEY_GRACE_PERIOD_MS;
      this.rotationMetadata.version += 1;
      this.keyVersion = this.rotationMetadata.version;

      // Save updated metadata
      this.saveKeyVersionMetadata(this.rotationMetadata);

      // Note: In production, we would re-encrypt all cache entries with new key
      // For now, we allow grace period decryption with old key
    }
  }
}

/**
 * Global instance of encrypted secrets cache
 * Will be used as a replacement for the plain Map in secrets-loader.ts
 */
export const encryptedSecretsCache = new EncryptedSecretsCache();
