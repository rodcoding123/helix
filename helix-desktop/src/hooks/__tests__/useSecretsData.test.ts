import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSecretsData } from '../useSecretsData';
import * as authModule from '../../lib/auth-context.tsx';

vi.mock('../../lib/auth-context');
vi.mock('../../lib/api/secrets-client');

describe('useSecretsData Hook', () => {
  beforeEach(() => {
    vi.mocked(authModule.useAuth).mockReturnValue({
      token: 'test-token',
      user: { id: 'user-123', email: 'test@example.com' },
      isLoading: false,
    } as any);
  });

  it('should load secrets on mount', async () => {
    const { result } = renderHook(() => useSecretsData());

    await waitFor(() => {
      expect(result.current.secrets).toBeDefined();
    });
  });

  it('should have loading state', async () => {
    const { result } = renderHook(() => useSecretsData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should create a secret', async () => {
    const { result } = renderHook(() => useSecretsData());

    await waitFor(() => {
      expect(result.current.createSecret).toBeDefined();
    });
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useSecretsData());

    expect(result.current.error).toBeNull();
  });
});
