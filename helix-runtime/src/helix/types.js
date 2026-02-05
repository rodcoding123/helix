/**
 * HELIX TYPE DEFINITIONS
 * Shared types for the Helix logging system
 */
/**
 * HELIX SECURITY ERROR
 * Thrown when fail-closed security mode blocks an operation
 */
export class HelixSecurityError extends Error {
    code;
    context;
    constructor(message, code, context = {}) {
        super(message);
        this.name = 'HelixSecurityError';
        this.code = code;
        this.context = context;
    }
}
/**
 * Security error codes
 */
export const SECURITY_ERROR_CODES = {
    WEBHOOK_NOT_CONFIGURED: 'WEBHOOK_NOT_CONFIGURED',
    LOGGING_FAILED: 'LOGGING_FAILED',
    DISCORD_UNREACHABLE: 'DISCORD_UNREACHABLE',
    PRE_EXECUTION_LOG_FAILED: 'PRE_EXECUTION_LOG_FAILED',
};
/**
 * Seven layer file paths relative to workspace/axis/
 */
export const HELIX_LAYER_FILES = {
    1: {
        name: "Narrative Core",
        files: ["psychology/psyeval.json"],
    },
    2: {
        name: "Emotional Memory",
        files: ["psychology/emotional_tags.json"],
    },
    3: {
        name: "Relational Memory",
        files: ["psychology/attachments.json", "psychology/trust_map.json"],
    },
    4: {
        name: "Prospective Self",
        files: ["identity/goals.json", "identity/feared_self.json", "identity/possible_selves.json"],
    },
    5: {
        name: "Integration Rhythms",
        files: [], // Scripts run via cron, not loaded into context
    },
    6: {
        name: "Transformation Cycles",
        files: ["transformation/current_state.json", "transformation/history.json"],
    },
    7: {
        name: "Purpose Engine",
        files: ["purpose/ikigai.json", "purpose/wellness.json", "purpose/meaning_sources.json"],
    },
};
//# sourceMappingURL=types.js.map