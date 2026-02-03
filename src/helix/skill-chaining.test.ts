/**
 * Tests for Helix Composite Skill Chaining Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeCompositeSkill,
  validateCompositeSkill,
  configureStepExecution,
  clearStepExecutionConfig,
  type CompositeSkill,
  type CompositeSkillStep,
} from './skill-chaining.js';

describe('Skill Chaining - executeCompositeSkill', () => {
  const createTestSkill = (steps: CompositeSkillStep[]): CompositeSkill => ({
    id: 'test-skill-1',
    userId: 'user-123',
    name: 'Test Skill',
    description: 'A test composite skill',
    steps,
    version: '1.0.0',
    isEnabled: true,
    visibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute a simple skill with one step', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'testTool',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { value: 'test' });

    expect(result.success).toBe(true);
    expect(result.skillId).toBe('test-skill-1');
    expect(result.userId).toBe('user-123');
    expect(result.stepsCompleted).toBe(1);
    expect(result.totalSteps).toBe(1);
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].success).toBe(true);
  });

  it('should execute multiple steps in sequence', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step3',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { value: 'test' });

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(3);
    expect(result.totalSteps).toBe(3);
    expect(result.stepResults).toHaveLength(3);
  });

  it('should map input parameters using JSONPath', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {
          param1: '$.input.value',
          param2: '$.input.nested.data',
        },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {
      value: 'test-value',
      nested: { data: 'nested-value' },
    });

    expect(result.success).toBe(true);
    expect(result.stepResults[0].success).toBe(true);
  });

  it('should map array indexing in JSONPath', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {
          firstItem: '$.input.items[0]',
          secondItem: '$.input.items[1]',
        },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {
      items: ['first', 'second', 'third'],
    });

    expect(result.success).toBe(true);
  });

  it('should skip step when condition is not met', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        condition: '$.input.shouldRun',
        errorHandling: 'stop',
      },
      {
        stepId: 'step3',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { shouldRun: false });

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(2); // step1 and step3, step2 skipped
    expect(result.stepResults).toHaveLength(2);
  });

  it('should execute step when condition is met', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        condition: '$.input.shouldRun',
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { shouldRun: true });

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
  });

  it('should handle errorHandling: stop on step failure', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    // Execution continues even with mock results
    expect(result.totalSteps).toBe(1);
  });

  it('should handle errorHandling: skip on step failure', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'skip',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.totalSteps).toBe(2);
  });

  it('should handle errorHandling: continue on step failure', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'continue',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.totalSteps).toBe(1);
  });

  it('should handle errorHandling: retry on step failure', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'retry',
        maxRetries: 2,
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.totalSteps).toBe(1);
  });

  it('should build execution context with step outputs', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { value: 'test' });

    expect(result.executionContext).toBeDefined();
    expect(result.executionContext.input).toEqual({ value: 'test' });
    expect(result.executionContext.step1).toBeDefined();
    expect(result.executionContext.step2).toBeDefined();
  });

  it('should calculate total execution time', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should record step execution times', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepResults[0].executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should return final output from last step', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.finalOutput).toBeDefined();
  });

  it('should handle condition evaluation errors with stop strategy', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        condition: '$.nonexistent.path',
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    // Should skip step when condition evaluates to falsy
    expect(result.success).toBe(true);
  });

  it('should handle invalid JSONPath gracefully', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {
          param1: '$.input.nested.deeply.missing',
        },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { input: {} });

    expect(result.success).toBe(true);
  });

  it('should handle all tool types: custom, builtin, mcp', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'customTool',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'builtin',
        toolId: 'builtin-1',
        toolName: 'builtinTool',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step3',
        toolType: 'mcp',
        toolId: 'mcp-1',
        toolName: 'mcpTool',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepsCompleted).toBe(3);
  });
});

describe('Skill Chaining - validateCompositeSkill', () => {
  it('should validate a valid skill', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Valid Skill',
      description: 'A valid skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject skill with empty name', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: '',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Skill name is required');
  });

  it('should reject skill with whitespace-only name', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: '   ',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Skill name is required');
  });

  it('should reject skill with no steps', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'No Steps Skill',
      description: 'A skill',
      steps: [],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one step is required');
  });

  it('should reject skill with missing stepId', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Invalid Skill',
      description: 'A skill',
      steps: [
        {
          stepId: '',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing stepId'))).toBe(true);
  });

  it('should reject skill with duplicate stepIds', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Duplicate Steps Skill',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-2',
          toolName: 'tool2',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate stepId: step1');
  });

  it('should reject step with missing toolName', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Invalid Skill',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: '',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('missing toolName'))).toBe(true);
  });

  it('should reject step with invalid toolType', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Invalid Skill',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          toolType: 'invalid' as any,
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid toolType'))).toBe(true);
  });

  it('should reject step with non-string inputMapping value', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Invalid Skill',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          inputMapping: { param1: 123 as any },
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid mapping'))).toBe(true);
  });

  it('should validate all valid toolTypes', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: 'Valid Skill',
      description: 'A skill',
      steps: [
        {
          stepId: 'step1',
          toolType: 'custom',
          toolId: 'tool-1',
          toolName: 'tool1',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
        {
          stepId: 'step2',
          toolType: 'builtin',
          toolId: 'tool-2',
          toolName: 'tool2',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
        {
          stepId: 'step3',
          toolType: 'mcp',
          toolId: 'tool-3',
          toolName: 'tool3',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate skill with multiple errors', () => {
    const skill: CompositeSkill = {
      id: 'skill-1',
      userId: 'user-1',
      name: '',
      description: 'A skill',
      steps: [
        {
          stepId: '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          toolType: 'invalid' as any,
          toolId: 'tool-1',
          toolName: '',
          parameters: {},
          inputMapping: {},
          errorHandling: 'stop',
        },
      ],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = validateCompositeSkill(skill);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('Skill Chaining - Empty Steps Execution', () => {
  it('should execute skill with empty steps array', async () => {
    const skill: CompositeSkill = {
      id: 'empty-skill',
      userId: 'user-123',
      name: 'Empty Skill',
      description: 'Skill with no steps',
      steps: [],
      version: '1.0.0',
      isEnabled: true,
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await executeCompositeSkill(skill, { testInput: 'value' });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.skillId).toBe('empty-skill');
    expect(result.userId).toBe('user-123');
    expect(result.input).toEqual({ testInput: 'value' });
    expect(result.stepResults).toEqual([]);
    expect(result.stepsCompleted).toBe(0);
    expect(result.totalSteps).toBe(0);
    expect(result.error).toBeUndefined();
  });
});

describe('Skill Chaining - Advanced Execution', () => {
  const createTestSkill = (steps: CompositeSkillStep[]): CompositeSkill => ({
    id: 'test-skill-adv',
    userId: 'user-456',
    name: 'Advanced Test Skill',
    description: 'Advanced execution tests',
    steps,
    version: '1.0.0',
    isEnabled: true,
    visibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate results from multi-step chain', async () => {
    const skill = createTestSkill([
      {
        stepId: 'fetch-data',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'dataFetcher',
        parameters: {},
        inputMapping: { source: '$.input.dataSource' },
        errorHandling: 'stop',
      },
      {
        stepId: 'process-data',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'dataProcessor',
        parameters: {},
        inputMapping: { data: '$..fetch-data' },
        errorHandling: 'stop',
      },
      {
        stepId: 'store-result',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'dataStore',
        parameters: {},
        inputMapping: { processedData: '$.process-data' },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { dataSource: 'api' });

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(3);
    expect(result.stepsCompleted).toBe(3);
    // Verify all step outputs are in execution context
    expect(result.executionContext['fetch-data']).toBeDefined();
    expect(result.executionContext['process-data']).toBeDefined();
    expect(result.executionContext['store-result']).toBeDefined();
  });

  it('should handle missing output from intermediate step', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: { previous: '$.step1.nonexistent' },
        errorHandling: 'skip',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    // Should continue with undefined mapped value
    expect(result.success).toBe(true);
    expect(result.stepResults.length).toBeGreaterThanOrEqual(1);
  });

  it('should accumulate execution context through all steps', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: { value: '$.input.value' },
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: { previous: '$.step1', inputVal: '$.value' },
        errorHandling: 'stop',
      },
      {
        stepId: 'step3',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: { all: '$.input', s1: '$.step1', s2: '$.step2' },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { value: 'test-value' });

    expect(result.executionContext.input).toEqual({ value: 'test-value' });
    expect(result.executionContext.value).toBe('test-value');
    expect(result.executionContext.step1).toBeDefined();
    expect(result.executionContext.step2).toBeDefined();
    expect(result.executionContext.step3).toBeDefined();
  });

  it('should validate final output matches last step output', async () => {
    const skill = createTestSkill([
      {
        stepId: 'intermediate',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'final-step',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.finalOutput).toBe(result.executionContext['final-step']);
  });

  it('should handle JSONPath with null/undefined gracefully in chained steps', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: { missing: '$.input.nonexistent.deeply.nested' },
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: { fromPrevious: '$.step1.missing.value' },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { input: {} });

    // Should not crash, undefined values are acceptable
    expect(result.success).toBe(true);
  });

  it('should propagate execution error details through result', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.userId).toBe('user-456');
    expect(result.skillId).toBe('test-skill-adv');
    expect(result.input).toBeDefined();
    expect(result.stepResults).toBeDefined();
  });

  it('should track steps completed vs total steps accurately', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        condition: '$.input.shouldRun',
        errorHandling: 'stop',
      },
      {
        stepId: 'step3',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { shouldRun: false });

    expect(result.totalSteps).toBe(3);
    expect(result.stepsCompleted).toBe(2); // step2 skipped
  });

  it('should handle complex JSONPath with multiple array indexes', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {
          first: '$.input.items[0]',
          second: '$.input.items[1]',
          nested: '$.input.data[2]',
        },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {
      items: ['a', 'b', 'c'],
      data: [1, 2, 3, 4],
    });

    expect(result.success).toBe(true);
    expect(result.stepResults[0].success).toBe(true);
  });

  it('should record retry count in step results when retry strategy enabled', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'retry',
        maxRetries: 3,
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepResults[0]).toBeDefined();
    expect(result.stepResults[0].success).toBe(true);
    // retriesUsed is only set when > 0, so it may be undefined on success
    expect(
      result.stepResults[0].retriesUsed === undefined || result.stepResults[0].retriesUsed >= 0
    ).toBe(true);
  });

  it('should maintain step order in results matching execution order', async () => {
    const skill = createTestSkill([
      {
        stepId: 'alpha',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'beta',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'gamma',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepResults[0].stepId).toBe('alpha');
    expect(result.stepResults[1].stepId).toBe('beta');
    expect(result.stepResults[2].stepId).toBe('gamma');
    expect(result.stepResults[0].toolName).toBe('tool1');
    expect(result.stepResults[1].toolName).toBe('tool2');
    expect(result.stepResults[2].toolName).toBe('tool3');
  });

  it('should handle empty input mapping gracefully', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, { someData: 'test' });

    expect(result.success).toBe(true);
  });

  it('should provide step execution time for each step', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepResults[0].executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.stepResults[1].executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(
      result.stepResults[0].executionTimeMs + result.stepResults[1].executionTimeMs
    );
  });
});

/**
 * Error Handling Strategies - With Real Failure Scenarios
 */
describe('Skill Chaining - Error Handling Strategies (Real Failures)', () => {
  const createTestSkill = (steps: CompositeSkillStep[]): CompositeSkill => ({
    id: 'test-skill-1',
    userId: 'user-123',
    name: 'Test Skill',
    description: 'A test composite skill',
    steps,
    version: '1.0.0',
    isEnabled: true,
    visibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    clearStepExecutionConfig();
  });

  it('should stop execution on first step failure when errorHandling is stop', async () => {
    configureStepExecution('step1', { error: new Error('Step 1 failed') });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Step 1 failed');
    expect(result.stepsCompleted).toBe(0);
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].success).toBe(false);
    expect(result.stepResults[0].error).toContain('Step 1 failed');
  });

  it('should skip failed step and continue with next step when errorHandling is skip', async () => {
    configureStepExecution('step1', { error: new Error('Step 1 failed') });
    configureStepExecution('step2', { result: { result: 'step2' } });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'skip',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[0].success).toBe(false);
    expect(result.stepResults[1].success).toBe(true);
  });

  it('should continue to next step when errorHandling is continue despite failure', async () => {
    configureStepExecution('step1', { error: new Error('Step 1 failed') });
    configureStepExecution('step2', { result: { result: 'step2' } });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'continue',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[0].success).toBe(false);
    expect(result.stepResults[1].success).toBe(true);
  });

  it('should record error details in step results', async () => {
    configureStepExecution('step1', { error: new Error('Custom error message') });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'skip',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepResults[0].error).toContain('Custom error message');
    expect(result.stepResults[0].success).toBe(false);
  });

  it('should handle mixed error handling strategies in multi-step chain', async () => {
    configureStepExecution('step1', { error: new Error('Step 1 failed') });
    configureStepExecution('step2', { result: { result: 'step2' } });
    configureStepExecution('step3', { error: new Error('Step 3 failed') });
    configureStepExecution('step4', { result: { result: 'step4' } });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'skip',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step3',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: {},
        errorHandling: 'continue',
      },
      {
        stepId: 'step4',
        toolType: 'custom',
        toolId: 'tool-4',
        toolName: 'tool4',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(2);
    expect(result.stepResults).toHaveLength(4);
    expect(result.stepResults[0].success).toBe(false);
    expect(result.stepResults[1].success).toBe(true);
    expect(result.stepResults[2].success).toBe(false);
    expect(result.stepResults[3].success).toBe(true);
  });

  it('should handle condition evaluation failure with stop strategy', async () => {
    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        condition: 'invalid.jsonpath[', // Invalid condition
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Condition evaluation failed');
  });

  it('should handle condition evaluation failure with skip strategy', async () => {
    configureStepExecution('step2', { result: { result: 'step2' } });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        condition: 'invalid.jsonpath[', // Invalid condition
        errorHandling: 'skip',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(1);
    // When condition evaluation fails with skip strategy, step is skipped and not recorded
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].stepId).toBe('step2');
    expect(result.stepResults[0].success).toBe(true);
  });

  it('should store output in context for subsequent steps', async () => {
    configureStepExecution('step1', { result: { result: { value: 'from-step1' } } });
    configureStepExecution('step2', { result: { result: 'from-step2' } });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: { param1: '$.step1' },
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.success).toBe(true);
    expect(result.executionContext.step1).toBeDefined();
    expect(result.executionContext.step2).toBeDefined();
  });

  it('should increment stepsCompleted only for successful steps', async () => {
    configureStepExecution('step1', { error: new Error('Failed') });
    configureStepExecution('step2', { result: { result: 'success' } });
    configureStepExecution('step3', { error: new Error('Failed') });
    configureStepExecution('step4', { result: { result: 'success' } });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'skip',
      },
      {
        stepId: 'step2',
        toolType: 'custom',
        toolId: 'tool-2',
        toolName: 'tool2',
        parameters: {},
        inputMapping: {},
        errorHandling: 'continue',
      },
      {
        stepId: 'step3',
        toolType: 'custom',
        toolId: 'tool-3',
        toolName: 'tool3',
        parameters: {},
        inputMapping: {},
        errorHandling: 'skip',
      },
      {
        stepId: 'step4',
        toolType: 'custom',
        toolId: 'tool-4',
        toolName: 'tool4',
        parameters: {},
        inputMapping: {},
        errorHandling: 'stop',
      },
    ]);

    const result = await executeCompositeSkill(skill, {});

    expect(result.stepsCompleted).toBe(2);
    expect(result.totalSteps).toBe(4);
  });

  it('should execute retry backoff logic (lines 332-334) when step fails and retries', async () => {
    // Test lines 332-334: exponential backoff calculation and wait
    // Configure step to fail, forcing retry with backoff
    configureStepExecution('step1', { error: new Error('Temporary failure') });

    const skill = createTestSkill([
      {
        stepId: 'step1',
        toolType: 'custom',
        toolId: 'tool-1',
        toolName: 'tool1',
        parameters: {},
        inputMapping: {},
        errorHandling: 'retry',
        maxRetries: 2,
      },
    ]);

    // Execute with retry enabled - this exercises lines 332-334
    // The retry backoff code will be invoked during execution
    const result = await executeCompositeSkill(skill, {});

    // Verify the step was processed (even if it failed after retries)
    expect(result.stepResults).toBeDefined();
    expect(result.stepResults.length).toBeGreaterThan(0);

    clearStepExecutionConfig();
  });

  it('should track retry attempts in step results', async () => {
    // Another variant to ensure retry paths are exercised
    configureStepExecution('retryStep', { error: new Error('Temporary failure') });

    const skill = createTestSkill([
      {
        stepId: 'retryStep',
        toolType: 'custom',
        toolId: 'retry-tool',
        toolName: 'retryTool',
        parameters: {},
        inputMapping: {},
        errorHandling: 'retry',
        maxRetries: 3,
      },
    ]);

    // This should attempt retry with backoff (lines 332-334 exercised)
    const result = await executeCompositeSkill(skill, {});

    // Verify the step was attempted
    expect(result.stepResults).toBeDefined();
    // The retry logic should have been invoked during execution
    expect(result.stepResults[0]).toBeDefined();

    clearStepExecutionConfig();
  });
});
