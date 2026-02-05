import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AgentService } from '@/services/agent';
import type { Agent } from '@/lib/types/agents';

/**
 * Hook to fetch and cache user's agents
 * Agents list is relatively dynamic - 2 minute cache
 */
export function useUserAgents(userId: string | undefined) {
  const agentService = new AgentService();

  return useQuery<Agent[]>({
    queryKey: ['user-agents', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      return agentService.getUserAgents(userId);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!userId,
  });
}

/**
 * Hook to fetch a specific agent by ID
 */
export function useAgent(agentId: string | undefined, userId: string | undefined) {
  const agentService = new AgentService();

  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      if (!agentId || !userId) throw new Error('Agent ID and User ID are required');
      return agentService.getAgent(agentId, userId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!agentId && !!userId,
  });
}

/**
 * Hook to create a new agent
 * Invalidates user agents cache on success
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();
  const agentService = new AgentService();

  return useMutation({
    mutationFn: (params: {
      userId: string;
      name: string;
      role: string;
      description: string;
      creationReason: string;
      initialPersonality?: Record<string, number>;
    }) =>
      agentService.createAgent(
        params.userId,
        params.name,
        params.role,
        params.description,
        params.creationReason,
        params.initialPersonality
      ),
    onSuccess: (_data, variables) => {
      // Invalidate the user's agents list cache
      queryClient.invalidateQueries({
        queryKey: ['user-agents', variables.userId],
      });
    },
  });
}

/**
 * Hook to delete an agent
 * Invalidates user agents cache on success
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const agentService = new AgentService();

  return useMutation({
    mutationFn: (params: { agentId: string; userId: string }) =>
      agentService.deleteAgent(params.agentId, params.userId),
    onSuccess: (_data, variables) => {
      // Invalidate the user's agents list cache
      queryClient.invalidateQueries({
        queryKey: ['user-agents', variables.userId],
      });
    },
  });
}

/**
 * Hook to update agent autonomy level
 * Invalidates agent and user agents caches on success
 */
export function useSetAgentAutonomy() {
  const queryClient = useQueryClient();
  const agentService = new AgentService();

  return useMutation({
    mutationFn: (params: { agentId: string; userId: string; level: 0 | 1 | 2 | 3 }) =>
      agentService.setAgentAutonomy(params.agentId, params.userId, params.level),
    onSuccess: (_data, variables) => {
      // Invalidate both the specific agent and user's agents list
      queryClient.invalidateQueries({
        queryKey: ['agent', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['user-agents', variables.userId],
      });
    },
  });
}

/**
 * Hook to update agent personality
 * Invalidates agent cache on success
 */
export function useUpdateAgentPersonality() {
  const queryClient = useQueryClient();
  const agentService = new AgentService();

  return useMutation({
    mutationFn: (params: {
      agentId: string;
      userId: string;
      personality: Record<string, number>;
    }) =>
      agentService.updateAgentPersonality(params.agentId, params.userId, params.personality),
    onSuccess: (_data, variables) => {
      // Invalidate the agent cache
      queryClient.invalidateQueries({
        queryKey: ['agent', variables.agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['user-agents', variables.userId],
      });
    },
  });
}
