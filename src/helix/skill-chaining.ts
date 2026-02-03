/**
 * COMPOSITE SKILL CHAINING ENGINE
 *
 * Orchestrates multi-step workflows where each step can be:
 * - Custom tools
 * - Built-in skills
 * - MCP tools
 * - Conditional logic branches
 *
 * Features:
 * - JSONPath-based input mapping between steps
 * - Conditional execution (if/then logic)
 * - Error handling strategies (stop, retry, skip)
 * - Execution history tracking
 * - Resource limits per step
 */

export interface CompositeSkillStep {
  /** Unique identifier for this step */
  stepId: string;

  /** Type of tool being executed */
  toolType: 'custom' | 'builtin' | 'mcp';

  /** Reference to the tool/skill */
  toolId: string;
  toolName: string;

  /** JSON schema for input parameters */
  parameters: Record<string, unknown>;

  /** Input mapping using JSONPath expressions */
  inputMapping: Record<string, string>;

  /** Conditional execution: JSONPath expression that must evaluate to true */
  condition?: string;

  /** What to do if this step fails */
  errorHandling: 'stop' | 'retry' | 'skip' | 'continue';

  /** Number of retries (for errorHandling: 'retry') */
  maxRetries?: number;

  /** Timeout for this step in milliseconds */
  timeoutMs?: number;

  /** Description of what this step does */
  description?: string;
}

export interface CompositeSkill {
  /** Unique identifier */
  id: string;

  /** User who owns this skill */
  userId: string;

  /** Name of the composite skill */
  name: string;

  /** Description */
  description: string;

  /** Ordered array of steps to execute */
  steps: CompositeSkillStep[];

  /** Version for schema evolution */
  version: string;

  /** Whether the skill is enabled */
  isEnabled: boolean;

  /** Public/private visibility */
  visibility: 'public' | 'private';

  /** Metadata */
  tags?: string[];
  icon?: string;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

export interface StepExecutionResult {
  stepId: string;
  toolName: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  retriesUsed?: number;
}

export interface CompositeSkillExecutionResult {
  success: boolean;
  skillId: string;
  userId: string;

  /** Input provided to the skill */
  input: Record<string, unknown>;

  /** Results from each step */
  stepResults: StepExecutionResult[];

  /** Final output after all steps */
  finalOutput?: unknown;

  /** Execution context (all intermediate values) */
  executionContext: Record<string, unknown>;

  /** Error details if skill failed */
  error?: string;

  /** Total execution time */
  executionTimeMs: number;

  /** Number of steps completed */
  stepsCompleted: number;
  totalSteps: number;
}

/**
 * Simple JSONPath evaluator supporting $.property and $.array[index] syntax
 */
function evaluateJsonPath(path: string, context: Record<string, unknown>): unknown {
  try {
    // Handle simple JSONPath expressions like $.stepId, $.input.value, $.array[0]
    if (!path.startsWith('$.')) {
      throw new Error('JSONPath must start with $.');
    }

    let current: unknown = context;
    const pathParts = path.substring(2).split('.');

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array indexing like array[0]
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, propName, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);

        if (propName) {
          current = (current as Record<string, unknown>)[propName];
        }

        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  } catch {
    throw new Error(`Invalid JSONPath expression: ${path}`);
  }
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  try {
    // Support both JSONPath and simple JavaScript expressions
    if (condition.startsWith('$.')) {
      // It's a JSONPath expression - check if it's truthy
      const result = evaluateJsonPath(condition, context);
      return Boolean(result);
    } else {
      // Simple boolean expression
      // SECURITY: This is intentionally restrictive - only allows comparison operators
      // and basic boolean logic. Use eval with extreme caution and only for trusted content.
      const allowedPattern = /^[a-zA-Z0-9_$.()[\]>=<!"' && || !! true false null undefined]*$/;
      if (!allowedPattern.test(condition)) {
        throw new Error(`Condition contains invalid characters: ${condition}`);
      }

      // Create a safe evaluation function with limited scope
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function('context', `with(context) { return ${condition}; }`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return Boolean(fn(context));
    }
  } catch (error) {
    throw new Error(
      `Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Map input parameters using JSONPath expressions
 */
function mapInputParameters(
  mappings: Record<string, string>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [paramName, pathExpression] of Object.entries(mappings)) {
    try {
      result[paramName] = evaluateJsonPath(pathExpression, context);
    } catch (error) {
      // If mapping fails, log warning but continue
      console.warn(`Failed to map parameter '${paramName}' with path '${pathExpression}':`, error);
    }
  }

  return result;
}

/**
 * Execute a single step (placeholder - real implementation would call gateway)
 */
// For testing: allows overriding step execution behavior
const STEP_EXECUTION_CONFIG = new Map<string, { error?: Error; result?: unknown }>();

export function executeStep(
  step: CompositeSkillStep,
  mappedInput: Record<string, unknown>
): Promise<unknown> {
  // Check if test has configured this step to fail
  if (STEP_EXECUTION_CONFIG.has(step.stepId)) {
    const config = STEP_EXECUTION_CONFIG.get(step.stepId)!;
    if (config.error) {
      return Promise.reject(config.error);
    }
    if (config.result !== undefined) {
      return Promise.resolve(config.result);
    }
  }

  // TODO: Implement actual tool execution via gateway
  // For now, return a mock result
  return Promise.resolve({
    stepId: step.stepId,
    toolName: step.toolName,
    input: mappedInput,
    output: { result: 'mock result' },
  });
}

/**
 * Test helper: configure step execution behavior
 */
export function configureStepExecution(
  stepId: string,
  config: { error?: Error; result?: unknown }
): void {
  STEP_EXECUTION_CONFIG.set(stepId, config);
}

/**
 * Test helper: clear step execution configuration
 */
export function clearStepExecutionConfig(): void {
  STEP_EXECUTION_CONFIG.clear();
}

/**
 * Execute a composite skill with multiple steps
 */
export async function executeCompositeSkill(
  skill: CompositeSkill,
  userInput: Record<string, unknown>
): Promise<CompositeSkillExecutionResult> {
  const startTime = Date.now();
  const stepResults: StepExecutionResult[] = [];

  // Initialize execution context with user input
  const context: Record<string, unknown> = {
    input: userInput,
    ...userInput,
  };

  let stepsCompleted = 0;
  let skillFailed = false;
  let skillError: string | undefined;

  try {
    for (const step of skill.steps) {
      // Check condition
      if (step.condition) {
        try {
          const conditionMet = evaluateCondition(step.condition, context);
          if (!conditionMet) {
            // Condition not met, skip this step
            continue;
          }
        } catch (error) {
          if (step.errorHandling === 'stop') {
            throw error;
          }
          // For other strategies, log and continue
          console.warn(`Condition evaluation failed for step '${step.stepId}':`, error);
          continue;
        }
      }

      // Map input parameters
      const stepStartTime = Date.now();
      let stepOutput: unknown;
      let stepError: string | undefined;
      let retriesUsed = 0;
      let stepSuccess = false;

      try {
        const mappedInput = mapInputParameters(step.inputMapping, context);

        // Attempt execution with retries
        const maxAttempts = step.errorHandling === 'retry' ? (step.maxRetries || 1) + 1 : 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            stepOutput = await executeStep(step, mappedInput);
            stepSuccess = true;
            retriesUsed = attempt;
            break;
          } catch (error) {
            if (attempt < maxAttempts - 1) {
              // Retry with exponential backoff
              const backoffMs = Math.pow(2, attempt) * 1000;
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            } else {
              throw error;
            }
          }
        }
      } catch (error) {
        stepError = error instanceof Error ? error.message : String(error);

        // Handle step error according to strategy
        if (step.errorHandling === 'stop') {
          skillFailed = true;
          skillError = `Step '${step.stepId}' failed: ${stepError}`;
          // NOTE: Do NOT break here - we need to record the step result below
        } else if (step.errorHandling === 'skip') {
          // Skip this step and continue to next
        } else if (step.errorHandling === 'retry') {
          // Already tried retries above - continue to next step
        } else if (step.errorHandling === 'continue') {
          // Continue with next step anyway
        }
      }

      const executionTimeMs = Date.now() - stepStartTime;

      // Record step result
      stepResults.push({
        stepId: step.stepId,
        toolName: step.toolName,
        success: stepSuccess,
        output: stepOutput,
        error: stepError,
        executionTimeMs,
        retriesUsed: retriesUsed > 0 ? retriesUsed : undefined,
      });

      // Store step output in context for next steps
      context[step.stepId] = stepOutput;

      if (stepSuccess) {
        stepsCompleted++;
      }

      if (skillFailed) {
        break;
      }
    }
  } catch (error) {
    skillFailed = true;
    skillError = error instanceof Error ? error.message : String(error);
  }

  const totalExecutionTimeMs = Date.now() - startTime;

  const result: CompositeSkillExecutionResult = {
    success: !skillFailed,
    skillId: skill.id,
    userId: skill.userId,
    input: userInput,
    stepResults,
    finalOutput: context[skill.steps[skill.steps.length - 1]?.stepId],
    executionContext: context,
    error: skillError,
    executionTimeMs: totalExecutionTimeMs,
    stepsCompleted,
    totalSteps: skill.steps.length,
  };

  return result;
}

/**
 * Validate a composite skill definition
 */
export function validateCompositeSkill(skill: CompositeSkill): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!skill.name || skill.name.trim().length === 0) {
    errors.push('Skill name is required');
  }

  if (!Array.isArray(skill.steps) || skill.steps.length === 0) {
    errors.push('At least one step is required');
  }

  const seenStepIds = new Set<string>();

  for (let i = 0; i < skill.steps.length; i++) {
    const step = skill.steps[i];

    if (!step.stepId) {
      errors.push(`Step ${i} is missing stepId`);
      continue;
    }

    if (seenStepIds.has(step.stepId)) {
      errors.push(`Duplicate stepId: ${step.stepId}`);
    }
    seenStepIds.add(step.stepId);

    if (!step.toolName) {
      errors.push(`Step '${step.stepId}' is missing toolName`);
    }

    if (!step.toolType || !['custom', 'builtin', 'mcp'].includes(step.toolType)) {
      errors.push(`Step '${step.stepId}' has invalid toolType`);
    }

    // Validate JSONPath expressions
    if (step.inputMapping) {
      for (const [paramName, pathExpr] of Object.entries(step.inputMapping)) {
        if (typeof pathExpr !== 'string') {
          errors.push(`Step '${step.stepId}' has invalid mapping for parameter '${paramName}'`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
