/**
 * Tray Sync Hook
 *
 * Watches gateway status, agents, channels, and pending approvals,
 * then pushes live state to the native system tray menu via Tauri IPC.
 *
 * Also listens for tray menu events (new-chat, settings, approvals, etc.)
 * and dispatches navigation/actions accordingly.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke, listen, isTauri } from '../lib/tauri-compat';
import { useGateway } from './useGateway';
import { useConfigStore } from '../stores/configStore';
import { ROUTES } from '../routes';
import { getGatewayClient } from '../lib/gateway-client';

/** How often (ms) we push a full tray state refresh regardless of changes. */
const POLL_INTERVAL_MS = 30_000;

/**
 * Derive tray-compatible tuples from gateway config.
 */
function deriveAgents(
  gatewayConfig: ReturnType<typeof useConfigStore.getState>['gatewayConfig']
): Array<[string, string]> {
  const list = gatewayConfig?.agents?.list;
  if (!Array.isArray(list)) return [];
  return list.map((a) => [a.name ?? a.id, 'active'] as [string, string]);
}

function deriveChannels(
  gatewayConfig: ReturnType<typeof useConfigStore.getState>['gatewayConfig']
): Array<[string, string]> {
  const channels = gatewayConfig?.channels;
  if (!channels || typeof channels !== 'object') return [];
  return Object.entries(channels).map(([name, cfg]) => {
    const status = cfg?.enabled ? 'connected' : 'disconnected';
    return [name, status] as [string, string];
  });
}

export function useTraySync() {
  const navigate = useNavigate();
  const { status: gatewayStatus } = useGateway();
  const gatewayConfig = useConfigStore((s) => s.gatewayConfig);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  // Push current state to the tray menu
  const pushTrayState = useCallback(() => {
    if (!isTauri) return;

    const agents = deriveAgents(gatewayConfig);
    const channels = deriveChannels(gatewayConfig);

    invoke('update_tray_menu', {
      gatewayStatus: gatewayStatus.running ? 'running' : 'stopped',
      agents,
      channels,
      pendingApprovals,
    }).catch((err: unknown) => {
      // Tray update is best-effort; don't crash if it fails
      console.debug('[tray-sync] update failed:', err);
    });
  }, [gatewayStatus.running, gatewayConfig, pendingApprovals]);

  // Subscribe to approval events and fetch initial count
  useEffect(() => {
    const client = getGatewayClient();
    if (!client?.connected) return;

    // Fetch initial pending approvals count
    client
      .request('exec.approval.snapshot', {})
      .then((result: unknown) => {
        const snapshot = result as { pending?: unknown[] } | null;
        if (snapshot?.pending && Array.isArray(snapshot.pending)) {
          setPendingApprovals(snapshot.pending.length);
        }
      })
      .catch((err: unknown) => {
        console.debug('[tray-sync] Failed to fetch initial approvals:', err);
      });

    // Subscribe to approval request events
    const handleApprovalRequested = () => {
      setPendingApprovals((prev) => prev + 1);
    };

    const handleApprovalResolved = () => {
      setPendingApprovals((prev) => Math.max(0, prev - 1));
    };

    client.on('exec.approval.requested', handleApprovalRequested);
    client.on('exec.approval.resolved', handleApprovalResolved);

    return () => {
      client.off('exec.approval.requested', handleApprovalRequested);
      client.off('exec.approval.resolved', handleApprovalResolved);
    };
  }, []);

  // Push on every meaningful state change
  useEffect(() => {
    pushTrayState();
  }, [pushTrayState]);

  // Periodic refresh as a safety net
  useEffect(() => {
    if (!isTauri) return;

    timerRef.current = setInterval(pushTrayState, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pushTrayState]);

  // Listen for tray menu events emitted by the Rust backend
  useEffect(() => {
    if (!isTauri) return;

    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      unlisteners.push(
        await listen('tray:new-chat', () => {
          navigate(ROUTES.CHAT);
        })
      );

      unlisteners.push(
        await listen('tray:open-settings', () => {
          navigate(ROUTES.SETTINGS);
        })
      );

      unlisteners.push(
        await listen('tray:open-approvals', () => {
          navigate(ROUTES.SECURITY);
        })
      );

      unlisteners.push(
        await listen('tray:toggle-talk-mode', () => {
          navigate(ROUTES.VOICE);
        })
      );

      unlisteners.push(
        await listen('tray:restart-gateway', () => {
          // Emit a restart via Tauri command
          invoke('stop_gateway')
            .then(() => invoke('start_gateway'))
            .catch((err: unknown) => {
              console.error('[tray-sync] gateway restart failed:', err);
            });
        })
      );
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [navigate]);
}
