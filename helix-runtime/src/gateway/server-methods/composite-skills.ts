import { executeCompositeSkill, validateCompositeSkill, type CompositeSkill } from '../../helix/skill-chaining.js';
import type { GatewayRequestHandlers } from './types.js';

/**
 * Composite Skills Gateway RPC Methods
 *
 * Phase 3 feature: Allows users to chain multiple tools into reusable workflows
 * with conditional logic, error handling, and step-by-step execution.
 */

export const compositeSkillHandlers: GatewayRequestHandlers = {
  /**
   * Execute a composite skill
   *
   * params: {
   *   skillId: string (UUID of the skill)
   *   skill?: CompositeSkill (full skill definition, used if skillId not in database)
   *   input: Record<string, unknown> (input parameters)
   * }
   *
   * response: {
   *   success: boolean
   *   skillId: string
   *   stepResults: Array<{stepId, toolName, success, output, error, executionTimeMs}>
   *   finalOutput: unknown
   *   executionContext: Record<string, unknown> (all intermediate values)
   *   executionTimeMs: number
   *   stepsCompleted: number
   *   totalSteps: number
   * }
   */
  'skills.execute_composite': async ({ params, respond, context, client }) => {
    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const { skillId, skill: providedSkill, input } = params as {
        skillId?: string;
        skill?: CompositeSkill;
        input?: Record<string, unknown>;
      };

      if (!skillId && !providedSkill) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Either skillId or skill definition is required',
        });
        return;
      }

      // TODO: Load skill from database if skillId is provided
      // For now, use provided skill
      if (!providedSkill) {
        respond(false, undefined, {
          code: 'NOT_FOUND',
          message: 'Database lookups not yet implemented',
        });
        return;
      }

      // Validate skill
      const validation = validateCompositeSkill(providedSkill);
      if (!validation.valid) {
        respond(false, undefined, {
          code: 'INVALID_SKILL',
          message: `Skill validation failed: ${validation.errors.join('; ')}`,
        });
        return;
      }

      // Log execution start
      context.logGateway.info?.(`Executing composite skill: ${providedSkill.name}`, {
        skillId: providedSkill.id,
        userId: client?.connect?.userId,
        stepsCount: providedSkill.steps.length,
      });

      // Execute skill
      const result = await executeCompositeSkill(providedSkill, input || {});

      // Log execution completion
      context.logGateway.info?.(`Composite skill execution completed: ${providedSkill.name}`, {
        skillId: providedSkill.id,
        success: result.success,
        executionTimeMs: result.executionTimeMs,
        stepsCompleted: result.stepsCompleted,
        userId: client?.connect?.userId,
      });

      respond(true, result);

    } catch (error) {
      context.logGateway.error?.('Composite skill execution error', {
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
   * Validate a composite skill definition
   *
   * params: {
   *   skill: CompositeSkill (skill definition to validate)
   * }
   *
   * response: {
   *   valid: boolean
   *   errors: string[] (validation errors, if any)
   * }
   */
  'skills.validate_composite': async ({ params, respond }) => {
    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const { skill } = params as { skill?: CompositeSkill };

      if (!skill) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'skill definition is required',
        });
        return;
      }

      const validation = validateCompositeSkill(skill);
      respond(true, validation);

    } catch (error) {
      respond(false, undefined, {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * Get composite skill metadata
   *
   * params: {
   *   skillId: string (UUID of the skill)
   * }
   *
   * response: {
   *   id: string
   *   name: string
   *   description: string
   *   stepsCount: number
   *   version: string
   *   createdAt: string (ISO)
   *   lastExecuted: string (ISO) | null
   * }
   */
  'skills.get_metadata': async ({ params, respond }) => {
    try {
      if (!params || typeof params !== 'object') {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'Invalid parameters',
        });
        return;
      }

      const { skillId } = params as { skillId?: string };

      if (!skillId) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'skillId is required',
        });
        return;
      }

      // TODO: Implement database lookup
      respond(true, {
        id: skillId,
        name: 'placeholder-skill',
        description: 'Database not yet initialized',
        stepsCount: 0,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        lastExecuted: null,
      });

    } catch (error) {
      respond(false, undefined, {
        code: 'LOOKUP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },

  /**
   * List user's composite skills
   *
   * params: {} (no parameters)
   *
   * response: {
   *   skills: Array<{
   *     id: string
   *     name: string
   *     description: string
   *     stepsCount: number
   *     version: string
   *     executionCount: number
   *     lastExecuted: string (ISO) | null
   *   }>
   * }
   */
  'skills.list_composite': async ({ respond, context, client }) => {
    try {
      // TODO: Implement database query
      context.logGateway.info?.('Listing composite skills', {
        userId: client?.connect?.userId,
      });

      respond(true, {
        skills: [],
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
