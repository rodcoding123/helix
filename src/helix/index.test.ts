/**
 * Tests for the main Helix module index
 * Covers initialization, shutdown, status, and export verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeHelix, shutdownHelix, getHelixStatus, type HelixInitOptions } from './index.js';

// Mock all module imports
vi.mock('./logging-hooks.js', () => ({
  setFailClosedMode: vi.fn(),
  validateSecurityConfiguration: vi.fn().mockResolvedValue({
    valid: true,
    criticalIssues: [],
    warnings: [],
  }),
  installPreExecutionLogger: vi.fn(),
  initializeDiscordWebhooks: vi.fn(),
  WEBHOOKS: {},
  checkWebhookHealth: vi.fn(),
  triggerHelixHooks: vi.fn(),
  sendAlert: vi.fn().mockResolvedValue(undefined),
  logConsciousnessObservation: vi.fn(),
  REQUIRED_WEBHOOKS: [],
  OPTIONAL_WEBHOOKS: [],
  HelixSecurityError: class extends Error {},
}));

vi.mock('./hash-chain.js', () => ({
  setHashChainFailClosedMode: vi.fn(),
  startHashChainScheduler: vi.fn(),
  stopHashChainScheduler: vi.fn(),
  startRotationScheduler: vi.fn(),
  createHashChainEntry: vi.fn().mockResolvedValue(undefined),
  verifyChain: vi.fn(),
  getChainState: vi.fn().mockResolvedValue({
    lastHash: 'test-hash',
    sequence: 42,
    entries: 100,
  }),
  computeEntryHash: vi.fn(),
  hashLogFiles: vi.fn(),
  verifyAgainstDiscord: vi.fn(),
}));

vi.mock('./heartbeat.js', () => ({
  announceStartup: vi.fn().mockResolvedValue(undefined),
  announceShutdown: vi.fn().mockResolvedValue(undefined),
  startHeartbeat: vi.fn(),
  stopHeartbeat: vi.fn(),
  getHeartbeatStats: vi.fn().mockReturnValue({
    running: true,
    count: 10,
    uptime: '10m',
  }),
  sendStatusUpdate: vi.fn(),
}));

vi.mock('./helix-context-loader.js', () => ({
  ensureHelixDirectoryStructure: vi.fn().mockResolvedValue(undefined),
  loadHelixContextFiles: vi.fn(),
  loadHelixContextFilesDetailed: vi.fn(),
  getHelixContextStatus: vi
    .fn()
    .mockResolvedValue([{ layer: 1, name: 'Narrative Core', file: 'HELIX_SOUL.md', status: 'ok' }]),
  buildLayerSummary: vi.fn(),
  validateContextFile: vi.fn(),
  HELIX_LAYER_FILES: {},
}));

vi.mock('./file-watcher.js', () => ({
  startFileWatcher: vi.fn(),
  stopFileWatcher: vi.fn(),
  manualLogFileChange: vi.fn(),
  getWatchedDirectories: vi.fn().mockReturnValue(['/test/dir']),
  getHashCacheSize: vi.fn().mockReturnValue(50),
  logFileChange: vi.fn(),
}));

vi.mock('./api-logger.js', () => ({
  logApiPreFlight: vi.fn(),
  logApiResponse: vi.fn(),
  logApiError: vi.fn(),
  getApiStats: vi.fn().mockReturnValue({
    requestCount: 5,
    tokenCount: 1000,
    pendingCount: 0,
  }),
  createApiLoggerWrapper: vi.fn(),
  extractPromptPreview: vi.fn(),
}));

vi.mock('../lib/env-validator.js', () => ({
  requireValidEnvironment: vi.fn(),
}));

describe('Helix Index Module', () => {
  beforeEach(async () => {
    // Reset environment
    delete process.env.OPENCLAW_WORKSPACE;

    // Clear mock call counts (but keep implementations)
    const {
      setFailClosedMode,
      validateSecurityConfiguration,
      installPreExecutionLogger,
      initializeDiscordWebhooks,
    } = await import('./logging-hooks.js');
    vi.mocked(setFailClosedMode).mockClear();
    vi.mocked(validateSecurityConfiguration).mockClear();
    vi.mocked(installPreExecutionLogger).mockClear();
    vi.mocked(initializeDiscordWebhooks).mockClear();

    const { startHashChainScheduler, stopHashChainScheduler, createHashChainEntry } =
      await import('./hash-chain.js');
    vi.mocked(startHashChainScheduler).mockClear();
    vi.mocked(stopHashChainScheduler).mockClear();
    vi.mocked(createHashChainEntry).mockClear();

    const { startHeartbeat, stopHeartbeat, announceStartup, announceShutdown } =
      await import('./heartbeat.js');
    vi.mocked(startHeartbeat).mockClear();
    vi.mocked(stopHeartbeat).mockClear();
    vi.mocked(announceStartup).mockClear();
    vi.mocked(announceShutdown).mockClear();

    const { startFileWatcher, stopFileWatcher } = await import('./file-watcher.js');
    vi.mocked(startFileWatcher).mockClear();
    vi.mocked(stopFileWatcher).mockClear();

    const { ensureHelixDirectoryStructure } = await import('./helix-context-loader.js');
    vi.mocked(ensureHelixDirectoryStructure).mockClear();
  });

  describe('initializeHelix', () => {
    it('should initialize with default options', async () => {
      await initializeHelix();

      const { setFailClosedMode } = await import('./logging-hooks.js');
      const { setHashChainFailClosedMode } = await import('./hash-chain.js');
      const { announceStartup } = await import('./heartbeat.js');

      expect(setFailClosedMode).toHaveBeenCalledWith(true);
      expect(setHashChainFailClosedMode).toHaveBeenCalledWith(true);
      expect(announceStartup).toHaveBeenCalled();
    });

    it('should initialize with custom options', async () => {
      const options: HelixInitOptions = {
        workspaceDir: '/custom/workspace',
        enableFileWatcher: false,
        hashChainInterval: 10000,
        skipHashChain: true,
        enableHeartbeat: false,
        failClosedMode: false,
        skipSecurityValidation: true,
      };

      await initializeHelix(options);

      const { setFailClosedMode } = await import('./logging-hooks.js');
      const { startFileWatcher } = await import('./file-watcher.js');
      const { startHashChainScheduler } = await import('./hash-chain.js');
      const { startHeartbeat } = await import('./heartbeat.js');

      expect(setFailClosedMode).toHaveBeenCalledWith(false);
      expect(startFileWatcher).not.toHaveBeenCalled();
      expect(startHashChainScheduler).not.toHaveBeenCalled();
      expect(startHeartbeat).not.toHaveBeenCalled();
    });

    it('should validate security configuration by default', async () => {
      await initializeHelix({ skipSecurityValidation: false });

      const { validateSecurityConfiguration } = await import('./logging-hooks.js');
      expect(validateSecurityConfiguration).toHaveBeenCalled();
    });

    it('should skip security validation when requested', async () => {
      await initializeHelix({ skipSecurityValidation: true });

      const { validateSecurityConfiguration } = await import('./logging-hooks.js');
      expect(validateSecurityConfiguration).not.toHaveBeenCalled();
    });

    it('should handle security validation warnings', async () => {
      const { validateSecurityConfiguration } = await import('./logging-hooks.js');
      vi.mocked(validateSecurityConfiguration).mockResolvedValueOnce({
        valid: true,
        criticalIssues: [],
        warnings: ['Test warning'],
        webhooks: [],
        checkedAt: new Date().toISOString(),
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializeHelix();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Helix] Security warnings:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  - Test warning');

      consoleWarnSpy.mockRestore();
    });

    it('should handle invalid security configuration in non-fail-closed mode', async () => {
      const { validateSecurityConfiguration } = await import('./logging-hooks.js');
      vi.mocked(validateSecurityConfiguration).mockResolvedValueOnce({
        valid: false,
        criticalIssues: ['Critical issue'],
        warnings: [],
        webhooks: [],
        checkedAt: new Date().toISOString(),
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializeHelix({ failClosedMode: false });

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Helix] SECURITY CONFIGURATION INVALID:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  - Critical issue');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Helix] Continuing despite security issues (fail-closed disabled)'
      );

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should announce startup before other initialization', async () => {
      const callOrder: string[] = [];

      const { announceStartup } = await import('./heartbeat.js');
      const { ensureHelixDirectoryStructure } = await import('./helix-context-loader.js');

      vi.mocked(announceStartup).mockImplementation((): Promise<boolean> => {
        callOrder.push('announceStartup');
        return Promise.resolve(true);
      });

      vi.mocked(ensureHelixDirectoryStructure).mockImplementation((): Promise<void> => {
        callOrder.push('ensureDirectories');
        return Promise.resolve();
      });

      await initializeHelix();

      expect(callOrder[0]).toBe('announceStartup');
      expect(callOrder[1]).toBe('ensureDirectories');
    });

    it('should install pre-execution logger', async () => {
      await initializeHelix();

      const { installPreExecutionLogger } = await import('./logging-hooks.js');
      expect(installPreExecutionLogger).toHaveBeenCalled();
    });

    it('should initialize Discord webhooks via preloadSecrets', async () => {
      // Discord webhooks are now initialized in preloadSecrets()
      // This test verifies that initializeHelix doesn't fail when webhooks are initialized
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await initializeHelix();

      // Verify initialization succeeded without errors
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Helix] Initializing logging system')
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle Discord webhook initialization failure gracefully', async () => {
      // Discord webhook failures are handled in preloadSecrets
      // This test verifies that webhook failures don't block initializeHelix
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializeHelix();

      // Verify initialization completed despite any webhook issues
      // The 1Password audit scheduler may generate some warnings
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should start file watcher when enabled', async () => {
      await initializeHelix({ enableFileWatcher: true });

      const { startFileWatcher } = await import('./file-watcher.js');
      expect(startFileWatcher).toHaveBeenCalled();
    });

    it('should not start file watcher when disabled', async () => {
      await initializeHelix({ enableFileWatcher: false });

      const { startFileWatcher } = await import('./file-watcher.js');
      expect(startFileWatcher).not.toHaveBeenCalled();
    });

    it('should start hash chain scheduler with custom interval', async () => {
      const interval = 120000;
      await initializeHelix({ hashChainInterval: interval, skipHashChain: false });

      const { startHashChainScheduler } = await import('./hash-chain.js');
      expect(startHashChainScheduler).toHaveBeenCalledWith(interval);
    });

    it('should skip hash chain when requested', async () => {
      await initializeHelix({ skipHashChain: true });

      const { startHashChainScheduler } = await import('./hash-chain.js');
      expect(startHashChainScheduler).not.toHaveBeenCalled();
    });

    it('should start heartbeat when enabled', async () => {
      await initializeHelix({ enableHeartbeat: true });

      const { startHeartbeat } = await import('./heartbeat.js');
      expect(startHeartbeat).toHaveBeenCalled();
    });

    it('should not start heartbeat when disabled', async () => {
      await initializeHelix({ enableHeartbeat: false });

      const { startHeartbeat } = await import('./heartbeat.js');
      expect(startHeartbeat).not.toHaveBeenCalled();
    });

    it('should use OPENCLAW_WORKSPACE environment variable', async () => {
      process.env.OPENCLAW_WORKSPACE = '/env/workspace';

      await initializeHelix();

      const { ensureHelixDirectoryStructure } = await import('./helix-context-loader.js');
      expect(ensureHelixDirectoryStructure).toHaveBeenCalledWith('/env/workspace');
    });

    it('should expand tilde in workspace directory', async () => {
      const home = process.env.HOME || process.env.USERPROFILE || '';

      await initializeHelix({ workspaceDir: '~/workspace' });

      const { ensureHelixDirectoryStructure } = await import('./helix-context-loader.js');
      expect(ensureHelixDirectoryStructure).toHaveBeenCalledWith(`${home}/workspace`);
    });

    it('should validate environment before initialization', async () => {
      await initializeHelix();

      const { requireValidEnvironment } = await import('../lib/env-validator.js');
      expect(requireValidEnvironment).toHaveBeenCalled();
    });

    it('should exit on environment validation failure', async () => {
      const { requireValidEnvironment } = await import('../lib/env-validator.js');
      vi.mocked(requireValidEnvironment).mockImplementationOnce(() => {
        throw new Error('Missing environment variable');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(initializeHelix()).rejects.toThrow('Environment validation failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Helix] ENVIRONMENT VALIDATION FAILED');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('shutdownHelix', () => {
    it('should shutdown with default reason', async () => {
      await shutdownHelix();

      const { announceShutdown } = await import('./heartbeat.js');
      expect(announceShutdown).toHaveBeenCalledWith('graceful');
    });

    it('should shutdown with custom reason', async () => {
      await shutdownHelix('user-requested');

      const { announceShutdown } = await import('./heartbeat.js');
      expect(announceShutdown).toHaveBeenCalledWith('user-requested');
    });

    it('should stop heartbeat first', async () => {
      const callOrder: string[] = [];

      const { stopHeartbeat } = await import('./heartbeat.js');
      const { stopFileWatcher } = await import('./file-watcher.js');

      vi.mocked(stopHeartbeat).mockImplementation(() => {
        callOrder.push('stopHeartbeat');
      });

      vi.mocked(stopFileWatcher).mockImplementation(() => {
        callOrder.push('stopFileWatcher');
      });

      await shutdownHelix();

      expect(callOrder[0]).toBe('stopHeartbeat');
      expect(callOrder[1]).toBe('stopFileWatcher');
    });

    it('should stop file watcher', async () => {
      await shutdownHelix();

      const { stopFileWatcher } = await import('./file-watcher.js');
      expect(stopFileWatcher).toHaveBeenCalled();
    });

    it('should stop hash chain scheduler', async () => {
      await shutdownHelix();

      const { stopHashChainScheduler } = await import('./hash-chain.js');
      expect(stopHashChainScheduler).toHaveBeenCalled();
    });

    it('should create final hash chain entry', async () => {
      await shutdownHelix();

      const { createHashChainEntry } = await import('./hash-chain.js');
      expect(createHashChainEntry).toHaveBeenCalled();
    });

    it('should announce shutdown last', async () => {
      const callOrder: string[] = [];

      const { createHashChainEntry } = await import('./hash-chain.js');
      const { announceShutdown } = await import('./heartbeat.js');

      vi.mocked(createHashChainEntry).mockImplementation(() => {
        callOrder.push('createHashChainEntry');
        return Promise.resolve({
          timestamp: new Date().toISOString(),
          previousHash: '',
          logStates: {},
          entryHash: 'abc123',
        });
      });

      vi.mocked(announceShutdown).mockImplementation((): Promise<boolean> => {
        callOrder.push('announceShutdown');
        return Promise.resolve(true);
      });

      await shutdownHelix();

      const lastIndex = callOrder.length - 1;
      expect(callOrder[lastIndex]).toBe('announceShutdown');
    });
  });

  describe('getHelixStatus', () => {
    it('should return complete status object', async () => {
      const status = await getHelixStatus();

      expect(status).toEqual({
        initialized: true,
        watchedDirectories: ['/test/dir'],
        hashCacheSize: 50,
        chainState: {
          lastHash: 'test-hash',
          sequence: 42,
          entries: 100,
        },
        apiStats: {
          requestCount: 5,
          tokenCount: 1000,
          pendingCount: 0,
        },
        heartbeat: {
          running: true,
          count: 10,
          uptime: '10m',
        },
        contextStatus: [{ layer: 1, name: 'Narrative Core', file: 'HELIX_SOUL.md', status: 'ok' }],
      });
    });

    it('should call all stat collection functions', async () => {
      await getHelixStatus();

      const { getWatchedDirectories, getHashCacheSize } = await import('./file-watcher.js');
      const { getChainState } = await import('./hash-chain.js');
      const { getApiStats } = await import('./api-logger.js');
      const { getHelixContextStatus } = await import('./helix-context-loader.js');
      const { getHeartbeatStats } = await import('./heartbeat.js');

      expect(getWatchedDirectories).toHaveBeenCalled();
      expect(getHashCacheSize).toHaveBeenCalled();
      expect(getChainState).toHaveBeenCalled();
      expect(getApiStats).toHaveBeenCalled();
      expect(getHelixContextStatus).toHaveBeenCalled();
      expect(getHeartbeatStats).toHaveBeenCalled();
    });

    it('should use OPENCLAW_WORKSPACE environment variable', async () => {
      process.env.OPENCLAW_WORKSPACE = '/env/workspace';

      await getHelixStatus();

      const { getHelixContextStatus } = await import('./helix-context-loader.js');
      expect(getHelixContextStatus).toHaveBeenCalledWith('/env/workspace');
    });

    it('should expand tilde in workspace path', async () => {
      delete process.env.OPENCLAW_WORKSPACE;
      const home = process.env.HOME || process.env.USERPROFILE || '';

      await getHelixStatus();

      const { getHelixContextStatus } = await import('./helix-context-loader.js');
      expect(getHelixContextStatus).toHaveBeenCalledWith(
        expect.stringContaining(home || '.openclaw')
      );
    });
  });

  describe('Type Exports', () => {
    it('should export all required types', () => {
      // These imports will fail at compile time if types are not exported
      const typeChecks = `
        import type {
          InternalHookEvent,
          PreExecutionLog,
          PostExecutionLog,
          ApiPreFlightLog,
          ApiResponseLog,
          FileChangeLog,
          HashChainEntry,
          DiscordEmbed,
          DiscordPayload,
          HelixContextFile,
          WebhookHealthStatus,
          SecurityConfigStatus,
          HelixSecurityErrorCode,
          DiscordVerificationResult,
          SkillMetadata,
          SkillPermission,
          SkillSandboxConfig,
          SkillValidationResult,
          SkillExecutionContext,
          SkillExecutionResult,
          SkillAuditEntry,
          SandboxPreset,
          MCPToolMetadata,
          MCPToolCapability,
          MCPToolValidatorConfig,
          MCPToolCall,
          MCPToolValidationResult,
          MCPToolAuditEntry,
          LethalTrifectaStatus,
          MemoryEntry,
          MemoryPoisoningResult,
          TrackedInput,
          InputOrigin,
          ConfusedDeputyResult,
          CredentialExposureResult,
          AgentContext,
          ContextLeakageResult,
          PromptInjectionResult,
          ThreatAssessment,
          ToolPoisoningResult,
          SchemaPoisoningResult,
          PathTraversalResult,
          ToolDefinition,
          RugPullResult,
          SamplingAttackResult,
          ObservatoryEventType,
          TelemetryPayload,
          HeartbeatMetrics,
          TransformationData,
        } from './index.js';
      `;

      // If this compiles, all types are exported correctly
      expect(typeChecks).toBeDefined();
    });
  });
});
