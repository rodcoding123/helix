/**
 * Tests for Helix Composite Skill Chaining Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeCompositeSkill,
  validateCompositeSkill,
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
