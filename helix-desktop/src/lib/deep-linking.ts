/**
 * Deep Linking System for Helix Desktop
 * Implements helix:// URI scheme handler
 */
import { invoke } from '@tauri-apps/api/core';
import { appWindow } from '@tauri-apps/api/window';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

export interface DeepLink {
  action: string;
  path?: string;
  params: Record<string, string>;
  fullUrl: string;
}

export type DeepLinkHandlerFn = (link: DeepLink) => Promise<void>;

export interface DeepLinkHandler {
  pattern: RegExp;
  handler: DeepLinkHandlerFn;
  priority: number;
}

class DeepLinkRegistry {
  private handlers: DeepLinkHandler[] = [];

  register(pattern: RegExp | string, handler: DeepLinkHandlerFn, priority = 0): void {
    const patternRegex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    this.handlers.push({ pattern: patternRegex, handler, priority });
    this.handlers.sort((a, b) => b.priority - a.priority);
  }

  async handle(link: DeepLink): Promise<boolean> {
    const key = link.path ? `${link.action}/${link.path}` : link.action;
    for (const handler of this.handlers) {
      if (handler.pattern.test(key)) {
        try {
          await handler.handler(link);
          return true;
        } catch (err) {
          console.error('[deep-link] Handler error:', err);
          return false;
        }
      }
    }
    console.warn('[deep-link] No handler for:', key);
    return false;
  }
}

const registry = new DeepLinkRegistry();

export function parseDeepLink(url: string): DeepLink | null {
  try {
    const cleanUrl = url.startsWith('helix://') ? url.slice(8) : url;
    const [pathPart, queryPart] = cleanUrl.split('?');
    const [action, ...pathSegments] = pathPart.split('/').filter(Boolean);

    if (!action) {
      console.warn('[deep-link] No action in URL:', url);
      return null;
    }

    const params: Record<string, string> = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((value, key) => {
        params[key] = value;
      });
    }

    return {
      action,
      path: pathSegments.length > 0 ? pathSegments.join('/') : undefined,
      params,
      fullUrl: url,
    };
  } catch (err) {
    console.error('[deep-link] Parse error:', err);
    return null;
  }
}

export function registerChatHandler(onNavigate: (sessionId: string) => Promise<void>): void {
  registry.register(/^chat\//, async (link) => {
    const sessionId = link.path;
    if (sessionId) {
      await onNavigate(sessionId);
    }
  }, 100);
}

export function registerDeviceHandler(
  onPair: (code: string) => Promise<void>,
  onDetail: (deviceId: string) => Promise<void>
): void {
  registry.register(/^device\/pair/, async (link) => {
    const code = link.params.code;
    if (code) {
      await onPair(code);
    }
  }, 100);

  registry.register(/^device\/detail/, async (link) => {
    const deviceId = link.path?.replace('detail/', '');
    if (deviceId) {
      await onDetail(deviceId);
    }
  }, 100);
}

export function registerOAuthHandler(
  onCallback: (code: string, state?: string) => Promise<void>
): void {
  registry.register(/^oauth\/callback/, async (link) => {
    const code = link.params.code;
    if (code) {
      await onCallback(code, link.params.state);
    }
  }, 100);
}

export function registerApprovalHandler(
  onResolve: (requestId: string, decision: 'approve' | 'deny') => Promise<void>
): void {
  registry.register(/^approval\//, async (link) => {
    const requestId = link.path;
    const decision = link.params.decision as 'approve' | 'deny';
    if (requestId && decision) {
      await onResolve(requestId, decision);
    }
  }, 100);
}

export function registerSettingsHandler(
  onNavigate: (path: string) => Promise<void>
): void {
  registry.register(/^settings\//, async (link) => {
    if (link.path) {
      await onNavigate(link.path);
    }
  }, 100);
}

export function registerSynthesisHandler(
  onNavigate: (synthesisType: string) => Promise<void>
): void {
  registry.register(/^synthesis\//, async (link) => {
    const synthesisType = link.path;
    if (synthesisType) {
      await onNavigate(synthesisType);
    }
  }, 100);
}

export async function initializeDeepLinking(): Promise<void> {
  try {
    await registerURIScheme();
    const unlisten = await appWindow.listen<string>('deep-link', async (event) => {
      const url = event.payload;
      console.log('[deep-link] Received:', url);
      const link = parseDeepLink(url);
      if (link) {
        await handleDeepLink(link);
      }
    });
    console.log('[deep-link] Initialized and listening');
    return unlisten;
  } catch (err) {
    console.error('[deep-link] Initialization error:', err);
  }
}

export async function handleDeepLink(link: DeepLink): Promise<void> {
  console.log('[deep-link] Handling:', link.action, link.path);
  try {
    await appWindow.setFocus();
  } catch {
    // Window focus may not be available
  }
  const success = await registry.handle(link);
  if (!success) {
    console.warn('[deep-link] No handler matched for:', link.action);
  }
}

export function generateDeepLink(
  action: string,
  path?: string,
  params?: Record<string, string>
): string {
  let uri = `helix://${action}`;
  if (path) {
    uri += `/${path}`;
  }
  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    uri += `?${queryString}`;
  }
  return uri;
}

export function generateSessionLink(sessionId: string, sessionName?: string): string {
  const params: Record<string, string> = {};
  if (sessionName) {
    params.name = sessionName;
  }
  return generateDeepLink('chat', sessionId, params);
}

export function generatePairingLink(code: string): string {
  return generateDeepLink('device', 'pair', { code });
}

export function generateApprovalLink(requestId: string, decision: 'approve' | 'deny'): string {
  return generateDeepLink('approval', requestId, { decision });
}

export function generateSettingsLink(section: string, subsection?: string): string {
  const path = subsection ? `${section}/${subsection}` : section;
  return generateDeepLink('settings', path);
}

export async function copyDeepLinkToClipboard(uri: string): Promise<void> {
  try {
    await writeText(uri);
    console.log('[deep-link] Copied to clipboard:', uri);
  } catch (err) {
    console.error('[deep-link] Clipboard error:', err);
    throw err;
  }
}

export async function copySessionLinkToClipboard(sessionId: string, sessionName?: string): Promise<void> {
  const link = generateSessionLink(sessionId, sessionName);
  await copyDeepLinkToClipboard(link);
}

async function registerURIScheme(): Promise<void> {
  try {
    console.log('[deep-link] URI scheme registered (via tauri.conf.json)');
  } catch (err) {
    console.error('[deep-link] URI scheme registration error:', err);
  }
}

export { registry as DeepLinkRegistry };
