/**
 * Integration Tests: Custom Tools
 * Tests the complete workflow from tool creation to execution
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CustomToolsService } from '@/services/custom-tools';
import type { CustomToolDefinition } from '@/lib/types/custom-tools';

describe('Custom Tools Integration', () => {
  let service: CustomToolsService;
  let testUserId: string;
  let createdToolId: string;

  beforeAll(() => {
    service = new CustomToolsService();
    testUserId = 'test-user-' + Date.now();
  });

  describe('Tool Creation Workflow', () => {
    it('should validate tool code before creation', () => {
      const validCode = 'async function execute(params) { return { result: params.input }; }';
      const validation = service.validateToolCode(validCode, ['mcp:tools']);

      expect(validation.valid).toBeTruthy();
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject dangerous code patterns', () => {
      const dangerousCode = 'async function execute(params) { eval(params.code); }';
      const validation = service.validateToolCode(dangerousCode, []);

      expect(validation.valid).toBeFalsy();
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.detectedDangerousFunctions).toContain('eval');
    });

    it('should warn about high-risk capabilities', () => {
      const code = 'async function execute(params) { return params; }';
      const validation = service.validateToolCode(code, ['filesystem:write', 'network:outbound']);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should create valid custom tool', async () => {
      const definition: CustomToolDefinition = {
        name: 'Text Reverser',
        description: 'Reverses input text',
        code: 'async function execute(params) { return { result: params.text.split("").reverse().join("") }; }',
        parameters: [
          { name: 'text', type: 'string', description: 'Text to reverse', required: true },
        ],
        capabilities: ['mcp:tools'],
        sandbox_profile: 'standard',
        tags: ['text', 'utility'],
        icon: '↩️',
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool).toBeDefined();
      expect(tool.id).toBeDefined();
      expect(tool.name).toBe('Text Reverser');
      expect(tool.user_id).toBe(testUserId);
      expect(tool.visibility).toBe('private');

      createdToolId = tool.id;
    });
  });

  describe('Tool Management Workflow', () => {
    it('should get user custom tools', async () => {
      const tools = await service.getCustomTools(testUserId);

      expect(Array.isArray(tools)).toBeTruthy();
      expect(tools.length).toBeGreaterThan(0);

      // Should include the tool we created
      const found = tools.find((t) => t.id === createdToolId);
      expect(found).toBeDefined();
    });

    it('should get specific tool by ID', async () => {
      const tool = await service.getCustomTool(createdToolId);

      expect(tool).toBeDefined();
      expect(tool.id).toBe(createdToolId);
      expect(tool.name).toBe('Text Reverser');
    });

    it('should update tool definition', async () => {
      const updated = await service.updateCustomTool(createdToolId, {
        description: 'Updated description: reverses text strings',
        icon: '🔄',
      });

      expect(updated.description).toBe('Updated description: reverses text strings');
      expect(updated.icon).toBe('🔄');
    });

    it('should delete (soft) tool', async () => {
      // Create a temporary tool to delete
      const definition: CustomToolDefinition = {
        name: 'Temporary Tool',
        description: 'Will be deleted',
        code: 'async function execute(params) { return {}; }',
        parameters: [],
        capabilities: [],
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);
      await service.deleteCustomTool(tool.id);

      // Should be disabled, not removed
      const updated = await service.getCustomTool(tool.id);
      expect(updated.is_enabled).toBeFalsy();
    });
  });

  describe('Tool Capability Management', () => {
    it('should create tool with filesystem read capability', async () => {
      const definition: CustomToolDefinition = {
        name: 'File Reader',
        description: 'Reads file contents',
        code: 'async function execute(params) { return { content: "file content" }; }',
        parameters: [{ name: 'path', type: 'string', description: 'File path', required: true }],
        capabilities: ['filesystem:read'],
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool.capabilities).toContain('filesystem:read');
      expect(tool.sandbox_profile).toBe('standard');
    });

    it('should reject process spawn capability for user tools', () => {
      const code = 'async function execute(params) { return {}; }';
      const validation = service.validateToolCode(code, ['process:spawn']);

      expect(validation.valid).toBeFalsy();
      expect(validation.errors.some((e) => e.includes('Process spawning'))).toBeTruthy();
    });
  });

  describe('Sandbox Profile Management', () => {
    it('should create tool with strict sandbox', async () => {
      const definition: CustomToolDefinition = {
        name: 'Strict Tool',
        description: 'Runs in strict sandbox',
        code: 'async function execute(params) { return params; }',
        parameters: [],
        capabilities: [],
        sandbox_profile: 'strict',
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool.sandbox_profile).toBe('strict');
    });

    it('should create tool with standard sandbox', async () => {
      const definition: CustomToolDefinition = {
        name: 'Standard Tool',
        description: 'Runs in standard sandbox',
        code: 'async function execute(params) { return params; }',
        parameters: [],
        capabilities: ['filesystem:read', 'network:localhost'],
        sandbox_profile: 'standard',
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool.sandbox_profile).toBe('standard');
    });

    it('should create tool with permissive sandbox', async () => {
      const definition: CustomToolDefinition = {
        name: 'Permissive Tool',
        description: 'Runs in permissive sandbox',
        code: 'async function execute(params) { return params; }',
        parameters: [],
        capabilities: ['filesystem:write', 'network:outbound'],
        sandbox_profile: 'permissive',
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool.sandbox_profile).toBe('permissive');
    });
  });

  describe('Public Tool Marketplace', () => {
    it('should create public tool', async () => {
      const definition: CustomToolDefinition = {
        name: 'Public JSON Parser',
        description: 'Parses JSON strings',
        code: 'async function execute(params) { return JSON.parse(params.json); }',
        parameters: [{ name: 'json', type: 'string', description: 'JSON string', required: true }],
        capabilities: [],
        visibility: 'public',
        tags: ['json', 'parser', 'utility'],
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool.visibility).toBe('public');
      expect(tool.tags).toContain('json');
    });

    it('should find public tools', async () => {
      const publicTools = await service.getPublicTools({
        search: 'JSON',
        limit: 10,
      });

      expect(Array.isArray(publicTools)).toBeTruthy();
    });

    it('should clone public tool', async () => {
      const publicTools = await service.getPublicTools({ limit: 1 });
      if (publicTools.length === 0) return;

      const sourceToolId = publicTools[0].id;
      const cloned = await service.clonePublicTool(testUserId, sourceToolId, 'My Clone');

      expect(cloned).toBeDefined();
      expect(cloned.visibility).toBe('private');
      expect(cloned.name).toBe('My Clone');
      expect(cloned.clone_source_id).toBe(sourceToolId);
      expect(cloned.user_id).toBe(testUserId);
    });
  });

  describe('Tool Usage Tracking', () => {
    it('should log tool usage', async () => {
      await service.logToolUsage(
        createdToolId,
        testUserId,
        { text: 'hello' },
        { result: 'olleh' },
        'success',
        150,
        undefined
      );

      // Tool should have usage recorded
      const tool = await service.getCustomTool(createdToolId);
      expect(tool.usage_count).toBeGreaterThan(0);
      expect(tool.last_used).toBeDefined();
    });

    it('should get tool usage history', async () => {
      const history = await service.getToolUsageHistory(createdToolId, 10);

      expect(Array.isArray(history)).toBeTruthy();
      if (history.length > 0) {
        expect(history[0]).toHaveProperty('execution_time_ms');
        expect(history[0]).toHaveProperty('status');
      }
    });
  });

  describe('Parameter Validation', () => {
    it('should create tool with multiple parameter types', async () => {
      const definition: CustomToolDefinition = {
        name: 'Multi-Param Tool',
        description: 'Tests different parameter types',
        code: 'async function execute(params) { return params; }',
        parameters: [
          { name: 'text', type: 'string', description: 'A string', required: true },
          { name: 'count', type: 'number', description: 'A number', required: false },
          { name: 'enabled', type: 'boolean', description: 'A boolean', required: false },
          { name: 'data', type: 'object', description: 'An object', required: false },
          { name: 'items', type: 'array', description: 'An array', required: false },
        ],
        capabilities: [],
        visibility: 'private',
      };

      const tool = await service.createCustomTool(testUserId, definition);

      expect(tool.parameters.properties).toHaveProperty('text');
      expect(tool.parameters.properties).toHaveProperty('count');
      expect(tool.parameters.properties).toHaveProperty('enabled');
      expect(tool.parameters.properties).toHaveProperty('data');
      expect(tool.parameters.properties).toHaveProperty('items');
      expect(tool.parameters.required).toContain('text');
      expect(tool.parameters.required).not.toContain('count');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid code on creation', async () => {
      const definition: CustomToolDefinition = {
        name: 'Invalid Tool',
        description: 'Has eval',
        code: 'async function execute(params) { eval(params); }',
        parameters: [],
        capabilities: [],
        visibility: 'private',
      };

      try {
        await service.createCustomTool(testUserId, definition);
        expect(false).toBeTruthy(); // Should have thrown
      } catch (error) {
        expect(String(error)).toContain('validation failed');
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should get all user tools in <500ms', async () => {
      const start = performance.now();
      await service.getCustomTools(testUserId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should search public tools in <1000ms', async () => {
      const start = performance.now();
      await service.getPublicTools({ search: 'Tool', limit: 20 });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
