/**
 * Composite Skill Chaining Engine
 *
 * Enables multi-step workflow execution with:
 * - Sequential and conditional step execution
 * - Data passing between steps using JSONPath
 * - Error handling and retry logic
 * - Comprehensive execution tracking
 */

import * as JSONPath from 'jsonpath';

export interface SkillStep {
  stepId: string;
  toolName: string;
  description?: string;
  inputMapping?: Record<string, string>; // Maps param names to JSONPath expressions
  outputMapping?: string; // JSONPath to extract from tool output
  condition?: string; // JavaScript condition to evaluate
  errorHandling?: 'stop' | 'continue' | 'retry';
  retryAttempts?: number;
}

export interface CompositeSkill {
  id: string;
  name: string;
  description?: string;
  steps: SkillStep[];
  version?: string;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface CompositeSkillExecutionResult {
  success: boolean;
  skillId: string;
  stepResults: StepResult[];
  finalOutput: unknown;
  executionContext: Record<string, unknown>;
  executionTimeMs: number;
  stepsCompleted: number;
  totalSteps: number;
}

/**
 * Validates a composite skill definition
 */
export function validateCompositeSkill(skill: CompositeSkill): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!skill.id) errors.push('Missing skill id');
  if (!skill.name) errors.push('Missing skill name');
  if (!Array.isArray(skill.steps) || skill.steps.length === 0) {
    errors.push('Skill must have at least one step');
  }

  // Validate each step
  if (Array.isArray(skill.steps)) {
    const stepIds = new Set<string>();

    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];

      if (!step.stepId) errors.push(`Step ${i} missing stepId`);
      if (!step.toolName) errors.push(`Step ${i} missing toolName`);

      if (stepIds.has(step.stepId)) {
        errors.push(`Duplicate stepId: ${step.stepId}`);
      }
      stepIds.add(step.stepId);

      // Validate JSONPath expressions in inputMapping
      if (step.inputMapping) {
        for (const [param, path] of Object.entries(step.inputMapping)) {
          try {
            JSONPath.parse(path);
          } catch (error) {
            errors.push(
              `Step ${step.stepId}: Invalid JSONPath in inputMapping for param '${param}': ${path}`,
            );
          }
        }
      }

      // Validate outputMapping JSONPath
      if (step.outputMapping) {
        try {
          JSONPath.parse(step.outputMapping);
        } catch (error) {
          errors.push(
            `Step ${step.stepId}: Invalid JSONPath in outputMapping: ${step.outputMapping}`,
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Function signature for tool execution
 * Can be implemented to call mock tools, gateway RPC, or other execution backends
 */
export interface ToolExecutor {
  (toolName: string, params: Record<string, unknown>): Promise<unknown>;
}

/**
 * Executes a composite skill with multi-step workflow
 *
 * @param skill - Composite skill definition
 * @param input - Initial input data
 * @param toolExecutor - Function to execute individual tools (supports both mock and real execution)
 * @returns Execution result with all step outputs and final output
 */
export async function executeCompositeSkill(
  skill: CompositeSkill,
  input: Record<string, unknown> = {},
  toolExecutor?: ToolExecutor,
): Promise<CompositeSkillExecutionResult> {
  const startTime = Date.now();
  const executionContext: Record<string, unknown> = { input };
  const stepResults: StepResult[] = [];

  // Use provided executor or fall back to mock
  const executor = toolExecutor || executeTool;

  // Validate skill before execution
  const validation = validateCompositeSkill(skill);
  if (!validation.valid) {
    throw new Error(`Skill validation failed: ${validation.errors.join('; ')}`);
  }

  for (let stepIndex = 0; stepIndex < skill.steps.length; stepIndex++) {
    const step = skill.steps[stepIndex];
    const stepStartTime = Date.now();

    try {
      // 1. Evaluate condition if present
      if (step.condition) {
        const conditionMet = evaluateCondition(step.condition, executionContext);
        if (!conditionMet) {
          stepResults.push({
            stepId: step.stepId,
            success: true,
            output: null,
            executionTimeMs: 0,
          });
          continue;
        }
      }

      // 2. Resolve input parameters using JSONPath
      const resolvedParams = resolveInputMapping(step.inputMapping || {}, executionContext);

      // 3. Execute tool via provided executor or mock
      const toolResult = await executor(step.toolName, resolvedParams);

      // 4. Extract output if outputMapping is defined
      let stepOutput = toolResult;
      if (step.outputMapping) {
        const matches = JSONPath.query(toolResult, step.outputMapping);
        stepOutput = matches.length > 0 ? matches[0] : null;
      }

      // 5. Store result in context
      executionContext[step.stepId] = stepOutput;

      const executionTimeMs = Date.now() - stepStartTime;
      stepResults.push({
        stepId: step.stepId,
        success: true,
        output: stepOutput,
        executionTimeMs,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTimeMs = Date.now() - stepStartTime;

      stepResults.push({
        stepId: step.stepId,
        success: false,
        error: errorMessage,
        executionTimeMs,
      });

      // Handle error based on step configuration
      if (step.errorHandling === 'stop' || step.errorHandling === undefined) {
        throw error;
      }
      // 'continue' - just log and move to next step (already done above)
      // 'retry' - would implement retry logic here
    }
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    success: true,
    skillId: skill.id,
    stepResults,
    finalOutput: executionContext[skill.steps[skill.steps.length - 1].stepId] || null,
    executionContext,
    executionTimeMs,
    stepsCompleted: stepResults.filter((r) => r.success).length,
    totalSteps: skill.steps.length,
  };
}

/**
 * Evaluates a JavaScript condition against execution context
 */
function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  try {
    // Create a function that evaluates the condition
    const fn = new Function(...Object.keys(context), `return (${condition})`);
    return Boolean(fn(...Object.values(context)));
  } catch (error) {
    throw new Error(`Failed to evaluate condition: ${condition} - ${error}`);
  }
}

/**
 * Resolves input parameters by extracting values from context using JSONPath
 */
function resolveInputMapping(
  inputMapping: Record<string, string>,
  context: Record<string, unknown>,
): Record<string, unknown> {
  const resolvedParams: Record<string, unknown> = {};

  for (const [paramName, jsonPath] of Object.entries(inputMapping)) {
    try {
      const matches = JSONPath.query(context, jsonPath);
      resolvedParams[paramName] = matches.length > 0 ? matches[0] : null;
    } catch (error) {
      throw new Error(
        `Failed to resolve input mapping for '${paramName}' with path '${jsonPath}': ${error}`,
      );
    }
  }

  return resolvedParams;
}

/**
 * Mock tool execution - in real implementation would call gateway RPC
 * This is a placeholder for demonstration
 */
async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  // Simulate tool execution
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock tool results based on tool name
      switch (toolName) {
        case 'double':
          resolve({ result: (params.x as number) * 2 });
          break;
        case 'add10':
          resolve({ result: (params.x as number) + 10 });
          break;
        case 'stringify':
          resolve({ result: String(params.x) });
          break;
        default:
          resolve({ result: params });
      }
    }, 100);
  });
}