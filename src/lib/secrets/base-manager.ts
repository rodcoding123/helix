import {
  SecretType,
  SecretSourceType,
  SecretMetadata,
  StoredSecretData,
  SecretsManager,
  SecretLoadOptions,
} from './types.js';

/**
 * In-memory secrets manager for testing and base implementation.
 *
 * WARNING: Does NOT encrypt secrets - stores plaintext in memory.
 * Production implementations MUST extend this with proper encryption.
 *
 * @example
 * const manager = new BaseSecretsManager('user-123');
 * await manager.storeSecret(SecretType.STRIPE_SECRET_KEY, 'sk_live_...', SecretSourceType.USER_PROVIDED);
 */
export class BaseSecretsManager implements SecretsManager {
  protected userId: string;
  private storage: Map<SecretType, StoredSecretData> = new Map();

  constructor(userId: string) {
    this.userId = userId;
  }

  loadSecret(type: SecretType, _options?: SecretLoadOptions): Promise<string | null> {
    const stored = this.storage.get(type);

    if (!stored) {
      return Promise.resolve(null);
    }

    // Update last accessed time
    stored.metadata.lastAccessedAt = new Date();

    // In real implementation, decrypt encryptedValue
    // For now, return plaintext (testing only)
    return Promise.resolve(stored.encryptedValue);
  }

  loadAllSecrets(_options?: SecretLoadOptions): Promise<Map<SecretType, string>> {
    const result = new Map<SecretType, string>();

    this.storage.forEach((_data, type) => {
      const stored = this.storage.get(type);
      if (stored) {
        // Update last accessed time
        stored.metadata.lastAccessedAt = new Date();
        result.set(type, stored.encryptedValue);
      }
    });

    return Promise.resolve(result);
  }

  storeSecret(
    type: SecretType,
    value: string,
    sourceType: SecretSourceType,
    expiresAt?: Date
  ): Promise<SecretMetadata> {
    const metadata: SecretMetadata = {
      id: `secret-${type}-${Date.now()}`,
      userId: this.userId,
      secretType: type,
      sourceType,
      createdAt: new Date(),
      lastAccessedAt: null,
      lastRotatedAt: null,
      expiresAt: expiresAt || null,
      isActive: true,
    };

    const stored: StoredSecretData = {
      metadata,
      encryptedValue: value,
      derivationSalt: '',
    };

    this.storage.set(type, stored);

    return Promise.resolve(metadata);
  }

  deleteSecret(type: SecretType): Promise<void> {
    this.storage.delete(type);
    return Promise.resolve();
  }

  rotateSecret(type: SecretType, newValue: string, expiresAt?: Date): Promise<SecretMetadata> {
    const existing = this.storage.get(type);

    if (!existing) {
      return Promise.reject(
        new Error(
          `Cannot rotate secret: ${type} does not exist. Store the secret first using storeSecret().`
        )
      );
    }

    const metadata: SecretMetadata = {
      ...existing.metadata,
      lastRotatedAt: new Date(),
      expiresAt: expiresAt || null,
    };

    this.storage.set(type, {
      metadata,
      encryptedValue: newValue,
      derivationSalt: existing.derivationSalt,
    });

    return Promise.resolve(metadata);
  }

  getMetadata(type: SecretType): Promise<SecretMetadata | null> {
    const stored = this.storage.get(type);
    return Promise.resolve(stored?.metadata || null);
  }

  validateSecret(type: SecretType): Promise<boolean> {
    const stored = this.storage.get(type);

    if (!stored) {
      return Promise.resolve(false);
    }

    // Check if expired
    if (stored.metadata.expiresAt && new Date() > stored.metadata.expiresAt) {
      return Promise.resolve(false);
    }

    return Promise.resolve(stored.metadata.isActive);
  }
}
