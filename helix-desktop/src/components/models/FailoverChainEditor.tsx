/**
 * Model Failover Chain Editor - Phase I, Task I1
 *
 * Full-featured model failover chain editor with:
 *   - Primary model selector dropdown
 *   - Drag-and-drop fallback chain reordering
 *   - Per-agent model overrides table
 *   - Model scan/discovery button
 *   - Image model selector
 *   - Thinking level default (off/low/high)
 *
 * Gateway methods used:
 *   - models.list       -> Available models
 *   - models.scan       -> Discover models from providers
 *   - agents.list       -> List agents for per-agent overrides
 *   - config.get        -> Read model config
 *   - config.patch      -> Write model config
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Model {
  id: string;
  name: string;
  provider: string;
  capabilities?: string[];
  contextWindow?: number;
  supportsVision?: boolean;
  supportsThinking?: boolean;
  maxOutputTokens?: number;
}

interface AgentOverride {
  agentId: string;
  agentName: string;
  modelId: string | null;
  isDefault?: boolean;
}

interface ModelConfig {
  primary: string;
  fallback: string[];
  image: string;
  thinking: ThinkingLevel;
}

type ThinkingLevel = 'off' | 'low' | 'high';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_META: Record<string, { label: string; color: string; abbr: string }> = {
  anthropic: { label: 'Anthropic', color: '#d4a574', abbr: 'ANT' },
  openai: { label: 'OpenAI', color: '#74b884', abbr: 'OAI' },
  google: { label: 'Google', color: '#7494d4', abbr: 'GGL' },
  deepseek: { label: 'DeepSeek', color: '#c474d4', abbr: 'DSK' },
  local: { label: 'Local', color: '#d4d474', abbr: 'LOC' },
  mistral: { label: 'Mistral', color: '#d47474', abbr: 'MIS' },
  meta: { label: 'Meta', color: '#74d4c4', abbr: 'MTA' },
  xai: { label: 'xAI', color: '#b4b4b4', abbr: 'XAI' },
};

/** Fallback models when gateway is not connected or models.list returns empty. */
const DEFAULT_MODELS: Model[] = [
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', provider: 'anthropic', supportsThinking: true, supportsVision: true, contextWindow: 200000 },
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'anthropic', supportsThinking: true, supportsVision: true, contextWindow: 200000 },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', supportsThinking: true, supportsVision: true, contextWindow: 200000 },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', supportsVision: true, contextWindow: 200000 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', supportsVision: true, contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', supportsVision: true, contextWindow: 128000 },
  { id: 'o3', name: 'o3', provider: 'openai', supportsThinking: true, contextWindow: 200000 },
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai', supportsThinking: true, contextWindow: 200000 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', supportsVision: true, contextWindow: 1000000 },
  { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'google', supportsVision: true, contextWindow: 1000000 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', supportsThinking: true, supportsVision: true, contextWindow: 1000000 },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', contextWindow: 64000 },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', supportsThinking: true, contextWindow: 64000 },
];

const THINKING_LEVELS: { id: ThinkingLevel; label: string; desc: string }[] = [
  { id: 'off', label: 'Off', desc: 'No extended thinking' },
  { id: 'low', label: 'Low', desc: 'Quick reasoning' },
  { id: 'high', label: 'High', desc: 'Deep analysis' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProviderMeta(provider: string): { label: string; color: string; abbr: string } {
  return PROVIDER_META[provider.toLowerCase()] ?? { label: provider, color: '#888', abbr: provider.slice(0, 3).toUpperCase() };
}

function getModelName(models: Model[], modelId: string): string {
  const found = models.find((m) => m.id === modelId);
  if (found) return found.name;
  // Fallback: humanize the id
  return modelId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getModelProvider(models: Model[], modelId: string): string {
  const found = models.find((m) => m.id === modelId);
  return found?.provider ?? 'unknown';
}

function formatContextWindow(tokens: number | undefined): string {
  if (!tokens) return '';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return String(tokens);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Provider badge pill shown on model chips. */
function ProviderBadge({ provider }: { provider: string }) {
  const meta = getProviderMeta(provider);
  return (
    <span
      className="mfc-provider-badge"
      style={{ borderColor: meta.color, color: meta.color }}
    >
      {meta.abbr}
    </span>
  );
}

/** A single model chip in the fallback chain list. */
function FallbackChip({
  modelId,
  index,
  models,
  isDragging,
  isOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onRemove,
}: {
  modelId: string;
  index: number;
  models: Model[];
  isDragging: boolean;
  isOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onRemove: (index: number) => void;
}) {
  const provider = getModelProvider(models, modelId);
  const name = getModelName(models, modelId);

  return (
    <div
      className={`mfc-chip ${isDragging ? 'mfc-chip--dragging' : ''} ${isOver ? 'mfc-chip--over' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(e, index);
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
    >
      <span className="mfc-chip__handle" title="Drag to reorder">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="3" cy="2" r="1.2" />
          <circle cx="3" cy="6" r="1.2" />
          <circle cx="3" cy="10" r="1.2" />
          <circle cx="9" cy="2" r="1.2" />
          <circle cx="9" cy="6" r="1.2" />
          <circle cx="9" cy="10" r="1.2" />
        </svg>
      </span>
      <span className="mfc-chip__index">{index + 1}</span>
      <span className="mfc-chip__name">{name}</span>
      <ProviderBadge provider={provider} />
      <button
        className="mfc-chip__remove"
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        title="Remove from fallback chain"
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
        </svg>
      </button>
    </div>
  );
}

/** The add-fallback dropdown that appears at the bottom of the chain. */
function AddFallbackButton({
  models,
  existingIds,
  primaryId,
  onAdd,
}: {
  models: Model[];
  existingIds: string[];
  primaryId: string;
  onAdd: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Group available models by provider
  const available = useMemo(() => {
    const excluded = new Set([...existingIds, primaryId]);
    return models.filter((m) => !excluded.has(m.id));
  }, [models, existingIds, primaryId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of available) {
      const list = map.get(m.provider) ?? [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [available]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (available.length === 0) return null;

  return (
    <div className="mfc-add-fallback" ref={ref}>
      <button
        className="mfc-add-fallback__btn"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M7 2v10M2 7h10" />
        </svg>
        Add Fallback Model
      </button>
      {open && (
        <div className="mfc-add-fallback__dropdown">
          {Array.from(grouped.entries()).map(([provider, provModels]) => {
            const meta = getProviderMeta(provider);
            return (
              <div key={provider} className="mfc-add-fallback__group">
                <div className="mfc-add-fallback__group-label" style={{ color: meta.color }}>
                  {meta.label}
                </div>
                {provModels.map((m) => (
                  <button
                    key={m.id}
                    className="mfc-add-fallback__option"
                    onClick={() => { onAdd(m.id); setOpen(false); }}
                    type="button"
                  >
                    <span className="mfc-add-fallback__option-name">{m.name}</span>
                    {m.contextWindow && (
                      <span className="mfc-add-fallback__option-ctx">
                        {formatContextWindow(m.contextWindow)}
                      </span>
                    )}
                    {m.supportsVision && (
                      <span className="mfc-add-fallback__option-cap" title="Vision">V</span>
                    )}
                    {m.supportsThinking && (
                      <span className="mfc-add-fallback__option-cap" title="Thinking">T</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Agent override row in the per-agent table. */
function AgentOverrideRow({
  override,
  models,
  onChangeModel,
}: {
  override: AgentOverride;
  models: Model[];
  onChangeModel: (agentId: string, modelId: string | null) => void;
}) {
  const currentModel = override.modelId
    ? getModelName(models, override.modelId)
    : null;
  const currentProvider = override.modelId
    ? getModelProvider(models, override.modelId)
    : null;

  return (
    <tr className="mfc-override-row">
      <td className="mfc-override-row__agent">
        <span className="mfc-override-row__name">{override.agentName}</span>
        {override.isDefault && (
          <span className="mfc-override-row__default">Default</span>
        )}
      </td>
      <td className="mfc-override-row__model">
        {currentModel && currentProvider && (
          <span className="mfc-override-row__current">
            <ProviderBadge provider={currentProvider} />
            {currentModel}
          </span>
        )}
        {!currentModel && (
          <span className="mfc-override-row__inherit">Uses primary</span>
        )}
      </td>
      <td className="mfc-override-row__action">
        <select
          className="mfc-override-row__select"
          value={override.modelId ?? ''}
          onChange={(e) => onChangeModel(override.agentId, e.target.value || null)}
        >
          <option value="">Use primary model</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {getProviderMeta(m.provider).abbr} / {m.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function FailoverChainEditor() {
  const { getClient, connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig, fetchConfig } = useGatewayConfig();

  // ---- State ----
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [primaryModel, setPrimaryModel] = useState<string>('claude-sonnet-4-20250514');
  const [fallbackChain, setFallbackChain] = useState<string[]>([]);
  const [imageModel, setImageModel] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('high');
  const [agentOverrides, setAgentOverrides] = useState<AgentOverride[]>([]);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Track initial config for dirty detection
  const initialConfigRef = useRef<ModelConfig | null>(null);

  // ---- Auto-dismiss success messages ----
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

  // ---- Load models and config on mount / connect ----
  const loadModels = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      const result = await client.request<{ models?: Model[] }>('models.list');
      if (result.models && result.models.length > 0) {
        setModels(result.models);
      }
    } catch {
      // Fall through to default models
    }
  }, [getClient]);

  const loadConfig = useCallback(async () => {
    const client = getClient();

    // Try gateway first
    if (client?.connected) {
      try {
        const result = await client.request<{
          value?: ModelConfig;
        }>('config.get', { path: 'agents.defaults.model' });

        if (result.value) {
          setPrimaryModel(result.value.primary || 'claude-sonnet-4-20250514');
          setFallbackChain(result.value.fallback || []);
          setImageModel(result.value.image || '');
          setThinkingLevel(result.value.thinking || 'high');

          initialConfigRef.current = {
            primary: result.value.primary || 'claude-sonnet-4-20250514',
            fallback: result.value.fallback || [],
            image: result.value.image || '',
            thinking: result.value.thinking || 'high',
          };
          setDirty(false);
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to gatewayConfig hydration
      }
    }

    // Hydrate from gatewayConfig store
    if (gatewayConfig?.agents?.defaults) {
      const defaults = gatewayConfig.agents.defaults;
      const primary = defaults.model || 'claude-sonnet-4-20250514';
      setPrimaryModel(primary);
      setThinkingLevel((defaults.thinkingLevel as ThinkingLevel) || 'high');
      initialConfigRef.current = {
        primary,
        fallback: [],
        image: '',
        thinking: (defaults.thinkingLevel as ThinkingLevel) || 'high',
      };
    }

    setDirty(false);
    setLoading(false);
  }, [getClient, gatewayConfig]);

  const loadAgentOverrides = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    try {
      const result = await client.request<{
        agents?: Array<{
          id: string;
          name?: string;
          modelConfig?: { model?: string };
          isDefault?: boolean;
        }>;
      }>('agents.list');

      if (result.agents) {
        setAgentOverrides(
          result.agents.map((a, idx) => ({
            agentId: a.id,
            agentName: a.name ?? a.id,
            modelId: a.modelConfig?.model ?? null,
            isDefault: a.isDefault ?? idx === 0,
          }))
        );
      }
    } catch {
      // Hydrate from gatewayConfig
      if (gatewayConfig?.agents?.list) {
        setAgentOverrides(
          gatewayConfig.agents.list.map((a, idx) => ({
            agentId: a.id,
            agentName: a.name ?? a.id,
            modelId: a.model ?? null,
            isDefault: idx === 0,
          }))
        );
      }
    }
  }, [getClient, gatewayConfig]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadModels(), loadConfig(), loadAgentOverrides()]).finally(() => {
      setLoading(false);
    });
  }, [loadModels, loadConfig, loadAgentOverrides, connected]);

  // ---- Dirty tracking ----
  useEffect(() => {
    if (!initialConfigRef.current) return;
    const initial = initialConfigRef.current;
    const isDirty =
      primaryModel !== initial.primary ||
      imageModel !== initial.image ||
      thinkingLevel !== initial.thinking ||
      JSON.stringify(fallbackChain) !== JSON.stringify(initial.fallback);
    setDirty(isDirty);
  }, [primaryModel, fallbackChain, imageModel, thinkingLevel]);

  // ---- Drag and drop handlers ----
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    setOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (_e: React.DragEvent, toIndex: number) => {
      if (dragIndex === null || dragIndex === toIndex) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }

      setFallbackChain((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });

      setDragIndex(null);
      setOverIndex(null);
    },
    [dragIndex]
  );

  const removeFallback = useCallback((index: number) => {
    setFallbackChain((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addFallback = useCallback((modelId: string) => {
    setFallbackChain((prev) => [...prev, modelId]);
  }, []);

  // ---- Model scan ----
  const handleScan = useCallback(async () => {
    const client = getClient();
    if (!client?.connected) return;

    setScanning(true);
    setScanResult(null);
    setError(null);

    try {
      const result = await client.request<{
        discovered?: number;
        models?: Model[];
        message?: string;
      }>('models.scan');

      if (result.models && result.models.length > 0) {
        setModels(result.models);
        setScanResult(
          `Discovered ${result.discovered ?? result.models.length} model${(result.discovered ?? result.models.length) !== 1 ? 's' : ''} across providers`
        );
      } else {
        setScanResult(result.message ?? 'Scan complete. No new models discovered.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model scan failed');
    } finally {
      setScanning(false);
    }
  }, [getClient]);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await patchGatewayConfig({
        agents: {
          ...gatewayConfig.agents,
          defaults: {
            ...gatewayConfig.agents?.defaults,
            model: primaryModel,
            thinkingLevel,
          },
        },
      });

      // Also patch the model failover config under the dedicated path
      const client = getClient();
      if (client?.connected) {
        try {
          await client.request('config.patch', {
            patch: {
              path: 'agents.defaults.model',
              value: {
                primary: primaryModel,
                fallback: fallbackChain,
                image: imageModel,
                thinking: thinkingLevel,
              },
            },
          });
        } catch {
          // The patchGatewayConfig above already saved essentials
        }
      }

      initialConfigRef.current = {
        primary: primaryModel,
        fallback: [...fallbackChain],
        image: imageModel,
        thinking: thinkingLevel,
      };
      setDirty(false);
      setSuccess('Model configuration saved');
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model configuration');
    } finally {
      setSaving(false);
    }
  }, [
    primaryModel,
    fallbackChain,
    imageModel,
    thinkingLevel,
    gatewayConfig,
    patchGatewayConfig,
    fetchConfig,
    getClient,
  ]);

  // ---- Save agent override ----
  const handleAgentOverrideChange = useCallback(
    async (agentId: string, modelId: string | null) => {
      // Optimistic update
      setAgentOverrides((prev) =>
        prev.map((o) => (o.agentId === agentId ? { ...o, modelId } : o))
      );

      const client = getClient();
      if (client?.connected) {
        try {
          const agentList = gatewayConfig?.agents?.list ?? [];
          const updatedList = agentList.map((a) =>
            a.id === agentId ? { ...a, model: modelId ?? undefined } : a
          );

          await patchGatewayConfig({
            agents: {
              ...gatewayConfig.agents,
              list: updatedList,
            },
          });
        } catch (err) {
          // Revert
          setAgentOverrides((prev) =>
            prev.map((o) =>
              o.agentId === agentId ? { ...o, modelId: o.modelId } : o
            )
          );
          setError(err instanceof Error ? err.message : 'Failed to update agent model');
        }
      }
    },
    [getClient, gatewayConfig, patchGatewayConfig]
  );

  // ---- Discard changes ----
  const handleDiscard = useCallback(() => {
    if (!initialConfigRef.current) return;
    const initial = initialConfigRef.current;
    setPrimaryModel(initial.primary);
    setFallbackChain([...initial.fallback]);
    setImageModel(initial.image);
    setThinkingLevel(initial.thinking);
    setDirty(false);
  }, []);

  // ---- Derived data ----
  const visionModels = useMemo(
    () => models.filter((m) => m.supportsVision),
    [models]
  );

  const groupedModels = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of models) {
      const list = map.get(m.provider) ?? [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [models]);

  const primaryModelObj = useMemo(
    () => models.find((m) => m.id === primaryModel),
    [models, primaryModel]
  );

  // =============================================
  // RENDER
  // =============================================

  return (
    <>
      <style>{failoverChainStyles}</style>
      <div className="mfc-container">

        {/* ---- Header ---- */}
        <header className="mfc-header">
          <div className="mfc-header__text">
            <h2 className="mfc-header__title">Model Configuration</h2>
            <p className="mfc-header__subtitle">
              Configure primary model, fallback chain, and per-agent overrides
            </p>
          </div>
          <div className="mfc-header__actions">
            <button
              className="mfc-btn mfc-btn--secondary mfc-btn--sm"
              onClick={handleScan}
              disabled={scanning || !connected}
              title={!connected ? 'Gateway not connected' : 'Scan providers for available models'}
              type="button"
            >
              {scanning ? (
                <>
                  <span className="mfc-btn__spinner" />
                  Scanning...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="6" r="4" />
                    <path d="M12.5 12.5L9.2 9.2" />
                  </svg>
                  Scan Models
                </>
              )}
            </button>
          </div>
        </header>

        {/* ---- Banners ---- */}
        {!connected && (
          <div className="mfc-banner mfc-banner--warn">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Gateway disconnected. Changes will be saved locally and synced when reconnected.
          </div>
        )}

        {error && (
          <div className="mfc-banner mfc-banner--error">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
            <button className="mfc-banner__dismiss" onClick={() => setError(null)} type="button">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
              </svg>
            </button>
          </div>
        )}

        {success && (
          <div className="mfc-banner mfc-banner--success">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        )}

        {scanResult && (
          <div className="mfc-banner mfc-banner--info">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {scanResult}
            <button className="mfc-banner__dismiss" onClick={() => setScanResult(null)} type="button">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ---- Loading ---- */}
        {loading ? (
          <div className="mfc-loading">
            <div className="mfc-loading__spinner" />
            <span>Loading model configuration...</span>
          </div>
        ) : (
          <div className="mfc-layout">

            {/* ==================== LEFT COLUMN ==================== */}
            <div className="mfc-col">

              {/* ---- Primary Model ---- */}
              <section className="mfc-section">
                <h3 className="mfc-section__title">Primary Model</h3>
                <p className="mfc-section__desc">
                  The default model used for all conversations and agent tasks.
                </p>

                <div className="mfc-field">
                  <label className="mfc-label">Model</label>
                  <select
                    className="mfc-select"
                    value={primaryModel}
                    onChange={(e) => setPrimaryModel(e.target.value)}
                  >
                    {Array.from(groupedModels.entries()).map(([provider, provModels]) => {
                      const meta = getProviderMeta(provider);
                      return (
                        <optgroup key={provider} label={meta.label}>
                          {provModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                              {m.contextWindow ? ` (${formatContextWindow(m.contextWindow)})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                {/* Primary model details card */}
                {primaryModelObj && (
                  <div className="mfc-model-card">
                    <div className="mfc-model-card__header">
                      <ProviderBadge provider={primaryModelObj.provider} />
                      <span className="mfc-model-card__name">{primaryModelObj.name}</span>
                    </div>
                    <div className="mfc-model-card__caps">
                      {primaryModelObj.contextWindow && (
                        <span className="mfc-model-card__cap">
                          {formatContextWindow(primaryModelObj.contextWindow)} context
                        </span>
                      )}
                      {primaryModelObj.supportsVision && (
                        <span className="mfc-model-card__cap mfc-model-card__cap--vision">
                          Vision
                        </span>
                      )}
                      {primaryModelObj.supportsThinking && (
                        <span className="mfc-model-card__cap mfc-model-card__cap--thinking">
                          Thinking
                        </span>
                      )}
                      {primaryModelObj.maxOutputTokens && (
                        <span className="mfc-model-card__cap">
                          {formatContextWindow(primaryModelObj.maxOutputTokens)} output
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* ---- Fallback Chain ---- */}
              <section className="mfc-section">
                <h3 className="mfc-section__title">Fallback Chain</h3>
                <p className="mfc-section__desc">
                  When the primary model is unavailable, the system tries each fallback in order.
                  Drag to reorder priority.
                </p>

                {fallbackChain.length === 0 ? (
                  <div className="mfc-chain-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <span>No fallback models configured</span>
                    <span className="mfc-chain-empty__hint">
                      Add models below to create a resilience chain
                    </span>
                  </div>
                ) : (
                  <div
                    className="mfc-chain-list"
                    onDragLeave={() => setOverIndex(null)}
                  >
                    {fallbackChain.map((modelId, index) => (
                      <FallbackChip
                        key={`${modelId}-${index}`}
                        modelId={modelId}
                        index={index}
                        models={models}
                        isDragging={dragIndex === index}
                        isOver={overIndex === index}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                        onDrop={handleDrop}
                        onRemove={removeFallback}
                      />
                    ))}
                  </div>
                )}

                <AddFallbackButton
                  models={models}
                  existingIds={fallbackChain}
                  primaryId={primaryModel}
                  onAdd={addFallback}
                />

                {fallbackChain.length > 0 && (
                  <div className="mfc-chain-summary">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" opacity="0.5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>
                      Failover path: {getModelName(models, primaryModel)}
                      {fallbackChain.map((id, i) => (
                        <span key={i}>
                          {' '}<span className="mfc-chain-summary__arrow">-&gt;</span>{' '}
                          {getModelName(models, id)}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </section>
            </div>

            {/* ==================== RIGHT COLUMN ==================== */}
            <div className="mfc-col">

              {/* ---- Image Model ---- */}
              <section className="mfc-section">
                <h3 className="mfc-section__title">Image / Vision Model</h3>
                <p className="mfc-section__desc">
                  Model used for tasks requiring image understanding or generation.
                </p>

                <div className="mfc-field">
                  <label className="mfc-label">Vision-capable Model</label>
                  <select
                    className="mfc-select"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                  >
                    <option value="">Same as primary</option>
                    {visionModels.map((m) => {
                      const meta = getProviderMeta(m.provider);
                      return (
                        <option key={m.id} value={m.id}>
                          [{meta.abbr}] {m.name}
                        </option>
                      );
                    })}
                  </select>
                  <span className="mfc-hint">
                    Leave as "Same as primary" if your primary model supports vision.
                  </span>
                </div>
              </section>

              {/* ---- Thinking Level ---- */}
              <section className="mfc-section">
                <h3 className="mfc-section__title">Thinking Level</h3>
                <p className="mfc-section__desc">
                  Default extended thinking behavior for models that support it.
                </p>

                <div className="mfc-thinking-grid">
                  {THINKING_LEVELS.map((tl) => (
                    <button
                      key={tl.id}
                      className={`mfc-thinking-btn ${thinkingLevel === tl.id ? 'mfc-thinking-btn--selected' : ''}`}
                      onClick={() => setThinkingLevel(tl.id)}
                      type="button"
                    >
                      <span className="mfc-thinking-btn__indicator">
                        {tl.id === 'off' && (
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="9" cy="9" r="6" opacity="0.3" />
                            <path d="M5 13L13 5" />
                          </svg>
                        )}
                        {tl.id === 'low' && (
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="9" cy="9" r="6" opacity="0.4" />
                            <path d="M9 6v3l2 1" />
                          </svg>
                        )}
                        {tl.id === 'high' && (
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <circle cx="9" cy="9" r="6" />
                            <path d="M9 5v4l3 1.5" />
                            <circle cx="9" cy="9" r="2" fill="currentColor" opacity="0.3" />
                          </svg>
                        )}
                      </span>
                      <span className="mfc-thinking-btn__label">{tl.label}</span>
                      <span className="mfc-thinking-btn__desc">{tl.desc}</span>
                    </button>
                  ))}
                </div>

                {primaryModelObj && !primaryModelObj.supportsThinking && thinkingLevel !== 'off' && (
                  <div className="mfc-thinking-warn">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {primaryModelObj.name} does not support extended thinking. This setting will be ignored for the primary model but applied to fallbacks that support it.
                    </span>
                  </div>
                )}
              </section>

              {/* ---- Per-Agent Model Overrides ---- */}
              <section className="mfc-section">
                <h3 className="mfc-section__title">Per-Agent Overrides</h3>
                <p className="mfc-section__desc">
                  Override the primary model for specific agents. Agents without an override use the primary model.
                </p>

                {agentOverrides.length === 0 ? (
                  <div className="mfc-overrides-empty">
                    <span>No agents configured. Create agents in the Agent Manager.</span>
                  </div>
                ) : (
                  <div className="mfc-overrides-table-wrap">
                    <table className="mfc-overrides-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Model</th>
                          <th>Override</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentOverrides.map((override) => (
                          <AgentOverrideRow
                            key={override.agentId}
                            override={override}
                            models={models}
                            onChangeModel={handleAgentOverrideChange}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ---- Sticky Save Bar ---- */}
        {dirty && (
          <div className="mfc-save-bar">
            <span className="mfc-save-bar__label">Unsaved changes</span>
            <div className="mfc-save-bar__actions">
              <button
                className="mfc-btn mfc-btn--secondary"
                onClick={handleDiscard}
                disabled={saving}
                type="button"
              >
                Discard
              </button>
              <button
                className="mfc-btn mfc-btn--primary"
                onClick={handleSave}
                disabled={saving}
                type="button"
              >
                {saving ? (
                  <>
                    <span className="mfc-btn__spinner" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles (mfc- prefix)
// ---------------------------------------------------------------------------

const failoverChainStyles = `
/* =========================================================================
   Container
   ========================================================================= */

.mfc-container {
  padding: 1.5rem;
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.mfc-container::-webkit-scrollbar {
  width: 6px;
}

.mfc-container::-webkit-scrollbar-track {
  background: transparent;
}

.mfc-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.mfc-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* =========================================================================
   Header
   ========================================================================= */

.mfc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.mfc-header__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #e0e0e0;
  margin: 0 0 0.25rem;
}

.mfc-header__subtitle {
  font-size: 0.875rem;
  color: #a0a0a0;
  margin: 0;
}

.mfc-header__actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* =========================================================================
   Layout (two columns)
   ========================================================================= */

.mfc-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding-bottom: 4rem;
}

@media (max-width: 960px) {
  .mfc-layout {
    grid-template-columns: 1fr;
  }
}

.mfc-col {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* =========================================================================
   Sections
   ========================================================================= */

.mfc-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.25rem;
}

.mfc-section__title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8b5cf6;
  margin: 0 0 0.375rem;
}

.mfc-section__desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  margin: 0 0 1rem;
  line-height: 1.45;
}

/* =========================================================================
   Fields
   ========================================================================= */

.mfc-field {
  margin-bottom: 1rem;
}

.mfc-field:last-child {
  margin-bottom: 0;
}

.mfc-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e0e0e0;
  margin-bottom: 0.375rem;
}

.mfc-hint {
  display: block;
  font-size: 0.75rem;
  color: #707070;
  margin-top: 0.375rem;
}

.mfc-select {
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 0.875rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.875rem;
  color: #e0e0e0;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23707070' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  font-family: inherit;
}

.mfc-select:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

.mfc-select option,
.mfc-select optgroup {
  background: #1a1a2e;
  color: #e0e0e0;
}

/* =========================================================================
   Model Detail Card (shown below primary selector)
   ========================================================================= */

.mfc-model-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 0.75rem;
}

.mfc-model-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.mfc-model-card__name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e0e0e0;
}

.mfc-model-card__caps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.mfc-model-card__cap {
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #a0a0a0;
  font-weight: 500;
}

.mfc-model-card__cap--vision {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.mfc-model-card__cap--thinking {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

/* =========================================================================
   Provider Badge
   ========================================================================= */

.mfc-provider-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  border: 1px solid;
  background: transparent;
  flex-shrink: 0;
}

/* =========================================================================
   Fallback Chain
   ========================================================================= */

.mfc-chain-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.mfc-chain-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #707070;
  font-size: 0.8125rem;
  text-align: center;
  margin-bottom: 0.75rem;
}

.mfc-chain-empty__hint {
  font-size: 0.75rem;
  color: #555;
}

/* Chip */
.mfc-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s ease;
  user-select: none;
}

.mfc-chip:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.mfc-chip--dragging {
  opacity: 0.4;
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.08);
}

.mfc-chip--over {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  transform: translateY(-1px);
}

.mfc-chip__handle {
  color: #505050;
  display: flex;
  align-items: center;
  cursor: grab;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.mfc-chip:hover .mfc-chip__handle {
  color: #a0a0a0;
}

.mfc-chip__index {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
  border-radius: 4px;
  flex-shrink: 0;
}

.mfc-chip__name {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mfc-chip__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #606060;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.mfc-chip__remove:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

/* Add fallback button */
.mfc-add-fallback {
  position: relative;
}

.mfc-add-fallback__btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: 1px dashed rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  color: #8b5cf6;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mfc-add-fallback__btn:hover {
  background: rgba(139, 92, 246, 0.06);
  border-color: rgba(139, 92, 246, 0.5);
}

.mfc-add-fallback__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 280px;
  overflow-y: auto;
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 0.375rem;
  z-index: 50;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  animation: mfc-dropdown-in 0.12s ease;
}

@keyframes mfc-dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mfc-add-fallback__dropdown::-webkit-scrollbar {
  width: 4px;
}

.mfc-add-fallback__dropdown::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.mfc-add-fallback__group {
  margin-bottom: 0.25rem;
}

.mfc-add-fallback__group:last-child {
  margin-bottom: 0;
}

.mfc-add-fallback__group-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 0.375rem 0.5rem 0.25rem;
  opacity: 0.7;
}

.mfc-add-fallback__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
  font-family: inherit;
}

.mfc-add-fallback__option:hover {
  background: rgba(139, 92, 246, 0.1);
}

.mfc-add-fallback__option-name {
  flex: 1;
}

.mfc-add-fallback__option-ctx {
  font-size: 0.6875rem;
  color: #707070;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.mfc-add-fallback__option-cap {
  font-size: 0.5625rem;
  font-weight: 700;
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
}

/* Chain summary */
.mfc-chain-summary {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: rgba(139, 92, 246, 0.04);
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #a0a0a0;
  margin-top: 0.75rem;
  line-height: 1.5;
}

.mfc-chain-summary__arrow {
  color: #8b5cf6;
  font-weight: 700;
}

/* =========================================================================
   Thinking Level
   ========================================================================= */

.mfc-thinking-grid {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 500px) {
  .mfc-thinking-grid {
    flex-direction: column;
  }
}

.mfc-thinking-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 1rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mfc-thinking-btn:hover {
  border-color: rgba(139, 92, 246, 0.3);
  background: rgba(255, 255, 255, 0.04);
}

.mfc-thinking-btn--selected {
  background: rgba(139, 92, 246, 0.08);
  border-color: #8b5cf6;
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.15);
}

.mfc-thinking-btn__indicator {
  color: #707070;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mfc-thinking-btn--selected .mfc-thinking-btn__indicator {
  color: #8b5cf6;
}

.mfc-thinking-btn__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #e0e0e0;
}

.mfc-thinking-btn__desc {
  font-size: 0.6875rem;
  color: #707070;
}

.mfc-thinking-btn--selected .mfc-thinking-btn__desc {
  color: #a0a0a0;
}

.mfc-thinking-warn {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #fbbf24;
  margin-top: 0.75rem;
  line-height: 1.45;
}

.mfc-thinking-warn svg {
  flex-shrink: 0;
  margin-top: 0.05rem;
}

/* =========================================================================
   Per-Agent Overrides Table
   ========================================================================= */

.mfc-overrides-empty {
  padding: 1.5rem;
  text-align: center;
  color: #707070;
  font-size: 0.8125rem;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.mfc-overrides-table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.mfc-overrides-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.mfc-overrides-table th {
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #707070;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.mfc-override-row td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  vertical-align: middle;
}

.mfc-override-row:last-child td {
  border-bottom: none;
}

.mfc-override-row:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.mfc-override-row__name {
  font-weight: 500;
  color: #e0e0e0;
}

.mfc-override-row__default {
  display: inline-block;
  margin-left: 0.375rem;
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.0625rem 0.3125rem;
  border-radius: 3px;
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
  vertical-align: middle;
}

.mfc-override-row__current {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #e0e0e0;
}

.mfc-override-row__inherit {
  color: #707070;
  font-style: italic;
  font-size: 0.75rem;
}

.mfc-override-row__select {
  width: 100%;
  max-width: 200px;
  padding: 0.375rem 2rem 0.375rem 0.625rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: #e0e0e0;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23707070' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  font-family: inherit;
  transition: border-color 0.15s ease;
}

.mfc-override-row__select:focus {
  outline: none;
  border-color: #8b5cf6;
}

.mfc-override-row__select option {
  background: #1a1a2e;
  color: #e0e0e0;
}

/* =========================================================================
   Banners
   ========================================================================= */

.mfc-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.mfc-banner svg {
  flex-shrink: 0;
}

.mfc-banner--warn {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.mfc-banner--error {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.mfc-banner--success {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #4ade80;
  animation: mfc-banner-in 0.2s ease;
}

.mfc-banner--info {
  background: rgba(139, 92, 246, 0.06);
  border: 1px solid rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

@keyframes mfc-banner-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.mfc-banner__dismiss {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.5;
  border-radius: 4px;
  transition: opacity 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
}

.mfc-banner__dismiss:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

/* =========================================================================
   Loading
   ========================================================================= */

.mfc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem;
  color: #707070;
  font-size: 0.875rem;
}

.mfc-loading__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: mfc-spin 0.7s linear infinite;
}

@keyframes mfc-spin {
  to { transform: rotate(360deg); }
}

/* =========================================================================
   Buttons
   ========================================================================= */

.mfc-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  border: none;
  white-space: nowrap;
}

.mfc-btn--sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.mfc-btn--primary {
  background: #8b5cf6;
  color: #ffffff;
}

.mfc-btn--primary:hover:not(:disabled) {
  background: #7c3aed;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
}

.mfc-btn--primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mfc-btn--secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #a0a0a0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mfc-btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #e0e0e0;
}

.mfc-btn--secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mfc-btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: mfc-spin 0.6s linear infinite;
  flex-shrink: 0;
}

/* =========================================================================
   Sticky Save Bar
   ========================================================================= */

.mfc-save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.5rem;
  background: rgba(18, 18, 32, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(139, 92, 246, 0.2);
  margin: 0 -1.5rem -1.5rem;
  animation: mfc-save-bar-in 0.2s ease;
  z-index: 10;
}

@keyframes mfc-save-bar-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mfc-save-bar__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #a78bfa;
}

.mfc-save-bar__actions {
  display: flex;
  gap: 0.625rem;
}

/* =========================================================================
   Responsive
   ========================================================================= */

@media (max-width: 768px) {
  .mfc-container {
    padding: 1rem;
  }

  .mfc-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .mfc-thinking-grid {
    flex-direction: column;
  }

  .mfc-save-bar {
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
    margin: 0 -1rem -1rem;
    padding: 0.875rem 1rem;
  }

  .mfc-save-bar__actions {
    width: 100%;
  }

  .mfc-save-bar__actions .mfc-btn {
    flex: 1;
    justify-content: center;
  }

  .mfc-override-row__select {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .mfc-section {
    padding: 1rem;
  }

  .mfc-chip {
    padding: 0.375rem 0.5rem;
    gap: 0.375rem;
  }
}
`;
