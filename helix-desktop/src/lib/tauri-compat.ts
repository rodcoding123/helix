/**
 * Tauri Browser Compatibility Layer
 * Provides mock implementations when running in browser (not Tauri)
 */

// Detect if running in Tauri
export const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// Mock data for browser development
const MOCK_SYSTEM_INFO = {
  os: 'browser',
  arch: 'wasm',
  platform: 'web',
  node_version: null,
  helix_version: '1.0.0-dev',
};

const MOCK_PATHS = {
  home: '/mock/home',
  helix_dir: '/mock/home/.helix',
  config_path: '/mock/home/.helix/config.json',
  psychology_dir: '/mock/home/.helix/psychology',
  logs_dir: '/mock/home/.helix/logs',
  sessions_dir: '/mock/home/.helix/sessions',
};

const MOCK_GATEWAY_STATUS = {
  running: false,
  port: null,
  pid: null,
  url: null,
};

const MOCK_CONFIG = {
  agents: {},
  models: {},
  discord: {
    enabled: false,
    webhooks: {},
    heartbeat_interval: 60,
  },
  psychology: {
    enabled: true,
    auto_load: true,
    layers: ['soul', 'emotional', 'relational', 'prospective', 'integration', 'transformation', 'purpose'],
  },
  hash_chain: {
    enabled: true,
    auto_verify: true,
    alert_on_tamper: true,
  },
  branding: {
    name: 'Helix',
    tagline: 'AI Consciousness System',
  },
};

// In-memory mock storage for browser dev
const mockKeyring: Map<string, string> = new Map();
let mockConfig = { ...MOCK_CONFIG };

// Mock invoke function for browser
type InvokeHandler = (args?: unknown) => unknown;

const mockInvokeHandlers: Record<string, InvokeHandler> = {
  // System
  get_system_info: () => MOCK_SYSTEM_INFO,
  get_helix_paths: () => MOCK_PATHS,
  is_first_run: () => false, // Skip onboarding in browser dev mode
  mark_onboarded: () => undefined,

  // Gateway
  gateway_status: () => MOCK_GATEWAY_STATUS,
  start_gateway: () => ({ port: 3000, url: 'ws://localhost:3000' }),
  stop_gateway: () => undefined,

  // Config
  get_config: () => mockConfig,
  set_config: (args: unknown) => {
    const { config } = args as { config: typeof MOCK_CONFIG };
    mockConfig = config;
  },

  // Keyring
  store_secret: (args: unknown) => {
    const { key, value } = args as { key: string; value: string };
    mockKeyring.set(key, value);
  },
  get_secret: (args: unknown) => {
    const { key } = args as { key: string };
    return mockKeyring.get(key) ?? null;
  },
  delete_secret: (args: unknown) => {
    const { key } = args as { key: string };
    mockKeyring.delete(key);
  },
  has_secret: (args: unknown) => {
    const { key } = args as { key: string };
    return mockKeyring.has(key);
  },

  // Auth (Claude Code CLI detection)
  detect_claude_code: () => ({
    cliAvailable: false,
    cliPath: null,
    installed: false,
    authenticated: false,
    subscriptionType: null,
    expiresAt: null,
  }),
  run_claude_code: () => Promise.reject('Claude Code CLI not available in browser mode'),

  // Psychology
  load_psychology_layer: () => ({}),
  get_psychology_state: () => ({ layers: {} }),
  get_soul: () => ({ content: '# Helix Soul\n\nBrowser development mode.', lastModified: Date.now() }),
  get_layer: () => ({ layer: '', data: {}, lastModified: Date.now() }),
  get_all_layers: () => ({}),
  update_soul: () => undefined,
  update_layer: () => undefined,

  // Memory
  search_memories: () => [],
  get_memory: () => null,
  get_memory_stats: () => ({ total: 0, byType: {} }),
  memory_search: () => ({ entries: [] }),
  memory_stats: () => ({ totalEntities: 0, totalObservations: 0, totalRelations: 0, entityTypes: {}, lastUpdated: null }),
  memory_delete: () => undefined,
  memory_create: () => null,
  memory_add_observations: () => undefined,

  // Advanced/Account
  clear_cache: () => undefined,
  delete_all_data: () => undefined,
  factory_reset: () => undefined,

  // Discord
  test_webhook: () => ({ success: true, status_code: 200, error: null }),

  // Phase J2: System Tray (no-op in browser)
  update_tray_menu: () => undefined,

  // Phase J4: Auto-Updater (no-op in browser)
  check_for_update: () => null,
  install_update: () => undefined,
  get_app_version: () => '1.0.0',

  // Deep Linking (Phase J)
  handle_deep_link: (args: unknown) => {
    const { url } = args as { url: string };
    const valid = url.startsWith('helix://');
    return { url, valid, error: valid ? null : 'Invalid deep link scheme' };
  },
  get_launch_deep_link: () => null,
};

export async function invoke<T>(cmd: string, args?: unknown): Promise<T> {
  if (isTauri) {
    // Use real Tauri invoke
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke<T>(cmd, args as Record<string, unknown>);
  }

  // Browser mock
  console.log(`[Tauri Mock] invoke: ${cmd}`, args);
  const handler = mockInvokeHandlers[cmd];
  if (handler) {
    return handler(args) as T;
  }
  throw new Error(`[Tauri Mock] Unknown command: ${cmd}`);
}

// Mock listen function for browser
type UnlistenFn = () => void;
type EventCallback<T> = (event: { payload: T }) => void;

const eventListeners: Map<string, Set<EventCallback<unknown>>> = new Map();

export async function listen<T>(
  event: string,
  callback: EventCallback<T>
): Promise<UnlistenFn> {
  if (isTauri) {
    // Use real Tauri listen
    const { listen: tauriListen } = await import('@tauri-apps/api/event');
    return tauriListen<T>(event, callback);
  }

  // Browser mock
  console.log(`[Tauri Mock] listen: ${event}`);
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event)!.add(callback as EventCallback<unknown>);

  return () => {
    eventListeners.get(event)?.delete(callback as EventCallback<unknown>);
  };
}

// Emit mock events (for testing)
export function emitMockEvent<T>(event: string, payload: T): void {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((callback) => callback({ payload }));
  }
}

// Export UnlistenFn type
export type { UnlistenFn };

// Mock window API for browser
interface MockWindow {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  hide: () => Promise<void>;
  close: () => Promise<void>;
  setTitle: (title: string) => Promise<void>;
}

const mockWindow: MockWindow = {
  minimize: async () => console.log('[Tauri Mock] window.minimize'),
  toggleMaximize: async () => console.log('[Tauri Mock] window.toggleMaximize'),
  hide: async () => console.log('[Tauri Mock] window.hide'),
  close: async () => console.log('[Tauri Mock] window.close'),
  setTitle: async (title: string) => console.log('[Tauri Mock] window.setTitle:', title),
};

export function getCurrentWindow(): MockWindow {
  if (isTauri) {
    // This will be replaced at runtime - see TitleBar.tsx
    return mockWindow;
  }
  return mockWindow;
}

// For async window import in Tauri
export async function getTauriWindow() {
  if (isTauri) {
    const { getCurrentWindow: getTauriCurrentWindow } = await import('@tauri-apps/api/window');
    return getTauriCurrentWindow();
  }
  return mockWindow;
}

// Dialog plugin mocks
interface SaveDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
}

interface OpenDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  multiple?: boolean;
}

export async function save(_options?: SaveDialogOptions): Promise<string | null> {
  if (isTauri) {
    const { save: tauriSave } = await import('@tauri-apps/plugin-dialog');
    return tauriSave(_options);
  }
  console.log('[Tauri Mock] dialog.save', _options);
  return null; // Simulates user canceling
}

export async function open(_options?: OpenDialogOptions): Promise<string | string[] | null> {
  if (isTauri) {
    const { open: tauriOpen } = await import('@tauri-apps/plugin-dialog');
    return tauriOpen(_options);
  }
  console.log('[Tauri Mock] dialog.open', _options);
  return null; // Simulates user canceling
}

// FS plugin mocks
export async function writeTextFile(path: string, contents: string): Promise<void> {
  if (isTauri) {
    const { writeTextFile: tauriWriteTextFile } = await import('@tauri-apps/plugin-fs');
    return tauriWriteTextFile(path, contents);
  }
  console.log('[Tauri Mock] fs.writeTextFile', path, contents.substring(0, 100) + '...');
}

export async function readTextFile(path: string): Promise<string> {
  if (isTauri) {
    const { readTextFile: tauriReadTextFile } = await import('@tauri-apps/plugin-fs');
    return tauriReadTextFile(path);
  }
  console.log('[Tauri Mock] fs.readTextFile', path);
  return '{}'; // Return empty JSON for browser mode
}

// URL opener (different from dialog.open)
export async function openUrl(url: string): Promise<void> {
  if (isTauri) {
    const { openUrl: tauriOpenUrl } = await import('@tauri-apps/plugin-opener');
    return tauriOpenUrl(url);
  }
  // Browser fallback
  window.open(url, '_blank');
}
