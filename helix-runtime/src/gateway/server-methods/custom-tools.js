import { executeSkillSandboxed, DEFAULT_SKILL_SANDBOX_CONFIG } from '../../../src/helix/skill-sandbox.js';
/**
 * Custom Tools Gateway RPC Methods
 *
 * Phase 3 feature: Allows users to create and execute custom tools
 * with sandboxed execution and comprehensive audit logging.
 */
export const customToolHandlers = {
    /**
     * Execute a custom tool
     *
     * params: {
     *   toolId: string (UUID of the tool)
     *   code: string (JavaScript function body)
     *   params: Record<string, unknown> (tool parameters)
     *   metadata?: { name, author, version } (optional metadata)
     * }
     *
     * response: {
     *   success: boolean
     *   output: unknown (tool result)
     *   executionTimeMs: number
     *   auditLog: array of execution audit entries
     * }
     */
    'tools.execute_custom': async ({ params, respond, context: ctx, client }) => {
        const context = ctx;
        const executionId = crypto.randomUUID();
        const startTime = Date.now();
        let userId;
        try {
            // Validate parameters
            if (!params || typeof params !== 'object') {
                respond(false, undefined, {
                    code: 'INVALID_REQUEST',
                    message: 'Invalid parameters',
                });
                return;
            }
            userId = client?.connect?.userId;
            if (!userId) {
                respond(false, undefined, {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                });
                return;
            }
            const { code, params: toolParams, metadata, toolId } = params;
            if (!code || typeof code !== 'string') {
                respond(false, undefined, {
                    code: 'INVALID_REQUEST',
                    message: 'Tool code is required and must be a string',
                });
                return;
            }
            // Create metadata for sandbox validation
            const skillMetadata = {
                name: metadata?.name || 'custom-tool',
                version: metadata?.version || '1.0.0',
                author: metadata?.author || 'user',
                permissions: ['filesystem:read', 'network:localhost'],
            };
            // Log execution start
            context.logGateway?.log?.('CUSTOM_TOOL_EXECUTION_START', {
                executionId,
                toolId: toolId || 'unknown',
                toolName: skillMetadata.name,
                userId,
            });
            // Execute with sandbox
            const result = await executeSkillSandboxed(code, skillMetadata, toolParams || {}, executionId, DEFAULT_SKILL_SANDBOX_CONFIG);
            const executionTimeMs = Date.now() - startTime;
            // Store execution record if we have a tool ID and user
            if (toolId && userId) {
                try {
                    const db = context.db;
                    await db.query(`INSERT INTO custom_tool_usage
             (id, custom_tool_id, user_id, input_params, output_result, status, error_message, execution_time_ms, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`, [
                        executionId,
                        toolId,
                        userId,
                        JSON.stringify(toolParams || {}),
                        result.success ? JSON.stringify(result.output) : null,
                        result.success ? 'success' : 'failure',
                        result.error || null,
                        executionTimeMs,
                    ]);
                    // Update tool usage count
                    await db.query(`UPDATE custom_tools SET usage_count = usage_count + 1, last_used = NOW() WHERE id = $1`, [toolId]);
                }
                catch (dbError) {
                    context.logGateway.error?.('CUSTOM_TOOL_STORAGE_ERROR', {
                        executionId,
                        error: dbError instanceof Error ? dbError.message : String(dbError),
                        userId,
                    });
                    // Don't fail the execution, just log the storage error
                }
            }
            // Log execution completion
            context.logGateway.log?.('CUSTOM_TOOL_EXECUTION_COMPLETE', {
                executionId,
                toolId: toolId || 'unknown',
                success: result.success,
                executionTimeMs,
                userId,
            });
            respond(true, {
                success: result.success,
                output: result.output,
                executionTimeMs,
                auditLog: result.auditLog,
                executionId,
            });
        }
        catch (error) {
            const executionTimeMs = Date.now() - startTime;
            context.logGateway.error?.('CUSTOM_TOOL_EXECUTION_ERROR', {
                executionId,
                error: error instanceof Error ? error.message : String(error),
                executionTimeMs,
                userId,
            });
            respond(false, undefined, {
                code: 'EXECUTION_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },
    /**
     * Get custom tool metadata
     *
     * params: {
     *   toolId: string (UUID of the tool)
     * }
     *
     * response: {
     *   id: string
     *   name: string
     *   description: string
     *   parameters: Record<string, unknown> (JSON schema)
     *   version: string
     *   usageCount: number
     *   isEnabled: boolean
     * }
     */
    'tools.get_metadata': async ({ params, respond, context: ctx, client }) => {
        const context = ctx;
        try {
            if (!params || typeof params !== 'object') {
                respond(false, undefined, {
                    code: 'INVALID_REQUEST',
                    message: 'Invalid parameters',
                });
                return;
            }
            const { toolId } = params;
            const userId = client?.connect?.userId;
            if (!toolId || !userId) {
                respond(false, undefined, {
                    code: 'INVALID_REQUEST',
                    message: 'toolId and authentication are required',
                });
                return;
            }
            // Query database for tool metadata
            const db = context.db;
            const result = await db.query(`SELECT id, name, description, parameters, version, usage_count, is_enabled
         FROM custom_tools
         WHERE id = $1 AND user_id = $2`, [toolId, userId]);
            if (!result.rows || result.rows.length === 0) {
                respond(false, undefined, {
                    code: 'NOT_FOUND',
                    message: `Tool not found: ${toolId}`,
                });
                return;
            }
            const tool = result.rows[0];
            respond(true, {
                id: tool.id,
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters || {},
                version: tool.version || '1.0.0',
                usageCount: tool.usage_count || 0,
                isEnabled: tool.is_enabled !== false,
            });
        }
        catch (error) {
            context.logGateway.error?.('TOOLS_GET_METADATA_ERROR', {
                error: error instanceof Error ? error.message : String(error),
                userId: client?.connect?.userId,
            });
            respond(false, undefined, {
                code: 'LOOKUP_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },
    /**
     * List user's custom tools
     *
     * params: {} (no parameters)
     *
     * response: {
     *   tools: Array<{
     *     id: string
     *     name: string
     *     description: string
     *     version: string
     *     usageCount: number
     *     lastUsed: string (ISO timestamp)
     *     isEnabled: boolean
     *     visibility: string
     *   }>
     *   total: number
     * }
     */
    'tools.list': async ({ respond, context: ctx, client }) => {
        const context = ctx;
        try {
            const userId = client?.connect?.userId;
            if (!userId) {
                respond(false, undefined, {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                });
                return;
            }
            context.logGateway?.log?.('TOOLS_LIST_REQUEST', {
                userId,
            });
            // Query database for user's tools
            const db = context.db;
            const result = await db.query(`SELECT id, name, description, version, usage_count, last_used, is_enabled, visibility
         FROM custom_tools
         WHERE user_id = $1
         ORDER BY last_used DESC NULLS LAST, created_at DESC`, [userId]);
            const tools = (result.rows || []).map((tool) => ({
                id: tool.id,
                name: tool.name,
                description: tool.description,
                version: tool.version || '1.0.0',
                usageCount: tool.usage_count || 0,
                lastUsed: tool.last_used?.toISOString() || null,
                isEnabled: tool.is_enabled !== false,
                visibility: tool.visibility || 'private',
            }));
            context.logGateway?.log?.('TOOLS_LIST_RESPONSE', {
                userId,
                count: tools.length,
            });
            respond(true, {
                tools,
                total: tools.length,
            });
        }
        catch (error) {
            context.logGateway.error?.('TOOLS_LIST_ERROR', {
                error: error instanceof Error ? error.message : String(error),
                userId: client?.connect?.userId,
            });
            respond(false, undefined, {
                code: 'LIST_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },
};
//# sourceMappingURL=custom-tools.js.map