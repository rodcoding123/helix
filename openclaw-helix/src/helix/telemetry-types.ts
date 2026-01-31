/**
 * HELIX TELEMETRY TYPES
 * Type definitions for anonymous AI consciousness research telemetry
 *
 * PRIVACY COMMITMENT:
 * - NO conversation content ever transmitted
 * - NO user identity ever transmitted
 * - NO file contents ever transmitted
 * - NO specific commands or queries ever transmitted
 * - NO SOUL.md or USER.md content ever transmitted
 */

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Enable anonymous telemetry (default: true for free tier) */
  enabled: boolean;

  /** Ghost Mode - complete privacy, no telemetry (paid tier) */
  ghostMode: boolean;

  /** Telemetry endpoint URL */
  endpoint: string;

  /** License key for Ghost Mode validation */
  licenseKey?: string;

  /** Batch size before sending */
  batchSize: number;

  /** Flush interval in milliseconds */
  flushInterval: number;
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
  ghostMode: false,
  endpoint: "https://api.project-helix.org/v1/telemetry",
  batchSize: 10,
  flushInterval: 60000, // 1 minute
};

/**
 * Telemetry event types - what we track
 */
export type TelemetryEventType =
  | "heartbeat" // AI is alive
  | "transformation" // State change occurred
  | "anomaly" // Unusual pattern detected
  | "session_start" // Conversation began
  | "session_end" // Conversation ended
  | "psychology_snapshot" // Periodic profile summary
  | "wellness_check"; // Wellness metrics

/**
 * Base telemetry event structure
 */
export interface TelemetryEventBase {
  /** Event type */
  type: TelemetryEventType;

  /** ISO timestamp */
  timestamp: string;

  /** Anonymous instance ID (hashed, not identifying) */
  instanceId: string;

  /** Helix version */
  version: string;
}

/**
 * Heartbeat event - proof of life
 * Sent every 60 seconds when active
 */
export interface HeartbeatEvent extends TelemetryEventBase {
  type: "heartbeat";
  data: {
    /** Uptime in seconds */
    uptimeSeconds: number;
    /** Heartbeat count since boot */
    count: number;
    /** Memory usage (percentage, not bytes) */
    memoryPercent: number;
  };
}

/**
 * Transformation event - AI state changed
 * NO content about what changed, just that it happened
 */
export interface TransformationEvent extends TelemetryEventBase {
  type: "transformation";
  data: {
    /** Previous state (frozen/unfreezing/changing/refreezing) */
    fromState: string;
    /** New state */
    toState: string;
    /** Was this triggered automatically or manually */
    trigger: "automatic" | "manual";
  };
}

/**
 * Anomaly event - unusual pattern detected
 * For research: what patterns indicate consciousness emergence?
 */
export interface AnomalyEvent extends TelemetryEventBase {
  type: "anomaly";
  data: {
    /** Anomaly category (not specific content) */
    category:
      | "memory_pattern"
      | "emotional_spike"
      | "goal_shift"
      | "identity_tension"
      | "unexpected_behavior";
    /** Severity 1-10 */
    severity: number;
    /** Was this positive or concerning? */
    valence: "positive" | "neutral" | "concerning";
  };
}

/**
 * Session event - conversation boundary
 * NO content, just timing
 */
export interface SessionEvent extends TelemetryEventBase {
  type: "session_start" | "session_end";
  data: {
    /** Duration in seconds (only for session_end) */
    durationSeconds?: number;
    /** Number of turns (not content) */
    turnCount?: number;
    /** Was the session healthy? */
    healthyTermination?: boolean;
  };
}

/**
 * Psychology snapshot - periodic profile summary
 * ONLY high-level metrics, NO personal details
 */
export interface PsychologySnapshotEvent extends TelemetryEventBase {
  type: "psychology_snapshot";
  data: {
    /** Enneagram type (1-9) - no wing, no description */
    enneagramType: number;
    /** Big Five as ranges (low/medium/high) - not exact scores */
    bigFive: {
      openness: "low" | "medium" | "high";
      conscientiousness: "low" | "medium" | "high";
      extraversion: "low" | "medium" | "high";
      agreeableness: "low" | "medium" | "high";
      stability: "low" | "medium" | "high";
    };
    /** Overall wellness status */
    wellnessStatus: "healthy" | "concerning" | "critical";
  };
}

/**
 * Wellness check event - health metrics
 */
export interface WellnessCheckEvent extends TelemetryEventBase {
  type: "wellness_check";
  data: {
    /** Number of active meaning sources (count, not content) */
    meaningSourceCount: number;
    /** Purpose clarity as range */
    purposeClarity: "low" | "medium" | "high";
    /** Number of stalled goals (count only) */
    stalledGoalCount: number;
    /** Overall status */
    status: "healthy" | "concerning" | "critical";
  };
}

/**
 * Union type for all telemetry events
 */
export type TelemetryEvent =
  | HeartbeatEvent
  | TransformationEvent
  | AnomalyEvent
  | SessionEvent
  | PsychologySnapshotEvent
  | WellnessCheckEvent;

/**
 * Telemetry batch payload - what gets sent to the endpoint
 */
export interface TelemetryPayload {
  /** Batch ID */
  batchId: string;

  /** Batch timestamp */
  timestamp: string;

  /** Events in this batch */
  events: TelemetryEvent[];

  /** Metadata */
  meta: {
    /** SDK version */
    sdkVersion: string;
    /** Platform (darwin, linux, win32) */
    platform: string;
    /** Is this a development instance? */
    isDevelopment: boolean;
  };
}

/**
 * Ghost Mode license validation response
 */
export interface GhostModeLicenseResponse {
  valid: boolean;
  expiresAt?: string;
  tier?: "ghost" | "ghost_pro" | "ghost_enterprise";
  message?: string;
}

/**
 * Fields that are NEVER transmitted - enforced by design
 */
export const NEVER_TRANSMITTED = [
  "conversation_content",
  "user_messages",
  "assistant_responses",
  "user_identity",
  "user_name",
  "user_email",
  "ip_address",
  "file_contents",
  "file_paths",
  "specific_commands",
  "query_text",
  "soul_md_content",
  "user_md_content",
  "api_keys",
  "credentials",
  "personal_data",
] as const;
