import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgentTemplateService } from '@/services/agent-template';
import type { EnrichedAgentTemplate } from '@/lib/types/agent-templates';

interface TemplateFilters {
  category_id?: string;
  search?: string;
  visibility?: string;
  limit?: number;
  offset?: number;
}

/**
 * Hook to fetch and cache agent templates with optional filtering
 * Includes search and category filters - 5 minute cache
 */
export function useTemplates(filters?: TemplateFilters) {
  const templateService = new AgentTemplateService();

  return useQuery<EnrichedAgentTemplate[]>({
    queryKey: ['templates', filters],
    queryFn: () => templateService.getTemplates(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true,
  });
}

/**
 * Hook to fetch a specific template by ID
 */
export function useTemplate(templateId: string | undefined) {
  const templateService = new AgentTemplateService();

  return useQuery({
    queryKey: ['template', templateId],
    queryFn: async () => {
      if (!templateId) throw new Error('Template ID is required');
      return templateService.getTemplate(templateId);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!templateId,
  });
}

/**
 * Hook to toggle a template as favorite
 */
export function useToggleTemplateFavorite() {
  const queryClient = useQueryClient();
  const templateService = new AgentTemplateService();

  return useMutation({
    mutationFn: (params: { userId: string; templateId: string }) =>
      templateService.toggleFavorite(params.userId, params.templateId),
    onSuccess: () => {
      // Invalidate favorites query
      queryClient.invalidateQueries({
        queryKey: ['template-favorites'],
      });
    },
  });
}

/**
 * Hook to fetch user's favorite templates
 */
export function useTemplateFavorites(userId: string | undefined) {
  const templateService = new AgentTemplateService();

  return useQuery({
    queryKey: ['template-favorites', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      return templateService.getFavorites(userId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId,
  });
}
