import { useEffect } from 'react';
import { useSecretsStore } from '../lib/stores/secrets-store';
import { getSupabaseClient } from '../lib/supabase-client';
import { TABLES, CHANNELS } from '../lib/supabase-client';
import type { UserApiKey } from '../lib/types/secrets';

/**
 * Hook for subscribing to real-time secret updates via Supabase
 * Listens for INSERT, UPDATE, and DELETE events on the user_api_keys table
 * Automatically updates the secrets store
 */
export function useSecretsSubscription(userId: string) {
  const store = useSecretsStore();

  useEffect(() => {
    let subscription: any = null;

    const setupSubscription = async () => {
      const client = await getSupabaseClient();
      if (!client) {
        console.warn('Supabase client not available for subscriptions');
        return;
      }

      try {
        // Subscribe to real-time changes on user_api_keys table
        subscription = client
          .channel(CHANNELS.SESSION_CHANGES)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: TABLES.SESSIONS,
              filter: `user_id=eq.${userId}`,
            },
            (payload: any) => {
              const { eventType, new: newRecord, old: oldRecord } = payload;

              if (eventType === 'INSERT') {
                const secret = newRecord as UserApiKey;
                store.addSecret(secret);
              } else if (eventType === 'UPDATE') {
                const secret = newRecord as UserApiKey;
                store.updateSecret(secret.id, secret);
              } else if (eventType === 'DELETE') {
                const secret = oldRecord as UserApiKey;
                store.removeSecret(secret.id);
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log('Connected to real-time updates');
            } else if (status === 'CLOSED') {
              console.log('Real-time subscription closed');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('Real-time channel error');
            }
          });
      } catch (err) {
        console.error('Failed to setup real-time subscriptions:', err);
      }
    };

    setupSubscription();

    // Cleanup on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [userId, store]);

  return store;
}
