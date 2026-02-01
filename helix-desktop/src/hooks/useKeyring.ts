/**
 * Secure credential storage hook for Helix Desktop
 */

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const KEYRING_KEYS = {
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  OPENAI_API_KEY: 'openai_api_key',
  GOOGLE_API_KEY: 'google_api_key',
  DISCORD_WEBHOOK_COMMANDS: 'discord_webhook_commands',
  DISCORD_WEBHOOK_API: 'discord_webhook_api',
  DISCORD_WEBHOOK_HEARTBEAT: 'discord_webhook_heartbeat',
  DISCORD_WEBHOOK_ALERTS: 'discord_webhook_alerts',
  SUPABASE_KEY: 'supabase_key',
} as const;

export type KeyringKey = typeof KEYRING_KEYS[keyof typeof KEYRING_KEYS];

export function useKeyring() {
  const storeSecret = useCallback(async (key: KeyringKey, value: string) => {
    await invoke('store_secret', { key, value });
  }, []);

  const getSecret = useCallback(async (key: KeyringKey): Promise<string | null> => {
    return await invoke<string | null>('get_secret', { key });
  }, []);

  const deleteSecret = useCallback(async (key: KeyringKey) => {
    await invoke('delete_secret', { key });
  }, []);

  const hasSecret = useCallback(async (key: KeyringKey): Promise<boolean> => {
    return await invoke<boolean>('has_secret', { key });
  }, []);

  // Convenience methods for common keys
  const setApiKey = useCallback(async (provider: 'anthropic' | 'openai' | 'google', value: string) => {
    const keyMap = {
      anthropic: KEYRING_KEYS.ANTHROPIC_API_KEY,
      openai: KEYRING_KEYS.OPENAI_API_KEY,
      google: KEYRING_KEYS.GOOGLE_API_KEY,
    };
    await storeSecret(keyMap[provider], value);
  }, [storeSecret]);

  const getApiKey = useCallback(async (provider: 'anthropic' | 'openai' | 'google'): Promise<string | null> => {
    const keyMap = {
      anthropic: KEYRING_KEYS.ANTHROPIC_API_KEY,
      openai: KEYRING_KEYS.OPENAI_API_KEY,
      google: KEYRING_KEYS.GOOGLE_API_KEY,
    };
    return await getSecret(keyMap[provider]);
  }, [getSecret]);

  return {
    storeSecret,
    getSecret,
    deleteSecret,
    hasSecret,
    setApiKey,
    getApiKey,
  };
}
