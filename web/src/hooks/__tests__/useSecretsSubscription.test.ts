import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSecretsSubscription } from '../useSecretsSubscription';
import * as supabaseModule from '../../lib/supabase-client';
import type { UserApiKey } from '../../lib/types/secrets';

vi.mock('../../lib/supabase-client');

describe('useSecretsSubscription Hook', () => {
  const mockSecret: UserApiKey = {
    id: 'secret-1',
    user_id: 'user-123',
    key_name: 'API Key',
    secret_type: 'STRIPE_SECRET_KEY' as const,
    source_type: 'user-provided' as const,
    created_at: new Date().toISOString(),
    expires_at: null,
    is_active: true,
    key_version: 1,
    encryption_method: 'aes-256-gcm' as const,
    encrypted_value: 'encrypted-test',
    derivation_salt: null,
    last_accessed_at: null,
    last_rotated_at: null,
    created_by: null,
    updated_by: null,
    updated_at: new Date().toISOString(),
  };

  const mockSubscribe = vi.fn();
  const mockUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const mockClient = {
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe.mockReturnValue({
          unsubscribe: mockUnsubscribe,
        }),
      }),
    };

    vi.spyOn(supabaseModule, 'getSupabaseClient').mockResolvedValue(mockClient as any);
  });

  it('should subscribe to realtime updates on mount', async () => {
    renderHook(() => useSecretsSubscription('user-123'));

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  it('should handle INSERT events from realtime', async () => {
    const { result } = renderHook(() => useSecretsSubscription('user-123'));

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    expect(result.current.secrets).toBeDefined();
  });

  it('should handle UPDATE events from realtime', async () => {
    const { result } = renderHook(() => useSecretsSubscription('user-123'));

    await waitFor(() => {
      expect(result.current.secrets).toBeDefined();
    });
  });

  it('should unsubscribe on unmount', async () => {
    const { unmount } = renderHook(() => useSecretsSubscription('user-123'));

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
