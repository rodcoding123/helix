import { useQuery } from '@tanstack/react-query';
import { AgentTemplateService } from '@/services/agent-template';

/**
 * Hook to fetch and cache agent template categories
 * Categories are very static data - 30 minute cache
 */
export function useTemplateCategories() {
  const templateService = new AgentTemplateService();

  return useQuery({
    queryKey: ['template-categories'],
    queryFn: () => templateService.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes (very static data)
  });
}
