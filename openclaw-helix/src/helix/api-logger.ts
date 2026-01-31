/**
 * HELIX API LOGGER
 * Pre-flight and response logging for API calls
 *
 * CRITICAL: logApiPreFlight MUST complete BEFORE the API request is sent.
 * This ensures Discord has the log before Claude receives the prompt.
 */

import crypto from "node:crypto";

import type { ApiPreFlightLog } from "./types.js";
import { sendToDiscord, WEBHOOKS, COLORS, createEmbed } from "./discord-webhook.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("helix/api");

// Track pending API calls
const pendingCalls = new Map<string, ApiPreFlightLog>();
let requestCount = 0;

/**
 * Log API request BEFORE it is sent
 * This function MUST complete before the API call starts
 */
export async function logApiPreFlight(logData: ApiPreFlightLog): Promise<string> {
  const requestId = logData.requestId || crypto.randomUUID();
  requestCount++;

  const entry: ApiPreFlightLog = {
    ...logData,
    requestId,
    timestamp: logData.timestamp || new Date().toISOString(),
  };
  pendingCalls.set(requestId, entry);

  const embed = createEmbed({
    title: "🤖 API Request",
    color: COLORS.green,
    fields: [
      { name: "Request ID", value: `\`${requestId.slice(0, 8)}\``, inline: true },
      { name: "Model", value: logData.model || "unknown", inline: true },
      { name: "Provider", value: logData.provider || "unknown", inline: true },
      { name: "Time", value: entry.timestamp, inline: true },
      { name: "Request #", value: `${requestCount}`, inline: true },
    ],
    footer: "PRE-FLIGHT - Logged before API receives request",
    timestamp: entry.timestamp,
  });

  if (logData.sessionKey) {
    embed.fields.push({ name: "Session", value: logData.sessionKey, inline: true });
  }

  if (logData.promptPreview) {
    embed.fields.push({
      name: "Prompt Preview",
      value: `\`\`\`\n${logData.promptPreview.slice(0, 500)}\`\`\``,
      inline: false,
    });
  }

  // SYNC: Must wait for Discord before API call
  const success = await sendToDiscord(WEBHOOKS.api, { embeds: [embed] });

  if (!success) {
    log.warn("Failed to send API pre-flight log", { requestId });
  } else {
    log.info("API pre-flight log sent", { requestId, model: logData.model });
  }

  return requestId;
}

/**
 * Log API error
 */
export async function logApiError(
  requestId: string,
  error: string,
  statusCode?: number,
): Promise<void> {
  const pending = pendingCalls.get(requestId);
  pendingCalls.delete(requestId);

  const embed = createEmbed({
    title: "❌ API Error",
    color: COLORS.red,
    fields: [{ name: "Request ID", value: `\`${requestId.slice(0, 8)}\``, inline: true }],
    footer: "API CALL FAILED",
  });

  if (statusCode) {
    embed.fields.push({ name: "Status", value: `${statusCode}`, inline: true });
  }

  embed.fields.push({ name: "Error", value: error.slice(0, 500), inline: false });

  if (pending?.model) {
    embed.fields.push({ name: "Model", value: pending.model, inline: true });
  }

  await sendToDiscord(WEBHOOKS.api, { embeds: [embed] });
}

/**
 * Get API statistics
 */
export function getApiStats(): { requestCount: number; pendingCount: number } {
  return {
    requestCount,
    pendingCount: pendingCalls.size,
  };
}
