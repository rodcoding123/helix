import { useState, useCallback, useRef } from 'react';
import type {
  AgentTemplate,
  AgentTemplateCategory,
  EnrichedAgentTemplate,
  TemplateInstantiationConfig,
  PersonalityProfile,
} from '@/lib/types/agent-templates';
import { AgentTemplateService } from '@/services/agent-template';

export function useAgentTemplates() {
  const [categories, setCategories] = useState<AgentTemplateCategory[]>([]);
  const [templates, setTemplates] = useState<EnrichedAgentTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<EnrichedAgentTemplate | null>(null);
  const [favorites, setFavorites] = useState<EnrichedAgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize service once (lazy-loaded)
  const serviceRef = useRef<AgentTemplateService | null>(null);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new AgentTemplateService();
    }
    return serviceRef.current;
  }, []);

  /**
   * Load all template categories
   */
  const loadCategories = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const service = getService();
      const data = await service.getCategories();
      setCategories(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getService]);

  /**
   * Load templates with optional filtering
   */
  const loadTemplates = useCallback(
    async (options?: {
      category_id?: string;
      search?: string;
      visibility?: string;
      limit?: number;
      offset?: number;
    }): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const data = await service.getTemplates(options);
        setTemplates(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load templates';
        setError(message);
        console.error('Failed to load templates:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load a specific template by ID
   */
  const loadTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const data = await service.getTemplate(templateId);
        setCurrentTemplate(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load template';
        setError(message);
        console.error('Failed to load template:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Create an agent from a template
   */
  const createFromTemplate = useCallback(
    async (userId: string, config: TemplateInstantiationConfig): Promise<any> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const agent = await service.instantiateTemplate(userId, config);
        return agent;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create agent from template';
        setError(message);
        console.error('Failed to create from template:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Save an agent as a template
   */
  const saveAgentAsTemplate = useCallback(
    async (
      userId: string,
      agentId: string,
      templateName: string,
      description: string,
      categoryId?: string,
      visibility: 'public' | 'private' | 'unlisted' = 'private'
    ): Promise<AgentTemplate> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const template = await service.saveAgentAsTemplate(
          userId,
          agentId,
          templateName,
          description,
          categoryId,
          visibility
        );
        return template;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save template';
        setError(message);
        console.error('Failed to save as template:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Toggle template as favorite
   */
  const toggleFavorite = useCallback(
    async (userId: string, templateId: string): Promise<void> => {
      try {
        const service = getService();
        await service.toggleFavorite(userId, templateId);

        // Reload favorites
        await loadFavorites(userId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to toggle favorite';
        setError(message);
        console.error('Failed to toggle favorite:', err);
      }
    },
    [getService]
  );

  /**
   * Load user's favorite templates
   */
  const loadFavorites = useCallback(
    async (userId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const data = await service.getFavorites(userId);
        setFavorites(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load favorites';
        setError(message);
        console.error('Failed to load favorites:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  return {
    // State
    categories,
    templates,
    currentTemplate,
    favorites,
    isLoading,
    error,

    // Methods
    loadCategories,
    loadTemplates,
    loadTemplate,
    createFromTemplate,
    saveAgentAsTemplate,
    toggleFavorite,
    loadFavorites,
  };
}
