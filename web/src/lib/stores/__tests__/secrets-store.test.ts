import { describe, it, expect, beforeEach } from 'vitest';
import { useSecretsStore } from '../secrets-store';

describe('SecretsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSecretsStore.setState({
      secrets: [],
      loading: false,
      error: null,
    });
  });

  it('should add a secret to the store', () => {
    const store = useSecretsStore.getState();
    const newSecret = {
      id: 'secret-1',
      user_id: 'user-1',
      key_name: 'API Key',
      secret_type: 'DEEPSEEK_API_KEY' as const,
      encrypted_value: 'encrypted-value',
      derivation_salt: null,
      encryption_method: 'aes-256-gcm' as const,
      key_version: 1,
      source_type: 'user-provided' as const,
      is_active: true,
      created_at: new Date().toISOString(),
      last_accessed_at: null,
      last_rotated_at: null,
      expires_at: null,
      created_by: null,
      updated_by: null,
      updated_at: new Date().toISOString(),
    };

    store.addSecret(newSecret);
    const { secrets } = useSecretsStore.getState();

    expect(secrets).toHaveLength(1);
    expect(secrets[0].id).toBe('secret-1');
  });

  it('should remove a secret by id', () => {
    const store = useSecretsStore.getState();
    const secretId = 'secret-1';

    store.addSecret({
      id: secretId,
      user_id: 'user-1',
      key_name: 'API Key',
      secret_type: 'DEEPSEEK_API_KEY' as const,
      encrypted_value: 'encrypted-value',
      derivation_salt: null,
      encryption_method: 'aes-256-gcm' as const,
      key_version: 1,
      source_type: 'user-provided' as const,
      is_active: true,
      created_at: new Date().toISOString(),
      last_accessed_at: null,
      last_rotated_at: null,
      expires_at: null,
      created_by: null,
      updated_by: null,
      updated_at: new Date().toISOString(),
    });

    store.removeSecret(secretId);
    const { secrets } = useSecretsStore.getState();

    expect(secrets).toHaveLength(0);
  });

  it('should update a secret', () => {
    const store = useSecretsStore.getState();
    const secretId = 'secret-1';

    store.addSecret({
      id: secretId,
      user_id: 'user-1',
      key_name: 'Old Name',
      secret_type: 'DEEPSEEK_API_KEY' as const,
      encrypted_value: 'encrypted-value',
      derivation_salt: null,
      encryption_method: 'aes-256-gcm' as const,
      key_version: 1,
      source_type: 'user-provided' as const,
      is_active: true,
      created_at: new Date().toISOString(),
      last_accessed_at: null,
      last_rotated_at: null,
      expires_at: null,
      created_by: null,
      updated_by: null,
      updated_at: new Date().toISOString(),
    });

    store.updateSecret(secretId, { key_name: 'New Name' });
    const { secrets } = useSecretsStore.getState();

    expect(secrets[0].key_name).toBe('New Name');
  });

  it('should set loading state', () => {
    const store = useSecretsStore.getState();

    store.setLoading(true);
    expect(useSecretsStore.getState().loading).toBe(true);

    store.setLoading(false);
    expect(useSecretsStore.getState().loading).toBe(false);
  });

  it('should set and clear error state', () => {
    const store = useSecretsStore.getState();
    const errorMessage = 'Failed to load secrets';

    store.setError(errorMessage);
    expect(useSecretsStore.getState().error).toBe(errorMessage);

    store.setError(null);
    expect(useSecretsStore.getState().error).toBeNull();
  });
});
