import type { OpenClawConfig } from "../config/config.js";
export type AgentAvatarResolution = {
    kind: "none";
    reason: string;
} | {
    kind: "local";
    filePath: string;
} | {
    kind: "remote";
    url: string;
} | {
    kind: "data";
    url: string;
};
export declare function resolveAgentAvatar(cfg: OpenClawConfig, agentId: string): AgentAvatarResolution;
/**
 * Async avatar loading with caching
 * Loads local avatars and converts to data URLs for fast access
 * Returns cached data URL on subsequent calls (within same process)
 *
 * Performance optimization:
 * - First load: ~50-100ms (file I/O + base64 encoding)
 * - Cached load: <1ms (memory lookup)
 * - Reduces repeated file system access for commonly used avatars
 */
export declare function resolveAgentAvatarAsync(cfg: OpenClawConfig, agentId: string): Promise<AgentAvatarResolution>;
/**
 * Clear avatar cache
 * Useful for testing or when avatars are updated
 */
export declare function clearAvatarCache(): void;
//# sourceMappingURL=identity-avatar.d.ts.map