/**
 * Configuration management hook for Helix Desktop
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../lib/tauri-compat';

export interface DiscordWebhooks {
  commands?: string;
  api?: string;
  heartbeat?: string;
  file_changes?: string;
  consciousness?: string;
  alerts?: string;
  hash_chain?: string;
}

export interface DiscordConfig {
  enabled: boolean;
  webhooks: DiscordWebhooks;
  heartbeat_interval: number;
}

export interface PsychologyConfig {
  enabled: boolean;
  auto_load: boolean;
  layers: string[];
}

export interface HashChainConfig {
  enabled: boolean;
  auto_verify: boolean;
  alert_on_tamper: boolean;
}

export interface BrandingConfig {
  name: string;
  tagline: string;
}

export interface HelixConfig {
  agents: Record<string, unknown>;
  models: Record<string, unknown>;
  discord: DiscordConfig;
  psychology: PsychologyConfig;
  hash_chain: HashChainConfig;
  branding: BrandingConfig;
}

export function useConfig() {
  const [config, setConfig] = useState<HelixConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<HelixConfig>('get_config');
      setConfig(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: HelixConfig) => {
    try {
      await invoke('set_config', { config: newConfig });
      setConfig(newConfig);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  const updateConfig = useCallback(async (updates: Partial<HelixConfig>) => {
    if (!config) {
      throw new Error('Config not loaded');
    }

    const newConfig = { ...config, ...updates };
    await saveConfig(newConfig);
  }, [config, saveConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
    updateConfig,
  };
}
