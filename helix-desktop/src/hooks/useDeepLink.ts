/**
 * Deep Link hook for Helix Desktop (Phase J, Task J1)
 *
 * Listens for `helix://` deep link URLs from the Tauri backend and
 * translates them into React Router navigations.
 *
 * Supported URL patterns:
 * - `helix://chat?message=...`         Navigate to chat, optionally pre-fill message
 * - `helix://settings/:section`        Navigate to a specific settings section
 * - `helix://approve/:requestId`       Open exec approval dialog for a request
 * - `helix://agent/:agentId`           Navigate to agent detail view
 * - `helix://skill/:skillId`           Navigate to skill detail
 * - `helix://device/:deviceId`         Navigate to device detail
 * - `helix://node/:nodeId`             Navigate to node detail
 *
 * Usage:
 * ```tsx
 * function AppLayout() {
 *   const { lastDeepLink } = useDeepLink();
 *   // Navigation is handled automatically by the hook
 * }
 * ```
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { listen, invoke } from '../lib/tauri-compat';
import type { UnlistenFn } from '../lib/tauri-compat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The category of deep link action, derived from the URL host/path. */
export type DeepLinkActionType =
  | 'chat'
  | 'settings'
  | 'approve'
  | 'agent'
  | 'skill'
  | 'device'
  | 'node';

/** A parsed deep link action ready for the frontend to consume. */
export interface DeepLinkAction {
  /** Identifies which view / workflow should be activated. */
  type: DeepLinkActionType;
  /** Key-value params extracted from the URL path segments and query string. */
  params: Record<string, string>;
  /** The original URL string as received from the backend. */
  raw: string;
}

/** Return type of the `useDeepLink` hook. */
export interface UseDeepLinkReturn {
  /** The most recently received (and still unconsumed) deep link, or null. */
  lastDeepLink: DeepLinkAction | null;
  /** Clear the current deep link so it is not re-processed. */
  clearDeepLink: () => void;
}

// ---------------------------------------------------------------------------
// Supported action types for validation
// ---------------------------------------------------------------------------

const VALID_ACTION_TYPES = new Set<string>([
  'chat',
  'settings',
  'approve',
  'agent',
  'skill',
  'device',
  'node',
]);

// ---------------------------------------------------------------------------
// URL Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a `helix://` URL into a {@link DeepLinkAction}.
 *
 * The URL is expected to follow the pattern:
 *   `helix://<action>[/<id>][?key=value&...]`
 *
 * For example:
 *   - `helix://chat?message=hello`         -> type=chat, params={message:'hello'}
 *   - `helix://settings/agents`            -> type=settings, params={section:'agents'}
 *   - `helix://approve/req_abc123`         -> type=approve, params={requestId:'req_abc123'}
 *   - `helix://agent/my-agent`             -> type=agent, params={agentId:'my-agent'}
 *   - `helix://skill/summarize`            -> type=skill, params={skillId:'summarize'}
 *   - `helix://device/dev_abc`             -> type=device, params={deviceId:'dev_abc'}
 *   - `helix://node/node_xyz`              -> type=node, params={nodeId:'node_xyz'}
 *
 * Returns `null` for malformed or unsupported URLs.
 */
function parseDeepLink(raw: string): DeepLinkAction | null {
  // Guard: must be a helix:// URL
  if (!raw.startsWith('helix://')) {
    console.warn('[deep-link] Ignoring non-helix URL:', raw);
    return null;
  }

  // Use a try/catch because `new URL` can throw on truly malformed input.
  // The `helix://` scheme is non-standard, so we normalise to `http://` for
  // the URL parser and then read the pathname + search params.
  let url: URL;
  try {
    url = new URL(raw.replace('helix://', 'http://'));
  } catch {
    console.warn('[deep-link] Malformed URL:', raw);
    return null;
  }

  // The "hostname" is the action type  (e.g. "chat", "settings")
  const actionStr = url.hostname;
  if (!actionStr || !VALID_ACTION_TYPES.has(actionStr)) {
    console.warn('[deep-link] Unknown action type:', actionStr, 'in URL:', raw);
    return null;
  }

  const type = actionStr as DeepLinkActionType;

  // Collect query-string params
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  // Extract the first meaningful path segment (after leading `/`)
  const pathSegments = url.pathname
    .split('/')
    .filter((s) => s.length > 0);

  const firstSegment = pathSegments[0] ?? '';

  // Map path segment to a named param based on action type
  switch (type) {
    case 'chat':
      // No path segment expected; message comes from query string
      break;

    case 'settings':
      if (firstSegment) {
        params.section = firstSegment;
      }
      break;

    case 'approve':
      if (firstSegment) {
        params.requestId = firstSegment;
      }
      break;

    case 'agent':
      if (firstSegment) {
        params.agentId = firstSegment;
      }
      break;

    case 'skill':
      if (firstSegment) {
        params.skillId = firstSegment;
      }
      break;

    case 'device':
      if (firstSegment) {
        params.deviceId = firstSegment;
      }
      break;

    case 'node':
      if (firstSegment) {
        params.nodeId = firstSegment;
      }
      break;
  }

  return { type, params, raw };
}

// ---------------------------------------------------------------------------
// Navigation mapping
// ---------------------------------------------------------------------------

/**
 * Translate a parsed {@link DeepLinkAction} into a React Router path and
 * optional location state.
 *
 * Returns `{ path, state }` where `state` can carry extra data (e.g. the
 * pre-filled chat message) that the target route can read from
 * `useLocation().state`.
 */
function actionToRoute(action: DeepLinkAction): {
  path: string;
  state?: Record<string, unknown>;
} {
  switch (action.type) {
    case 'chat': {
      const state: Record<string, unknown> = {};
      if (action.params.message) {
        state.prefillMessage = action.params.message;
      }
      return { path: '/chat', state };
    }

    case 'settings': {
      const section = action.params.section;
      return { path: section ? `/settings/${section}` : '/settings' };
    }

    case 'approve': {
      // Navigate to chat with approval dialog state
      const state: Record<string, unknown> = {};
      if (action.params.requestId) {
        state.approveRequestId = action.params.requestId;
      }
      return { path: '/chat', state };
    }

    case 'agent': {
      // Navigate to agents settings section with the selected agent
      const state: Record<string, unknown> = {};
      if (action.params.agentId) {
        state.selectedAgentId = action.params.agentId;
      }
      return { path: '/settings/agents', state };
    }

    case 'skill': {
      // Navigate to skills page with the selected skill
      const state: Record<string, unknown> = {};
      if (action.params.skillId) {
        state.selectedSkillId = action.params.skillId;
      }
      return { path: '/skills', state };
    }

    case 'device': {
      // Navigate to orchestrator with device focus
      const state: Record<string, unknown> = {};
      if (action.params.deviceId) {
        state.selectedDeviceId = action.params.deviceId;
      }
      return { path: '/orchestrator', state };
    }

    case 'node': {
      // Navigate to orchestrator with node focus
      const state: Record<string, unknown> = {};
      if (action.params.nodeId) {
        state.selectedNodeId = action.params.nodeId;
      }
      return { path: '/orchestrator', state };
    }

    default:
      return { path: '/chat' };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook that listens for `helix://` deep link events from the Tauri
 * backend and automatically navigates to the corresponding route.
 *
 * Should be mounted once at the app root level (e.g. inside `AppLayout`).
 *
 * @returns The most recent deep link action and a function to clear it.
 */
export function useDeepLink(): UseDeepLinkReturn {
  const navigate = useNavigate();
  const [lastDeepLink, setLastDeepLink] = useState<DeepLinkAction | null>(null);
  const navigateRef = useRef(navigate);

  // Keep navigate ref fresh to avoid re-subscribing on every render
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  /**
   * Process a deep link action: update state and navigate.
   */
  const handleDeepLinkAction = useCallback((action: DeepLinkAction) => {
    console.log('[deep-link] Processing action:', action.type, action.params);
    setLastDeepLink(action);

    const { path, state } = actionToRoute(action);
    navigateRef.current(path, { state });
  }, []);

  /**
   * Clear the current deep link (call after the target view has consumed it).
   */
  const clearDeepLink = useCallback(() => {
    setLastDeepLink(null);
  }, []);

  // ------- Listen for deep-link events from Tauri -------
  useEffect(() => {
    let unlistenFn: UnlistenFn | undefined;

    const setup = async () => {
      unlistenFn = await listen<string>('deep-link', (event) => {
        const action = parseDeepLink(event.payload);
        if (action) {
          handleDeepLinkAction(action);
        }
      });
    };

    setup().catch((err) => {
      console.warn('[deep-link] Failed to register event listener:', err);
    });

    return () => {
      unlistenFn?.();
    };
  }, [handleDeepLinkAction]);

  // ------- Check for cold-start deep link on mount -------
  useEffect(() => {
    const checkLaunchUrl = async () => {
      try {
        const launchUrl = await invoke<string | null>('get_launch_deep_link');
        if (launchUrl) {
          console.log('[deep-link] App launched via deep link:', launchUrl);
          const action = parseDeepLink(launchUrl);
          if (action) {
            handleDeepLinkAction(action);
          }
        }
      } catch (err) {
        // Not critical - the app may have been launched normally
        console.debug('[deep-link] No launch deep link:', err);
      }
    };

    checkLaunchUrl();
  }, []);

  return { lastDeepLink, clearDeepLink };
}
