import { executeCompositeSkill, validateCompositeSkill, type CompositeSkill, type ToolExecutor } from '../../helix/skill-chaining.js';
import { executeSkillSandboxed, DEFAULT_SKILL_SANDBOX_CONFIG, type SkillMetadata } from '../../helix/skill-sandbox.js';
import type { GatewayRequestHandlers, GatewayRequestContext } from './types.js';

/**
 * Creates a real tool executor that fetches and executes custom tools from the database
 */
function createRealToolExecutor(context: GatewayRequestContext, userId: string): ToolExecutor {
  return async (toolName: string, params: Record<string, unknown>): Promise<unknown> => {
    const db = context.db;

    // Try to fetch the custom tool from database
    try {
      const result = await db.query(
        `SELECT id, code, name, capabilities FROM custom_tools
         WHERE (name = $1 OR id = $1) AND user_id = $2`,
        [toolName, userId]
      );

      if (!result.rows || result.rows.length === 0) {
        throw new Error(`Custom tool not found: ${toolName}`);
      }

      const tool = result.rows[0];

      // Execute the custom tool using the sandbox
      const metadata: SkillMetadata = {
        name: tool.name || toolName,
        version: '1.0.0',
        author: 'composite-skill',
        permissions: tool.capabilities || [],
      };

      const sandboxResult = await executeSkillSandboxed(
        tool.code,
        metadata,
        params,
        `step-${toolName}`,
        DEFAULT_SKILL_SANDBOX_CONFIG
      );

      if (!sandboxResult.success) {
        throw new Error(sandboxResult.error || `Tool execution failed: ${toolName}`);
      }

      return sandboxResult.output;
    } catch (error) {
      throw new Error(
        `Failed to execute tool '${toolName}': ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

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

      // Load skill from database if skillId is provided
      let skillToExecute = providedSkill;
      if (skillId && !providedSkill) {
        const userId = client?.connect?.userId;
        if (!userId) {
          respond(false, undefined, {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          });
          return;
        }

        try {
          const db = context.db;
          const result = await db.query(
            `SELECT id, name, description, steps, version FROM composite_skills
             WHERE id = $1 AND user_id = $2`,
            [skillId, userId]
          );

          if (!result.rows || result.rows.length === 0) {
            respond(false, undefined, {
              code: 'NOT_FOUND',
              message: `Skill not found: ${skillId}`,
            });
            return;
          }

          skillToExecute = {
            id: result.rows[0].id,
            name: result.rows[0].name,
            description: result.rows[0].description,
            steps: result.rows[0].steps,
            version: result.rows[0].version || '1.0.0',
          } as CompositeSkill;
        } catch (dbError) {
          respond(false, undefined, {
            code: 'DATABASE_ERROR',
            message: dbError instanceof Error ? dbError.message : 'Database lookup failed',
          });
          return;
        }
      }

      if (!skillToExecute) {
        respond(false, undefined, {
          code: 'INVALID_REQUEST',
          message: 'No skill definition provided or found',
        });
        return;
      }

      // Validate skill
      const validation = validateCompositeSkill(skillToExecute);
      if (!validation.valid) {
        respond(false, undefined, {
          code: 'INVALID_SKILL',
          message: `Skill validation failed: ${validation.errors.join('; ')}`,
        });
        return;
      }

      const executionId = crypto.randomUUID();
      const startTime = Date.now();

      // Log execution start
      context.logGateway.info?.(`Executing composite skill: ${skillToExecute.name}`, {
        executionId,
        skillId: skillToExecute.id,
        userId: client?.connect?.userId,
        stepsCount: skillToExecute.steps.length,
      });

      // Create real tool executor that fetches and executes custom tools
      const toolExecutor = createRealToolExecutor(context, userId);

      // Execute skill with real tool executor
      const result = await executeCompositeSkill(skillToExecute, input || {}, toolExecutor);

      const executionTimeMs = Date.now() - startTime;

      // Store execution record if we have a skill ID
      if (skillId && client?.connect?.userId) {
        try {
          const db = context.db;
          await db.query(
            `INSERT INTO composite_skill_executions
             (id, composite_skill_id, user_id, input_params, steps_executed, final_output, status, execution_time_ms, steps_completed, total_steps, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
            [
              executionId,
              skillId,
              client.connect.userId,
              JSON.stringify(input || {}),
              JSON.stringify(result.stepResults || []),
              JSON.stringify(result.finalOutput),
              result.success ? 'completed' : 'failed',
              executionTimeMs,
              result.stepsCompleted || 0,
              skillToExecute.steps.length,
            ]
          );

          // Update skill execution count
          await db.query(
            `UPDATE composite_skills SET execution_count = execution_count + 1, last_executed = NOW() WHERE id = $1`,
            [skillId]
          );
        } catch (dbError) {
          context.logGateway.error?.('COMPOSITE_SKILL_STORAGE_ERROR', {
            executionId,
            error: dbError instanceof Error ? dbError.message : String(dbError),
            userId: client?.connect?.userId,
          });
        }
      }

      // Log execution completion
      context.logGateway.info?.(`Composite skill execution completed: ${skillToExecute.name}`, {
        executionId,
        skillId: skillToExecute.id,
        success: result.success,
        executionTimeMs,
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
   *   skillId: string
   *   name: string
   *   description: string
   *   steps: unknown (JSONB array of steps)
   *   version: string
   *   isEnabled: boolean
   *   createdAt: string (ISO)
   *   updatedAt: string (ISO)
   * }
   */
  'skills.get_skill_metadata': async ({ params, respond, context, client }) => {
    const { skillId } = params as Record<string, unknown>;

    if (!client?.connect?.userId) {
      respond(false, undefined, { code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    if (!skillId || typeof skillId !== 'string') {
      respond(false, undefined, { code: 'INVALID_REQUEST', message: 'skillId is required' });
      return;
    }

    try {
      const { data: skill, error } = await context.supabaseClient
        .from('composite_skills')
        .select('*')
        .eq('id', skillId)
        .eq('user_id', client.connect.userId)
        .single();

      if (error || !skill) {
        respond(false, undefined, { code: 'NOT_FOUND', message: 'Skill not found' });
        return;
      }

      respond(true, {
        skillId: skill.id,
        name: skill.name,
        description: skill.description,
        steps: skill.steps,
        version: skill.version,
        isEnabled: skill.is_enabled,
        createdAt: skill.created_at,
        updatedAt: skill.updated_at,
      });
    } catch (error) {
      context.logGateway.error?.('Failed to fetch skill metadata', { error, skillId });
      respond(false, undefined, { code: 'INTERNAL_ERROR', message: 'Failed to fetch skill metadata' });
    }
  },

  /**
   * List user's composite skills
   *
   * params: {
   *   enabled?: boolean
   *   limit?: number (1-100, default 50)
   *   offset?: number (default 0)
   * }
   *
   * response: {
   *   skills: Array<{
   *     skillId: string
   *     name: string
   *     description: string
   *     steps: unknown (JSONB array)
   *     version: string
   *     isEnabled: boolean
   *     createdAt: string (ISO)
   *     updatedAt: string (ISO)
   *   }>
   *   total: number
   *   limit: number
   *   offset: number
   * }
   */
  'skills.list_user_skills': async ({ params, respond, context, client }) => {
    const { enabled, limit = 50, offset = 0 } = params as Record<string, unknown>;

    if (!client?.connect?.userId) {
      respond(false, undefined, { code: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      respond(false, undefined, { code: 'INVALID_REQUEST', message: 'limit must be between 1 and 100' });
      return;
    }

    if (typeof offset !== 'number' || offset < 0) {
      respond(false, undefined, { code: 'INVALID_REQUEST', message: 'offset must be >= 0' });
      return;
    }

    try {
      let query = context.supabaseClient
        .from('composite_skills')
        .select('*', { count: 'exact' })
        .eq('user_id', client.connect.userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (enabled !== undefined && typeof enabled === 'boolean') {
        query = query.eq('is_enabled', enabled);
      }

      const { data: skills, error, count } = await query;

      if (error) {
        throw error;
      }

      context.logGateway.info?.('Listed user skills', {
        userId: client.connect.userId,
        enabled,
        count: skills?.length || 0,
      });

      respond(true, {
        skills: (skills || []).map(skill => ({
          skillId: skill.id,
          name: skill.name,
          description: skill.description,
          steps: skill.steps,
          version: skill.version,
          isEnabled: skill.is_enabled,
          createdAt: skill.created_at,
          updatedAt: skill.updated_at,
        })),
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      context.logGateway.error?.('Failed to list user skills', { error });
      respond(false, undefined, { code: 'INTERNAL_ERROR', message: 'Failed to list skills' });
    }
  },
};
