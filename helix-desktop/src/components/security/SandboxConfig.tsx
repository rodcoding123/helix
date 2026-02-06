/**
 * SandboxConfig - Docker-based sandbox configuration for agent command execution
 *
 * Controls:
 *   1. Sandbox Mode     - Off / Non-main agents / All agents
 *   2. Docker Settings  - Image, network, memory, CPU, workspace access
 *   3. Security Policies - Host networking, privileged mode, Docker socket, persistence
 *   4. Per-Agent Overrides (when no agentId prop) - Table of agent sandbox overrides
 *
 * Gateway methods:
 *   - config.patch (agents.defaults.sandbox.*) - Persist sandbox settings
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useGatewayConfig } from '../../hooks/useGatewayConfig';

/* ===================================================================
   Types
   =================================================================== */

export interface SandboxConfigProps {
  agentId?: string;
  agentName?: string;
  onBack?: () => void;
}

type SandboxMode = 'off' | 'non-main' | 'all';
type NetworkMode = 'none' | 'bridge' | 'host';
type WorkspaceAccess = 'none' | 'ro' | 'rw';

interface DockerSettings {
  image: string;
  networkMode: NetworkMode;
  memoryMB: number;
  cpuLimit: number;
  workspaceAccess: WorkspaceAccess;
}

interface SecurityPolicies {
  allowHostNetworking: boolean;
  allowPrivilegedMode: boolean;
  mountDockerSocket: boolean;
  persistSandbox: boolean;
  autoCleanupMinutes: number;
}

interface SandboxSettings {
  mode: SandboxMode;
  docker: DockerSettings;
  security: SecurityPolicies;
}

interface AgentOverride {
  agentId: string;
  agentName: string;
  hasOverride: boolean;
  sandboxMode?: SandboxMode;
  expanded?: boolean;
}

const DEFAULT_SETTINGS: SandboxSettings = {
  mode: 'non-main',
  docker: {
    image: 'node:22-slim',
    networkMode: 'bridge',
    memoryMB: 2048,
    cpuLimit: 2,
    workspaceAccess: 'ro',
  },
  security: {
    allowHostNetworking: false,
    allowPrivilegedMode: false,
    mountDockerSocket: false,
    persistSandbox: false,
    autoCleanupMinutes: 30,
  },
};

const COMMON_IMAGES = [
  'node:22-slim',
  'node:22-alpine',
  'python:3.12-slim',
  'ubuntu:24.04',
  'debian:bookworm-slim',
];

/* ===================================================================
   Helpers
   =================================================================== */

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

function memorySliderColor(mb: number): string {
  const ratio = (mb - 256) / (8192 - 256);
  if (ratio < 0.35) return '#10b981';
  if (ratio < 0.65) return '#f59e0b';
  return '#ef4444';
}

function cpuSliderColor(cores: number): string {
  const ratio = (cores - 0.5) / (8 - 0.5);
  if (ratio < 0.35) return '#10b981';
  if (ratio < 0.65) return '#f59e0b';
  return '#ef4444';
}

/* ===================================================================
   SVG Icons
   =================================================================== */

function DockerWhaleIcon() {
  return (
    <svg className="sbc-page-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M13 4h-2v2h2V4zm-3 0H8v2h2V4zM7 4H5v2h2V4zm10 0h-2v2h2V4zM13 7h-2v2h2V7zm-3 0H8v2h2V7zM7 7H5v2h2V7zm10 0h-2v2h2V7zm3.5 2.5c-.55 0-1.07.09-1.56.25-.29-1.21-1.2-2.06-2.44-2.5V7h-2V5h2V3H5v2h2v2H5v.25C3.76 7.69 2.85 8.54 2.56 9.75 2.07 9.59 1.55 9.5 1 9.5c0 0-.5 3 2 4.5.36 2.3 2.27 4 4.5 4h9c2.23 0 4.14-1.7 4.5-4 2.5-1.5 2-4.5 2-4.5z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5C17.944 5.652 18 6.32 18 7c0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.68.056-1.348.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={size} height={size}>
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function DangerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={size} height={size}>
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`sbc-chevron ${open ? 'sbc-chevron-open' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      width="14"
      height="14"
    >
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
    </svg>
  );
}

/* ===================================================================
   Main Component
   =================================================================== */

export function SandboxConfig({ agentId, agentName, onBack }: SandboxConfigProps) {
  const { connected } = useGateway();
  const { gatewayConfig, patchGatewayConfig } = useGatewayConfig();

  // -- State --
  const [settings, setSettings] = useState<SandboxSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SandboxSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showImageDropdown, setShowImageDropdown] = useState(false);
  const [agentOverrides, setAgentOverrides] = useState<AgentOverride[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // -- Dirty detection --
  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(originalSettings),
    [settings, originalSettings]
  );

  // -- Load config from gateway --
  useEffect(() => {
    if (gatewayConfig._raw) {
      const raw = gatewayConfig._raw;
      const agentsRaw = raw.agents as Record<string, unknown> | undefined;
      const defaultsRaw = agentsRaw?.defaults as Record<string, unknown> | undefined;
      const sandboxRaw = defaultsRaw?.sandbox as Record<string, unknown> | undefined;

      if (sandboxRaw) {
        const dockerRaw = sandboxRaw.docker as Record<string, unknown> | undefined;
        const securityRaw = sandboxRaw.security as Record<string, unknown> | undefined;

        let loaded: SandboxSettings;

        if (agentId) {
          // Per-agent override
          const overridesRaw = sandboxRaw.overrides as Record<string, Record<string, unknown>> | undefined;
          const agentOverrideRaw = overridesRaw?.[agentId] as Record<string, unknown> | undefined;
          if (agentOverrideRaw) {
            const agentDockerRaw = agentOverrideRaw.docker as Record<string, unknown> | undefined;
            const agentSecurityRaw = agentOverrideRaw.security as Record<string, unknown> | undefined;
            loaded = {
              mode: (agentOverrideRaw.mode as SandboxMode) ?? DEFAULT_SETTINGS.mode,
              docker: {
                image: (agentDockerRaw?.image as string) ?? dockerRaw?.image as string ?? DEFAULT_SETTINGS.docker.image,
                networkMode: (agentDockerRaw?.networkMode as NetworkMode) ?? dockerRaw?.networkMode as NetworkMode ?? DEFAULT_SETTINGS.docker.networkMode,
                memoryMB: (agentDockerRaw?.memoryMB as number) ?? dockerRaw?.memoryMB as number ?? DEFAULT_SETTINGS.docker.memoryMB,
                cpuLimit: (agentDockerRaw?.cpuLimit as number) ?? dockerRaw?.cpuLimit as number ?? DEFAULT_SETTINGS.docker.cpuLimit,
                workspaceAccess: (agentDockerRaw?.workspaceAccess as WorkspaceAccess) ?? dockerRaw?.workspaceAccess as WorkspaceAccess ?? DEFAULT_SETTINGS.docker.workspaceAccess,
              },
              security: {
                allowHostNetworking: (agentSecurityRaw?.allowHostNetworking as boolean) ?? securityRaw?.allowHostNetworking as boolean ?? DEFAULT_SETTINGS.security.allowHostNetworking,
                allowPrivilegedMode: (agentSecurityRaw?.allowPrivilegedMode as boolean) ?? securityRaw?.allowPrivilegedMode as boolean ?? DEFAULT_SETTINGS.security.allowPrivilegedMode,
                mountDockerSocket: (agentSecurityRaw?.mountDockerSocket as boolean) ?? securityRaw?.mountDockerSocket as boolean ?? DEFAULT_SETTINGS.security.mountDockerSocket,
                persistSandbox: (agentSecurityRaw?.persistSandbox as boolean) ?? securityRaw?.persistSandbox as boolean ?? DEFAULT_SETTINGS.security.persistSandbox,
                autoCleanupMinutes: (agentSecurityRaw?.autoCleanupMinutes as number) ?? securityRaw?.autoCleanupMinutes as number ?? DEFAULT_SETTINGS.security.autoCleanupMinutes,
              },
            };
          } else {
            // No override, load defaults
            loaded = buildSettingsFromRaw(sandboxRaw, dockerRaw, securityRaw);
          }
        } else {
          loaded = buildSettingsFromRaw(sandboxRaw, dockerRaw, securityRaw);
        }

        setSettings(loaded);
        setOriginalSettings(loaded);
      }

      // Build agent overrides table
      if (!agentId) {
        const agentList = (agentsRaw?.list ?? []) as Array<{ id: string; name?: string }>;
        const overridesRaw = (
          (defaultsRaw?.sandbox as Record<string, unknown> | undefined)?.overrides as
            Record<string, Record<string, unknown>> | undefined
        ) ?? {};

        const overridesList: AgentOverride[] = agentList.map((a) => ({
          agentId: a.id,
          agentName: a.name ?? a.id,
          hasOverride: overridesRaw[a.id] !== undefined,
          sandboxMode: overridesRaw[a.id]?.mode as SandboxMode | undefined,
        }));

        setAgentOverrides(overridesList);
      }
    }
  }, [gatewayConfig._raw, agentId]);

  // -- Helper to build settings from raw config --
  function buildSettingsFromRaw(
    sandboxRaw: Record<string, unknown>,
    dockerRaw: Record<string, unknown> | undefined,
    securityRaw: Record<string, unknown> | undefined,
  ): SandboxSettings {
    return {
      mode: (sandboxRaw.mode as SandboxMode) ?? DEFAULT_SETTINGS.mode,
      docker: {
        image: (dockerRaw?.image as string) ?? DEFAULT_SETTINGS.docker.image,
        networkMode: (dockerRaw?.networkMode as NetworkMode) ?? DEFAULT_SETTINGS.docker.networkMode,
        memoryMB: (dockerRaw?.memoryMB as number) ?? DEFAULT_SETTINGS.docker.memoryMB,
        cpuLimit: (dockerRaw?.cpuLimit as number) ?? DEFAULT_SETTINGS.docker.cpuLimit,
        workspaceAccess: (dockerRaw?.workspaceAccess as WorkspaceAccess) ?? DEFAULT_SETTINGS.docker.workspaceAccess,
      },
      security: {
        allowHostNetworking: (securityRaw?.allowHostNetworking as boolean) ?? DEFAULT_SETTINGS.security.allowHostNetworking,
        allowPrivilegedMode: (securityRaw?.allowPrivilegedMode as boolean) ?? DEFAULT_SETTINGS.security.allowPrivilegedMode,
        mountDockerSocket: (securityRaw?.mountDockerSocket as boolean) ?? DEFAULT_SETTINGS.security.mountDockerSocket,
        persistSandbox: (securityRaw?.persistSandbox as boolean) ?? DEFAULT_SETTINGS.security.persistSandbox,
        autoCleanupMinutes: (securityRaw?.autoCleanupMinutes as number) ?? DEFAULT_SETTINGS.security.autoCleanupMinutes,
      },
    };
  }

  // -- Updaters --
  const updateMode = useCallback((mode: SandboxMode) => {
    setSettings((prev) => ({ ...prev, mode }));
  }, []);

  const updateDocker = useCallback(<K extends keyof DockerSettings>(key: K, value: DockerSettings[K]) => {
    setSettings((prev) => ({ ...prev, docker: { ...prev.docker, [key]: value } }));
  }, []);

  const updateSecurity = useCallback(<K extends keyof SecurityPolicies>(key: K, value: SecurityPolicies[K]) => {
    setSettings((prev) => ({ ...prev, security: { ...prev.security, [key]: value } }));
  }, []);

  // -- Save --
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      const patchPath = agentId
        ? {
            agents: {
              defaults: {
                sandbox: {
                  overrides: {
                    [agentId]: {
                      mode: settings.mode,
                      docker: settings.docker,
                      security: settings.security,
                    },
                  },
                },
              },
            },
          }
        : {
            agents: {
              defaults: {
                sandbox: {
                  mode: settings.mode,
                  docker: settings.docker,
                  security: settings.security,
                },
              },
            },
          };

      await patchGatewayConfig(patchPath);
      setOriginalSettings(settings);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to save sandbox config:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  }, [agentId, settings, patchGatewayConfig]);

  // -- Discard --
  const handleDiscard = useCallback(() => {
    setSettings(originalSettings);
  }, [originalSettings]);

  // -- Reset agent override --
  const handleResetAgentOverride = useCallback(
    async (targetAgentId: string) => {
      try {
        await patchGatewayConfig({
          agents: {
            defaults: {
              sandbox: {
                overrides: {
                  [targetAgentId]: null,
                },
              },
            },
          },
        });
        setAgentOverrides((prev) =>
          prev.map((a) =>
            a.agentId === targetAgentId
              ? { ...a, hasOverride: false, sandboxMode: undefined }
              : a
          )
        );
      } catch (err) {
        console.error('Failed to reset agent sandbox override:', err);
      }
    },
    [patchGatewayConfig]
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="sbc-container">
      <style>{sandboxConfigStyles}</style>

      {/* ---- Header ---- */}
      <header className="sbc-page-header">
        <div className="sbc-page-title-row">
          {onBack && (
            <button className="sbc-back-btn" onClick={onBack} aria-label="Go back">
              <BackArrowIcon />
            </button>
          )}
          <DockerWhaleIcon />
          <div>
            <h1 className="sbc-page-title">Sandbox Configuration</h1>
            <p className="sbc-page-subtitle">
              Control Docker-based isolation for command execution
            </p>
          </div>
        </div>

        {agentId && agentName && (
          <div className="sbc-agent-override-banner">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            Overrides for <strong>{agentName}</strong>
          </div>
        )}

        {!connected && (
          <div className="sbc-disconnected-banner">
            <WarningIcon />
            Gateway disconnected. Sandbox configuration requires an active connection.
          </div>
        )}
      </header>

      {/* ============================================
          Section 1: Sandbox Mode
          ============================================ */}
      <section className="sbc-section">
        <h2 className="sbc-section-title">Sandbox Mode</h2>
        <p className="sbc-section-desc">
          Choose which agents run inside a Docker sandbox
        </p>

        <div className="sbc-mode-cards">
          {/* Off */}
          <button
            className={`sbc-mode-card ${settings.mode === 'off' ? 'sbc-mode-card-active sbc-mode-card-danger' : ''}`}
            onClick={() => updateMode('off')}
            aria-pressed={settings.mode === 'off'}
            aria-label="Sandbox mode: Off"
          >
            <div className="sbc-mode-card-icon sbc-mode-icon-danger">
              <WarningIcon size={20} />
            </div>
            <div className="sbc-mode-card-body">
              <span className="sbc-mode-card-title">Off</span>
              <span className="sbc-mode-card-desc">
                No sandboxing. Commands run directly on host.
              </span>
            </div>
            <div className={`sbc-mode-radio ${settings.mode === 'off' ? 'sbc-mode-radio-active' : ''}`} />
          </button>

          {/* Non-main agents */}
          <button
            className={`sbc-mode-card ${settings.mode === 'non-main' ? 'sbc-mode-card-active sbc-mode-card-warning' : ''}`}
            onClick={() => updateMode('non-main')}
            aria-pressed={settings.mode === 'non-main'}
            aria-label="Sandbox mode: Non-main agents"
          >
            <div className="sbc-mode-card-icon sbc-mode-icon-warning">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm1 5a1 1 0 00-1 1v2a1 1 0 001 1h12a1 1 0 001-1v-2a1 1 0 00-1-1H4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="sbc-mode-card-body">
              <span className="sbc-mode-card-title">Non-main agents</span>
              <span className="sbc-mode-card-desc">
                Only non-default agents are sandboxed. Main agent runs on host.
              </span>
            </div>
            <div className={`sbc-mode-radio ${settings.mode === 'non-main' ? 'sbc-mode-radio-active' : ''}`} />
          </button>

          {/* All agents */}
          <button
            className={`sbc-mode-card ${settings.mode === 'all' ? 'sbc-mode-card-active sbc-mode-card-success' : ''}`}
            onClick={() => updateMode('all')}
            aria-pressed={settings.mode === 'all'}
            aria-label="Sandbox mode: All agents"
          >
            <div className="sbc-mode-card-icon sbc-mode-icon-success">
              <ShieldIcon />
            </div>
            <div className="sbc-mode-card-body">
              <span className="sbc-mode-card-title">All agents</span>
              <span className="sbc-mode-card-desc">
                Every agent runs in a sandbox. Maximum security.
              </span>
            </div>
            <div className={`sbc-mode-radio ${settings.mode === 'all' ? 'sbc-mode-radio-active' : ''}`} />
          </button>
        </div>
      </section>

      {/* ============================================
          Section 2: Docker Settings
          ============================================ */}
      <section className="sbc-section">
        <h2 className="sbc-section-title">Docker Settings</h2>

        {/* Docker Image */}
        <div className="sbc-field">
          <label className="sbc-label" htmlFor="sbc-docker-image">Docker Image</label>
          <div className="sbc-image-input-wrapper">
            <input
              id="sbc-docker-image"
              type="text"
              className="sbc-input"
              value={settings.docker.image}
              onChange={(e) => updateDocker('image', e.target.value)}
              onFocus={() => setShowImageDropdown(true)}
              onBlur={() => setTimeout(() => setShowImageDropdown(false), 150)}
              placeholder="e.g. node:22-slim"
              aria-label="Docker image"
            />
            {showImageDropdown && (
              <div className="sbc-image-dropdown">
                {COMMON_IMAGES.filter((img) => img !== settings.docker.image).map((img) => (
                  <button
                    key={img}
                    className="sbc-image-option"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      updateDocker('image', img);
                      setShowImageDropdown(false);
                    }}
                  >
                    <code>{img}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Network Mode */}
        <div className="sbc-field">
          <label className="sbc-label">Network Mode</label>
          <div className="sbc-option-group">
            <button
              className={`sbc-option-btn ${settings.docker.networkMode === 'none' ? 'sbc-option-btn-active sbc-opt-success' : ''}`}
              onClick={() => updateDocker('networkMode', 'none')}
              aria-pressed={settings.docker.networkMode === 'none'}
            >
              <span className="sbc-option-title">none</span>
              <span className="sbc-option-hint">No network access (most secure)</span>
            </button>
            <button
              className={`sbc-option-btn ${settings.docker.networkMode === 'bridge' ? 'sbc-option-btn-active sbc-opt-accent' : ''}`}
              onClick={() => updateDocker('networkMode', 'bridge')}
              aria-pressed={settings.docker.networkMode === 'bridge'}
            >
              <span className="sbc-option-title">bridge</span>
              <span className="sbc-option-hint">Isolated network with outbound access</span>
            </button>
            <button
              className={`sbc-option-btn ${settings.docker.networkMode === 'host' ? 'sbc-option-btn-active sbc-opt-danger' : ''}`}
              onClick={() => updateDocker('networkMode', 'host')}
              aria-pressed={settings.docker.networkMode === 'host'}
            >
              <span className="sbc-option-title">host</span>
              <span className="sbc-option-hint">Full host network access (least secure)</span>
            </button>
          </div>
        </div>

        {/* Memory Limit */}
        <div className="sbc-field">
          <div className="sbc-slider-header">
            <label className="sbc-label" htmlFor="sbc-memory-slider">Memory Limit</label>
            <span
              className="sbc-slider-value"
              style={{ color: memorySliderColor(settings.docker.memoryMB) }}
            >
              {formatMemory(settings.docker.memoryMB)}
            </span>
          </div>
          <input
            id="sbc-memory-slider"
            type="range"
            className="sbc-slider"
            min={256}
            max={8192}
            step={256}
            value={settings.docker.memoryMB}
            onChange={(e) => updateDocker('memoryMB', parseInt(e.target.value))}
            aria-label="Memory limit in megabytes"
            aria-valuetext={formatMemory(settings.docker.memoryMB)}
            style={{
              '--sbc-slider-color': memorySliderColor(settings.docker.memoryMB),
            } as React.CSSProperties}
          />
          <div className="sbc-slider-labels">
            <span>256 MB</span>
            <span>8.0 GB</span>
          </div>
        </div>

        {/* CPU Limit */}
        <div className="sbc-field">
          <div className="sbc-slider-header">
            <label className="sbc-label" htmlFor="sbc-cpu-slider">CPU Limit</label>
            <span
              className="sbc-slider-value"
              style={{ color: cpuSliderColor(settings.docker.cpuLimit) }}
            >
              {settings.docker.cpuLimit} {settings.docker.cpuLimit === 1 ? 'core' : 'cores'}
            </span>
          </div>
          <input
            id="sbc-cpu-slider"
            type="range"
            className="sbc-slider"
            min={0.5}
            max={8}
            step={0.5}
            value={settings.docker.cpuLimit}
            onChange={(e) => updateDocker('cpuLimit', parseFloat(e.target.value))}
            aria-label="CPU core limit"
            aria-valuetext={`${settings.docker.cpuLimit} cores`}
            style={{
              '--sbc-slider-color': cpuSliderColor(settings.docker.cpuLimit),
            } as React.CSSProperties}
          />
          <div className="sbc-slider-labels">
            <span>0.5</span>
            <span>8.0</span>
          </div>
        </div>

        {/* Workspace Access */}
        <div className="sbc-field">
          <label className="sbc-label">Workspace Access</label>
          <div className="sbc-option-group">
            <button
              className={`sbc-option-btn ${settings.docker.workspaceAccess === 'none' ? 'sbc-option-btn-active sbc-opt-success' : ''}`}
              onClick={() => updateDocker('workspaceAccess', 'none')}
              aria-pressed={settings.docker.workspaceAccess === 'none'}
            >
              <span className="sbc-option-title">none</span>
              <span className="sbc-option-hint">No workspace access</span>
            </button>
            <button
              className={`sbc-option-btn ${settings.docker.workspaceAccess === 'ro' ? 'sbc-option-btn-active sbc-opt-accent' : ''}`}
              onClick={() => updateDocker('workspaceAccess', 'ro')}
              aria-pressed={settings.docker.workspaceAccess === 'ro'}
            >
              <span className="sbc-option-title">read-only</span>
              <span className="sbc-option-hint">Read-only workspace mount</span>
            </button>
            <button
              className={`sbc-option-btn ${settings.docker.workspaceAccess === 'rw' ? 'sbc-option-btn-active sbc-opt-danger' : ''}`}
              onClick={() => updateDocker('workspaceAccess', 'rw')}
              aria-pressed={settings.docker.workspaceAccess === 'rw'}
            >
              <span className="sbc-option-title">read-write</span>
              <span className="sbc-option-hint">Read-write workspace mount</span>
            </button>
          </div>
        </div>
      </section>

      {/* ============================================
          Section 3: Security Policies
          ============================================ */}
      <section className="sbc-section">
        <h2 className="sbc-section-title">Security Policies</h2>

        {/* Allow host networking */}
        <div className="sbc-toggle-row">
          <div className="sbc-toggle-info">
            <span className="sbc-toggle-label">Allow host networking</span>
            {settings.security.allowHostNetworking && (
              <span className="sbc-toggle-warning sbc-warning-warn">
                <WarningIcon size={12} />
                Sandbox network isolation is bypassed
              </span>
            )}
          </div>
          <label className="sbc-switch" aria-label="Allow host networking">
            <input
              type="checkbox"
              checked={settings.security.allowHostNetworking}
              onChange={(e) => updateSecurity('allowHostNetworking', e.target.checked)}
            />
            <span className="sbc-switch-slider" />
          </label>
        </div>

        {/* Allow privileged mode */}
        <div className="sbc-toggle-row">
          <div className="sbc-toggle-info">
            <span className="sbc-toggle-label">Allow privileged mode</span>
            {settings.security.allowPrivilegedMode && (
              <span className="sbc-toggle-warning sbc-warning-danger">
                <DangerIcon size={12} />
                Container has full host access -- high security risk
              </span>
            )}
          </div>
          <label className="sbc-switch" aria-label="Allow privileged mode">
            <input
              type="checkbox"
              checked={settings.security.allowPrivilegedMode}
              onChange={(e) => updateSecurity('allowPrivilegedMode', e.target.checked)}
            />
            <span className="sbc-switch-slider" />
          </label>
        </div>

        {/* Mount Docker socket */}
        <div className="sbc-toggle-row">
          <div className="sbc-toggle-info">
            <span className="sbc-toggle-label">Mount Docker socket</span>
            {settings.security.mountDockerSocket && (
              <span className="sbc-toggle-warning sbc-warning-danger">
                <DangerIcon size={12} />
                Grants full Docker control
              </span>
            )}
          </div>
          <label className="sbc-switch" aria-label="Mount Docker socket">
            <input
              type="checkbox"
              checked={settings.security.mountDockerSocket}
              onChange={(e) => updateSecurity('mountDockerSocket', e.target.checked)}
            />
            <span className="sbc-switch-slider" />
          </label>
        </div>

        {/* Persist sandbox */}
        <div className="sbc-toggle-row">
          <div className="sbc-toggle-info">
            <span className="sbc-toggle-label">Persist sandbox</span>
            <span className="sbc-toggle-hint">Keep sandbox between sessions</span>
          </div>
          <label className="sbc-switch" aria-label="Persist sandbox between sessions">
            <input
              type="checkbox"
              checked={settings.security.persistSandbox}
              onChange={(e) => updateSecurity('persistSandbox', e.target.checked)}
            />
            <span className="sbc-switch-slider" />
          </label>
        </div>

        {/* Auto-cleanup timeout */}
        <div className="sbc-field sbc-cleanup-field">
          <label className="sbc-label" htmlFor="sbc-cleanup-timeout">
            Auto-cleanup timeout (minutes)
          </label>
          <input
            id="sbc-cleanup-timeout"
            type="number"
            className="sbc-input sbc-input-number"
            min={1}
            max={1440}
            value={settings.security.autoCleanupMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= 1440) {
                updateSecurity('autoCleanupMinutes', val);
              }
            }}
            aria-label="Auto-cleanup timeout in minutes"
          />
        </div>
      </section>

      {/* ============================================
          Section 4: Per-Agent Overrides
          (only shown when agentId is NOT provided)
          ============================================ */}
      {!agentId && (
        <section className="sbc-section">
          <h2 className="sbc-section-title">Per-Agent Overrides</h2>
          <p className="sbc-section-desc">
            View and manage sandbox configuration overrides for individual agents
          </p>

          {agentOverrides.length === 0 ? (
            <div className="sbc-empty">
              <p className="sbc-empty-text">No agents configured</p>
              <p className="sbc-empty-subtext">
                Agents will appear here when added via the Agent Management panel.
              </p>
            </div>
          ) : (
            <div className="sbc-overrides-table">
              <div className="sbc-overrides-header">
                <span className="sbc-overrides-col-name">Agent</span>
                <span className="sbc-overrides-col-status">Status</span>
                <span className="sbc-overrides-col-mode">Mode</span>
                <span className="sbc-overrides-col-actions">Actions</span>
              </div>
              {agentOverrides.map((agent) => (
                <div key={agent.agentId} className="sbc-override-item">
                  <button
                    className="sbc-override-row"
                    onClick={() =>
                      setExpandedAgent(
                        expandedAgent === agent.agentId ? null : agent.agentId
                      )
                    }
                    aria-expanded={expandedAgent === agent.agentId}
                  >
                    <span className="sbc-overrides-col-name">
                      <ChevronIcon open={expandedAgent === agent.agentId} />
                      <span className="sbc-override-agent-name">{agent.agentName}</span>
                    </span>
                    <span className="sbc-overrides-col-status">
                      <span
                        className={`sbc-override-badge ${
                          agent.hasOverride ? 'sbc-override-badge-custom' : 'sbc-override-badge-default'
                        }`}
                      >
                        {agent.hasOverride ? 'Custom' : 'Default'}
                      </span>
                    </span>
                    <span className="sbc-overrides-col-mode">
                      {agent.hasOverride && agent.sandboxMode ? (
                        <code className="sbc-override-mode">{agent.sandboxMode}</code>
                      ) : (
                        <span className="sbc-override-mode-inherit">Inherits global</span>
                      )}
                    </span>
                    <span className="sbc-overrides-col-actions">
                      {agent.hasOverride && (
                        <button
                          className="sbc-btn-reset"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetAgentOverride(agent.agentId);
                          }}
                          title="Reset to default"
                          aria-label={`Reset sandbox override for ${agent.agentName}`}
                        >
                          Reset to default
                        </button>
                      )}
                    </span>
                  </button>

                  {expandedAgent === agent.agentId && (
                    <div className="sbc-override-detail">
                      {agent.hasOverride ? (
                        <div className="sbc-override-detail-content">
                          <div className="sbc-override-detail-row">
                            <span className="sbc-override-detail-label">Sandbox Mode</span>
                            <code className="sbc-override-detail-value">{agent.sandboxMode ?? 'inherited'}</code>
                          </div>
                          <p className="sbc-override-detail-hint">
                            This agent uses custom sandbox settings that override the global configuration.
                          </p>
                        </div>
                      ) : (
                        <p className="sbc-override-detail-hint">
                          This agent inherits the global sandbox configuration. No per-agent overrides are set.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================
          Sticky Save Bar
          ============================================ */}
      <div className={`sbc-save-bar ${isDirty ? 'sbc-save-bar-visible' : ''}`}>
        <div className="sbc-save-bar-inner">
          {isDirty && (
            <span className="sbc-unsaved-indicator">
              <span className="sbc-unsaved-dot" />
              Unsaved changes
            </span>
          )}
          <div className="sbc-save-bar-actions">
            <button
              className="sbc-btn-discard"
              onClick={handleDiscard}
              disabled={!isDirty || saving}
            >
              Discard
            </button>
            <button
              className={`sbc-btn-save ${saveStatus === 'success' ? 'sbc-btn-save-success' : ''} ${saveStatus === 'error' ? 'sbc-btn-save-error' : ''}`}
              onClick={handleSave}
              disabled={!isDirty || saving || !connected}
            >
              {saving
                ? 'Saving...'
                : saveStatus === 'success'
                  ? 'Saved'
                  : saveStatus === 'error'
                    ? 'Save Failed'
                    : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SandboxConfig;

/* ===================================================================
   Scoped styles (sbc- prefix)
   =================================================================== */

const sandboxConfigStyles = `
/* ---- Container ---- */
.sbc-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 900px;
  padding: 0.5rem 0 5rem;
}

/* ---- Page header ---- */
.sbc-page-header {
  margin-bottom: 0.25rem;
}

.sbc-page-title-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.sbc-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 0.125rem;
}

.sbc-back-btn:hover {
  background: rgba(255,255,255,0.08);
  color: var(--text-primary, #fff);
  border-color: rgba(255,255,255,0.15);
}

.sbc-page-icon {
  color: var(--accent-color, #6366f1);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.sbc-page-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
  line-height: 1.2;
}

.sbc-page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary, #a0a0c0);
  margin: 0.25rem 0 0;
}

.sbc-agent-override-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  margin-top: 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: #a5b4fc;
}

.sbc-agent-override-banner strong {
  color: #c7d2fe;
}

.sbc-disconnected-banner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  margin-top: 0.75rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.25);
  color: #fbbf24;
}

/* ---- Section ---- */
.sbc-section {
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1.25rem;
}

.sbc-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0 0 0.25rem;
}

.sbc-section-desc {
  font-size: 0.8125rem;
  color: var(--text-tertiary, #606080);
  margin: 0 0 1rem;
}

/* ---- Sandbox Mode Cards ---- */
.sbc-mode-cards {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.sbc-mode-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
}

.sbc-mode-card:hover {
  border-color: rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.02);
}

.sbc-mode-card-active {
  border-width: 2px;
  padding: calc(0.875rem - 1px) calc(1rem - 1px);
}

.sbc-mode-card-danger.sbc-mode-card-active {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.06);
}

.sbc-mode-card-warning.sbc-mode-card-active {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.06);
}

.sbc-mode-card-success.sbc-mode-card-active {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.06);
}

.sbc-mode-card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.sbc-mode-icon-danger {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}

.sbc-mode-icon-warning {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}

.sbc-mode-icon-success {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.sbc-mode-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sbc-mode-card-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.sbc-mode-card-desc {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.35;
}

.sbc-mode-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.15);
  flex-shrink: 0;
  position: relative;
  transition: all 0.15s ease;
}

.sbc-mode-radio-active {
  border-color: var(--accent-color, #6366f1);
}

.sbc-mode-radio-active::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  right: 3px;
  bottom: 3px;
  border-radius: 50%;
  background: var(--accent-color, #6366f1);
}

/* ---- Fields ---- */
.sbc-field {
  margin-bottom: 1.25rem;
}

.sbc-field:last-child {
  margin-bottom: 0;
}

.sbc-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin-bottom: 0.5rem;
}

.sbc-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-primary, #fff);
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}

.sbc-input:focus {
  border-color: var(--accent-color, #6366f1);
}

.sbc-input::placeholder {
  color: var(--text-tertiary, #606080);
}

.sbc-input-number {
  width: 120px;
  font-family: var(--font-mono, monospace);
}

.sbc-cleanup-field {
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.04);
  margin-top: 0.5rem;
}

/* ---- Docker Image Dropdown ---- */
.sbc-image-input-wrapper {
  position: relative;
}

.sbc-image-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  margin-top: 4px;
  overflow: hidden;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.sbc-image-option {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease;
  color: var(--text-secondary, #a0a0c0);
}

.sbc-image-option:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary, #fff);
}

.sbc-image-option code {
  font-size: 0.8125rem;
  font-family: var(--font-mono, monospace);
}

/* ---- Option Group (3-way selectors) ---- */
.sbc-option-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

@media (max-width: 600px) {
  .sbc-option-group {
    grid-template-columns: 1fr;
  }
}

.sbc-option-btn {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: var(--bg-primary, #0a0a1a);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.sbc-option-btn:hover {
  border-color: rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.02);
}

.sbc-option-btn-active {
  border-width: 2px;
  padding: calc(0.75rem - 1px);
}

.sbc-option-btn-active.sbc-opt-success {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.06);
}

.sbc-option-btn-active.sbc-opt-accent {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.06);
}

.sbc-option-btn-active.sbc-opt-danger {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.06);
}

.sbc-option-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  font-family: var(--font-mono, monospace);
}

.sbc-option-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  line-height: 1.3;
}

/* ---- Sliders ---- */
.sbc-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.5rem;
}

.sbc-slider-value {
  font-size: 0.875rem;
  font-weight: 700;
  font-family: var(--font-mono, monospace);
  transition: color 0.2s ease;
}

.sbc-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.sbc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sbc-slider-color, var(--accent-color, #6366f1));
  border: 2px solid var(--bg-secondary, #111127);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.sbc-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);
}

.sbc-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--sbc-slider-color, var(--accent-color, #6366f1));
  border: 2px solid var(--bg-secondary, #111127);
  cursor: pointer;
}

.sbc-slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  color: var(--text-tertiary, #606080);
  margin-top: 0.375rem;
}

/* ---- Toggle rows (Security Policies) ---- */
.sbc-toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.sbc-toggle-row:last-of-type {
  border-bottom: none;
}

.sbc-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.sbc-toggle-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.sbc-toggle-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
}

.sbc-toggle-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.125rem 0;
}

.sbc-warning-warn {
  color: #fbbf24;
}

.sbc-warning-danger {
  color: #f87171;
}

/* ---- Toggle Switch ---- */
.sbc-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;
}

.sbc-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.sbc-switch-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 11px;
  transition: background 0.2s ease;
}

.sbc-switch-slider::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s ease;
}

.sbc-switch input:checked + .sbc-switch-slider {
  background: var(--accent-color, #6366f1);
}

.sbc-switch input:checked + .sbc-switch-slider::before {
  transform: translateX(18px);
}

/* ---- Per-Agent Overrides ---- */
.sbc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.sbc-empty-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
  margin: 0 0 0.25rem;
}

.sbc-empty-subtext {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
}

.sbc-overrides-table {
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  overflow: hidden;
}

.sbc-overrides-header {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  padding: 0.5rem 0.75rem;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary, #606080);
}

.sbc-override-item {
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.sbc-override-item:last-child {
  border-bottom: none;
}

.sbc-override-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  align-items: center;
  padding: 0.625rem 0.75rem;
  background: transparent;
  border: none;
  width: 100%;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;
}

.sbc-override-row:hover {
  background: rgba(255,255,255,0.02);
}

.sbc-overrides-col-name {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.sbc-chevron {
  color: var(--text-tertiary, #606080);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.sbc-chevron-open {
  transform: rotate(90deg);
}

.sbc-override-agent-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sbc-override-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
}

.sbc-override-badge-default {
  background: rgba(255,255,255,0.06);
  color: var(--text-tertiary, #606080);
}

.sbc-override-badge-custom {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
}

.sbc-override-mode {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  color: var(--text-secondary, #a0a0c0);
}

.sbc-override-mode-inherit {
  font-size: 0.75rem;
  color: var(--text-tertiary, #606080);
  font-style: italic;
}

.sbc-btn-reset {
  padding: 0.25rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  color: #f87171;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.sbc-btn-reset:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.35);
}

.sbc-override-detail {
  padding: 0.75rem 0.75rem 0.75rem 2.25rem;
  border-top: 1px solid rgba(255,255,255,0.04);
  background: rgba(255,255,255,0.01);
}

.sbc-override-detail-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sbc-override-detail-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sbc-override-detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #a0a0c0);
}

.sbc-override-detail-value {
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  padding: 0.125rem 0.375rem;
  background: rgba(255,255,255,0.04);
  border-radius: 3px;
  color: var(--text-primary, #fff);
}

.sbc-override-detail-hint {
  font-size: 0.6875rem;
  color: var(--text-tertiary, #606080);
  margin: 0;
  line-height: 1.4;
}

/* ---- Sticky Save Bar ---- */
.sbc-save-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  opacity: 0;
  transform: translateY(100%);
  transition: all 0.25s ease;
  pointer-events: none;
}

.sbc-save-bar-visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.sbc-save-bar-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: var(--bg-secondary, #111127);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
  backdrop-filter: blur(8px);
}

.sbc-unsaved-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #fbbf24;
}

.sbc-unsaved-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fbbf24;
  animation: sbc-pulse 2s ease-in-out infinite;
}

@keyframes sbc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.sbc-save-bar-actions {
  display: flex;
  gap: 0.625rem;
}

.sbc-btn-discard {
  padding: 0.4375rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: var(--text-secondary, #a0a0c0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sbc-btn-discard:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: var(--text-primary, #fff);
}

.sbc-btn-discard:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sbc-btn-save {
  padding: 0.4375rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  background: var(--accent-color, #6366f1);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sbc-btn-save:hover:not(:disabled) {
  background: #4f46e5;
}

.sbc-btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sbc-btn-save-success {
  background: #10b981 !important;
}

.sbc-btn-save-error {
  background: #ef4444 !important;
}
`;
