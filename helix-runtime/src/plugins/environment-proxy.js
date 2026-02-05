/**
 * Plugin Environment Proxy - Restricts plugin access to sensitive environment variables
 *
 * Implements a read-only proxy that allows plugins to access safe environment variables
 * while blocking access to sensitive credentials and secrets.
 *
 * SECURITY: Plugins should use api.env instead of process.env
 */
import { logSecretOperation } from '../helix/hash-chain.js';
// Environment variables that plugins are allowed to read
const ALLOWED_ENV_VARS = new Set([
    'NODE_ENV',
    'PATH',
    'HOME',
    'USERPROFILE', // Windows
    'USER',
    'USERNAME', // Windows
    'LANG',
    'LANGUAGE',
    'LC_ALL',
    'TZ',
    'TMPDIR',
    'TEMP',
    'OS',
    'ARCH',
    'NODE_VERSION',
    'NPM_VERSION',
    'SHELL',
]);
// Regex patterns that indicate sensitive environment variables
const SENSITIVE_PATTERNS = [
    /^HELIX_/, // Block all Helix internal variables
    /^RODRIGO_/, // Block creator security variables
    /^THANOS_/, // Block THANOS_MODE variables
    /^DISCORD_WEBHOOK_/,
    /^SUPABASE_/,
    /^STRIPE_/,
    /^DEEPSEEK_/,
    /^GEMINI_/,
    /^OPENAI_/,
    /^ANTHROPIC_/,
    /API[_-]?KEY$/i,
    /^SECRET/i,
    /^TOKEN/i,
    /^PASSWORD/i,
    /CREDENTIAL/i,
    /^AUTH/i,
    /^AWS_/,
    /^GITHUB_/,
    /^GITLAB_/,
    /PRIVATE[_-]?KEY/i,
];
/**
 * Create a restricted environment proxy for a plugin
 * Allows access to safe variables, blocks sensitive ones
 *
 * @param pluginId - Unique identifier for the plugin
 * @returns A read-only proxy of process.env with restrictions
 */
export function createPluginEnvironment(pluginId) {
    return new Proxy({}, {
        get(target, prop) {
            // Only handle string properties
            if (typeof prop !== 'string') {
                return undefined;
            }
            // Check if variable is in the allowlist
            if (ALLOWED_ENV_VARS.has(prop)) {
                return process.env[prop];
            }
            // Check if variable matches sensitive patterns
            for (const pattern of SENSITIVE_PATTERNS) {
                if (pattern.test(prop)) {
                    // Log attempt to access sensitive variable
                    logPluginSecretAccess(pluginId, prop);
                    return undefined;
                }
            }
            // Variable is not sensitive, allow access
            return process.env[prop];
        },
        set(target, prop, value) {
            // Environment is read-only for plugins
            return false;
        },
        has(target, prop) {
            if (typeof prop !== 'string') {
                return false;
            }
            // Check allowlist
            if (ALLOWED_ENV_VARS.has(prop)) {
                return prop in process.env;
            }
            // Check sensitive patterns
            for (const pattern of SENSITIVE_PATTERNS) {
                if (pattern.test(prop)) {
                    return false;
                }
            }
            // Not sensitive, use actual check
            return prop in process.env;
        },
        ownKeys(target) {
            // Only return allowed keys for enumeration
            return Array.from(ALLOWED_ENV_VARS).filter((key) => key in process.env);
        },
        getOwnPropertyDescriptor(target, prop) {
            if (typeof prop !== 'string') {
                return undefined;
            }
            if (ALLOWED_ENV_VARS.has(prop) && prop in process.env) {
                return {
                    value: process.env[prop],
                    writable: false,
                    enumerable: true,
                    configurable: false,
                };
            }
            return undefined;
        },
    });
}
/**
 * Log when a plugin attempts to access a sensitive environment variable
 * This should be logged to the hash chain for security audit trails
 *
 * @param pluginId - ID of the plugin attempting access
 * @param variableName - Name of the blocked variable
 */
function logPluginSecretAccess(pluginId, variableName) {
    // SECURITY: Log but don't include the actual value
    console.warn(`[Plugin Security] Plugin "${pluginId}" attempted to access restricted environment variable: ${variableName}`);
    // Fire-and-forget logging to hash chain for security audit
    logSecretOperation({
        operation: 'plugin_attempt',
        pluginId,
        secretName: variableName,
        source: 'env',
        success: false,
        timestamp: new Date().toISOString(),
        details: `Plugin attempted unauthorized access to ${variableName}`,
    }).catch((err) => console.error('[Plugin Security] Failed to log access attempt:', err));
}
/**
 * Check if a variable name matches sensitive patterns
 * Useful for testing and validation
 */
export function isSensitiveVariable(variableName) {
    // Check allowlist first
    if (ALLOWED_ENV_VARS.has(variableName)) {
        return false;
    }
    // Check sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(variableName)) {
            return true;
        }
    }
    return false;
}
/**
 * Get list of allowed environment variables for documentation
 */
export function getAllowedEnvironmentVariables() {
    return Array.from(ALLOWED_ENV_VARS).sort();
}
/**
 * Verify that the proxy blocks a specific sensitive variable
 * Useful for security testing
 */
export function verifySensitiveVariableBlocked(env, variableName) {
    return env[variableName] === undefined && isSensitiveVariable(variableName);
}
//# sourceMappingURL=environment-proxy.js.map