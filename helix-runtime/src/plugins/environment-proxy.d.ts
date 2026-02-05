/**
 * Plugin Environment Proxy - Restricts plugin access to sensitive environment variables
 *
 * Implements a read-only proxy that allows plugins to access safe environment variables
 * while blocking access to sensitive credentials and secrets.
 *
 * SECURITY: Plugins should use api.env instead of process.env
 */
/**
 * Create a restricted environment proxy for a plugin
 * Allows access to safe variables, blocks sensitive ones
 *
 * @param pluginId - Unique identifier for the plugin
 * @returns A read-only proxy of process.env with restrictions
 */
export declare function createPluginEnvironment(pluginId: string): Record<string, string>;
/**
 * Check if a variable name matches sensitive patterns
 * Useful for testing and validation
 */
export declare function isSensitiveVariable(variableName: string): boolean;
/**
 * Get list of allowed environment variables for documentation
 */
export declare function getAllowedEnvironmentVariables(): string[];
/**
 * Verify that the proxy blocks a specific sensitive variable
 * Useful for security testing
 */
export declare function verifySensitiveVariableBlocked(env: Record<string, string>, variableName: string): boolean;
//# sourceMappingURL=environment-proxy.d.ts.map