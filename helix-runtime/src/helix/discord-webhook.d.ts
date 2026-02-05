/**
 * HELIX DISCORD WEBHOOK
 * Core Discord webhook functionality for unhackable logging
 *
 * CRITICAL: These webhooks fire synchronously BEFORE actions execute.
 * Discord has the log before Helix can do anything.
 *
 * SECURITY: Implements FAIL-CLOSED behavior - operations BLOCK when logging unavailable
 */
import type { DiscordEmbed, DiscordPayload } from "./types.js";
export declare const WEBHOOKS: {
    readonly commands: string | undefined;
    readonly api: string | undefined;
    readonly files: string | undefined;
    readonly consciousness: string | undefined;
    readonly alerts: string | undefined;
    readonly hashChain: string | undefined;
};
/**
 * Enable or disable fail-closed security mode
 * WARNING: Disabling this compromises the "unhackable logging" guarantee
 */
export declare function setFailClosedMode(enabled: boolean): void;
/**
 * Check if fail-closed mode is enabled
 */
export declare function isFailClosedMode(): boolean;
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
export declare function sendToDiscord(webhookUrl: string | undefined, payload: DiscordPayload, critical?: boolean): Promise<boolean>;
/**
 * Create a Discord embed with standard formatting
 */
export declare function createEmbed(params: {
    title: string;
    color: number;
    fields: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    footer?: string;
    timestamp?: string;
}): DiscordEmbed;
export declare const COLORS: {
    readonly blue: 3447003;
    readonly green: 3066993;
    readonly red: 15158332;
    readonly yellow: 15844367;
    readonly purple: 10181046;
    readonly blurple: 5793266;
};
//# sourceMappingURL=discord-webhook.d.ts.map