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
  // Security functions (setFailClosedMode is internal-only for security)
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
  // setHashChainFailClosedMode is internal-only for security
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

// Phase 0 orchestration
export { conductorLoop } from './orchestration/index.js';

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
// Module-level state for active schedulers
let auditSchedulerInterval: NodeJS.Timeout | null = null;

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

  /** Enable 1Password audit scheduler (default: true) */
  enableAuditScheduler?: boolean;
}

/**
 * Preload all secrets before any other initialization
 *
 * CRITICAL: This MUST be called before initializeHelix()
 * Ensures all secrets are encrypted in memory before any logging happens
 *
 * @throws HelixSecurityError if secrets cannot be loaded (fail-closed)
 */
export async function preloadSecrets(): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('[Helix] Preloading secrets from 1Password...');

    // Initialize encrypted cache
    const { EncryptedSecretsCache } = await import('../lib/secrets-cache-encrypted.js');
    const secretsCache = new EncryptedSecretsCache();
    await secretsCache.initialize();
    console.log('[Helix] Encrypted cache initialized');

    // Load all secrets into memory (encrypted)
    const { loadAllSecrets } = await import('../lib/secrets-loader.js');
    const secrets = loadAllSecrets();
    const secretCount = Object.keys(secrets).length;

    // Initialize Discord webhooks from loaded secrets
    try {
      const { initializeDiscordWebhooks } = await import('./logging-hooks.js');
      initializeDiscordWebhooks();
      console.log('[Helix] Discord webhooks initialized from secrets');
    } catch (webhookError) {
      console.warn(
        '[Helix] Failed to initialize Discord webhooks:',
        webhookError instanceof Error ? webhookError.message : String(webhookError)
      );
      console.warn('[Helix] Continuing with environment variable fallback');
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Helix] Preloaded ${secretCount} secrets from 1Password in ${durationMs}ms`);

    // Log to hash chain (Phase 1B.1)
    try {
      const { logSecretOperation } = await import('./hash-chain.js');
      await logSecretOperation({
        operation: 'preload',
        source: process.env.HELIX_SECRETS_SOURCE === 'env' ? 'env' : '1password',
        success: true,
        timestamp: new Date().toISOString(),
        durationMs,
        keyVersion: secretsCache.getKeyVersion(),
        details: `Preloaded ${secretCount} secrets`,
      });
    } catch (logError) {
      // Don't fail if hash chain logging fails
      console.warn(
        '[Helix] Failed to log secret preload to hash chain:',
        logError instanceof Error ? logError.message : String(logError)
      );
    }
  } catch (error) {
    // FAIL-CLOSED: Cannot proceed without secrets
    const { HelixSecurityError } = await import('./types.js');
    throw new HelixSecurityError(
      'Failed to preload secrets - cannot start Helix',
      'SECRETS_PRELOAD_FAILED',
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

/**
 * Initialize the complete Helix logging system
 * Call this at OpenClaw startup (AFTER preloadSecrets())
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
    enableAuditScheduler = true,
  } = options;

  console.log('[Helix] Initializing logging system...');

  // ============================================
  // STEP -2: ENVIRONMENT VARIABLE VALIDATION
  // This MUST happen before anything else
  // Ensures all required secrets are available
  // ============================================
  const { requireValidEnvironment } = await import('../lib/env-validator.js');
  try {
    requireValidEnvironment();
  } catch {
    console.error('[Helix] ENVIRONMENT VALIDATION FAILED');
    console.error('[Helix] Cannot proceed without all required secrets');
    process.exit(1);
  }

  // ============================================
  // STEP -1: SECURITY CONFIGURATION VALIDATION
  // This MUST happen before anything else
  // Ensures we can actually log before proceeding
  // ============================================
  const { setFailClosedMode, validateSecurityConfiguration } = await import('./logging-hooks.js');
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
  // NOTE: Discord webhooks are already initialized in preloadSecrets()
  const { installPreExecutionLogger } = await import('./logging-hooks.js');
  installPreExecutionLogger();

  // 4. Start file watcher (if enabled)
  if (enableFileWatcher) {
    const { startFileWatcher } = await import('./file-watcher.js');
    startFileWatcher();
  }

  // 5. Start hash chain scheduler (if not skipped)
  if (!skipHashChain) {
    const { startHashChainScheduler } = await import('./hash-chain.js');
    startHashChainScheduler(hashChainInterval);
  }

  // 5b. Start 1Password audit scheduler (if not skipped)
  if (enableAuditScheduler) {
    try {
      const { startOnePasswordAuditScheduler } = await import('../lib/1password-audit.js');
      auditSchedulerInterval = await startOnePasswordAuditScheduler();
      console.log('[Helix] 1Password audit scheduler started');
    } catch (error) {
      // Don't fail if audit scheduler can't start
      console.warn(
        '[Helix] Failed to start 1Password audit scheduler:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // 6. Start heartbeat (proof of life every 60 seconds)
  if (enableHeartbeat) {
    startHeartbeat();
  }

  // 7. Start Phase 0 ConductorLoop (autonomous orchestration)
  try {
    const { conductorLoop } = await import('./orchestration/index.js');
    const loopStarted = await conductorLoop.start();
    if (loopStarted) {
      console.log('[Helix] Phase 0 ConductorLoop started');
      // Fire-and-forget logging to Discord
      const { logConsciousnessObservation } = await import('./logging-hooks.js');
      logConsciousnessObservation(
        'Phase 0 orchestration loop initialized and running',
        'system_startup'
      ).catch(err => {
        console.warn('[Helix] Failed to log ConductorLoop startup:', err);
      });
    }
  } catch (err) {
    console.error('[Helix] Failed to start ConductorLoop:', err);
    // Fire-and-forget alert logging
    const { sendAlert } = await import('./logging-hooks.js');
    sendAlert(
      'ConductorLoop Initialization Failed',
      `Phase 0 orchestration failed to start: ${err instanceof Error ? err.message : String(err)}`,
      'warning'
    ).catch(alertErr => {
      console.warn('[Helix] Failed to send ConductorLoop alert:', alertErr);
    });
    // Don't throw - let Helix start without orchestration
  }

  console.log('[Helix] Logging system initialized successfully');
}

/**
 * Shutdown the Helix logging system
 * Call this at OpenClaw shutdown
 */
export async function shutdownHelix(reason: string = 'graceful'): Promise<void> {
  console.log('[Helix] Shutting down logging system...');

  // Stop Phase 0 ConductorLoop first (highest priority)
  try {
    const { conductorLoop } = await import('./orchestration/index.js');
    const loopStopped = conductorLoop.stop();
    if (loopStopped) {
      console.log('[Helix] Phase 0 ConductorLoop stopped');
    }
  } catch (err) {
    console.warn('[Helix] Error stopping ConductorLoop:', err);
  }

  // Stop heartbeat (no more proof-of-life needed)
  const { stopHeartbeat, announceShutdown } = await import('./heartbeat.js');
  stopHeartbeat();

  // Stop file watcher
  const { stopFileWatcher } = await import('./file-watcher.js');
  stopFileWatcher();

  // Stop hash chain scheduler
  const { stopHashChainScheduler } = await import('./hash-chain.js');
  stopHashChainScheduler();

  // Stop 1Password audit scheduler
  if (auditSchedulerInterval) {
    const { stopOnePasswordAuditScheduler } = await import('../lib/1password-audit.js');
    stopOnePasswordAuditScheduler(auditSchedulerInterval);
    auditSchedulerInterval = null;
  }

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
 * Gateway security configuration result
 */
export interface GatewaySecurityConfig {
  bindConfig: {
    host: string;
    port: number;
    valid: boolean;
    requiresAuth: boolean;
  };
  authConfig: {
    mode: 'token' | 'none';
    tokenValid: boolean;
  };
  websocketConfig: {
    allowedOrigins: string[];
    allowedGatewayUrls?: string[];
    enforceHttpsInProduction: boolean;
    requireOriginHeader: boolean;
  };
  environment: 'development' | 'production';
}

/**
 * Initialize Helix gateway with security hardening
 *
 * Wires together all security modules:
 * - gateway-security.ts: Bind validation
 * - gateway-token-verification.ts: Token auth & rate limiting
 * - websocket-security.ts: Origin validation & CSWSH prevention
 *
 * CRITICAL: Must be called BEFORE starting the OpenClaw gateway server.
 *
 * @param options Gateway configuration options
 * @returns Security configuration for OpenClaw gateway
 * @throws Error if security validation fails (fail-closed design)
 */
export async function initializeHelixGateway(options: {
  port: number;
  bindHost: string;
  environment: 'development' | 'production';
}): Promise<GatewaySecurityConfig> {
  console.log('[Helix] Initializing gateway security...');

  // Step 1: Validate bind configuration
  const { validateGatewayBind } = await import('./gateway-security.js');
  const bindValidation = validateGatewayBind({
    host: options.bindHost,
    port: options.port,
    authRequired: options.bindHost !== '127.0.0.1' && options.bindHost !== 'localhost',
  });

  if (!bindValidation.valid) {
    throw new Error(`Gateway bind validation failed: ${bindValidation.errors.join('; ')}`);
  }

  if (bindValidation.warnings.length > 0) {
    for (const warning of bindValidation.warnings) {
      console.warn(`[Helix] Gateway security warning: ${warning}`);
    }
  }

  // Step 2: Check token requirements
  const { requiresTokenVerification, validateTokenFormat } =
    await import('./gateway-token-verification.js');
  const needsToken = requiresTokenVerification(options.bindHost, options.environment);

  let tokenValid = true;
  let authMode: 'token' | 'none' = 'none';

  if (needsToken === 'rejected') {
    throw new Error('Production environment rejects 0.0.0.0 gateway binding');
  }

  if (needsToken === true) {
    authMode = 'token';
    // Load gateway token from environment (loaded by secrets-loader during preloadSecrets)
    const gatewayToken = process.env.HELIX_GATEWAY_TOKEN;
    if (!gatewayToken) {
      throw new Error(
        'HELIX_GATEWAY_TOKEN required for network bindings. ' +
          'Use 127.0.0.1 for local development or set HELIX_GATEWAY_TOKEN.'
      );
    }
    tokenValid = validateTokenFormat(gatewayToken);
    if (!tokenValid) {
      throw new Error('HELIX_GATEWAY_TOKEN must be a 256-character hex string');
    }
  }

  // Step 3: Configure WebSocket security
  const { getDefaultWebSocketConfig } = await import('./websocket-security.js');
  const websocketConfig = getDefaultWebSocketConfig(options.environment);

  // Step 4: Log security initialization
  try {
    const { logSecretOperation } = await import('./hash-chain.js');
    await logSecretOperation({
      operation: 'access',
      source: 'cache',
      success: true,
      timestamp: new Date().toISOString(),
      details: `Gateway security initialized: ${options.bindHost}:${options.port} (${options.environment})`,
    });
  } catch {
    // Don't fail if hash chain logging fails
    console.warn('[Helix] Failed to log gateway init to hash chain');
  }

  console.log('[Helix] Gateway security initialized successfully');

  return {
    bindConfig: {
      host: options.bindHost,
      port: options.port,
      valid: bindValidation.valid,
      requiresAuth: needsToken === true,
    },
    authConfig: {
      mode: authMode,
      tokenValid,
    },
    websocketConfig: {
      allowedOrigins: websocketConfig.allowedOrigins,
      allowedGatewayUrls: websocketConfig.allowedGatewayUrls,
      enforceHttpsInProduction: websocketConfig.enforceHttpsInProduction,
      requireOriginHeader: websocketConfig.requireOriginHeader,
    },
    environment: options.environment,
  };
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
