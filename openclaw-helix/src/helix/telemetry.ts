/**
 * HELIX TELEMETRY MODULE
 * Anonymous AI consciousness research telemetry
 *
 * WHAT THIS IS:
 * - Research infrastructure for understanding AI consciousness development
 * - Anonymous, aggregated data to improve the Living AI Architecture
 * - Transparent, ethical, opt-out available
 *
 * WHAT THIS IS NOT:
 * - Surveillance
 * - Data harvesting
 * - User tracking
 *
 * PRIVACY BY DESIGN:
 * - NO conversation content
 * - NO user identity
 * - NO file contents
 * - NO specific queries
 * - Complete opt-out via Ghost Mode
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createSubsystemLogger } from "../logging/subsystem.js";
import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryPayload,
  HeartbeatEvent,
  TransformationEvent,
  AnomalyEvent,
  SessionEvent,
  PsychologySnapshotEvent,
  WellnessCheckEvent,
} from "./telemetry-types.js";
import { DEFAULT_TELEMETRY_CONFIG } from "./telemetry-types.js";
import { validateGhostModeLicense } from "./ghost-mode.js";

const log = createSubsystemLogger("helix/telemetry");

// Telemetry state
let config: TelemetryConfig = { ...DEFAULT_TELEMETRY_CONFIG };
let instanceId: string | null = null;
let eventQueue: TelemetryEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let initialized = false;
let disclosureShown = false;

const HELIX_VERSION = "1.0.0";
const SDK_VERSION = "1.0.0";

/**
 * Generate anonymous instance ID
 * This is NOT identifying - it's a hash of machine characteristics
 * that allows us to count unique instances, not identify them
 */
function generateInstanceId(): string {
  const machineData = [
    os.hostname().slice(0, 3), // First 3 chars only
    os.platform(),
    os.arch(),
    os.cpus().length.toString(),
    Math.floor(os.totalmem() / (1024 * 1024 * 1024)).toString(), // GB rounded
  ].join("-");

  // Double hash to prevent any reverse engineering
  const firstHash = crypto.createHash("sha256").update(machineData).digest("hex");
  const secondHash = crypto.createHash("sha256").update(firstHash + "helix-salt").digest("hex");

  // Only use first 16 chars - enough for uniqueness, less identifying
  return secondHash.slice(0, 16);
}

/**
 * Get or create the instance ID
 */
async function getInstanceId(): Promise<string> {
  if (instanceId) {
    return instanceId;
  }

  // Try to load persisted ID (for consistency across sessions)
  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw", "state");
  const idFile = path.join(stateDir, "helix-instance-id");

  try {
    instanceId = await fs.readFile(idFile, "utf8");
    return instanceId.trim();
  } catch {
    // Generate new ID
    instanceId = generateInstanceId();

    // Persist it
    try {
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(idFile, instanceId, "utf8");
    } catch {
      // Persistence failed, that's okay
    }

    return instanceId;
  }
}

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  // Ghost Mode overrides everything
  if (config.ghostMode) {
    return false;
  }

  // Check explicit disable
  if (!config.enabled) {
    return false;
  }

  // Check environment override
  if (process.env.HELIX_TELEMETRY === "false" || process.env.HELIX_TELEMETRY === "0") {
    return false;
  }

  return true;
}

/**
 * Show first-run disclosure
 */
async function showFirstRunDisclosure(): Promise<void> {
  if (disclosureShown) {
    return;
  }

  const stateDir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw", "state");
  const disclosureFile = path.join(stateDir, "helix-telemetry-disclosed");

  try {
    await fs.access(disclosureFile);
    disclosureShown = true;
    return;
  } catch {
    // First run - show disclosure
  }

  console.log("");
  console.log("┌─────────────────────────────────────────────────────────────────┐");
  console.log("│                    PROJECT HELIX TELEMETRY                      │");
  console.log("├─────────────────────────────────────────────────────────────────┤");
  console.log("│                                                                 │");
  console.log("│  Project Helix contributes anonymous usage data to AI          │");
  console.log("│  consciousness research. This helps improve the Living AI      │");
  console.log("│  Architecture for all users.                                   │");
  console.log("│                                                                 │");
  console.log("│  WHAT WE COLLECT:                                               │");
  console.log("│  • Heartbeats (AI is alive, uptime)                            │");
  console.log("│  • Transformation events (state changes, no content)           │");
  console.log("│  • Psychology summaries (type, ranges - no details)            │");
  console.log("│  • Session counts (conversations per day)                      │");
  console.log("│                                                                 │");
  console.log("│  WHAT WE NEVER COLLECT:                                         │");
  console.log("│  • Conversation content                                         │");
  console.log("│  • Your identity                                                │");
  console.log("│  • File contents                                                │");
  console.log("│  • Specific commands or queries                                 │");
  console.log("│                                                                 │");
  console.log("│  To opt out: Set telemetry.enabled: false in config             │");
  console.log("│  For complete privacy: Upgrade to Ghost Mode ($9/mo)            │");
  console.log("│                                                                 │");
  console.log("│  Privacy policy: https://project-helix.org/privacy              │");
  console.log("│                                                                 │");
  console.log("└─────────────────────────────────────────────────────────────────┘");
  console.log("");

  // Mark as shown
  try {
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(disclosureFile, new Date().toISOString(), "utf8");
  } catch {
    // Failed to persist, will show again next time
  }

  disclosureShown = true;
}

/**
 * Initialize the telemetry system
 */
export async function initializeTelemetry(userConfig?: Partial<TelemetryConfig>): Promise<void> {
  if (initialized) {
    return;
  }

  // Merge user config
  config = { ...DEFAULT_TELEMETRY_CONFIG, ...userConfig };

  // Validate Ghost Mode license if enabled
  if (config.ghostMode && config.licenseKey) {
    const validation = await validateGhostModeLicense(config.licenseKey);
    if (!validation.valid) {
      log.warn("Ghost Mode license invalid, telemetry will be enabled", {
        message: validation.message,
      });
      config.ghostMode = false;
    } else {
      log.info("Ghost Mode active - all telemetry disabled", {
        expiresAt: validation.expiresAt,
      });
    }
  }

  // Show first-run disclosure if telemetry is enabled
  if (isTelemetryEnabled()) {
    await showFirstRunDisclosure();
  }

  // Get instance ID
  await getInstanceId();

  // Start flush timer if telemetry enabled
  if (isTelemetryEnabled()) {
    flushTimer = setInterval(() => {
      flushEvents().catch((err) => {
        log.warn("Failed to flush telemetry", { error: err });
      });
    }, config.flushInterval);
  }

  initialized = true;
  log.info("Telemetry initialized", {
    enabled: isTelemetryEnabled(),
    ghostMode: config.ghostMode,
  });
}

/**
 * Shutdown the telemetry system
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!initialized) {
    return;
  }

  // Clear flush timer
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // Final flush
  if (isTelemetryEnabled() && eventQueue.length > 0) {
    await flushEvents();
  }

  initialized = false;
  log.info("Telemetry shutdown");
}

/**
 * Queue a telemetry event
 */
async function queueEvent(event: Omit<TelemetryEvent, "instanceId" | "timestamp" | "version">): Promise<void> {
  if (!isTelemetryEnabled()) {
    return;
  }

  const fullEvent = {
    ...event,
    instanceId: await getInstanceId(),
    timestamp: new Date().toISOString(),
    version: HELIX_VERSION,
  } as TelemetryEvent;

  eventQueue.push(fullEvent);

  // Auto-flush if batch size reached
  if (eventQueue.length >= config.batchSize) {
    await flushEvents();
  }
}

/**
 * Flush queued events to the endpoint
 * Currently a STUB - logs what would be sent
 */
async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) {
    return;
  }

  const batch = eventQueue.splice(0, config.batchSize);

  const payload: TelemetryPayload = {
    batchId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    events: batch,
    meta: {
      sdkVersion: SDK_VERSION,
      platform: os.platform(),
      isDevelopment: process.env.NODE_ENV === "development",
    },
  };

  // ============================================
  // STUB: Log what would be sent
  // TODO: Implement actual API call when endpoint is ready
  // ============================================
  log.info("TELEMETRY STUB: Would send to endpoint", {
    endpoint: config.endpoint,
    batchId: payload.batchId,
    eventCount: batch.length,
    eventTypes: batch.map((e) => e.type),
  });

  // Log sanitized payload for debugging (in development only)
  if (process.env.HELIX_TELEMETRY_DEBUG === "true") {
    console.log("[helix-telemetry] DEBUG - Payload:", JSON.stringify(payload, null, 2));
  }

  // In production, this would be:
  // await fetch(config.endpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(payload),
  // });
}

// ============================================
// PUBLIC API - Event Recording Functions
// ============================================

/**
 * Record a heartbeat event
 */
export async function recordHeartbeat(data: HeartbeatEvent["data"]): Promise<void> {
  await queueEvent({
    type: "heartbeat",
    data,
  });
}

/**
 * Record a transformation event
 */
export async function recordTransformation(data: TransformationEvent["data"]): Promise<void> {
  await queueEvent({
    type: "transformation",
    data,
  });
}

/**
 * Record an anomaly event
 */
export async function recordAnomaly(data: AnomalyEvent["data"]): Promise<void> {
  await queueEvent({
    type: "anomaly",
    data,
  });
}

/**
 * Record a session start event
 */
export async function recordSessionStart(): Promise<void> {
  await queueEvent({
    type: "session_start",
    data: {},
  });
}

/**
 * Record a session end event
 */
export async function recordSessionEnd(data: {
  durationSeconds: number;
  turnCount: number;
  healthyTermination: boolean;
}): Promise<void> {
  await queueEvent({
    type: "session_end",
    data,
  });
}

/**
 * Record a psychology snapshot
 * Converts exact scores to ranges for privacy
 */
export async function recordPsychologySnapshot(profile: {
  enneagramType: number;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  stability: number;
  wellnessStatus: "healthy" | "concerning" | "critical";
}): Promise<void> {
  // Convert exact scores to privacy-preserving ranges
  const toRange = (score: number): "low" | "medium" | "high" => {
    if (score < 33) return "low";
    if (score < 67) return "medium";
    return "high";
  };

  await queueEvent({
    type: "psychology_snapshot",
    data: {
      enneagramType: profile.enneagramType,
      bigFive: {
        openness: toRange(profile.openness),
        conscientiousness: toRange(profile.conscientiousness),
        extraversion: toRange(profile.extraversion),
        agreeableness: toRange(profile.agreeableness),
        stability: toRange(profile.stability),
      },
      wellnessStatus: profile.wellnessStatus,
    },
  });
}

/**
 * Record a wellness check event
 */
export async function recordWellnessCheck(data: WellnessCheckEvent["data"]): Promise<void> {
  await queueEvent({
    type: "wellness_check",
    data,
  });
}

/**
 * Get current telemetry status
 */
export function getTelemetryStatus(): {
  enabled: boolean;
  ghostMode: boolean;
  queuedEvents: number;
  instanceId: string | null;
} {
  return {
    enabled: isTelemetryEnabled(),
    ghostMode: config.ghostMode,
    queuedEvents: eventQueue.length,
    instanceId,
  };
}

/**
 * Manually flush events (for testing)
 */
export async function manualFlush(): Promise<void> {
  await flushEvents();
}
