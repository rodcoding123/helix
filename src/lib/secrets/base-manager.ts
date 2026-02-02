import {
  SecretType,
  SecretSourceType,
  SecretMetadata,
  StoredSecretData,
  SecretsManager,
  SecretLoadOptions,
} from './types';

/**
 * In-memory secrets manager for testing and base implementation
 * Production will extend this with database backend
 */
export class BaseSecretsManager implements SecretsManager {
  private userId: string;
  private storage: Map<SecretType, StoredSecretData> = new Map();

  constructor(userId: string) {
    this.userId = userId;
  }

  async loadSecret(
    type: SecretType,
    options?: SecretLoadOptions
  ): Promise<string | null> {
    const stored = this.storage.get(type);

    if (!stored) {
      return null;
    }

    // Update last accessed time
    stored.metadata.lastAccessedAt = new Date();

    // In real implementation, decrypt encryptedValue
    // For now, return plaintext (testing only)
    return stored.encryptedValue;
  }

  async loadAllSecrets(options?: SecretLoadOptions): Promise<Map<SecretType, string>> {
    const result = new Map<SecretType, string>();

    this.storage.forEach((data, type) => {
      const stored = this.storage.get(type);
      if (stored) {
        // Update last accessed time
        stored.metadata.lastAccessedAt = new Date();
        result.set(type, stored.encryptedValue);
      }
    });

    return result;
  }

  async storeSecret(
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

    return metadata;
  }

  async deleteSecret(type: SecretType): Promise<void> {
    this.storage.delete(type);
  }

  async rotateSecret(
    type: SecretType,
    newValue: string,
    expiresAt?: Date
  ): Promise<SecretMetadata> {
    const existing = this.storage.get(type);

    if (!existing) {
      throw new Error(`Secret ${type} does not exist`);
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

    return metadata;
  }

  async getMetadata(type: SecretType): Promise<SecretMetadata | null> {
    const stored = this.storage.get(type);
    return stored?.metadata || null;
  }

  async validateSecret(type: SecretType): Promise<boolean> {
    const stored = this.storage.get(type);

    if (!stored) {
      return false;
    }

    // Check if expired
    if (stored.metadata.expiresAt && new Date() > stored.metadata.expiresAt) {
      return false;
    }

    return stored.metadata.isActive;
  }
}
