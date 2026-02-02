import { executeSkillSandboxed, DEFAULT_SKILL_SANDBOX_CONFIG, type SkillMetadata } from '../../helix/skill-sandbox.js';
import type { GatewayRequestHandlers } from './types.js';

/**
 * Custom Tools Gateway RPC Methods
 *
 * Phase 3 feature: Allows users to create and execute custom tools
 * with sandboxed execution and comprehensive audit logging.
 */

export const customToolHandlers: GatewayRequestHandlers = {
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
  'tools.execute_custom': async ({ params, respond, context, client }) => {
    try {
      // Validate parameters
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const { code, params: toolParams, metadata, toolId } = params as {
        toolId?: string;
        code: string;
        params?: Record<string, unknown>;
        metadata?: Partial<SkillMetadata>;
      };

      if (!code || typeof code !== 'string') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Tool code is required and must be a string',
        });
        return;
      }

      // Create metadata for sandbox validation
      const skillMetadata: SkillMetadata = {
        name: metadata?.name || 'custom-tool',
        version: metadata?.version || '1.0.0',
        author: metadata?.author || 'user',
        permissions: ['filesystem:read', 'network:localhost'],
      };

      // Log execution start
      context.logGateway.log?.('CUSTOM_TOOL_EXECUTION_START', {
        toolId: toolId || 'unknown',
        toolName: skillMetadata.name,
        userId: client?.connect?.userId,
      });

      // Execute with sandbox
      const result = await executeSkillSandboxed(
        code,
        skillMetadata,
        toolParams || {},
        context.deps.session?.key || 'unknown',
        DEFAULT_SKILL_SANDBOX_CONFIG,
      );

      // Log execution completion
      context.logGateway.log?.('CUSTOM_TOOL_EXECUTION_COMPLETE', {
        toolId: toolId || 'unknown',
        success: result.success,
        executionTimeMs: result.executionTimeMs,
        userId: client?.connect?.userId,
      });

      respond(true, {
        success: result.success,
        output: result.output,
        executionTimeMs: result.executionTimeMs,
        auditLog: result.auditLog,
      });

    } catch (error) {
      context.logGateway.error?.('CUSTOM_TOOL_EXECUTION_ERROR', {
        error: error instanceof Error ? error.message : String(error),
        userId: client?.connect?.userId,
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
   * }
   */
  'tools.get_metadata': async ({ params, respond }) => {
    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const { toolId } = params as { toolId?: string };

      if (!toolId) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'toolId is required',
        });
        return;
      }

      // TODO: Implement database lookup when tables are available
      // For now, return a placeholder
      respond(true, {
        id: toolId,
        name: 'placeholder-tool',
        description: 'Database not yet initialized',
        parameters: {},
        version: '1.0.0',
      });

    } catch (error) {
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
   *   }>
   * }
   */
  'tools.list': async ({ respond, context, client }) => {
    try {
      // TODO: Implement database query when tables are available
      // For now, return empty list
      context.logGateway.log?.('TOOLS_LIST_REQUEST', {
        userId: client?.connect?.userId,
      });

      respond(true, {
        tools: [],
        total: 0,
      });

    } catch (error) {
      respond(false, undefined, {
        code: 'LIST_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
};
