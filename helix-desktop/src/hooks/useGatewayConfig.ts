/**
 * Hook that syncs gateway config with the config store.
 * Fetches config on gateway connect, applies patches on settings changes.
 *
 * The gateway (helix-runtime) owns openclaw.json as the authoritative config.
 * This hook reads from it via `config.get` and writes via `config.patch`.
 * Desktop-only settings (window position, tray, privacy) stay in localStorage.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGateway } from './useGateway';
import { useConfigStore, type GatewayConfig } from '../stores/configStore';

export function useGatewayConfig() {
  const { getClient, connected } = useGateway();
  const setGatewayConfig = useConfigStore((s) => s.setGatewayConfig);
  const setGatewayConfigError = useConfigStore((s) => s.setGatewayConfigError);
  const gatewayConfig = useConfigStore((s) => s.gatewayConfig);
  const gatewayConfigLoaded = useConfigStore((s) => s.gatewayConfigLoaded);
  const gatewayConfigError = useConfigStore((s) => s.gatewayConfigError);

  // Track whether we already fetched for the current connection
  const fetchedRef = useRef(false);

  // Fetch config from gateway
  const fetchConfig = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      const result = (await client.getConfig()) as {
        config: Record<string, unknown>;
        hash?: string;
      };

      const raw = result.config ?? {};
      const config: GatewayConfig = {
        agents: raw.agents as GatewayConfig['agents'],
        channels: raw.channels as GatewayConfig['channels'],
        tools: raw.tools as GatewayConfig['tools'],
        skills: raw.skills as GatewayConfig['skills'],
        session: raw.session as GatewayConfig['session'],
        messages: raw.messages as GatewayConfig['messages'],
        _hash: result.hash,
        _raw: raw,
      };

      setGatewayConfig(config);
    } catch (err) {
      setGatewayConfigError(
        err instanceof Error ? err.message : String(err)
      );
    }
  }, [getClient, setGatewayConfig, setGatewayConfigError]);

  // Patch config on the gateway (optimistic concurrency via baseHash)
  const patchGatewayConfig = useCallback(
    async (patch: Record<string, unknown>) => {
      const client = getClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }

      const result = (await client.patchConfig({
        patch,
        baseHash: gatewayConfig._hash,
      })) as { hash?: string };

      // Refetch to get the full updated config and new hash
      await fetchConfig();
      return result;
    },
    [getClient, gatewayConfig._hash, fetchConfig]
  );

  // Auto-fetch when gateway connects
  useEffect(() => {
    if (connected && !fetchedRef.current) {
      fetchedRef.current = true;
      void fetchConfig();
    }

    if (!connected) {
      fetchedRef.current = false;
    }
  }, [connected, fetchConfig]);

  return {
    gatewayConfig,
    gatewayConfigLoaded,
    gatewayConfigError,
    fetchConfig,
    patchGatewayConfig,
  };
}
