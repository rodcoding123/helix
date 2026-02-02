import { describe, it, expect, beforeEach } from 'vitest';
import { BaseSecretsManager } from './base-manager';
import { SecretType, SecretSourceType } from './types';

describe('BaseSecretsManager', () => {
  let manager: BaseSecretsManager;

  beforeEach(() => {
    manager = new BaseSecretsManager('user-123');
  });

  it('should store and retrieve a secret', async () => {
    const secretValue = 'sk_live_test123';

    await manager.storeSecret(
      SecretType.STRIPE_SECRET_KEY,
      secretValue,
      SecretSourceType.USER_PROVIDED
    );

    const retrieved = await manager.loadSecret(SecretType.STRIPE_SECRET_KEY);

    expect(retrieved).toBe(secretValue);
  });

  it('should return null for non-existent secret', async () => {
    const result = await manager.loadSecret(SecretType.GEMINI_API_KEY);

    expect(result).toBeNull();
  });

  it('should track metadata including creation time', async () => {
    const secretValue = 'AIzaSy_test123';
    const beforeTime = new Date();

    const metadata = await manager.storeSecret(
      SecretType.GEMINI_API_KEY,
      secretValue,
      SecretSourceType.USER_PROVIDED
    );

    expect(metadata.userId).toBe('user-123');
    expect(metadata.secretType).toBe(SecretType.GEMINI_API_KEY);
    expect(metadata.sourceType).toBe(SecretSourceType.USER_PROVIDED);
    expect(metadata.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
  });

  it('should update lastAccessedAt when loading secret', async () => {
    const secretValue = 'test-key';

    await manager.storeSecret(
      SecretType.DEEPSEEK_API_KEY,
      secretValue,
      SecretSourceType.USER_PROVIDED
    );

    const metadataBefore = await manager.getMetadata(SecretType.DEEPSEEK_API_KEY);
    expect(metadataBefore?.lastAccessedAt).toBeNull();

    await manager.loadSecret(SecretType.DEEPSEEK_API_KEY);

    const metadataAfter = await manager.getMetadata(SecretType.DEEPSEEK_API_KEY);
    expect(metadataAfter?.lastAccessedAt).not.toBeNull();
  });

  it('should rotate secrets with new values', async () => {
    const originalValue = 'original-key';
    const newValue = 'rotated-key';

    await manager.storeSecret(
      SecretType.STRIPE_SECRET_KEY,
      originalValue,
      SecretSourceType.USER_PROVIDED
    );

    const rotationMetadata = await manager.rotateSecret(
      SecretType.STRIPE_SECRET_KEY,
      newValue
    );

    const retrieved = await manager.loadSecret(SecretType.STRIPE_SECRET_KEY);

    expect(retrieved).toBe(newValue);
    expect(rotationMetadata.lastRotatedAt).not.toBeNull();
  });

  it('should handle expiration dates', async () => {
    const secretValue = 'temporary-key';
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const metadata = await manager.storeSecret(
      SecretType.GEMINI_API_KEY,
      secretValue,
      SecretSourceType.USER_PROVIDED,
      futureDate
    );

    expect(metadata.expiresAt).toEqual(futureDate);
  });

  it('should load all secrets as a map', async () => {
    await manager.storeSecret(
      SecretType.STRIPE_SECRET_KEY,
      'sk_live_123',
      SecretSourceType.USER_PROVIDED
    );

    await manager.storeSecret(
      SecretType.DEEPSEEK_API_KEY,
      'sk-456',
      SecretSourceType.USER_PROVIDED
    );

    const allSecrets = await manager.loadAllSecrets();

    expect(allSecrets.has(SecretType.STRIPE_SECRET_KEY)).toBe(true);
    expect(allSecrets.has(SecretType.DEEPSEEK_API_KEY)).toBe(true);
    expect(allSecrets.get(SecretType.STRIPE_SECRET_KEY)).toBe('sk_live_123');
  });

  it('should delete secrets', async () => {
    await manager.storeSecret(
      SecretType.GEMINI_API_KEY,
      'test-key',
      SecretSourceType.USER_PROVIDED
    );

    await manager.deleteSecret(SecretType.GEMINI_API_KEY);

    const retrieved = await manager.loadSecret(SecretType.GEMINI_API_KEY);

    expect(retrieved).toBeNull();
  });
});
