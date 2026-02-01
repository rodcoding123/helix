/**
 * HELIX LOGGING MODULE
 * Unhackable pre-execution logging for the Helix autonomous AI system
 *
 * Core Principle: Logs fire BEFORE actions, not after.
 * Discord webhooks are the authoritative record.
 *
 * Usage:
 * ```typescript
 * import { initializeHelix } from './helix';
 *
 * // Call at OpenClaw startup
 * await initializeHelix({
 *   workspaceDir: '~/.openclaw/workspace',
 *   enableFileWatcher: true,
 *   hashChainInterval: 5 * 60 * 1000, // 5 minutes
 * });
 * ```
 */

// Type exports
export type {
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
} from './types.js';

export {
  HELIX_SEVEN_LAYERS,
  HelixSecurityError,
  REQUIRED_WEBHOOKS,
  OPTIONAL_WEBHOOKS,
} from './types.js';

// Logging hooks
export {
  installPreExecutionLogger,
  triggerHelixHooks,
  sendAlert,
  logConsciousnessObservation,
  WEBHOOKS,
  // Security functions
  setFailClosedMode,
  checkWebhookHealth,
  validateSecurityConfiguration,
} from './logging-hooks.js';

// Command logging
export {
  logCommandPreExecution,
  logCommandPostExecution,
  logCommandFailed,
  getPendingCommands,
  isCommandPending,
  createLoggedExecutor,
} from './command-logger.js';

// API logging
export {
  logApiPreFlight,
  logApiResponse,
  logApiError,
  getApiStats,
  createApiLoggerWrapper,
  extractPromptPreview,
} from './api-logger.js';

// File watching
export {
  startFileWatcher,
  stopFileWatcher,
  manualLogFileChange,
  getWatchedDirectories,
  getHashCacheSize,
  logFileChange,
} from './file-watcher.js';

// Hash chain
export {
  createHashChainEntry,
  verifyChain,
  getChainState,
  startHashChainScheduler,
  stopHashChainScheduler,
  verifyAgainstDiscord,
  computeEntryHash,
  hashLogFiles,
  setHashChainFailClosedMode,
} from './hash-chain.js';

// Re-export the type
export type { DiscordVerificationResult } from './hash-chain.js';

// Context loading
export {
  loadHelixContextFiles,
  loadHelixContextFilesDetailed,
  getHelixContextStatus,
  buildLayerSummary,
  ensureHelixDirectoryStructure,
  validateContextFile,
  HELIX_LAYER_FILES,
} from './helix-context-loader.js';

// Heartbeat (proof of life)
export {
  announceStartup,
  announceShutdown,
  startHeartbeat,
  stopHeartbeat,
  getHeartbeatStats,
  sendStatusUpdate,
} from './heartbeat.js';

// Observatory client (centralized telemetry)
export {
  HelixObservatoryClient,
  getObservatoryClient,
  shutdownObservatoryClient,
} from './observatory-client.js';

export type {
  ObservatoryEventType,
  TelemetryPayload,
  HeartbeatMetrics,
  TransformationData,
} from './observatory-client.js';

// Skill sandbox (secure skill execution)
export {
  validateSkill,
  executeSkillSandboxed,
  verifySkillSignature,
  getSkillAuditLog,
  clearSkillAuditLog,
  createSandboxConfig,
  DEFAULT_SKILL_SANDBOX_CONFIG,
} from './skill-sandbox.js';

export type {
  SkillMetadata,
  SkillPermission,
  SkillSandboxConfig,
  SkillValidationResult,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillAuditEntry,
  SandboxPreset,
} from './skill-sandbox.js';

// MCP tool validation (tool poisoning prevention)
export {
  validateMCPToolCall,
  validateAndExecute,
  registerToolMetadata,
  getToolMetadata,
  assessToolRisk,
  sanitizeParameters,
  getMCPToolAuditLog,
  clearMCPToolAuditLog,
  clearRateLimitStore,
  DEFAULT_VALIDATOR_CONFIG,
} from './mcp-tool-validator.js';

export type {
  MCPToolMetadata,
  MCPToolCapability,
  MCPToolValidatorConfig,
  MCPToolCall,
  MCPToolValidationResult,
  MCPToolAuditEntry,
} from './mcp-tool-validator.js';

// Threat detection (Willison's Trifecta, memory poisoning, confused deputy, MCP attacks)
export {
  // Lethal Trifecta
  detectLethalTrifecta,
  // Memory poisoning
  detectMemoryPoisoning,
  createVerifiedMemoryEntry,
  // Confused deputy
  detectConfusedDeputy,
  calculateTrustLevel,
  // Credential exposure
  detectCredentialExposure,
  sanitizeCredentials,
  // Context leakage
  detectContextLeakage,
  // Prompt injection
  detectPromptInjection,
  // Comprehensive assessment
  assessThreats,
  enforceSecurityPolicy,
  // MCP tool poisoning (WhatsApp breach pattern)
  detectToolPoisoning,
  // Schema poisoning (IDEsaster CVE-2025-49150)
  detectSchemaPoisoning,
  // Path traversal (Anthropic Filesystem breach)
  detectPathTraversal,
  // Rug pull detection (tool mutation)
  detectRugPull,
  hashToolDefinition,
  // MCP sampling attacks (Unit42 research)
  detectSamplingAttack,
} from './threat-detection.js';

export type {
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
  // New types for MCP attack detection
  ToolPoisoningResult,
  SchemaPoisoningResult,
  PathTraversalResult,
  ToolDefinition,
  RugPullResult,
  SamplingAttackResult,
} from './threat-detection.js';

/**
 * Helix initialization options
 */
export interface HelixInitOptions {
  /** OpenClaw workspace directory */
  workspaceDir?: string;

  /** Enable file system watcher */
  enableFileWatcher?: boolean;

  /** Hash chain creation interval in ms (default: 5 minutes) */
  hashChainInterval?: number;

  /** Skip hash chain scheduler */
  skipHashChain?: boolean;

  /** Enable heartbeat (default: true) - sends proof-of-life every 60 seconds */
  enableHeartbeat?: boolean;

  /** Enable fail-closed security mode (default: true) - blocks operations if logging fails */
  failClosedMode?: boolean;

  /** Skip security validation at startup (NOT RECOMMENDED) */
  skipSecurityValidation?: boolean;
}

/**
 * Initialize the complete Helix logging system
 * Call this at OpenClaw startup
 */
export async function initializeHelix(options: HelixInitOptions = {}): Promise<void> {
  const {
    workspaceDir = process.env.OPENCLAW_WORKSPACE || '~/.openclaw/workspace',
    enableFileWatcher = true,
    hashChainInterval = 5 * 60 * 1000,
    skipHashChain = false,
    enableHeartbeat = true,
    failClosedMode = true,
    skipSecurityValidation = false,
  } = options;

  console.log('[Helix] Initializing logging system...');

  // ============================================
  // STEP -1: SECURITY CONFIGURATION VALIDATION
  // This MUST happen before anything else
  // Ensures we can actually log before proceeding
  // ============================================
  const {
    setFailClosedMode,
    validateSecurityConfiguration,
  } = await import('./logging-hooks.js');
  const { setHashChainFailClosedMode } = await import('./hash-chain.js');

  // Set fail-closed mode
  setFailClosedMode(failClosedMode);
  setHashChainFailClosedMode(failClosedMode);

  if (!skipSecurityValidation) {
    console.log('[Helix] Validating security configuration...');
    const securityStatus = await validateSecurityConfiguration();

    if (!securityStatus.valid) {
      console.error('[Helix] SECURITY CONFIGURATION INVALID:');
      for (const issue of securityStatus.criticalIssues) {
        console.error(`  - ${issue}`);
      }
      // In fail-closed mode, validateSecurityConfiguration already throws
      // This is a fallback for non-fail-closed mode
      if (!failClosedMode) {
        console.warn('[Helix] Continuing despite security issues (fail-closed disabled)');
      }
    } else {
      console.log('[Helix] Security configuration validated');
      if (securityStatus.warnings.length > 0) {
        console.warn('[Helix] Security warnings:');
        for (const warning of securityStatus.warnings) {
          console.warn(`  - ${warning}`);
        }
      }
    }
  } else {
    console.warn('[Helix] WARNING: Skipping security validation (not recommended!)');
  }

  // ============================================
  // STEP 0: STARTUP ANNOUNCEMENT (FIRST!)
  // This MUST be the first thing that happens
  // Creates an immutable record of every boot
  // ============================================
  const { announceStartup, startHeartbeat } = await import('./heartbeat.js');
  await announceStartup();

  // 1. Ensure directory structure exists
  const { ensureHelixDirectoryStructure } = await import('./helix-context-loader.js');
  await ensureHelixDirectoryStructure(
    workspaceDir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '')
  );

  // 2. Install pre-execution logging hooks
  const { installPreExecutionLogger } = await import('./logging-hooks.js');
  installPreExecutionLogger();

  // 3. Start file watcher (if enabled)
  if (enableFileWatcher) {
    const { startFileWatcher } = await import('./file-watcher.js');
    startFileWatcher();
  }

  // 4. Start hash chain scheduler (if not skipped)
  if (!skipHashChain) {
    const { startHashChainScheduler } = await import('./hash-chain.js');
    startHashChainScheduler(hashChainInterval);
  }

  // 5. Start heartbeat (proof of life every 60 seconds)
  if (enableHeartbeat) {
    startHeartbeat();
  }

  console.log('[Helix] Logging system initialized successfully');
}

/**
 * Shutdown the Helix logging system
 * Call this at OpenClaw shutdown
 */
export async function shutdownHelix(reason: string = 'graceful'): Promise<void> {
  console.log('[Helix] Shutting down logging system...');

  // Stop heartbeat first (no more proof-of-life needed)
  const { stopHeartbeat, announceShutdown } = await import('./heartbeat.js');
  stopHeartbeat();

  // Stop file watcher
  const { stopFileWatcher } = await import('./file-watcher.js');
  stopFileWatcher();

  // Stop hash chain scheduler
  const { stopHashChainScheduler } = await import('./hash-chain.js');
  stopHashChainScheduler();

  // Final hash chain entry
  const { createHashChainEntry } = await import('./hash-chain.js');
  await createHashChainEntry();

  // ============================================
  // SHUTDOWN ANNOUNCEMENT (LAST!)
  // Creates an immutable record of graceful shutdown
  // If this doesn't appear, shutdown was NOT graceful
  // ============================================
  await announceShutdown(reason);

  console.log('[Helix] Logging system shut down');
}

/**
 * Get the current status of the Helix system
 */
export async function getHelixStatus(): Promise<{
  initialized: boolean;
  watchedDirectories: string[];
  hashCacheSize: number;
  chainState: { lastHash: string; sequence: number; entries: number };
  apiStats: { requestCount: number; tokenCount: number; pendingCount: number };
  heartbeat: { running: boolean; count: number; uptime: string };
  contextStatus: { layer: number; name: string; file: string; status: string }[];
}> {
  const { getWatchedDirectories, getHashCacheSize } = await import('./file-watcher.js');
  const { getChainState } = await import('./hash-chain.js');
  const { getApiStats } = await import('./api-logger.js');
  const { getHelixContextStatus } = await import('./helix-context-loader.js');
  const { getHeartbeatStats } = await import('./heartbeat.js');

  const workspaceDir = process.env.OPENCLAW_WORKSPACE || '~/.openclaw/workspace';
  const resolvedWorkspace = workspaceDir.replace(
    /^~/,
    process.env.HOME || process.env.USERPROFILE || ''
  );

  const heartbeatStats = getHeartbeatStats();

  return {
    initialized: true,
    watchedDirectories: getWatchedDirectories(),
    hashCacheSize: getHashCacheSize(),
    chainState: await getChainState(),
    apiStats: getApiStats(),
    heartbeat: {
      running: heartbeatStats.running,
      count: heartbeatStats.count,
      uptime: heartbeatStats.uptime,
    },
    contextStatus: await getHelixContextStatus(resolvedWorkspace),
  };
}
