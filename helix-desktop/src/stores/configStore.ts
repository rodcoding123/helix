import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'local';
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface PrivacyConfig {
  telemetryEnabled: boolean;
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
  localStorageOnly: boolean;
}

export interface MemoryDecayConfig {
  enabled: boolean;
  mode: 'hard' | 'soft'; // hard = delete, soft = preserve with decay marker
  rate: number; // 0.0 to 1.0, default 0.95 (5% decay per cycle)
  minimumIntensity: number; // floor for emotional intensity, default 0.1
  trustDecayEnabled: boolean; // whether trust scores decay toward neutral
  preserveHighSalience: boolean; // never decay critical/high salience memories
}

export interface PsychologyConfig {
  enabled: boolean;
  layersEnabled: {
    narrative: boolean;
    emotional: boolean;
    relational: boolean;
    prospective: boolean;
    integration: boolean;
    transformation: boolean;
    purpose: boolean;
  };
  integrationSchedule: 'hourly' | 'daily' | 'weekly' | 'manual';
  memoryDecay: MemoryDecayConfig;
}

export interface GeneralConfig {
  appName: string;
  language: string;
  startupBehavior: 'minimized' | 'normal' | 'maximized';
  closeToTray: boolean;
  checkUpdates: boolean;
}

export interface DiscordConfig {
  enabled: boolean;
  webhookUrl: string;
  channels: {
    commands: boolean;
    api: boolean;
    heartbeat: boolean;
    fileChanges: boolean;
    consciousness: boolean;
    alerts: boolean;
    hashChain: boolean;
  };
}

export interface AccountConfig {
  displayName: string;
  avatar: string | null;
  cloudSync: boolean;
}

export interface AdvancedConfig {
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  developerMode: boolean;
  showThinking: boolean;
  showToolCalls: boolean;
}

export interface ChannelsConfig {
  autoRespond: boolean;
  notificationSound: boolean;
  discord: { enabled: boolean };
  telegram: { enabled: boolean };
  slack: { enabled: boolean };
  whatsapp: { enabled: boolean };
}

export interface Config {
  general: GeneralConfig;
  model: ModelConfig;
  privacy: PrivacyConfig;
  psychology: PsychologyConfig;
  discord: DiscordConfig;
  account: AccountConfig;
  advanced: AdvancedConfig;
  channels: ChannelsConfig;
}

// Gateway-sourced config (from openclaw.json via gateway protocol)
export interface GatewayConfig {
  // Model/agent defaults
  agents?: {
    defaults?: {
      provider?: string;
      model?: string;
      thinkingLevel?: string;
      timeout?: number;
    };
    list?: Array<{
      id: string;
      name?: string;
      model?: string;
      workspace?: string;
    }>;
  };
  // Channel configuration
  channels?: Record<string, {
    enabled?: boolean;
    config?: Record<string, unknown>;
  }>;
  // Tools policy
  tools?: {
    allow?: string[];
    deny?: string[];
    profile?: string;
  };
  // Skills
  skills?: Record<string, unknown>;
  // Session config
  session?: {
    scope?: string;
    reset?: { mode?: string; time?: number; idleMinutes?: number };
    compaction?: { mode?: string };
  };
  // Messages/TTS config
  messages?: {
    tts?: Record<string, unknown>;
  };
  // Raw config hash for optimistic concurrency
  _hash?: string;
  // Full raw config (for sections we don't explicitly model)
  _raw?: Record<string, unknown>;
}

interface ConfigState {
  config: Config;
  isDirty: boolean;
  lastSaved: number | null;

  // Gateway-sourced config (not persisted to localStorage)
  gatewayConfig: GatewayConfig;
  gatewayConfigLoaded: boolean;
  gatewayConfigError: string | null;

  // Actions
  updateConfig: <K extends keyof Config>(section: K, updates: Partial<Config[K]>) => void;
  setConfig: (config: Config) => void;
  resetSection: (section: keyof Config) => void;
  resetAll: () => void;
  resetConfig: () => void; // Alias for resetAll
  markSaved: () => void;

  // Gateway config actions
  setGatewayConfig: (config: GatewayConfig) => void;
  setGatewayConfigError: (error: string | null) => void;
  updateGatewayConfig: (updates: Partial<GatewayConfig>) => void;
}

const defaultConfig: Config = {
  general: {
    appName: 'Helix',
    language: 'en',
    startupBehavior: 'normal',
    closeToTray: true,
    checkUpdates: true,
  },
  model: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 8192,
  },
  privacy: {
    telemetryEnabled: false,
    analyticsEnabled: false,
    crashReportingEnabled: true,
    localStorageOnly: true,
  },
  psychology: {
    enabled: true,
    layersEnabled: {
      narrative: true,
      emotional: true,
      relational: true,
      prospective: true,
      integration: true,
      transformation: true,
      purpose: true,
    },
    integrationSchedule: 'daily',
    memoryDecay: {
      enabled: true,
      mode: 'soft', // preserve all data, just mark as decayed
      rate: 0.95, // 5% decay per cycle
      minimumIntensity: 0.1, // floor for emotional intensity
      trustDecayEnabled: true, // trust decays toward neutral over time
      preserveHighSalience: true, // never decay critical memories
    },
  },
  discord: {
    enabled: false,
    webhookUrl: '',
    channels: {
      commands: true,
      api: true,
      heartbeat: true,
      fileChanges: true,
      consciousness: true,
      alerts: true,
      hashChain: true,
    },
  },
  account: {
    displayName: '',
    avatar: null,
    cloudSync: false,
  },
  advanced: {
    logLevel: 'info',
    developerMode: false,
    showThinking: true,
    showToolCalls: true,
  },
  channels: {
    autoRespond: true,
    notificationSound: true,
    discord: { enabled: false },
    telegram: { enabled: false },
    slack: { enabled: false },
    whatsapp: { enabled: false },
  },
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      isDirty: false,
      lastSaved: null,

      // Gateway config defaults (not persisted)
      gatewayConfig: {},
      gatewayConfigLoaded: false,
      gatewayConfigError: null,

      updateConfig: (section, updates) => {
        set((state) => ({
          config: {
            ...state.config,
            [section]: { ...state.config[section], ...updates },
          },
          isDirty: true,
        }));
      },

      setConfig: (config) => {
        set({ config, isDirty: false, lastSaved: Date.now() });
      },

      resetSection: (section) => {
        set((state) => ({
          config: {
            ...state.config,
            [section]: defaultConfig[section],
          },
          isDirty: true,
        }));
      },

      resetAll: () => {
        set({ config: defaultConfig, isDirty: true });
      },

      resetConfig: () => {
        set({ config: defaultConfig, isDirty: true });
      },

      markSaved: () => {
        set({ isDirty: false, lastSaved: Date.now() });
      },

      // Gateway config actions
      setGatewayConfig: (config) =>
        set({
          gatewayConfig: config,
          gatewayConfigLoaded: true,
          gatewayConfigError: null,
        }),

      setGatewayConfigError: (error) => set({ gatewayConfigError: error }),

      updateGatewayConfig: (updates) =>
        set((state) => ({
          gatewayConfig: { ...state.gatewayConfig, ...updates },
        })),
    }),
    {
      name: 'helix-config-storage',
      partialize: (state) => ({
        config: state.config,
        isDirty: state.isDirty,
        lastSaved: state.lastSaved,
      }),
    }
  )
);

// Export default config for reference
export { defaultConfig };
