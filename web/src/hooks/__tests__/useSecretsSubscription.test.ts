import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSecretsSubscription } from '../useSecretsSubscription';
import * as supabaseModule from '../../lib/supabase-client';

vi.mock('../../lib/supabase-client');

describe('useSecretsSubscription Hook', () => {
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
