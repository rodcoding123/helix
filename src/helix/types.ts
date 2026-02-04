/**
 * HELIX TYPE DEFINITIONS
 * Shared types for the Helix logging system
 */

// =============================================================================
// SECURITY TYPES
// =============================================================================

/**
 * Security error thrown when critical logging infrastructure fails
 * This implements FAIL-CLOSED behavior - operations block when logging unavailable
 */
export class HelixSecurityError extends Error {
  constructor(
    message: string,
    public readonly code: HelixSecurityErrorCode,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HelixSecurityError';
  }
}

/**
 * Security error codes for fail-closed behavior
 */
export type HelixSecurityErrorCode =
  | 'WEBHOOK_UNAVAILABLE'
  | 'WEBHOOK_NOT_CONFIGURED'
  | 'LOGGING_FAILED'
  | 'HASH_CHAIN_BROKEN'
  | 'DISCORD_UNREACHABLE'
  | 'SECURITY_CONFIG_INVALID'
  | 'SECRETS_PRELOAD_FAILED';

/**
 * Webhook health check result
 */
export interface WebhookHealthStatus {
  name: string;
  url: string | undefined;
  configured: boolean;
  reachable: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Overall security configuration status
 */
export interface SecurityConfigStatus {
  valid: boolean;
  webhooks: WebhookHealthStatus[];
  criticalIssues: string[];
  warnings: string[];
  checkedAt: string;
}

/**
 * Required webhook channels for Helix security model
 */
export const REQUIRED_WEBHOOKS = [
  'DISCORD_WEBHOOK_COMMANDS',
  'DISCORD_WEBHOOK_HASH_CHAIN',
  'DISCORD_WEBHOOK_ALERTS',
] as const;

/**
 * Optional but recommended webhooks
 */
export const OPTIONAL_WEBHOOKS = [
  'DISCORD_WEBHOOK_API',
  'DISCORD_WEBHOOK_FILE_CHANGES',
  'DISCORD_WEBHOOK_CONSCIOUSNESS',
  'DISCORD_WEBHOOK_HEARTBEAT',
] as const;

// =============================================================================
// HOOK TYPES
// =============================================================================

/**
 * Internal hook event structure (matches OpenClaw's internal-hooks.ts)
 */
export interface InternalHookEvent {
  type: string;
  action: string;
  sessionKey?: string;
  context?: {
    command?: string;
    workdir?: string;
    files?: string[];
    [key: string]: unknown;
  };
  timestamp?: string;
}

/**
 * Pre-execution command log entry
 */
export interface PreExecutionLog {
  id: string;
  command: string;
  workdir: string;
  timestamp: string;
  sessionKey?: string;
  elevated?: boolean;
}

/**
 * Post-execution command log entry
 */
export interface PostExecutionLog extends PreExecutionLog {
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  outputPreview: string;
}

/**
 * API pre-flight log entry
 */
export interface ApiPreFlightLog {
  model?: string;
  provider?: string;
  sessionKey?: string;
  timestamp: string;
  promptPreview?: string;
  requestId?: string;
}

/**
 * API response log entry
 */
export interface ApiResponseLog extends ApiPreFlightLog {
  responsePreview?: string;
  tokenCount?: number;
  latencyMs?: number;
}

/**
 * File change log entry
 */
export interface FileChangeLog {
  path: string;
  changeType: 'created' | 'modified' | 'deleted';
  hash?: string;
  timestamp: string;
  sizeBytes?: number;
}

/**
 * Hash chain entry
 */
export interface HashChainEntry {
  timestamp: string;
  previousHash: string;
  logStates: Record<string, string>;
  entryHash: string;
  sequence?: number;
}

/**
 * Secret operation entry for audit logging
 * Logs all secret management operations (preload, access, rotation, plugin attempts, failures)
 */
export interface SecretOperationEntry {
  operation: 'preload' | 'access' | 'rotation' | 'plugin_attempt' | 'failure';
  secretName?: string; // Sanitized name only, never the actual secret value
  pluginId?: string; // If operation involves plugin access attempt
  source: '1password' | 'env' | 'cache';
  success: boolean;
  timestamp: string;
  durationMs?: number;
  keyVersion?: number;
  details?: string; // Additional context, can be sanitized error message
}

/**
 * Trust update entry for user-agnostic trust formation logging
 * Logs all trust changes to hash chain for immutable audit trail
 * User IDs are hashed for privacy (pseudonymous logging)
 */
export interface TrustUpdateEntry {
  operation:
    | 'trust_increase'
    | 'trust_decrease'
    | 'violation'
    | 'stage_progression'
    | 'stage_regression'
    | 'emotional_impact'
    | 'reciprocity_detected';

  userId: string; // SHA-256 hashed for privacy
  userIdentifierHash: string; // First 8 chars of hash (pseudonymous ID)

  trigger: string; // What triggered the update

  trustBefore: number;
  trustAfter: number;
  trustDelta: number;

  dimensionsChanged: {
    competence?: { before: number; after: number };
    integrity?: { before: number; after: number };
    benevolence?: { before: number; after: number };
    predictability?: { before: number; after: number };
    vulnerability_safety?: { before: number; after: number };
  };

  conversationId?: string; // Reference to conversation that triggered update
  salienceTier: 'critical' | 'high' | 'medium' | 'low';

  attachmentStageBefore?: string;
  attachmentStageAfter?: string;

  timestamp: string;
  durationMs?: number;
}

/**
 * Discord embed field
 */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord embed structure
 */
export interface DiscordEmbed {
  title: string;
  color: number;
  description?: string;
  fields: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
}

/**
 * Discord webhook payload
 */
export interface DiscordPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

/**
 * Helix context file (for seven-layer loading)
 */
export interface HelixContextFile {
  path: string;
  content: string;
  layer?: number;
  description?: string;
}

/**
 * Seven layer configuration
 */
export const HELIX_SEVEN_LAYERS = {
  1: { name: 'Narrative Core', files: ['SOUL.md', 'psyeval.json'] },
  2: { name: 'Emotional Memory', files: ['emotional_tags.json', 'salience.db'] },
  3: { name: 'Relational Memory', files: ['attachments.json', 'trust_map.json'] },
  4: {
    name: 'Prospective Self',
    files: ['goals.json', 'feared_self.json', 'possible_selves.json'],
  },
  5: { name: 'Integration Rhythms', files: ['decay.py', 'synthesis.py'] },
  6: { name: 'Transformation Cycles', files: ['current_state.json', 'history.json'] },
  7: { name: 'Purpose Engine', files: ['ikigai.json', 'wellness.json', 'meaning_sources.json'] },
} as const;
