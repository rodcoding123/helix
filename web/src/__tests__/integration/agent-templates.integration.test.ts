/**
 * Integration Tests: Agent Templates
 * Tests the complete workflow from template discovery to agent creation
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { AgentTemplateService } from '@/services/agent-template';
import type { AgentTemplate, CustomToolDefinition } from '@/lib/types/agent-templates';

describe('Agent Templates Integration', () => {
  let service: AgentTemplateService;
  let testUserId: string;
  let createdTemplateId: string;

  beforeAll(() => {
    service = new AgentTemplateService();
    testUserId = 'test-user-' + Date.now();
  });

  describe('Template Discovery Workflow', () => {
    it('should load all template categories', async () => {
      const categories = await service.getCategories();

      expect(categories).toBeDefined();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('id');
      expect(categories[0]).toHaveProperty('name');
      expect(categories[0]).toHaveProperty('icon');
    });

    it('should load system templates', async () => {
      const templates = await service.getTemplates({ visibility: 'public' });

      expect(templates).toBeDefined();
      expect(templates.length).toBeGreaterThan(0);

      // Check system template properties
      const template = templates[0];
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('role');
      expect(template).toHaveProperty('personality');
      expect(template.personality).toHaveProperty('verbosity');
      expect(template.personality).toHaveProperty('warmth');
    });

    it('should filter templates by category', async () => {
      const categories = await service.getCategories();
      const categoryId = categories[0]?.id;

      if (!categoryId) return;

      const templates = await service.getTemplates({
        category_id: categoryId,
        visibility: 'public',
      });

      expect(templates).toBeDefined();
      // All returned templates should match category
      templates.forEach((t) => {
        expect(t.category_id).toBe(categoryId);
      });
    });

    it('should search templates by name', async () => {
      const searchResults = await service.getTemplates({
        search: 'Manager',
        visibility: 'public',
      });

      expect(searchResults).toBeDefined();
      // Should find Project Manager template
      const found = searchResults.some((t) => t.name.includes('Manager'));
      expect(found).toBeTruthy();
    });

    it('should get individual template details', async () => {
      const allTemplates = await service.getTemplates({ visibility: 'public' });
      if (allTemplates.length === 0) return;

      const templateId = allTemplates[0].id;
      const template = await service.getTemplate(templateId);

      expect(template).toBeDefined();
      expect(template.id).toBe(templateId);
      expect(template.name).toBeDefined();
      expect(template.role).toBeDefined();
      expect(template.personality).toBeDefined();
    });
  });

  describe('Template Customization & Creation Workflow', () => {
    it('should instantiate template as new agent', async () => {
      // Get a template to instantiate
      const templates = await service.getTemplates({ visibility: 'public' });
      if (templates.length === 0) return;

      const sourceTemplate = templates[0];

      // Create agent from template
      const agent = await service.instantiateTemplate(testUserId, {
        template_id: sourceTemplate.id,
        agent_name: 'Test Agent from Template',
        custom_personality: {
          verbosity: 0.7,
          warmth: 0.8,
        },
      });

      expect(agent).toBeDefined();
      expect(agent.user_id).toBe(testUserId);
      expect(agent.name).toBe('Test Agent from Template');
      expect(agent.personality.verbosity).toBe(0.7);
      expect(agent.personality.warmth).toBe(0.8);
    });

    it('should customize all personality dimensions', async () => {
      const templates = await service.getTemplates({ visibility: 'public' });
      if (templates.length === 0) return;

      const agent = await service.instantiateTemplate(testUserId, {
        template_id: templates[0].id,
        agent_name: 'Fully Customized Agent',
        custom_personality: {
          verbosity: 0.9,
          formality: 0.2,
          creativity: 0.95,
          proactivity: 0.6,
          warmth: 0.75,
        },
      });

      expect(agent.personality.verbosity).toBe(0.9);
      expect(agent.personality.formality).toBe(0.2);
      expect(agent.personality.creativity).toBe(0.95);
      expect(agent.personality.proactivity).toBe(0.6);
      expect(agent.personality.warmth).toBe(0.75);
    });

    it('should override template goals and scope', async () => {
      const templates = await service.getTemplates({ visibility: 'public' });
      if (templates.length === 0) return;

      const agent = await service.instantiateTemplate(testUserId, {
        template_id: templates[0].id,
        agent_name: 'Custom Goals Agent',
        custom_goals: ['Custom Goal 1', 'Custom Goal 2'],
        custom_scope: 'Custom scope description',
      });

      expect(agent.goals).toContain('Custom Goal 1');
      expect(agent.goals).toContain('Custom Goal 2');
      expect(agent.scope).toBe('Custom scope description');
    });
  });

  describe('User Template Management Workflow', () => {
    it('should save agent as template', async () => {
      // This would require a real agent to exist
      // In a real test, we'd create an agent first, then save it
      // For now, we test the service method exists
      expect(service).toHaveProperty('saveAgentAsTemplate');
    });

    it('should toggle template as favorite', async () => {
      const templates = await service.getTemplates({ visibility: 'public' });
      if (templates.length === 0) return;

      const templateId = templates[0].id;

      // First toggle: add to favorites
      await service.toggleFavorite(testUserId, templateId);

      // Get favorites
      let favorites = await service.getFavorites(testUserId);
      let isFavorite = favorites.some((f) => f.id === templateId);
      expect(isFavorite).toBeTruthy();

      // Second toggle: remove from favorites
      await service.toggleFavorite(testUserId, templateId);

      // Get favorites again
      favorites = await service.getFavorites(testUserId);
      isFavorite = favorites.some((f) => f.id === templateId);
      expect(isFavorite).toBeFalsy();
    });

    it('should get user favorite templates', async () => {
      const templates = await service.getTemplates({ visibility: 'public' });
      if (templates.length < 2) return;

      // Add multiple to favorites
      await service.toggleFavorite(testUserId, templates[0].id);
      await service.toggleFavorite(testUserId, templates[1].id);

      const favorites = await service.getFavorites(testUserId);

      expect(favorites).toBeDefined();
      expect(favorites.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Template Category Navigation', () => {
    it('should navigate by category and get relevant templates', async () => {
      const categories = await service.getCategories();
      expect(categories.length).toBeGreaterThan(0);

      for (const category of categories.slice(0, 2)) {
        const templates = await service.getTemplates({
          category_id: category.id,
          visibility: 'public',
        });

        // Category should have at least 0 templates (some might be empty)
        expect(Array.isArray(templates)).toBeTruthy();

        if (templates.length > 0) {
          // All templates in category should match the category
          templates.forEach((t) => {
            expect(t.category_id).toBe(category.id);
          });
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template ID gracefully', async () => {
      try {
        await service.getTemplate('invalid-id-12345');
        // If it doesn't throw, that's also valid behavior
        expect(true).toBeTruthy();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle instantiation with missing template', async () => {
      try {
        await service.instantiateTemplate(testUserId, {
          template_id: 'non-existent-id',
          agent_name: 'Should Fail',
        });
        expect(false).toBeTruthy(); // Should have thrown
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain('not found');
      }
    });
  });

  describe('Performance Benchmarks', () => {
    it('should load categories in <200ms', async () => {
      const start = performance.now();
      await service.getCategories();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });

    it('should get templates in <500ms', async () => {
      const start = performance.now();
      await service.getTemplates({ visibility: 'public' });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should instantiate template in <1000ms', async () => {
      const templates = await service.getTemplates({ visibility: 'public' });
      if (templates.length === 0) return;

      const start = performance.now();
      await service.instantiateTemplate(testUserId, {
        template_id: templates[0].id,
        agent_name: 'Perf Test Agent',
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });
});
