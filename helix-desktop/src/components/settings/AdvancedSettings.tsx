/**
 * Gateway Advanced Settings - Comprehensive gateway configuration panel
 *
 * Phase I, Task I4: Full gateway settings with collapsible sections,
 * dirty state tracking, config import/export, and reset-with-confirmation.
 *
 * Communicates with the OpenClaw gateway via the WebSocket protocol using
 * config.get / config.patch / config.apply methods.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGateway } from '../../hooks';
import { save, open, writeTextFile, readTextFile } from '../../lib/tauri-compat';

/* ================================================================
   Types
   ================================================================ */

interface GatewaySettings {
  port: number;
  host: string;
  corsOrigins: string[];
  wsPingInterval: number;
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    redactSensitive: boolean;
    filePath: string;
    rotation: 'daily' | 'weekly' | 'size';
    maxSizeMb: number;
  };
  context: {
    pruningMode: 'adaptive' | 'aggressive' | 'off';
    blockStreaming: boolean;
    messageQueueMode: 'steer' | 'followup' | 'collect' | 'interrupt';
    inboundDebounceMs: number;
  };
  security: {
    tokenRotationDays: number;
    maxConcurrentSessions: number;
    sessionTimeoutMinutes: number;
    requireApproval: {
      shellCommands: boolean;
      fileWrites: boolean;
      networkRequests: boolean;
    };
  };
  configIncludes: string[];
}

type SectionId = 'network' | 'logging' | 'context' | 'security' | 'config';

interface SectionMeta {
  id: SectionId;
  title: string;
  description: string;
  icon: string;
}

/* ================================================================
   Constants
   ================================================================ */

const SECTIONS: SectionMeta[] = [
  {
    id: 'network',
    title: 'Gateway Network',
    description: 'Port, host, CORS, and WebSocket settings',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  },
  {
    id: 'logging',
    title: 'Logging & Debug',
    description: 'Log level, redaction, rotation, and file paths',
    icon: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  },
  {
    id: 'context',
    title: 'Context & Processing',
    description: 'Pruning, streaming, message queue, and debounce',
    icon: 'M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z',
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Token rotation, sessions, and approval policies',
    icon: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  },
  {
    id: 'config',
    title: 'Config Management',
    description: 'Import, export, include paths, and reset',
    icon: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  },
];

const DEFAULT_SETTINGS: GatewaySettings = {
  port: 3777,
  host: '127.0.0.1',
  corsOrigins: ['http://localhost:1420', 'http://localhost:5173'],
  wsPingInterval: 30,
  logging: {
    level: 'info',
    redactSensitive: true,
    filePath: '',
    rotation: 'daily',
    maxSizeMb: 50,
  },
  context: {
    pruningMode: 'adaptive',
    blockStreaming: false,
    messageQueueMode: 'steer',
    inboundDebounceMs: 500,
  },
  security: {
    tokenRotationDays: 30,
    maxConcurrentSessions: 10,
    sessionTimeoutMinutes: 60,
    requireApproval: {
      shellCommands: true,
      fileWrites: true,
      networkRequests: false,
    },
  },
  configIncludes: [],
};

const LOG_LEVELS: Array<{ value: GatewaySettings['logging']['level']; label: string }> = [
  { value: 'error', label: 'Error' },
  { value: 'warn', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
  { value: 'trace', label: 'Trace' },
];

const LOG_ROTATIONS: Array<{ value: GatewaySettings['logging']['rotation']; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'size', label: 'Size-based' },
];

const TOKEN_ROTATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Never' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const PRUNING_MODES: Array<{
  value: GatewaySettings['context']['pruningMode'];
  label: string;
  description: string;
}> = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Prunes old context intelligently when approaching token limit',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Aggressively prunes to maximize available context',
  },
  {
    value: 'off',
    label: 'Off',
    description: 'No automatic pruning, may hit token limits',
  },
];

const MESSAGE_QUEUE_MODES: Array<{
  value: GatewaySettings['context']['messageQueueMode'];
  label: string;
  description: string;
}> = [
  {
    value: 'steer',
    label: 'Steer',
    description: 'New messages steer the current response',
  },
  {
    value: 'followup',
    label: 'Follow-up',
    description: 'New messages queue as follow-ups',
  },
  {
    value: 'collect',
    label: 'Collect',
    description: 'Collects all messages before responding',
  },
  {
    value: 'interrupt',
    label: 'Interrupt',
    description: 'New messages interrupt current processing',
  },
];

/* ================================================================
   Deep comparison utility
   ================================================================ */

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/* ================================================================
   Component
   ================================================================ */

export function AdvancedSettings() {
  const { getClient, connected } = useGateway();

  // ---- State ----
  const [settings, setSettings] = useState<GatewaySettings>(deepClone(DEFAULT_SETTINGS));
  const [initialSettings, setInitialSettings] = useState<GatewaySettings>(
    deepClone(DEFAULT_SETTINGS)
  );
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(['network'])
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  // Config import/export
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // CORS tag input
  const [corsInput, setCorsInput] = useState('');

  // Config includes input
  const [includeInput, setIncludeInput] = useState('');

  // Auto-dismiss success message
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Gateway request helper ----
  const sendRequest = useCallback(
    async <T = unknown>(method: string, params?: unknown): Promise<T> => {
      const client = getClient();
      if (!client?.connected) {
        throw new Error('Gateway not connected');
      }
      return client.request<T>(method, params);
    },
    [getClient]
  );

  // ---- Dirty state ----
  const isDirty = useMemo(() => !deepEqual(settings, initialSettings), [settings, initialSettings]);

  // ---- Load settings from gateway ----
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await sendRequest<{
        config: Record<string, unknown>;
        hash?: string;
      }>('config.get', { path: 'gateway' });

      const raw = result?.config ?? result ?? {};
      const gateway = (raw as Record<string, unknown>).gateway ?? raw;
      const g = gateway as Record<string, unknown>;

      const loaded: GatewaySettings = {
        port: typeof g.port === 'number' ? g.port : DEFAULT_SETTINGS.port,
        host: typeof g.host === 'string' ? g.host : DEFAULT_SETTINGS.host,
        corsOrigins: Array.isArray(g.corsOrigins)
          ? (g.corsOrigins as string[])
          : DEFAULT_SETTINGS.corsOrigins,
        wsPingInterval:
          typeof g.wsPingInterval === 'number'
            ? g.wsPingInterval
            : DEFAULT_SETTINGS.wsPingInterval,
        logging: {
          level:
            typeof (g.logging as Record<string, unknown>)?.level === 'string'
              ? ((g.logging as Record<string, unknown>).level as GatewaySettings['logging']['level'])
              : DEFAULT_SETTINGS.logging.level,
          redactSensitive:
            typeof (g.logging as Record<string, unknown>)?.redactSensitive === 'boolean'
              ? ((g.logging as Record<string, unknown>).redactSensitive as boolean)
              : DEFAULT_SETTINGS.logging.redactSensitive,
          filePath:
            typeof (g.logging as Record<string, unknown>)?.filePath === 'string'
              ? ((g.logging as Record<string, unknown>).filePath as string)
              : DEFAULT_SETTINGS.logging.filePath,
          rotation:
            typeof (g.logging as Record<string, unknown>)?.rotation === 'string'
              ? ((g.logging as Record<string, unknown>).rotation as GatewaySettings['logging']['rotation'])
              : DEFAULT_SETTINGS.logging.rotation,
          maxSizeMb:
            typeof (g.logging as Record<string, unknown>)?.maxSizeMb === 'number'
              ? ((g.logging as Record<string, unknown>).maxSizeMb as number)
              : DEFAULT_SETTINGS.logging.maxSizeMb,
        },
        context: {
          pruningMode:
            typeof (g.context as Record<string, unknown>)?.pruningMode === 'string'
              ? ((g.context as Record<string, unknown>).pruningMode as GatewaySettings['context']['pruningMode'])
              : DEFAULT_SETTINGS.context.pruningMode,
          blockStreaming:
            typeof (g.context as Record<string, unknown>)?.blockStreaming === 'boolean'
              ? ((g.context as Record<string, unknown>).blockStreaming as boolean)
              : DEFAULT_SETTINGS.context.blockStreaming,
          messageQueueMode:
            typeof (g.context as Record<string, unknown>)?.messageQueueMode === 'string'
              ? ((g.context as Record<string, unknown>).messageQueueMode as GatewaySettings['context']['messageQueueMode'])
              : DEFAULT_SETTINGS.context.messageQueueMode,
          inboundDebounceMs:
            typeof (g.context as Record<string, unknown>)?.inboundDebounceMs === 'number'
              ? ((g.context as Record<string, unknown>).inboundDebounceMs as number)
              : DEFAULT_SETTINGS.context.inboundDebounceMs,
        },
        security: {
          tokenRotationDays:
            typeof (g.security as Record<string, unknown>)?.tokenRotationDays === 'number'
              ? ((g.security as Record<string, unknown>).tokenRotationDays as number)
              : DEFAULT_SETTINGS.security.tokenRotationDays,
          maxConcurrentSessions:
            typeof (g.security as Record<string, unknown>)?.maxConcurrentSessions === 'number'
              ? ((g.security as Record<string, unknown>).maxConcurrentSessions as number)
              : DEFAULT_SETTINGS.security.maxConcurrentSessions,
          sessionTimeoutMinutes:
            typeof (g.security as Record<string, unknown>)?.sessionTimeoutMinutes === 'number'
              ? ((g.security as Record<string, unknown>).sessionTimeoutMinutes as number)
              : DEFAULT_SETTINGS.security.sessionTimeoutMinutes,
          requireApproval: {
            shellCommands:
              typeof ((g.security as Record<string, unknown>)?.requireApproval as Record<string, unknown>)?.shellCommands === 'boolean'
                ? (((g.security as Record<string, unknown>).requireApproval as Record<string, unknown>).shellCommands as boolean)
                : DEFAULT_SETTINGS.security.requireApproval.shellCommands,
            fileWrites:
              typeof ((g.security as Record<string, unknown>)?.requireApproval as Record<string, unknown>)?.fileWrites === 'boolean'
                ? (((g.security as Record<string, unknown>).requireApproval as Record<string, unknown>).fileWrites as boolean)
                : DEFAULT_SETTINGS.security.requireApproval.fileWrites,
            networkRequests:
              typeof ((g.security as Record<string, unknown>)?.requireApproval as Record<string, unknown>)?.networkRequests === 'boolean'
                ? (((g.security as Record<string, unknown>).requireApproval as Record<string, unknown>).networkRequests as boolean)
                : DEFAULT_SETTINGS.security.requireApproval.networkRequests,
          },
        },
        configIncludes: Array.isArray(g.configIncludes)
          ? (g.configIncludes as string[])
          : DEFAULT_SETTINGS.configIncludes,
      };

      setSettings(loaded);
      setInitialSettings(deepClone(loaded));
    } catch (err) {
      console.error('Failed to load gateway settings:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load gateway settings');
      // Fall back to defaults
      setSettings(deepClone(DEFAULT_SETTINGS));
      setInitialSettings(deepClone(DEFAULT_SETTINGS));
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);

  // Load on mount and when connected
  useEffect(() => {
    if (connected) {
      void loadSettings();
    } else {
      setLoading(false);
    }
  }, [connected, loadSettings]);

  // ---- Save settings ----
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await sendRequest('config.patch', {
        path: 'gateway',
        value: settings,
      });

      setInitialSettings(deepClone(settings));
      setSaveSuccess(true);

      // Auto-dismiss success
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to save gateway settings:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings, sendRequest]);

  // ---- Discard changes ----
  const handleDiscard = useCallback(() => {
    setSettings(deepClone(initialSettings));
    setSaveError(null);
    setSaveSuccess(false);
  }, [initialSettings]);

  // ---- Reset to defaults ----
  const handleReset = useCallback(async () => {
    if (resetConfirmText !== 'RESET') return;

    setResetting(true);
    try {
      await sendRequest('config.patch', {
        path: 'gateway',
        value: DEFAULT_SETTINGS,
      });

      setSettings(deepClone(DEFAULT_SETTINGS));
      setInitialSettings(deepClone(DEFAULT_SETTINGS));
      setShowResetConfirm(false);
      setResetConfirmText('');
      setSaveSuccess(true);

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to reset gateway settings:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setResetting(false);
    }
  }, [resetConfirmText, sendRequest]);

  // ---- Export config ----
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = await sendRequest<{
        config: Record<string, unknown>;
      }>('config.get', {});

      const configJson = JSON.stringify(result?.config ?? result, null, 2);

      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'helix-gateway-config.json',
      });

      if (filePath) {
        await writeTextFile(filePath, configJson);
      }
    } catch (err) {
      console.error('Failed to export config:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to export config');
    } finally {
      setExporting(false);
    }
  }, [sendRequest]);

  // ---- Import config ----
  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportError(null);

    try {
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      });

      if (filePath && typeof filePath === 'string') {
        const configJson = await readTextFile(filePath);
        const parsed = JSON.parse(configJson) as Record<string, unknown>;

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid config file format');
        }

        await sendRequest('config.apply', { config: parsed });
        await loadSettings();
      }
    } catch (err) {
      console.error('Failed to import config:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import config');
    } finally {
      setImporting(false);
    }
  }, [sendRequest, loadSettings]);

  // ---- Section toggle ----
  const toggleSection = useCallback((sectionId: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // ---- Updater helpers ----
  const updateField = useCallback(
    <K extends keyof GatewaySettings>(key: K, value: GatewaySettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateLogging = useCallback(
    <K extends keyof GatewaySettings['logging']>(
      key: K,
      value: GatewaySettings['logging'][K]
    ) => {
      setSettings((prev) => ({
        ...prev,
        logging: { ...prev.logging, [key]: value },
      }));
    },
    []
  );

  const updateContext = useCallback(
    <K extends keyof GatewaySettings['context']>(
      key: K,
      value: GatewaySettings['context'][K]
    ) => {
      setSettings((prev) => ({
        ...prev,
        context: { ...prev.context, [key]: value },
      }));
    },
    []
  );

  const updateSecurity = useCallback(
    <K extends keyof GatewaySettings['security']>(
      key: K,
      value: GatewaySettings['security'][K]
    ) => {
      setSettings((prev) => ({
        ...prev,
        security: { ...prev.security, [key]: value },
      }));
    },
    []
  );

  const updateApproval = useCallback(
    <K extends keyof GatewaySettings['security']['requireApproval']>(
      key: K,
      value: boolean
    ) => {
      setSettings((prev) => ({
        ...prev,
        security: {
          ...prev.security,
          requireApproval: { ...prev.security.requireApproval, [key]: value },
        },
      }));
    },
    []
  );

  // ---- CORS tag helpers ----
  const addCorsOrigin = useCallback(() => {
    const trimmed = corsInput.trim();
    if (!trimmed) return;
    if (settings.corsOrigins.includes(trimmed)) {
      setCorsInput('');
      return;
    }
    updateField('corsOrigins', [...settings.corsOrigins, trimmed]);
    setCorsInput('');
  }, [corsInput, settings.corsOrigins, updateField]);

  const removeCorsOrigin = useCallback(
    (origin: string) => {
      updateField(
        'corsOrigins',
        settings.corsOrigins.filter((o) => o !== origin)
      );
    },
    [settings.corsOrigins, updateField]
  );

  const handleCorsKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCorsOrigin();
      }
    },
    [addCorsOrigin]
  );

  // ---- Config include helpers ----
  const addIncludePath = useCallback(() => {
    const trimmed = includeInput.trim();
    if (!trimmed) return;
    if (settings.configIncludes.includes(trimmed)) {
      setIncludeInput('');
      return;
    }
    updateField('configIncludes', [...settings.configIncludes, trimmed]);
    setIncludeInput('');
  }, [includeInput, settings.configIncludes, updateField]);

  const removeIncludePath = useCallback(
    (path: string) => {
      updateField(
        'configIncludes',
        settings.configIncludes.filter((p) => p !== path)
      );
    },
    [settings.configIncludes, updateField]
  );

  const handleIncludeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addIncludePath();
      }
    },
    [addIncludePath]
  );

  // ---- Cleanup timer on unmount ----
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  // ---- Render helpers ----
  const renderSectionHeader = (section: SectionMeta) => {
    const isExpanded = expandedSections.has(section.id);
    return (
      <button
        className="gas-section-header"
        onClick={() => toggleSection(section.id)}
        aria-expanded={isExpanded}
      >
        <div className="gas-section-header-left">
          <svg
            className="gas-section-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="20"
            height="20"
          >
            <path d={section.icon} />
          </svg>
          <div className="gas-section-title-group">
            <span className="gas-section-title">{section.title}</span>
            <span className="gas-section-description">{section.description}</span>
          </div>
        </div>
        <svg
          className={`gas-chevron ${isExpanded ? 'gas-chevron-open' : ''}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          width="20"
          height="20"
        >
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>
    );
  };

  /* ================================================================
     RENDER - Network Section
     ================================================================ */
  const renderNetworkSection = () => (
    <div className="gas-section-body">
      {/* Port */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-port">
            Gateway Port
          </label>
          <span className="gas-field-hint">Range: 1024-65535 (default: 3777)</span>
        </div>
        <input
          id="gas-port"
          type="number"
          className="gas-input gas-input-number"
          value={settings.port}
          min={1024}
          max={65535}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1024 && val <= 65535) {
              updateField('port', val);
            }
          }}
        />
      </div>

      {/* Host */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-host">
            Gateway Host
          </label>
          <span className="gas-field-hint">Bind address (default: 127.0.0.1)</span>
        </div>
        <input
          id="gas-host"
          type="text"
          className="gas-input"
          value={settings.host}
          placeholder="127.0.0.1"
          onChange={(e) => updateField('host', e.target.value)}
        />
      </div>

      {/* CORS Origins */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label">CORS Origins</label>
          <span className="gas-field-hint">Allowed origins for cross-origin requests</span>
        </div>
        <div className="gas-tags-container">
          <div className="gas-tags">
            {settings.corsOrigins.map((origin) => (
              <span key={origin} className="gas-tag">
                <span className="gas-tag-text">{origin}</span>
                <button
                  className="gas-tag-remove"
                  onClick={() => removeCorsOrigin(origin)}
                  aria-label={`Remove ${origin}`}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
          <div className="gas-tag-input-row">
            <input
              type="text"
              className="gas-input gas-tag-input"
              value={corsInput}
              placeholder="https://example.com"
              onChange={(e) => setCorsInput(e.target.value)}
              onKeyDown={handleCorsKeyDown}
            />
            <button
              className="gas-btn gas-btn-sm gas-btn-secondary"
              onClick={addCorsOrigin}
              disabled={!corsInput.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* WebSocket Ping Interval */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-ws-ping">
            WebSocket Ping Interval
          </label>
          <span className="gas-field-hint">Keep-alive interval in seconds</span>
        </div>
        <div className="gas-slider-group">
          <input
            id="gas-ws-ping"
            type="range"
            className="gas-slider"
            min={10}
            max={120}
            step={5}
            value={settings.wsPingInterval}
            onChange={(e) => updateField('wsPingInterval', parseInt(e.target.value, 10))}
          />
          <span className="gas-slider-value">{settings.wsPingInterval}s</span>
        </div>
      </div>
    </div>
  );

  /* ================================================================
     RENDER - Logging Section
     ================================================================ */
  const renderLoggingSection = () => (
    <div className="gas-section-body">
      {/* Log Level */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-log-level">
            Logging Level
          </label>
          <span className="gas-field-hint">Control gateway log verbosity</span>
        </div>
        <select
          id="gas-log-level"
          className="gas-select"
          value={settings.logging.level}
          onChange={(e) =>
            updateLogging('level', e.target.value as GatewaySettings['logging']['level'])
          }
        >
          {LOG_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sensitive Data Redaction */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label">Sensitive Data Redaction</label>
          <span className="gas-field-hint">
            Redacts secrets, tokens, and keys from log output
          </span>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.logging.redactSensitive}
            onChange={(e) => updateLogging('redactSensitive', e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Log File Path */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-log-path">
            Log File Path
          </label>
          <span className="gas-field-hint">
            {settings.logging.filePath
              ? 'Custom path'
              : 'Leave empty for default (~/.helix/logs/)'}
          </span>
        </div>
        <input
          id="gas-log-path"
          type="text"
          className="gas-input gas-input-wide"
          value={settings.logging.filePath}
          placeholder="~/.helix/logs/gateway.log"
          onChange={(e) => updateLogging('filePath', e.target.value)}
        />
      </div>

      {/* Log Rotation */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-log-rotation">
            Log Rotation
          </label>
          <span className="gas-field-hint">When to rotate log files</span>
        </div>
        <select
          id="gas-log-rotation"
          className="gas-select"
          value={settings.logging.rotation}
          onChange={(e) =>
            updateLogging(
              'rotation',
              e.target.value as GatewaySettings['logging']['rotation']
            )
          }
        >
          {LOG_ROTATIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Max Log Size (only when size-based) */}
      {settings.logging.rotation === 'size' && (
        <div className="gas-field">
          <div className="gas-field-info">
            <label className="gas-field-label" htmlFor="gas-log-size">
              Max Log Size
            </label>
            <span className="gas-field-hint">Maximum size in MB before rotation</span>
          </div>
          <div className="gas-input-suffix-group">
            <input
              id="gas-log-size"
              type="number"
              className="gas-input gas-input-number"
              value={settings.logging.maxSizeMb}
              min={1}
              max={10000}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  updateLogging('maxSizeMb', val);
                }
              }}
            />
            <span className="gas-input-suffix">MB</span>
          </div>
        </div>
      )}
    </div>
  );

  /* ================================================================
     RENDER - Context Section
     ================================================================ */
  const renderContextSection = () => (
    <div className="gas-section-body">
      {/* Context Pruning Mode */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label">Context Pruning Mode</label>
          <span className="gas-field-hint">
            Controls how context is managed when approaching token limits
          </span>
        </div>
        <div className="gas-radio-group">
          {PRUNING_MODES.map((mode) => (
            <label
              key={mode.value}
              className={`gas-radio-option ${
                settings.context.pruningMode === mode.value ? 'gas-radio-selected' : ''
              }`}
            >
              <input
                type="radio"
                name="pruningMode"
                value={mode.value}
                checked={settings.context.pruningMode === mode.value}
                onChange={() => updateContext('pruningMode', mode.value)}
                className="gas-radio-input"
              />
              <div className="gas-radio-content">
                <span className="gas-radio-label">{mode.label}</span>
                <span className="gas-radio-description">{mode.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Block Streaming */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label">Block Streaming Default</label>
          <span className="gas-field-hint">
            Wait for full response before sending to client
          </span>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.context.blockStreaming}
            onChange={(e) => updateContext('blockStreaming', e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Message Queue Mode */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-queue-mode">
            Message Queue Mode
          </label>
          <span className="gas-field-hint">
            How incoming messages are handled during active processing
          </span>
        </div>
        <div className="gas-select-cards">
          {MESSAGE_QUEUE_MODES.map((mode) => (
            <button
              key={mode.value}
              className={`gas-select-card ${
                settings.context.messageQueueMode === mode.value
                  ? 'gas-select-card-active'
                  : ''
              }`}
              onClick={() => updateContext('messageQueueMode', mode.value)}
            >
              <span className="gas-select-card-label">{mode.label}</span>
              <span className="gas-select-card-desc">{mode.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inbound Debounce */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-debounce">
            Inbound Debounce
          </label>
          <span className="gas-field-hint">
            Delay before processing incoming messages
          </span>
        </div>
        <div className="gas-slider-group">
          <input
            id="gas-debounce"
            type="range"
            className="gas-slider"
            min={0}
            max={5000}
            step={100}
            value={settings.context.inboundDebounceMs}
            onChange={(e) =>
              updateContext('inboundDebounceMs', parseInt(e.target.value, 10))
            }
          />
          <span className="gas-slider-value">
            {settings.context.inboundDebounceMs}ms
          </span>
        </div>
      </div>
    </div>
  );

  /* ================================================================
     RENDER - Security Section
     ================================================================ */
  const renderSecuritySection = () => (
    <div className="gas-section-body">
      {/* Token Rotation */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-token-rotation">
            Token Rotation Interval
          </label>
          <span className="gas-field-hint">
            How often gateway tokens are automatically rotated
          </span>
        </div>
        <select
          id="gas-token-rotation"
          className="gas-select"
          value={settings.security.tokenRotationDays}
          onChange={(e) =>
            updateSecurity('tokenRotationDays', parseInt(e.target.value, 10))
          }
        >
          {TOKEN_ROTATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Max Concurrent Sessions */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-max-sessions">
            Max Concurrent Sessions
          </label>
          <span className="gas-field-hint">
            Maximum number of simultaneous connections (1-100)
          </span>
        </div>
        <input
          id="gas-max-sessions"
          type="number"
          className="gas-input gas-input-number"
          value={settings.security.maxConcurrentSessions}
          min={1}
          max={100}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 100) {
              updateSecurity('maxConcurrentSessions', val);
            }
          }}
        />
      </div>

      {/* Session Timeout */}
      <div className="gas-field">
        <div className="gas-field-info">
          <label className="gas-field-label" htmlFor="gas-session-timeout">
            Session Timeout
          </label>
          <span className="gas-field-hint">
            Idle sessions expire after this duration
          </span>
        </div>
        <div className="gas-slider-group gas-slider-wide">
          <input
            id="gas-session-timeout"
            type="range"
            className="gas-slider"
            min={5}
            max={1440}
            step={5}
            value={settings.security.sessionTimeoutMinutes}
            onChange={(e) =>
              updateSecurity('sessionTimeoutMinutes', parseInt(e.target.value, 10))
            }
          />
          <span className="gas-slider-value">
            {settings.security.sessionTimeoutMinutes < 60
              ? `${settings.security.sessionTimeoutMinutes}m`
              : settings.security.sessionTimeoutMinutes % 60 === 0
                ? `${Math.floor(settings.security.sessionTimeoutMinutes / 60)}h`
                : `${Math.floor(settings.security.sessionTimeoutMinutes / 60)}h ${settings.security.sessionTimeoutMinutes % 60}m`}
          </span>
        </div>
      </div>

      {/* Require Approval */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label">Require Approval For</label>
          <span className="gas-field-hint">
            Actions that require explicit user approval before execution
          </span>
        </div>
        <div className="gas-checkbox-group">
          <label className="gas-checkbox-option">
            <input
              type="checkbox"
              className="gas-checkbox-input"
              checked={settings.security.requireApproval.shellCommands}
              onChange={(e) => updateApproval('shellCommands', e.target.checked)}
            />
            <div className="gas-checkbox-content">
              <span className="gas-checkbox-label">Shell Commands</span>
              <span className="gas-checkbox-hint">
                Bash, PowerShell, and system command execution
              </span>
            </div>
          </label>
          <label className="gas-checkbox-option">
            <input
              type="checkbox"
              className="gas-checkbox-input"
              checked={settings.security.requireApproval.fileWrites}
              onChange={(e) => updateApproval('fileWrites', e.target.checked)}
            />
            <div className="gas-checkbox-content">
              <span className="gas-checkbox-label">File Writes</span>
              <span className="gas-checkbox-hint">
                Creating, modifying, or deleting files on disk
              </span>
            </div>
          </label>
          <label className="gas-checkbox-option">
            <input
              type="checkbox"
              className="gas-checkbox-input"
              checked={settings.security.requireApproval.networkRequests}
              onChange={(e) => updateApproval('networkRequests', e.target.checked)}
            />
            <div className="gas-checkbox-content">
              <span className="gas-checkbox-label">Network Requests</span>
              <span className="gas-checkbox-hint">
                HTTP requests, WebSocket connections, and API calls
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  /* ================================================================
     RENDER - Config Management Section
     ================================================================ */
  const renderConfigSection = () => (
    <div className="gas-section-body">
      {/* Config Include Paths */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label">Config Include Paths</label>
          <span className="gas-field-hint">
            Additional config files to include via $include directives
          </span>
        </div>
        <div className="gas-tags-container">
          {settings.configIncludes.length > 0 && (
            <div className="gas-include-list">
              {settings.configIncludes.map((path) => (
                <div key={path} className="gas-include-item">
                  <svg
                    className="gas-include-icon"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    width="16"
                    height="16"
                  >
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 9V3.5L18.5 9H13z" />
                  </svg>
                  <span className="gas-include-path">{path}</span>
                  <button
                    className="gas-include-remove"
                    onClick={() => removeIncludePath(path)}
                    aria-label={`Remove ${path}`}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="gas-tag-input-row">
            <input
              type="text"
              className="gas-input gas-tag-input"
              value={includeInput}
              placeholder="./secrets.json"
              onChange={(e) => setIncludeInput(e.target.value)}
              onKeyDown={handleIncludeKeyDown}
            />
            <button
              className="gas-btn gas-btn-sm gas-btn-secondary"
              onClick={addIncludePath}
              disabled={!includeInput.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Export / Import */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label">Configuration File</label>
          <span className="gas-field-hint">
            Export or import the full gateway configuration as JSON
          </span>
        </div>
        <div className="gas-config-actions">
          <button
            className="gas-btn gas-btn-secondary"
            onClick={handleExport}
            disabled={exporting || !connected}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
            </svg>
            {exporting ? 'Exporting...' : 'Export Config'}
          </button>
          <button
            className="gas-btn gas-btn-secondary"
            onClick={handleImport}
            disabled={importing || !connected}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
            </svg>
            {importing ? 'Importing...' : 'Import Config'}
          </button>
        </div>
        {importError && (
          <div className="gas-inline-error">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>{importError}</span>
          </div>
        )}
      </div>

      {/* Reset to Defaults */}
      <div className="gas-field gas-field-column">
        <div className="gas-field-info">
          <label className="gas-field-label gas-danger-label">Reset to Defaults</label>
          <span className="gas-field-hint">
            This will overwrite all gateway settings with factory defaults. This cannot be
            undone.
          </span>
        </div>
        {!showResetConfirm ? (
          <button
            className="gas-btn gas-btn-danger"
            onClick={() => setShowResetConfirm(true)}
            disabled={!connected}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            Reset to Defaults
          </button>
        ) : (
          <div className="gas-reset-confirm">
            <div className="gas-reset-confirm-header">
              <svg
                className="gas-reset-warn-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="20"
                height="20"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <span className="gas-reset-confirm-text">
                Type <strong>RESET</strong> to confirm
              </span>
            </div>
            <div className="gas-reset-confirm-input-row">
              <input
                type="text"
                className="gas-input gas-reset-input"
                value={resetConfirmText}
                placeholder="Type RESET"
                onChange={(e) => setResetConfirmText(e.target.value)}
                autoFocus
              />
              <button
                className="gas-btn gas-btn-danger gas-btn-sm"
                onClick={handleReset}
                disabled={resetConfirmText !== 'RESET' || resetting}
              >
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
              <button
                className="gas-btn gas-btn-secondary gas-btn-sm"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ================================================================
     MAIN RENDER
     ================================================================ */

  return (
    <div className="settings-section">
      <style>{advancedSettingsStyles}</style>

      {/* Header */}
      <header className="settings-section-header">
        <h1>Advanced Settings</h1>
        <p className="settings-section-description">
          Gateway configuration, logging, security, and processing options
        </p>
      </header>

      {/* Disconnected banner */}
      {!connected && (
        <div className="gas-banner gas-banner-warn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="gas-banner-content">
            <span className="gas-banner-title">Gateway disconnected</span>
            <span className="gas-banner-subtitle">
              Advanced settings require an active gateway connection. Start the gateway to
              configure these options.
            </span>
          </div>
        </div>
      )}

      {/* Unsaved changes banner */}
      {isDirty && (
        <div className="gas-banner gas-banner-dirty">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="gas-banner-content">
            <span className="gas-banner-title">Unsaved changes</span>
            <span className="gas-banner-subtitle">
              You have modified settings that have not been saved to the gateway.
            </span>
          </div>
          <div className="gas-banner-actions">
            <button
              className="gas-btn gas-btn-sm gas-btn-secondary"
              onClick={handleDiscard}
            >
              Discard
            </button>
            <button
              className="gas-btn gas-btn-sm gas-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Save success banner */}
      {saveSuccess && !isDirty && (
        <div className="gas-banner gas-banner-success">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="gas-banner-title">Settings saved successfully</span>
        </div>
      )}

      {/* Save error banner */}
      {saveError && (
        <div className="gas-banner gas-banner-error">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="gas-banner-content">
            <span className="gas-banner-title">Failed to save</span>
            <span className="gas-banner-subtitle">{saveError}</span>
          </div>
          <button
            className="gas-btn gas-btn-sm gas-btn-secondary"
            onClick={() => setSaveError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="gas-banner gas-banner-error">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="gas-banner-content">
            <span className="gas-banner-title">Failed to load settings</span>
            <span className="gas-banner-subtitle">{loadError}</span>
          </div>
          <button
            className="gas-btn gas-btn-sm gas-btn-secondary"
            onClick={() => void loadSettings()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="gas-loading">
          <div className="gas-spinner" />
          <span>Loading gateway settings...</span>
        </div>
      )}

      {/* Settings Sections */}
      {!loading && (
        <div className="gas-sections">
          {/* Network */}
          <div className="gas-section">
            {renderSectionHeader(SECTIONS[0])}
            {expandedSections.has('network') && renderNetworkSection()}
          </div>

          {/* Logging */}
          <div className="gas-section">
            {renderSectionHeader(SECTIONS[1])}
            {expandedSections.has('logging') && renderLoggingSection()}
          </div>

          {/* Context & Processing */}
          <div className="gas-section">
            {renderSectionHeader(SECTIONS[2])}
            {expandedSections.has('context') && renderContextSection()}
          </div>

          {/* Security */}
          <div className="gas-section">
            {renderSectionHeader(SECTIONS[3])}
            {expandedSections.has('security') && renderSecuritySection()}
          </div>

          {/* Config Management */}
          <div className="gas-section">
            {renderSectionHeader(SECTIONS[4])}
            {expandedSections.has('config') && renderConfigSection()}
          </div>
        </div>
      )}

      {/* Bottom save bar (persistent when dirty) */}
      {isDirty && !loading && (
        <div className="gas-save-bar">
          <div className="gas-save-bar-inner">
            <span className="gas-save-bar-text">You have unsaved changes</span>
            <div className="gas-save-bar-actions">
              <button
                className="gas-btn gas-btn-secondary"
                onClick={handleDiscard}
              >
                Discard
              </button>
              <button
                className="gas-btn gas-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="gas-spinner-small" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="gas-modal-overlay"
          onClick={() => {
            setShowResetConfirm(false);
            setResetConfirmText('');
          }}
        >
          <div className="gas-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gas-modal-header">
              <svg
                className="gas-modal-warn-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="28"
                height="28"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
              <h3 className="gas-modal-title">Reset All Gateway Settings</h3>
            </div>
            <p className="gas-modal-desc">
              This will overwrite <strong>all</strong> gateway configuration with factory
              defaults. This action cannot be undone. Any custom ports, CORS rules, security
              policies, and logging settings will be lost.
            </p>
            <div className="gas-modal-confirm-section">
              <label className="gas-modal-confirm-label">
                Type <code>RESET</code> to confirm:
              </label>
              <input
                type="text"
                className="gas-input gas-modal-confirm-input"
                value={resetConfirmText}
                placeholder="Type RESET"
                onChange={(e) => setResetConfirmText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="gas-modal-actions">
              <button
                className="gas-btn gas-btn-secondary"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
              >
                Cancel
              </button>
              <button
                className="gas-btn gas-btn-danger"
                onClick={handleReset}
                disabled={resetConfirmText !== 'RESET' || resetting}
              >
                {resetting ? (
                  <>
                    <div className="gas-spinner-small" />
                    Resetting...
                  </>
                ) : (
                  'Reset to Defaults'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Scoped Styles (gas- prefix)
   ================================================================ */

const advancedSettingsStyles = `

/* ==============================
   Banner System
   ============================== */

.gas-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
  animation: gas-slide-in 0.2s ease;
}

@keyframes gas-slide-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.gas-banner > svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.gas-banner-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.gas-banner-title {
  font-weight: 600;
  font-size: 0.8125rem;
}

.gas-banner-subtitle {
  font-size: 0.75rem;
  opacity: 0.85;
}

.gas-banner-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  align-items: center;
}

.gas-banner-warn {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.gas-banner-dirty {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);
  color: #a78bfa;
}

.gas-banner-success {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.gas-banner-error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

/* ==============================
   Loading
   ============================== */

.gas-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #a0a0a0;
}

.gas-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.08);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: gas-spin 0.8s linear infinite;
}

.gas-spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: gas-spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes gas-spin {
  to { transform: rotate(360deg); }
}

/* ==============================
   Sections Container
   ============================== */

.gas-sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.gas-section {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.2s ease;
}

.gas-section:hover {
  border-color: rgba(255,255,255,0.1);
}

/* ==============================
   Section Header (collapsible)
   ============================== */

.gas-section-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #e0e0e0;
  transition: background-color 0.15s ease;
  text-align: left;
}

.gas-section-header:hover {
  background: rgba(255,255,255,0.02);
}

.gas-section-header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.gas-section-icon {
  color: #8b5cf6;
  flex-shrink: 0;
  opacity: 0.9;
}

.gas-section-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.gas-section-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: #e0e0e0;
}

.gas-section-description {
  font-size: 0.75rem;
  color: #a0a0a0;
}

.gas-chevron {
  color: #a0a0a0;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.gas-chevron-open {
  transform: rotate(180deg);
}

/* ==============================
   Section Body
   ============================== */

.gas-section-body {
  padding: 0 1.25rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,0.04);
  animation: gas-expand 0.2s ease;
}

@keyframes gas-expand {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==============================
   Fields
   ============================== */

.gas-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.gas-field:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.gas-field:first-child {
  padding-top: 1rem;
}

.gas-field-column {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
}

.gas-field-info {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  flex: 1;
  min-width: 0;
}

.gas-field-label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #e0e0e0;
}

.gas-field-hint {
  font-size: 0.75rem;
  color: #a0a0a0;
}

.gas-danger-label {
  color: #ef4444;
}

/* ==============================
   Inputs
   ============================== */

.gas-input {
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  outline: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  min-width: 180px;
}

.gas-input:focus {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.04);
}

.gas-input::placeholder {
  color: rgba(255,255,255,0.25);
}

.gas-input-number {
  min-width: 100px;
  width: 100px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.gas-input-wide {
  min-width: 260px;
}

.gas-input-suffix-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.gas-input-suffix {
  font-size: 0.75rem;
  color: #a0a0a0;
  font-weight: 500;
}

/* ==============================
   Select
   ============================== */

.gas-select {
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #e0e0e0;
  cursor: pointer;
  outline: none;
  min-width: 160px;
  transition: border-color 0.15s ease;
}

.gas-select:focus {
  border-color: #8b5cf6;
}

.gas-select option {
  background: #1a1a2e;
  color: #e0e0e0;
}

/* ==============================
   Slider
   ============================== */

.gas-slider-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 200px;
}

.gas-slider-wide {
  min-width: 260px;
}

.gas-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  outline: none;
}

.gas-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #8b5cf6;
  border-radius: 50%;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.gas-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.2);
}

.gas-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #8b5cf6;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

.gas-slider-value {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #8b5cf6;
  min-width: 52px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ==============================
   Tags / Chips
   ============================== */

.gas-tags-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gas-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.gas-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem 0.25rem 0.625rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #c4b5fd;
  transition: all 0.15s ease;
}

.gas-tag:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
}

.gas-tag-text {
  font-family: monospace;
  font-size: 0.75rem;
}

.gas-tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(196, 181, 253, 0.6);
  cursor: pointer;
  padding: 0.125rem;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.gas-tag-remove:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.gas-tag-input-row {
  display: flex;
  gap: 0.5rem;
}

.gas-tag-input {
  flex: 1;
  min-width: 0;
}

/* ==============================
   Radio Group (Pruning Mode)
   ============================== */

.gas-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gas-radio-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gas-radio-option:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.1);
}

.gas-radio-selected {
  background: rgba(139, 92, 246, 0.06);
  border-color: rgba(139, 92, 246, 0.3);
}

.gas-radio-selected:hover {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.4);
}

.gas-radio-input {
  margin-top: 3px;
  accent-color: #8b5cf6;
  flex-shrink: 0;
}

.gas-radio-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.gas-radio-label {
  font-weight: 600;
  font-size: 0.8125rem;
  color: #e0e0e0;
}

.gas-radio-description {
  font-size: 0.75rem;
  color: #a0a0a0;
  line-height: 1.4;
}

/* ==============================
   Select Cards (Message Queue)
   ============================== */

.gas-select-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

@media (max-width: 640px) {
  .gas-select-cards {
    grid-template-columns: 1fr;
  }
}

.gas-select-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  color: #e0e0e0;
}

.gas-select-card:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
}

.gas-select-card-active {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.4);
}

.gas-select-card-active:hover {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.5);
}

.gas-select-card-label {
  font-weight: 600;
  font-size: 0.8125rem;
}

.gas-select-card-desc {
  font-size: 0.6875rem;
  color: #a0a0a0;
  line-height: 1.35;
}

.gas-select-card-active .gas-select-card-label {
  color: #c4b5fd;
}

/* ==============================
   Checkbox Group (Approval)
   ============================== */

.gas-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gas-checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.gas-checkbox-option:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.1);
}

.gas-checkbox-input {
  margin-top: 2px;
  accent-color: #8b5cf6;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.gas-checkbox-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.gas-checkbox-label {
  font-weight: 500;
  font-size: 0.8125rem;
  color: #e0e0e0;
}

.gas-checkbox-hint {
  font-size: 0.6875rem;
  color: #a0a0a0;
  line-height: 1.35;
}

/* ==============================
   Config Include List
   ============================== */

.gas-include-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.gas-include-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.gas-include-item:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.1);
}

.gas-include-icon {
  color: #a0a0a0;
  flex-shrink: 0;
}

.gas-include-path {
  flex: 1;
  font-family: monospace;
  font-size: 0.75rem;
  color: #c4b5fd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gas-include-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.gas-include-remove:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* ==============================
   Config Actions (Export/Import)
   ============================== */

.gas-config-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.gas-inline-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 0.75rem;
}

/* ==============================
   Buttons
   ============================== */

.gas-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  white-space: nowrap;
}

.gas-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gas-btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.gas-btn-primary {
  background: #8b5cf6;
  color: white;
}

.gas-btn-primary:hover:not(:disabled) {
  background: #7c3aed;
}

.gas-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: #e0e0e0;
  border: 1px solid rgba(255,255,255,0.1);
}

.gas-btn-secondary:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.16);
}

.gas-btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.gas-btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

.gas-btn-danger:disabled {
  opacity: 0.4;
}

/* ==============================
   Reset Confirmation (inline)
   ============================== */

.gas-reset-confirm {
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 8px;
  padding: 1rem;
}

.gas-reset-confirm-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.75rem;
}

.gas-reset-warn-icon {
  color: #ef4444;
  flex-shrink: 0;
}

.gas-reset-confirm-text {
  font-size: 0.8125rem;
  color: #fca5a5;
}

.gas-reset-confirm-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.gas-reset-input {
  flex: 1;
  max-width: 200px;
}

/* ==============================
   Save Bar (sticky bottom)
   ============================== */

.gas-save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem 0;
  margin-top: 1.5rem;
  z-index: 10;
}

.gas-save-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: rgba(30, 20, 60, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 10px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
}

.gas-save-bar-text {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #c4b5fd;
}

.gas-save-bar-actions {
  display: flex;
  gap: 0.5rem;
}

/* ==============================
   Modal (Reset Confirm)
   ============================== */

.gas-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: gas-fade-in 0.15s ease;
}

@keyframes gas-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.gas-modal {
  background: #151528;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 1.75rem;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(239, 68, 68, 0.1);
  animation: gas-modal-in 0.2s ease;
}

@keyframes gas-modal-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.gas-modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.gas-modal-warn-icon {
  color: #ef4444;
  flex-shrink: 0;
}

.gas-modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.gas-modal-desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  line-height: 1.5;
  margin: 0 0 1.25rem;
}

.gas-modal-desc strong {
  color: #e0e0e0;
}

.gas-modal-confirm-section {
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.12);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.25rem;
}

.gas-modal-confirm-label {
  display: block;
  font-size: 0.8125rem;
  color: #a0a0a0;
  margin-bottom: 0.5rem;
}

.gas-modal-confirm-label code {
  font-family: monospace;
  font-size: 0.875rem;
  color: #ef4444;
  font-weight: 700;
}

.gas-modal-confirm-input {
  width: 100%;
  box-sizing: border-box;
}

.gas-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* ==============================
   Responsive
   ============================== */

@media (max-width: 640px) {
  .gas-field:not(.gas-field-column) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .gas-slider-group,
  .gas-slider-wide {
    min-width: 0;
    width: 100%;
  }

  .gas-input-wide {
    min-width: 0;
    width: 100%;
  }

  .gas-save-bar-inner {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }

  .gas-banner {
    flex-wrap: wrap;
  }

  .gas-banner-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .gas-reset-confirm-input-row {
    flex-wrap: wrap;
  }
}
`;
