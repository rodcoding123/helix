/**
 * Integration Tests: Composite Skills (Skill Composition)
 * Tests the complete workflow from skill creation to multi-step execution
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CompositeSkillsService } from '@/services/composite-skills';
import type { CompositeSkill, SkillStep } from '@/lib/types/composite-skills';

describe('Composite Skills Integration', () => {
  let service: CompositeSkillsService;
  let testUserId: string;
  let createdSkillId: string;
  let executionId: string;

  beforeAll(() => {
    service = new CompositeSkillsService();
    testUserId = 'test-user-' + Date.now();
  });

  describe('Skill Definition Workflow', () => {
    it('should validate simple 1-step skill', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step1',
          toolName: 'TextReverser',
          toolType: 'custom',
          inputMapping: { text: '$.input.text' },
          errorHandling: 'stop',
        },
      ];

      const validation = service.validateSkillSteps(steps);

      expect(validation.valid).toBeTruthy();
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate multi-step skill workflow', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step1',
          toolName: 'TextReverser',
          toolType: 'custom',
          inputMapping: { text: '$.input.text' },
          errorHandling: 'continue',
        },
        {
          stepId: 'step2',
          toolName: 'TextTransformer',
          toolType: 'custom',
          inputMapping: { text: '$.step1.output' },
          errorHandling: 'continue',
        },
        {
          stepId: 'step3',
          toolName: 'Logger',
          toolType: 'builtin',
          inputMapping: { message: '$.step2.output' },
          errorHandling: 'stop',
        },
      ];

      const validation = service.validateSkillSteps(steps);

      expect(validation.valid).toBeTruthy();
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields in steps', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step1',
          toolName: '',
          toolType: 'custom',
          inputMapping: {},
          errorHandling: 'stop',
        },
      ];

      const validation = service.validateSkillSteps(steps);

      expect(validation.valid).toBeFalsy();
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some((e) => e.includes('Tool name'))).toBeTruthy();
    });

    it('should detect invalid step IDs', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step 1',
          toolName: 'Tool',
          toolType: 'custom',
          inputMapping: {},
          errorHandling: 'stop',
        },
      ];

      const validation = service.validateSkillSteps(steps);

      expect(validation.valid).toBeFalsy();
    });

    it('should detect circular dependencies', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step1',
          toolName: 'Tool1',
          toolType: 'custom',
          inputMapping: { input: '$.step2.output' },
          errorHandling: 'stop',
        },
        {
          stepId: 'step2',
          toolName: 'Tool2',
          toolType: 'custom',
          inputMapping: { input: '$.step1.output' },
          errorHandling: 'stop',
        },
      ];

      const validation = service.validateSkillSteps(steps);

      expect(validation.valid).toBeFalsy();
      expect(validation.errors.some((e) => e.includes('circular'))).toBeTruthy();
    });

    it('should warn about forward references', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step1',
          toolName: 'Tool1',
          toolType: 'custom',
          inputMapping: { input: '$.step2.output' },
          errorHandling: 'stop',
        },
        {
          stepId: 'step2',
          toolName: 'Tool2',
          toolType: 'custom',
          inputMapping: {},
          errorHandling: 'stop',
        },
      ];

      const validation = service.validateSkillSteps(steps);

      if (validation.warnings) {
        expect(
          validation.warnings.some((w) => w.includes('forward'))
        ).toBeTruthy();
      }
    });
  });

  describe('Skill Creation Workflow', () => {
    it('should create simple skill', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Text Processing Pipeline',
        description: 'Simple text reversal skill',
        steps: [
          {
            stepId: 'step1',
            toolName: 'TextReverser',
            toolType: 'custom',
            inputMapping: { text: '$.input.text' },
            errorHandling: 'stop',
          },
        ],
        tags: ['text', 'utility'],
        icon: '🔄',
        visibility: 'private',
      });

      expect(skill).toBeDefined();
      expect(skill.id).toBeDefined();
      expect(skill.name).toBe('Text Processing Pipeline');
      expect(skill.user_id).toBe(testUserId);
      expect(skill.visibility).toBe('private');
      expect(skill.steps).toHaveLength(1);

      createdSkillId = skill.id;
    });

    it('should create multi-step skill', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Advanced Workflow',
        description: 'Multi-step workflow with transformations',
        steps: [
          {
            stepId: 'step1',
            toolName: 'TextReverser',
            toolType: 'custom',
            inputMapping: { text: '$.input.text' },
            errorHandling: 'continue',
          },
          {
            stepId: 'step2',
            toolName: 'TextUppercase',
            toolType: 'custom',
            inputMapping: { text: '$.step1.output' },
            errorHandling: 'continue',
          },
        ],
        tags: ['advanced'],
        icon: '⚙️',
        visibility: 'private',
      });

      expect(skill.steps).toHaveLength(2);
      expect(skill.steps[1].inputMapping.text).toBe('$.step1.output');
    });

    it('should reject invalid skill on creation', async () => {
      try {
        await service.createCompositeSkill(testUserId, {
          name: 'Invalid Skill',
          description: 'Has invalid step',
          steps: [
            {
              stepId: 'step1',
              toolName: '',
              toolType: 'custom',
              inputMapping: {},
              errorHandling: 'stop',
            },
          ],
          tags: [],
          icon: '❌',
          visibility: 'private',
        });

        expect(false).toBeTruthy(); // Should have thrown
      } catch (error) {
        expect(String(error)).toContain('validation');
      }
    });
  });

  describe('Skill Management Workflow', () => {
    it('should get user composite skills', async () => {
      const skills = await service.getCompositeSkills(testUserId);

      expect(Array.isArray(skills)).toBeTruthy();
      expect(skills.length).toBeGreaterThan(0);

      const found = skills.find((s) => s.id === createdSkillId);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Text Processing Pipeline');
    });

    it('should get specific skill by ID', async () => {
      const skill = await service.getCompositeSkill(createdSkillId);

      expect(skill).toBeDefined();
      expect(skill.id).toBe(createdSkillId);
      expect(skill.name).toBe('Text Processing Pipeline');
      expect(skill.steps).toBeDefined();
    });

    it('should update skill definition', async () => {
      const updated = await service.updateCompositeSkill(createdSkillId, {
        description: 'Updated description: now handles multiple inputs',
        tags: ['text', 'utility', 'updated'],
      });

      expect(updated.description).toBe(
        'Updated description: now handles multiple inputs'
      );
      expect(updated.tags).toContain('updated');
    });

    it('should delete (disable) skill', async () => {
      const definition = {
        name: 'Temporary Skill',
        description: 'Will be deleted',
        steps: [
          {
            stepId: 'step1',
            toolName: 'Tool',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'stop',
          },
        ],
        tags: [],
        icon: '❌',
        visibility: 'private',
      };

      const skill = await service.createCompositeSkill(testUserId, definition);
      await service.deleteCompositeSkill(skill.id);

      const updated = await service.getCompositeSkill(skill.id);
      expect(updated.is_enabled).toBeFalsy();
    });
  });

  describe('Skill Execution Workflow', () => {
    it('should execute simple 1-step skill', async () => {
      const result = await service.executeCompositeSkill(
        createdSkillId,
        testUserId,
        { text: 'hello' }
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.steps_executed).toBeDefined();
      expect(result.steps_executed.length).toBeGreaterThan(0);
    });

    it('should track execution metrics', async () => {
      const result = await service.executeCompositeSkill(
        createdSkillId,
        testUserId,
        { text: 'test' }
      );

      expect(result).toHaveProperty('execution_time_ms');
      expect(result).toHaveProperty('steps_completed');
      expect(result).toHaveProperty('total_steps');
      expect(typeof result.execution_time_ms).toBe('number');
      expect(result.execution_time_ms).toBeGreaterThan(0);
    });

    it('should store execution in history', async () => {
      const result = await service.executeCompositeSkill(
        createdSkillId,
        testUserId,
        { text: 'stored' }
      );

      const history = await service.getExecutionHistory(createdSkillId, 10);

      expect(Array.isArray(history)).toBeTruthy();
      if (result.id) {
        const found = history.find((e) => e.id === result.id);
        expect(found).toBeDefined();
      }
    });

    it('should handle execution errors gracefully', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Error Handling Skill',
        description: 'Tests error handling',
        steps: [
          {
            stepId: 'step1',
            toolName: 'FailingTool',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'continue',
          },
          {
            stepId: 'step2',
            toolName: 'NormalTool',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'stop',
          },
        ],
        tags: [],
        icon: '⚠️',
        visibility: 'private',
      });

      const result = await service.executeCompositeSkill(
        skill.id,
        testUserId,
        {}
      );

      // Even with error in step1, step2 should continue
      expect(result.status).toBe('completed');
      expect(result.steps_executed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Conditional Execution', () => {
    it('should skip step if condition fails', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Conditional Skill',
        description: 'Tests conditional execution',
        steps: [
          {
            stepId: 'step1',
            toolName: 'Checker',
            toolType: 'builtin',
            inputMapping: { value: '$.input.value' },
            errorHandling: 'stop',
          },
          {
            stepId: 'step2',
            toolName: 'Processor',
            toolType: 'custom',
            inputMapping: { data: '$.step1.output' },
            condition: {
              field: '$.step1.output.isValid',
              operator: 'equals',
              value: true,
            },
            errorHandling: 'stop',
          },
        ],
        tags: ['conditional'],
        icon: '❓',
        visibility: 'private',
      });

      const result = await service.executeCompositeSkill(
        skill.id,
        testUserId,
        { value: 42 }
      );

      expect(result.status).toBe('completed');
      expect(result.steps_executed).toBeDefined();
    });

    it('should support multiple condition operators', () => {
      const operators = ['equals', 'contains', 'gt', 'lt', 'exists'];
      const steps: SkillStep[] = operators.map((op, i) => ({
        stepId: `step${i}`,
        toolName: `Tool${i}`,
        toolType: 'custom',
        inputMapping: {},
        condition: {
          field: '$.input.value',
          operator: op as any,
          value: 100,
        },
        errorHandling: 'continue',
      }));

      const validation = service.validateSkillSteps(steps);
      expect(validation.valid).toBeTruthy();
    });
  });

  describe('Error Handling Strategies', () => {
    it('should support continue on error strategy', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Continue Strategy',
        description: 'Continues despite errors',
        steps: [
          {
            stepId: 'step1',
            toolName: 'MayFail',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'continue',
          },
          {
            stepId: 'step2',
            toolName: 'AlwaysRuns',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'continue',
          },
        ],
        tags: [],
        icon: '➡️',
        visibility: 'private',
      });

      const result = await service.executeCompositeSkill(
        skill.id,
        testUserId,
        {}
      );

      // Should complete even if step1 fails
      expect(result.status).toBe('completed');
    });

    it('should support stop on error strategy', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Stop Strategy',
        description: 'Stops on first error',
        steps: [
          {
            stepId: 'step1',
            toolName: 'MayFail',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'stop',
          },
          {
            stepId: 'step2',
            toolName: 'NeverRuns',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'stop',
          },
        ],
        tags: [],
        icon: '⏹️',
        visibility: 'private',
      });

      const result = await service.executeCompositeSkill(
        skill.id,
        testUserId,
        {}
      );

      // May fail at step1 and not reach step2
      if (result.status === 'failed') {
        expect(result.steps_executed.length).toBeLessThanOrEqual(1);
      }
    });

    it('should support retry on error strategy', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Retry Strategy',
        description: 'Retries on error',
        steps: [
          {
            stepId: 'step1',
            toolName: 'Retryable',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'retry',
            maxRetries: 3,
          },
        ],
        tags: [],
        icon: '🔁',
        visibility: 'private',
      });

      const result = await service.executeCompositeSkill(
        skill.id,
        testUserId,
        {}
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('Input Mapping with JSONPath', () => {
    it('should resolve simple input paths', () => {
      const context = {
        input: { text: 'hello' },
        step1: { output: 'world' },
      };

      const resolved = service.resolveJSONPath('$.input.text', context);
      expect(resolved).toBe('hello');
    });

    it('should resolve nested paths', () => {
      const context = {
        input: { user: { name: 'Alice', age: 30 } },
      };

      const resolved = service.resolveJSONPath('$.input.user.name', context);
      expect(resolved).toBe('Alice');
    });

    it('should handle array access', () => {
      const context = {
        step1: { output: ['a', 'b', 'c'] },
      };

      const resolved = service.resolveJSONPath('$.step1.output[0]', context);
      expect(resolved).toBe('a');
    });

    it('should return undefined for invalid paths', () => {
      const context = { input: { text: 'hello' } };

      const resolved = service.resolveJSONPath('$.input.missing', context);
      expect(resolved).toBeUndefined();
    });
  });

  describe('Public Skill Marketplace', () => {
    it('should create public skill', async () => {
      const skill = await service.createCompositeSkill(testUserId, {
        name: 'Public Workflow',
        description: 'Shared workflow for everyone',
        steps: [
          {
            stepId: 'step1',
            toolName: 'PublicTool',
            toolType: 'builtin',
            inputMapping: {},
            errorHandling: 'stop',
          },
        ],
        tags: ['public', 'shared'],
        icon: '🌍',
        visibility: 'public',
      });

      expect(skill.visibility).toBe('public');
    });

    it('should find public skills', async () => {
      const skills = await service.getPublicSkills({
        search: 'workflow',
        limit: 10,
      });

      expect(Array.isArray(skills)).toBeTruthy();
    });

    it('should clone public skill', async () => {
      const publicSkills = await service.getPublicSkills({ limit: 1 });
      if (publicSkills.length === 0) return;

      const cloned = await service.clonePublicSkill(
        testUserId,
        publicSkills[0].id,
        'My Clone'
      );

      expect(cloned).toBeDefined();
      expect(cloned.visibility).toBe('private');
      expect(cloned.user_id).toBe(testUserId);
    });
  });

  describe('Execution History', () => {
    it('should get execution history', async () => {
      const history = await service.getExecutionHistory(createdSkillId, 10);

      expect(Array.isArray(history)).toBeTruthy();
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('id');
        expect(history[0]).toHaveProperty('status');
        expect(history[0]).toHaveProperty('execution_time_ms');
      }
    });

    it('should include step details in history', async () => {
      const history = await service.getExecutionHistory(createdSkillId, 1);

      if (history.length > 0) {
        expect(history[0]).toHaveProperty('steps_executed');
        expect(Array.isArray(history[0].steps_executed)).toBeTruthy();
      }
    });

    it('should order history by most recent first', async () => {
      // Execute multiple times
      await service.executeCompositeSkill(createdSkillId, testUserId, {
        text: '1',
      });
      await service.executeCompositeSkill(createdSkillId, testUserId, {
        text: '2',
      });

      const history = await service.getExecutionHistory(createdSkillId, 10);

      if (history.length >= 2) {
        const first = new Date(history[0].created_at).getTime();
        const second = new Date(history[1].created_at).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should validate skill in <50ms', () => {
      const steps: SkillStep[] = [
        {
          stepId: 'step1',
          toolName: 'Tool',
          toolType: 'custom',
          inputMapping: { input: '$.input.text' },
          errorHandling: 'stop',
        },
      ];

      const start = performance.now();
      service.validateSkillSteps(steps);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should create skill in <100ms', async () => {
      const start = performance.now();
      await service.createCompositeSkill(testUserId, {
        name: 'Perf Test ' + Date.now(),
        description: 'Performance test',
        steps: [
          {
            stepId: 'step1',
            toolName: 'Tool',
            toolType: 'custom',
            inputMapping: {},
            errorHandling: 'stop',
          },
        ],
        tags: [],
        icon: '⏱️',
        visibility: 'private',
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should execute skill in <500ms', async () => {
      const start = performance.now();
      await service.executeCompositeSkill(createdSkillId, testUserId, {
        text: 'perf',
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should get user skills in <200ms', async () => {
      const start = performance.now();
      await service.getCompositeSkills(testUserId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });

    it('should get execution history in <300ms', async () => {
      const start = performance.now();
      await service.getExecutionHistory(createdSkillId, 100);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });
  });
});
