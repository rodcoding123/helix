import { useState, useCallback, useEffect, useMemo } from 'react';
import { SecretsClient } from '../lib/api/secrets-client';
import { useAuth } from '../lib/auth-context.tsx';
import type { UserApiKey } from '../types/secrets';
import type { CreateSecretInput } from '../lib/api/secrets-client';

/**
 * Result type for useSecretsData hook
 */
export interface SecretsDataResult {
  secrets: UserApiKey[];
  loading: boolean;
  error: string | null;
  selectedSecret: UserApiKey | null;
  setSelectedSecret: (secret: UserApiKey | null) => void;
  loadSecrets: () => Promise<void>;
  createSecret: (input: CreateSecretInput) => Promise<UserApiKey>;
  rotateSecret: (secretId: string) => Promise<UserApiKey>;
  deleteSecret: (secretId: string) => Promise<void>;
}

/**
 * Hook for managing secrets data and API calls
 *
 * Provides state management for secrets list, loading, and error states.
 * Automatically loads secrets on mount when authentication token is available.
 *
 * @returns {SecretsDataResult} Secrets data and manipulation methods
 *
 * @example
 * ```tsx
 * const { secrets, loading, error, createSecret } = useSecretsData();
 *
 * const handleCreate = async (data) => {
 *   try {
 *     const secret = await createSecret(data);
 *     console.log('Created:', secret);
 *   } catch (err) {
 *     console.error('Failed:', err);
 *   }
 * };
 * ```
 */
export function useSecretsData(): SecretsDataResult {
  const { token } = useAuth();
  const [secrets, setSecrets] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<UserApiKey | null>(null);

  // Memoize client to prevent unnecessary instantiation
  const client = useMemo(() => new SecretsClient(token || ''), [token]);

  /**
   * Load all secrets from the API
   */
  const loadSecrets = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      const data = await client.listSecrets();
      setSecrets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  }, [token, client]);

  // Load secrets on mount and when token changes
  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  /**
   * Create a new secret
   * @param {CreateSecretInput} input - Secret creation data
   * @returns {Promise<UserApiKey>} Created secret
   */
  const createSecret = useCallback(
    async (input: CreateSecretInput): Promise<UserApiKey> => {
      setError(null);
      try {
        const secret = await client.createSecret(input);
        setSecrets((prev) => [...prev, secret]);
        return secret;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create secret';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  /**
   * Rotate a secret (generate new version)
   * @param {string} secretId - ID of secret to rotate
   * @returns {Promise<UserApiKey>} Updated secret
   */
  const rotateSecret = useCallback(
    async (secretId: string): Promise<UserApiKey> => {
      setError(null);
      try {
        const updated = await client.rotateSecret(secretId);
        setSecrets((prev) =>
          prev.map((s) => (s.id === secretId ? updated : s))
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rotate secret';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  /**
   * Delete a secret
   * @param {string} secretId - ID of secret to delete
   */
  const deleteSecret = useCallback(
    async (secretId: string): Promise<void> => {
      setError(null);
      try {
        await client.deleteSecret(secretId);
        setSecrets((prev) => prev.filter((s) => s.id !== secretId));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete secret';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  return {
    secrets,
    loading,
    error,
    selectedSecret,
    setSelectedSecret,
    loadSecrets,
    createSecret,
    rotateSecret,
    deleteSecret,
  };
}
