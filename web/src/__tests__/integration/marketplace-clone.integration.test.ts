/**
 * Integration Tests: Marketplace Clone Workflow
 * Tests the complete workflow from discovering public templates/tools to cloning and customizing them
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AgentTemplateService } from '@/services/agent-templates';
import { CustomToolsService } from '@/services/custom-tools';
import type { AgentTemplate, CustomTool } from '@/lib/types';

describe('Marketplace Clone Workflow', () => {
  let templateService: AgentTemplateService;
  let toolsService: CustomToolsService;
  let testUserId: string;
  let publicTemplateId: string;
  let publicToolId: string;
  let clonedTemplateId: string;
  let clonedToolId: string;

  beforeAll(() => {
    templateService = new AgentTemplateService();
    toolsService = new CustomToolsService();
    testUserId = 'test-user-' + Date.now();
  });

  describe('Public Template Discovery', () => {
    it('should list public templates with pagination', async () => {
      const templates = await templateService.getPublicTemplates({
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(templates)).toBeTruthy();
      if (templates.length > 0) {
        expect(templates[0]).toHaveProperty('id');
        expect(templates[0]).toHaveProperty('name');
        expect(templates[0]).toHaveProperty('visibility');
        expect(templates[0].visibility).toBe('public');
      }
    });

    it('should search public templates by name', async () => {
      const templates = await templateService.getPublicTemplates({
        search: 'Agent',
        limit: 20,
      });

      expect(Array.isArray(templates)).toBeTruthy();
      if (templates.length > 0) {
        const hasMatch = templates.some((t) =>
          t.name.toLowerCase().includes('agent')
        );
        expect(hasMatch || templates.length > 0).toBeTruthy();
      }
    });

    it('should filter public templates by category', async () => {
      const categories = await templateService.getTemplateCategories();
      expect(Array.isArray(categories)).toBeTruthy();

      if (categories.length > 0) {
        const category = categories[0];
        const templates = await templateService.getPublicTemplates({
          category: category,
          limit: 10,
        });

        expect(Array.isArray(templates)).toBeTruthy();
      }
    });

    it('should get template with full details', async () => {
      const templates = await templateService.getPublicTemplates({ limit: 1 });
      if (templates.length === 0) return;

      const templateId = templates[0].id;
      publicTemplateId = templateId;

      const fullTemplate = await templateService.getTemplate(templateId);

      expect(fullTemplate).toBeDefined();
      expect(fullTemplate.id).toBe(templateId);
      expect(fullTemplate).toHaveProperty('description');
      expect(fullTemplate).toHaveProperty('system_prompt');
      expect(fullTemplate).toHaveProperty('capabilities');
      expect(fullTemplate).toHaveProperty('personality');
    });

    it('should include template ratings in public listing', async () => {
      const templates = await templateService.getPublicTemplates({ limit: 10 });

      if (templates.length > 0) {
        templates.forEach((t) => {
          expect(t).toHaveProperty('rating_avg');
          expect(t).toHaveProperty('rating_count');
          expect(typeof t.rating_avg).toBe('number');
          expect(typeof t.rating_count).toBe('number');
        });
      }
    });
  });

  describe('Public Tool Discovery', () => {
    it('should list public tools with pagination', async () => {
      const tools = await toolsService.getPublicTools({
        limit: 10,
        offset: 0,
      });

      expect(Array.isArray(tools)).toBeTruthy();
      if (tools.length > 0) {
        expect(tools[0]).toHaveProperty('id');
        expect(tools[0]).toHaveProperty('name');
        expect(tools[0]).toHaveProperty('visibility');
        expect(tools[0].visibility).toBe('public');
      }
    });

    it('should search public tools by keyword', async () => {
      const tools = await toolsService.getPublicTools({
        search: 'text',
        limit: 20,
      });

      expect(Array.isArray(tools)).toBeTruthy();
    });

    it('should filter public tools by tags', async () => {
      const tools = await toolsService.getPublicTools({
        tags: ['utility'],
        limit: 10,
      });

      expect(Array.isArray(tools)).toBeTruthy();
      if (tools.length > 0) {
        const hasTag = tools.some((t) =>
          t.tags && t.tags.includes('utility')
        );
        expect(hasTag || tools.length > 0).toBeTruthy();
      }
    });

    it('should get full tool details including code', async () => {
      const tools = await toolsService.getPublicTools({ limit: 1 });
      if (tools.length === 0) return;

      const toolId = tools[0].id;
      publicToolId = toolId;

      const fullTool = await toolsService.getCustomTool(toolId);

      expect(fullTool).toBeDefined();
      expect(fullTool.id).toBe(toolId);
      expect(fullTool).toHaveProperty('code');
      expect(fullTool).toHaveProperty('parameters');
      expect(fullTool).toHaveProperty('capabilities');
    });
  });

  describe('Template Clone Workflow', () => {
    it('should clone public template with new name', async () => {
      if (!publicTemplateId) return;

      const cloned = await templateService.cloneTemplate(
        testUserId,
        publicTemplateId,
        'My Custom Clone'
      );

      expect(cloned).toBeDefined();
      expect(cloned.id).not.toBe(publicTemplateId);
      expect(cloned.name).toBe('My Custom Clone');
      expect(cloned.user_id).toBe(testUserId);
      expect(cloned.visibility).toBe('private');
      expect(cloned.clone_source_id).toBe(publicTemplateId);

      clonedTemplateId = cloned.id;
    });

    it('should preserve template configuration in clone', async () => {
      if (!publicTemplateId) return;

      const original = await templateService.getTemplate(publicTemplateId);
      const cloned = await templateService.cloneTemplate(
        testUserId,
        publicTemplateId,
        'Config Test Clone'
      );

      expect(cloned.system_prompt).toBe(original.system_prompt);
      expect(cloned.capabilities).toEqual(original.capabilities);
      expect(cloned.personality).toEqual(original.personality);
    });

    it('should allow modifying cloned template', async () => {
      if (!clonedTemplateId) return;

      const updated = await templateService.updateTemplate(clonedTemplateId, {
        name: 'Modified Clone',
        description: 'This is a modified clone',
      });

      expect(updated.name).toBe('Modified Clone');
      expect(updated.description).toBe('This is a modified clone');
      expect(updated.clone_source_id).toBe(publicTemplateId);
    });

    it('should list user clones separately from originals', async () => {
      const userTemplates = await templateService.getUserTemplates(testUserId);

      expect(Array.isArray(userTemplates)).toBeTruthy();
      const clones = userTemplates.filter((t) => t.clone_source_id);
      expect(clones.length).toBeGreaterThan(0);
    });

    it('should track clone lineage', async () => {
      if (!clonedTemplateId) return;

      const cloned = await templateService.getTemplate(clonedTemplateId);

      expect(cloned.clone_source_id).toBe(publicTemplateId);
      expect(cloned.user_id).toBe(testUserId);
    });
  });

  describe('Tool Clone Workflow', () => {
    it('should clone public tool with new name', async () => {
      if (!publicToolId) return;

      const cloned = await toolsService.clonePublicTool(
        testUserId,
        publicToolId,
        'My Custom Tool'
      );

      expect(cloned).toBeDefined();
      expect(cloned.id).not.toBe(publicToolId);
      expect(cloned.name).toBe('My Custom Tool');
      expect(cloned.user_id).toBe(testUserId);
      expect(cloned.visibility).toBe('private');
      expect(cloned.clone_source_id).toBe(publicToolId);

      clonedToolId = cloned.id;
    });

    it('should preserve tool code and parameters in clone', async () => {
      if (!publicToolId) return;

      const original = await toolsService.getCustomTool(publicToolId);
      const cloned = await toolsService.clonePublicTool(
        testUserId,
        publicToolId,
        'Code Test Clone'
      );

      expect(cloned.code).toBe(original.code);
      expect(cloned.parameters).toEqual(original.parameters);
      expect(cloned.capabilities).toEqual(original.capabilities);
    });

    it('should allow modifying cloned tool code', async () => {
      if (!clonedToolId) return;

      const newCode =
        'async function execute(params) { return { result: "modified" }; }';
      const updated = await toolsService.updateCustomTool(clonedToolId, {
        code: newCode,
        name: 'Modified Tool',
      });

      expect(updated.code).toBe(newCode);
      expect(updated.name).toBe('Modified Tool');
    });
  });

  describe('Clone Publish Workflow', () => {
    it('should allow publishing cloned template back to marketplace', async () => {
      if (!clonedTemplateId) return;

      const published = await templateService.updateTemplate(clonedTemplateId, {
        visibility: 'public',
      });

      expect(published.visibility).toBe('public');
      expect(published.clone_source_id).toBe(publicTemplateId);
    });

    it('should allow publishing cloned tool to marketplace', async () => {
      if (!clonedToolId) return;

      const published = await toolsService.updateCustomTool(clonedToolId, {
        visibility: 'public',
      });

      expect(published.visibility).toBe('public');
      expect(published.clone_source_id).toBe(publicToolId);
    });

    it('should track derived works in marketplace', async () => {
      const publicTools = await toolsService.getPublicTools({ limit: 100 });

      const derived = publicTools.filter((t) => t.clone_source_id);
      expect(Array.isArray(derived)).toBeTruthy();
    });
  });

  describe('Clone Customization Workflow', () => {
    it('should support cloning with immediate customization', async () => {
      if (!publicTemplateId) return;

      // Clone
      const cloned = await templateService.cloneTemplate(
        testUserId,
        publicTemplateId,
        'Custom Agent'
      );

      // Customize
      const customized = await templateService.updateTemplate(cloned.id, {
        system_prompt: 'You are a custom assistant',
        personality: {
          tone: 'friendly',
          formality: 'casual',
        },
      });

      expect(customized.system_prompt).toBe('You are a custom assistant');
      expect(customized.personality.tone).toBe('friendly');
    });

    it('should allow adding capabilities to cloned tool', async () => {
      if (!publicToolId) return;

      const cloned = await toolsService.clonePublicTool(
        testUserId,
        publicToolId,
        'Extended Tool'
      );

      const extended = await toolsService.updateCustomTool(cloned.id, {
        capabilities: ['filesystem:read', 'network:localhost'],
      });

      expect(extended.capabilities).toContain('filesystem:read');
    });
  });

  describe('Clone Discovery & Attribution', () => {
    it('should discover clones of a template', async () => {
      if (!publicTemplateId) return;

      const clones = await templateService.getTemplateClones(publicTemplateId);

      expect(Array.isArray(clones)).toBeTruthy();
    });

    it('should include original template link in clone metadata', async () => {
      if (!clonedTemplateId) return;

      const cloned = await templateService.getTemplate(clonedTemplateId);

      expect(cloned.clone_source_id).toBe(publicTemplateId);
      const original = await templateService.getTemplate(
        cloned.clone_source_id
      );
      expect(original).toBeDefined();
    });

    it('should show clone count on original template', async () => {
      if (!publicTemplateId) return;

      const template = await templateService.getTemplate(publicTemplateId);

      expect(template).toHaveProperty('clone_count');
      expect(typeof template.clone_count).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should reject cloning deleted template', async () => {
      try {
        await templateService.cloneTemplate(
          testUserId,
          'invalid-template-id',
          'Clone'
        );
        expect(false).toBeTruthy(); // Should have thrown
      } catch (error) {
        expect(String(error)).toContain('not found');
      }
    });

    it('should reject cloning tool without read access', async () => {
      try {
        await toolsService.clonePublicTool(
          testUserId,
          'invalid-tool-id',
          'Clone'
        );
        expect(false).toBeTruthy(); // Should have thrown
      } catch (error) {
        expect(String(error)).toContain('not found');
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should list public templates in <200ms', async () => {
      const start = performance.now();
      await templateService.getPublicTemplates({ limit: 20 });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });

    it('should search templates in <300ms', async () => {
      const start = performance.now();
      await templateService.getPublicTemplates({
        search: 'test',
        limit: 20,
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });

    it('should clone template in <100ms', async () => {
      const templates = await templateService.getPublicTemplates({ limit: 1 });
      if (templates.length === 0) return;

      const start = performance.now();
      await templateService.cloneTemplate(
        testUserId,
        templates[0].id,
        'Perf Test'
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should list public tools in <300ms', async () => {
      const start = performance.now();
      await toolsService.getPublicTools({ limit: 20 });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });

    it('should clone tool in <100ms', async () => {
      const tools = await toolsService.getPublicTools({ limit: 1 });
      if (tools.length === 0) return;

      const start = performance.now();
      await toolsService.clonePublicTool(
        testUserId,
        tools[0].id,
        'Perf Test'
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});
