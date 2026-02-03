import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type {
  CompositeSkill,
  CompositeSkillDefinition,
  CompositeSkillExecution,
  SkillStep,
  StepExecutionResult,
  SkillValidationResult,
} from '@/lib/types/composite-skills';

/**
 * CompositeSkillsService: Manages skill composition and workflow execution
 * Handles tool chaining, conditional logic, and error handling
 */
export class CompositeSkillsService {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Validate skill steps configuration
   */
  validateSkillSteps(steps: SkillStep[]): SkillValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!steps || steps.length === 0) {
      errors.push('Skill must have at least one step');
      return { valid: false, errors, warnings };
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of steps) {
      if (!step.stepId) {
        errors.push('All steps must have a stepId');
      } else if (stepIds.has(step.stepId)) {
        errors.push(`Duplicate step ID: ${step.stepId}`);
      }
      stepIds.add(step.stepId);

      // Validate step fields
      if (!step.toolName) {
        errors.push(`Step ${step.stepId} must specify a toolName`);
      }
      if (!step.toolType) {
        errors.push(`Step ${step.stepId} must specify a toolType`);
      }
      if (!step.inputMapping) {
        errors.push(`Step ${step.stepId} must have inputMapping`);
      }
      if (!step.errorHandling) {
        errors.push(`Step ${step.stepId} must specify errorHandling`);
      }

      // Validate conditions
      if (step.condition) {
        if (!step.condition.field) {
          errors.push(`Step ${step.stepId} condition missing field`);
        }
        if (!step.condition.operator) {
          errors.push(`Step ${step.stepId} condition missing operator`);
        }
      }
    }

    // Warn about input mapping to non-existent steps
    for (const step of steps) {
      for (const mapping of Object.values(step.inputMapping)) {
        if (typeof mapping === 'string' && mapping.startsWith('$.')) {
          const referencedStep = mapping.match(/\$\.(\w+)/)?.[1];
          if (referencedStep && referencedStep !== 'input' && !stepIds.has(referencedStep)) {
            warnings.push(
              `Step ${step.stepId} references non-existent step: ${referencedStep}`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Resolve a JSONPath expression
   */
  private resolveJSONPath(path: string, context: Record<string, any>): any {
    if (!path.startsWith('$.')) {
      return path; // Literal string
    }

    const parts = path.slice(2).split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Evaluate a condition against context
   */
  private evaluateCondition(
    condition: SkillStep['condition'],
    context: Record<string, any>
  ): boolean {
    if (!condition) return true;

    const fieldValue = this.resolveJSONPath(condition.field, context);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'gt':
        return Number(fieldValue) > Number(condition.value);
      case 'lt':
        return Number(fieldValue) < Number(condition.value);
      case 'exists':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return true;
    }
  }

  /**
   * Map input parameters using JSONPath
   */
  private mapInputs(
    inputMapping: Record<string, string>,
    context: Record<string, any>
  ): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const [paramKey, mapping] of Object.entries(inputMapping)) {
      mapped[paramKey] = this.resolveJSONPath(mapping, context);
    }

    return mapped;
  }

  /**
   * Create a new composite skill
   */
  async createCompositeSkill(
    userId: string,
    definition: CompositeSkillDefinition
  ): Promise<CompositeSkill> {
    try {
      // Validate steps
      const validation = this.validateSkillSteps(definition.steps);
      if (!validation.valid) {
        throw new Error(`Skill validation failed: ${validation.errors.join(', ')}`);
      }

      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('composite_skills')
        .insert([
          {
            user_id: userId,
            name: definition.name,
            description: definition.description,
            steps: definition.steps,
            tags: definition.tags || [],
            icon: definition.icon || '⚙️',
            visibility: definition.visibility || 'private',
            is_enabled: true,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create skill: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to create composite skill:', error);
      throw error;
    }
  }

  /**
   * Get user's composite skills
   */
  async getCompositeSkills(userId: string): Promise<CompositeSkill[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('composite_skills')
        .select('*')
        .eq('user_id', userId)
        .eq('is_enabled', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch skills: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get composite skills:', error);
      throw error;
    }
  }

  /**
   * Get a specific skill
   */
  async getCompositeSkill(skillId: string): Promise<CompositeSkill> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('composite_skills')
        .select('*')
        .eq('id', skillId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch skill: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to get composite skill:', error);
      throw error;
    }
  }

  /**
   * Update a composite skill
   */
  async updateCompositeSkill(
    skillId: string,
    updates: Partial<CompositeSkillDefinition>
  ): Promise<CompositeSkill> {
    try {
      // Validate steps if updating
      if (updates.steps) {
        const validation = this.validateSkillSteps(updates.steps);
        if (!validation.valid) {
          throw new Error(`Skill validation failed: ${validation.errors.join(', ')}`);
        }
      }

      const supabase = this.getSupabaseClient();

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      if (updates.steps) updateData.steps = updates.steps;
      if (updates.tags) updateData.tags = updates.tags;
      if (updates.icon) updateData.icon = updates.icon;
      if (updates.visibility) updateData.visibility = updates.visibility;

      const { data, error } = await supabase
        .from('composite_skills')
        .update(updateData)
        .eq('id', skillId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update skill: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to update composite skill:', error);
      throw error;
    }
  }

  /**
   * Delete a composite skill
   */
  async deleteCompositeSkill(skillId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      const { error } = await supabase
        .from('composite_skills')
        .update({ is_enabled: false })
        .eq('id', skillId);

      if (error) {
        throw new Error(`Failed to delete skill: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete composite skill:', error);
      throw error;
    }
  }

  /**
   * Execute a composite skill (simulated - actual execution would call gateway)
   * This is a client-side simulation that shows the execution flow
   */
  async simulateSkillExecution(
    skill: CompositeSkill,
    inputParams: Record<string, any>,
    onProgress?: (result: StepExecutionResult) => void
  ): Promise<CompositeSkillExecution> {
    const startTime = Date.now();
    const context: Record<string, any> = { input: inputParams };
    const stepsExecuted: StepExecutionResult[] = [];
    let errorMessage: string | null = null;
    let status: CompositeSkillExecution['status'] = 'completed';

    try {
      for (const step of skill.steps) {
        // Check condition
        if (step.condition && !this.evaluateCondition(step.condition, context)) {
          continue;
        }

        // Map inputs
        const toolParams = this.mapInputs(step.inputMapping, context);

        // Simulate tool execution (in real app, would call actual tool)
        const stepStartTime = Date.now();
        let stepResult: StepExecutionResult;

        try {
          // Simulate execution with random delay
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 500));

          stepResult = {
            stepId: step.stepId,
            toolName: step.toolName,
            toolType: step.toolType,
            input: toolParams,
            output: { success: true, data: `Simulated output from ${step.toolName}` },
            success: true,
            executionTime: Date.now() - stepStartTime,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          stepResult = {
            stepId: step.stepId,
            toolName: step.toolName,
            toolType: step.toolType,
            input: toolParams,
            output: null,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - stepStartTime,
            timestamp: new Date().toISOString(),
          };

          // Handle error
          if (step.errorHandling === 'stop') {
            errorMessage = `Step ${step.stepId} failed: ${stepResult.error}`;
            status = 'failed';
            break;
          }
          // 'continue' or 'retry' - just log and continue
        }

        context[step.stepId] = stepResult.output;
        stepsExecuted.push(stepResult);

        if (onProgress) {
          onProgress(stepResult);
        }
      }

      return {
        id: crypto.randomUUID(),
        composite_skill_id: skill.id,
        user_id: skill.user_id,
        input_params: inputParams,
        steps_executed: stepsExecuted,
        final_output: context,
        status,
        error_message: errorMessage,
        execution_time_ms: Date.now() - startTime,
        steps_completed: stepsExecuted.length,
        total_steps: skill.steps.length,
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        id: crypto.randomUUID(),
        composite_skill_id: skill.id,
        user_id: skill.user_id,
        input_params: inputParams,
        steps_executed: stepsExecuted,
        final_output: context,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - startTime,
        steps_completed: stepsExecuted.length,
        total_steps: skill.steps.length,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a composite skill via the gateway RPC
   */
  async executeSkill(
    userId: string,
    skillId: string,
    input: Record<string, any>
  ): Promise<{ success: boolean; output: any; executionTimeMs: number; error?: string }> {
    try {
      const { getGatewayRPCClient } = await import('@/lib/gateway-rpc-client');
      const client = getGatewayRPCClient();

      const startTime = Date.now();
      const result = await client.executeCompositeSkill(skillId, userId, input);
      const executionTimeMs = Date.now() - startTime;

      return {
        success: result.success,
        output: result.finalOutput,
        executionTimeMs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        output: null,
        executionTimeMs: 0,
        error: message,
      };
    }
  }

  /**
   * Save skill execution to database
   */
  async saveExecution(
    userId: string,
    execution: CompositeSkillExecution
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase.from('composite_skill_executions').insert([
        {
          composite_skill_id: execution.composite_skill_id,
          user_id: userId,
          input_params: execution.input_params,
          steps_executed: execution.steps_executed,
          final_output: execution.final_output,
          status: execution.status,
          error_message: execution.error_message,
          execution_time_ms: execution.execution_time_ms,
          steps_completed: execution.steps_completed,
          total_steps: execution.total_steps,
        },
      ]);

      // Update skill execution count
      if (execution.status === 'completed') {
        await supabase
          .from('composite_skills')
          .update({
            execution_count: (await supabase.rpc('increment')).data,
            last_executed: new Date().toISOString(),
          })
          .eq('id', execution.composite_skill_id);
      }
    } catch (error) {
      console.error('Failed to save execution:', error);
      // Non-fatal
    }
  }

  /**
   * Get skill execution history
   */
  async getExecutionHistory(skillId: string, limit: number = 20): Promise<CompositeSkillExecution[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('composite_skill_executions')
        .select('*')
        .eq('composite_skill_id', skillId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to fetch history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get execution history:', error);
      throw error;
    }
  }
}
