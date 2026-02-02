import { useState, useCallback, useEffect, useMemo } from 'react';
import { SecretsClient } from '../lib/api/secrets-client';
import { useAuth } from '../lib/auth-context.tsx';
import type { UserApiKey } from '../types/secrets';
import type { CreateSecretInput } from '../lib/api/secrets-client';

export function useSecretsData() {
  const { token } = useAuth();
  const [secrets, setSecrets] = useState<UserApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<UserApiKey | null>(null);

  const client = useMemo(() => new SecretsClient(token || ''), [token]);

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
  }, [token]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const createSecret = useCallback(
    async (input: CreateSecretInput) => {
      setError(null);
      try {
        const secret = await client.createSecret(input);
        setSecrets((prev) => [...prev, secret]);
        return secret;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create secret');
        throw err;
      }
    },
    []
  );

  const rotateSecret = useCallback(
    async (secretId: string) => {
      setError(null);
      try {
        const updated = await client.rotateSecret(secretId);
        setSecrets((prev) =>
          prev.map((s) => (s.id === secretId ? updated : s))
        );
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rotate secret');
        throw err;
      }
    },
    []
  );

  const deleteSecret = useCallback(
    async (secretId: string) => {
      setError(null);
      try {
        await client.deleteSecret(secretId);
        setSecrets((prev) => prev.filter((s) => s.id !== secretId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete secret');
        throw err;
      }
    },
    []
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
  } as SecretsDataResult;
}

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
