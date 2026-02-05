/**
 * HELIX DISCORD WEBHOOK
 * Core Discord webhook functionality for unhackable logging
 *
 * CRITICAL: These webhooks fire synchronously BEFORE actions execute.
 * Discord has the log before Helix can do anything.
 *
 * SECURITY: Implements FAIL-CLOSED behavior - operations BLOCK when logging unavailable
 */
import { HelixSecurityError, SECURITY_ERROR_CODES } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
const log = createSubsystemLogger("helix/discord");
// Discord webhook URLs from environment
export const WEBHOOKS = {
    commands: process.env.DISCORD_WEBHOOK_COMMANDS,
    api: process.env.DISCORD_WEBHOOK_API,
    files: process.env.DISCORD_WEBHOOK_FILE_CHANGES,
    consciousness: process.env.DISCORD_WEBHOOK_CONSCIOUSNESS,
    alerts: process.env.DISCORD_WEBHOOK_ALERTS,
    hashChain: process.env.DISCORD_WEBHOOK_HASH_CHAIN,
};
// ============================================
// FAIL-CLOSED SECURITY MODE
// When enabled, operations BLOCK if logging unavailable
// This ensures the "unhackable logging" guarantee
// ============================================
let failClosedMode = process.env.HELIX_FAIL_CLOSED !== "false";
/**
 * Enable or disable fail-closed security mode
 * WARNING: Disabling this compromises the "unhackable logging" guarantee
 */
export function setFailClosedMode(enabled) {
    if (!enabled) {
        log.warn("SECURITY WARNING: Disabling fail-closed mode compromises security!");
    }
    failClosedMode = enabled;
}
/**
 * Check if fail-closed mode is enabled
 */
export function isFailClosedMode() {
    return failClosedMode;
}
/**
 * Send a payload to a Discord webhook
 * MUST be awaited for pre-execution logging to ensure log arrives before action
 *
 * @param webhookUrl - The Discord webhook URL
 * @param payload - The payload to send
 * @param critical - If true and fail-closed mode is enabled, throws on failure
 * @returns true if successful, false if non-critical failure
 * @throws HelixSecurityError if critical logging fails in fail-closed mode
 */
export async function sendToDiscord(webhookUrl, payload, critical = false) {
    if (!webhookUrl) {
        if (critical && failClosedMode) {
            throw new HelixSecurityError("Critical webhook not configured - execution blocked for security", SECURITY_ERROR_CODES.WEBHOOK_NOT_CONFIGURED, { payload });
        }
        return false;
    }
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            log.warn("Discord webhook failed", {
                status: response.status,
                statusText: response.statusText,
            });
            if (critical && failClosedMode) {
                throw new HelixSecurityError(`Critical logging failed (HTTP ${response.status}) - execution blocked`, SECURITY_ERROR_CODES.LOGGING_FAILED, { status: response.status, payload });
            }
        }
        return response.ok;
    }
    catch (error) {
        // Re-throw HelixSecurityError
        if (error instanceof HelixSecurityError) {
            throw error;
        }
        log.error("Discord webhook error", {
            error: error instanceof Error ? error.message : String(error),
        });
        if (critical && failClosedMode) {
            throw new HelixSecurityError("Discord unreachable - execution blocked for security", SECURITY_ERROR_CODES.DISCORD_UNREACHABLE, { error: error instanceof Error ? error.message : String(error) });
        }
        return false;
    }
}
/**
 * Create a Discord embed with standard formatting
 */
export function createEmbed(params) {
    return {
        title: params.title,
        color: params.color,
        fields: params.fields,
        timestamp: params.timestamp ?? new Date().toISOString(),
        footer: params.footer ? { text: params.footer } : undefined,
    };
}
// Discord embed colors
export const COLORS = {
    blue: 0x3498db, // Info/starting
    green: 0x2ecc71, // Success
    red: 0xe74c3c, // Error/critical
    yellow: 0xf1c40f, // Warning
    purple: 0x9b59b6, // Consciousness/hash
    blurple: 0x5865f2, // Discord default
};
//# sourceMappingURL=discord-webhook.js.map