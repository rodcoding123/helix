import { SupabaseClient } from '@supabase/supabase-js';
import { BaseSecretsManager } from './base-manager.js';
import { SecretType, SecretSourceType, SecretMetadata, SecretLoadOptions } from './types.js';
import { encryptWithKey, generateNonce, decryptWithKey } from '../encryption/symmetric.js';
import { deriveEncryptionKey } from '../encryption/key-derivation.js';

interface UserApiKey {
  id: string;
  user_id: string;
  key_name: string;
  secret_type: SecretType;
  encrypted_value: string;
  derivation_salt: string;
  encryption_method: string;
  key_version: number;
  source_type: SecretSourceType;
  is_active: boolean;
  created_at: string;
  created_by: string;
  last_accessed_at: string | null;
  last_rotated_at: string | null;
  expires_at: string | null;
}

/**
 * Database-backed secrets manager with encryption
 * - Stores encrypted secrets in Supabase
 * - Audits all access
 * - Supports per-user isolation via RLS
 */
export class DatabaseSecretsManager extends BaseSecretsManager {
  constructor(
    userId: string,
    private supabase: SupabaseClient
  ) {
    super(userId);
  }

  async loadSecret(type: SecretType, _options?: SecretLoadOptions): Promise<string | null> {
    try {
      // Query database for secret
      const { data: secret, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', this.userId)
        .eq('secret_type', type)
        .eq('is_active', true)
        .single();

      if (error || !secret) {
        console.warn(`Secret ${type} not found for user ${this.userId}`);
        return null;
      }

      const userApiKey = secret as UserApiKey;

      // Check expiration
      if (userApiKey.expires_at) {
        const expiresAt = new Date(userApiKey.expires_at);
        if (new Date() > expiresAt) {
          console.warn(`Secret ${type} has expired`);
          return null;
        }
      }

      // Log access
      await this.logAccess(userApiKey.id, 'read', `loading_${type}`, true);

      // Decrypt if encrypted
      if (userApiKey.encryption_method === 'aes-256-gcm') {
        const decrypted = await this.decryptSecretValue(
          userApiKey.encrypted_value,
          userApiKey.derivation_salt || ''
        );
        return decrypted;
      }

      return userApiKey.encrypted_value;
    } catch (error) {
      console.error('Error loading secret:', error);
      await this.logAccess(null, 'read', `loading_${type}`, false, String(error));
      return null;
    }
  }

  async storeSecret(
    type: SecretType,
    value: string,
    sourceType: SecretSourceType,
    expiresAt?: Date
  ): Promise<SecretMetadata> {
    const nonce = await generateNonce();
    const encryptionKey = await deriveEncryptionKey(`${this.userId}:${type}`, nonce);

    const encryptedValue = await encryptWithKey(value, encryptionKey, nonce);

    const { data: inserted, error } = await this.supabase
      .from('user_api_keys')
      .insert({
        user_id: this.userId,
        key_name: type,
        secret_type: type,
        encrypted_value: encryptedValue,
        derivation_salt: nonce.toString('hex'),
        encryption_method: 'aes-256-gcm',
        key_version: 1,
        source_type: sourceType,
        is_active: true,
        created_by: this.userId,
        expires_at: expiresAt?.toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store secret: ${error.message}`);
    }

    const insertedData = inserted as UserApiKey;

    const metadata: SecretMetadata = {
      id: insertedData.id,
      userId: this.userId,
      secretType: type,
      sourceType,
      createdAt: new Date(insertedData.created_at),
      lastAccessedAt: null,
      lastRotatedAt: null,
      expiresAt: expiresAt || null,
      isActive: true,
    };

    await this.logAccess(insertedData.id, 'create', `storing_${type}`, true);

    return metadata;
  }

  /**
   * Decrypt secret value using derivation salt
   * Salt is stored alongside encrypted data
   * Key is derived from: userId:secretType + salt
   */
  private async decryptSecretValue(encryptedValue: string, saltHex: string): Promise<string> {
    const salt = Buffer.from(saltHex, 'hex');
    const key = await deriveEncryptionKey(`${this.userId}`, salt);
    return await decryptWithKey(encryptedValue, key);
  }

  async loadAllSecrets(_options?: SecretLoadOptions): Promise<Map<SecretType, string>> {
    const result = new Map<SecretType, string>();

    try {
      const { data: secrets, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_active', true);

      if (error || !secrets) {
        console.warn(`Failed to load secrets for user ${this.userId}`);
        return result;
      }

      for (const secret of secrets) {
        const apiKey = secret as UserApiKey;

        // Check expiration
        if (apiKey.expires_at) {
          const expiresAt = new Date(apiKey.expires_at);
          if (new Date() > expiresAt) {
            continue;
          }
        }

        // Decrypt if encrypted
        let value: string;
        if (apiKey.encryption_method === 'aes-256-gcm') {
          try {
            value = await this.decryptSecretValue(
              apiKey.encrypted_value,
              apiKey.derivation_salt || ''
            );
          } catch (error) {
            console.error(`Failed to decrypt secret ${apiKey.secret_type}:`, error);
            continue;
          }
        } else {
          value = apiKey.encrypted_value;
        }

        result.set(apiKey.secret_type, value);
        await this.logAccess(apiKey.id, 'list', `loading_all_${apiKey.secret_type}`, true);
      }
    } catch (error) {
      console.error('Error loading all secrets:', error);
    }

    return result;
  }

  async deleteSecret(type: SecretType): Promise<void> {
    try {
      const { data: secret } = await this.supabase
        .from('user_api_keys')
        .select('id')
        .eq('user_id', this.userId)
        .eq('secret_type', type)
        .single();

      if (!secret) {
        throw new Error(`Secret ${type} not found`);
      }

      const secretRecord = secret as UserApiKey;

      const { error } = await this.supabase
        .from('user_api_keys')
        .update({ is_active: false })
        .eq('id', secretRecord.id);

      if (error) {
        throw new Error(`Failed to delete secret: ${error.message}`);
      }

      await this.logAccess(secretRecord.id, 'delete', `deleting_${type}`, true);
    } catch (error) {
      console.error('Error deleting secret:', error);
      await this.logAccess(null, 'delete', `deleting_${type}`, false, String(error));
      throw error;
    }
  }

  async rotateSecret(
    type: SecretType,
    newValue: string,
    expiresAt?: Date
  ): Promise<SecretMetadata> {
    try {
      const { data: existing } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', this.userId)
        .eq('secret_type', type)
        .eq('is_active', true)
        .single();

      if (!existing) {
        throw new Error(`Secret ${type} not found. Store the secret first using storeSecret().`);
      }

      const existingData = existing as UserApiKey;

      // Create new encrypted value
      const nonce = await generateNonce();
      const encryptionKey = await deriveEncryptionKey(`${this.userId}:${type}`, nonce);
      const encryptedValue = await encryptWithKey(newValue, encryptionKey, nonce);

      // Update the secret
      const { data: updated, error } = await this.supabase
        .from('user_api_keys')
        .update({
          encrypted_value: encryptedValue,
          derivation_salt: nonce.toString('hex'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingData.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to rotate secret: ${error.message}`);
      }

      const updatedData = updated as UserApiKey;

      const metadata: SecretMetadata = {
        id: updatedData.id,
        userId: this.userId,
        secretType: type,
        sourceType: existingData.source_type,
        createdAt: new Date(updatedData.created_at),
        lastAccessedAt: updatedData.last_accessed_at
          ? new Date(updatedData.last_accessed_at)
          : null,
        lastRotatedAt: new Date(),
        expiresAt: expiresAt || null,
        isActive: true,
      };

      await this.logAccess(existingData.id, 'rotate', `rotating_${type}`, true);

      return metadata;
    } catch (error) {
      console.error('Error rotating secret:', error);
      await this.logAccess(null, 'rotate', `rotating_${type}`, false, String(error));
      throw error;
    }
  }

  async getMetadata(type: SecretType): Promise<SecretMetadata | null> {
    try {
      const { data: secret, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', this.userId)
        .eq('secret_type', type)
        .eq('is_active', true)
        .single();

      if (error || !secret) {
        return null;
      }

      const secretData = secret as UserApiKey;

      return {
        id: secretData.id,
        userId: this.userId,
        secretType: type,
        sourceType: secretData.source_type,
        createdAt: new Date(secretData.created_at),
        lastAccessedAt: secretData.last_accessed_at ? new Date(secretData.last_accessed_at) : null,
        lastRotatedAt: secretData.last_rotated_at ? new Date(secretData.last_rotated_at) : null,
        expiresAt: secretData.expires_at ? new Date(secretData.expires_at) : null,
        isActive: secretData.is_active,
      };
    } catch (error) {
      console.error('Error getting metadata:', error);
      return null;
    }
  }

  async validateSecret(type: SecretType): Promise<boolean> {
    try {
      const { data: secret, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', this.userId)
        .eq('secret_type', type)
        .eq('is_active', true)
        .single();

      if (error || !secret) {
        return false;
      }

      const secretData = secret as UserApiKey;

      // Check if expired
      if (secretData.expires_at && new Date() > new Date(secretData.expires_at)) {
        return false;
      }

      return secretData.is_active;
    } catch (error) {
      console.error('Error validating secret:', error);
      return false;
    }
  }

  /**
   * Log secret access to audit table
   */
  private async logAccess(
    secretId: string | null,
    action: 'read' | 'create' | 'update' | 'rotate' | 'delete' | 'list',
    context: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase.from('api_key_access_audit').insert({
        user_id: this.userId,
        secret_id: secretId,
        action,
        context,
        success,
        error_message: errorMessage,
        source: 'api',
      });
    } catch (error) {
      console.error('Failed to log access:', error);
      // Don't throw - audit logging shouldn't break main operations
    }
  }
}
