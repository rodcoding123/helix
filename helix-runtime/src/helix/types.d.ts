/**
 * HELIX TYPE DEFINITIONS
 * Shared types for the Helix logging system
 */
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
 * HELIX SECURITY ERROR
 * Thrown when fail-closed security mode blocks an operation
 */
export declare class HelixSecurityError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown>;
    constructor(message: string, code: string, context?: Record<string, unknown>);
}
/**
 * Security error codes
 */
export declare const SECURITY_ERROR_CODES: {
    readonly WEBHOOK_NOT_CONFIGURED: "WEBHOOK_NOT_CONFIGURED";
    readonly LOGGING_FAILED: "LOGGING_FAILED";
    readonly DISCORD_UNREACHABLE: "DISCORD_UNREACHABLE";
    readonly PRE_EXECUTION_LOG_FAILED: "PRE_EXECUTION_LOG_FAILED";
};
/**
 * Seven layer file paths relative to workspace/axis/
 */
export declare const HELIX_LAYER_FILES: Record<number, {
    name: string;
    files: string[];
}>;
//# sourceMappingURL=types.d.ts.map