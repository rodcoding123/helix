import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecretsClient } from '../secrets-client';
import type { UserApiKey } from '../../../types/secrets';

describe('SecretsClient', () => {
  let client: SecretsClient;
  const mockToken = 'test-token-123';
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    name: 'Stripe Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'manual' as const,
    created_at: new Date(),
    expires_at: null,
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
  };

  beforeEach(() => {
    client = new SecretsClient(mockToken);
    globalThis.fetch = vi.fn();
  });

  it('should fetch all secrets', async () => {
    const mockResponse = { secrets: [mockSecret] };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await client.listSecrets();

    expect(result).toEqual([mockSecret]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/secrets', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': `Bearer ${mockToken}`,
      }),
    }));
  });

  it('should create a new secret', async () => {
    const newSecret = {
      name: 'New Key',
      secret_type: 'GEMINI_API_KEY' as const,
      expires_at: undefined,
    };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSecret,
    } as Response);

    const result = await client.createSecret(newSecret);

    expect(result).toEqual(mockSecret);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/secrets', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(newSecret),
    }));
  });

  it('should rotate a secret', async () => {
    const updatedSecret = { ...mockSecret, key_version: 2 };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => updatedSecret,
    } as Response);

    const result = await client.rotateSecret('secret-1');

    expect(result.key_version).toBe(2);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/secrets/secret-1/rotate', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('should delete a secret', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await client.deleteSecret('secret-1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/secrets/secret-1', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('should handle 401 unauthorized error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response);

    await expect(client.listSecrets()).rejects.toThrow('Unauthorized');
  });
});
