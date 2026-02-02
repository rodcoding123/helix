import { useState, useCallback, useRef } from 'react';
import type {
  Agent,
  AgentProposal,
  AutonomyAction,
  AutonomySettings,
  AutonomyLevel,
} from '@/lib/types/agents';
import { AgentService } from '@/services/agent';
import { PatternDetectionService } from '@/services/pattern-detection';
import { AutonomyManagerService } from '@/services/autonomy-manager';

export function useAutonomy() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [autonomySettings, setAutonomySettings] = useState<AutonomySettings | null>(
    null
  );
  const [pendingActions, setPendingActions] = useState<AutonomyAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize services once (lazy-loaded)
  const servicesRef = useRef<{
    agentService: AgentService;
    patternDetection: PatternDetectionService;
    autonomyManager: AutonomyManagerService;
  } | null>(null);

  const getServices = useCallback(() => {
    if (!servicesRef.current) {
      servicesRef.current = {
        agentService: new AgentService(),
        patternDetection: new PatternDetectionService(),
        autonomyManager: new AutonomyManagerService(),
      };
    }
    return servicesRef.current;
  }, []);

  /**
   * Load all agents for the user
   */
  const loadAgents = useCallback(
    async (userId: string): Promise<Agent[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const userAgents = await services.agentService.getUserAgents(userId);
        setAgents(userAgents);
        return userAgents;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to load agents:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Detect agent proposals from user's conversation patterns
   */
  const detectProposals = useCallback(
    async (userId: string): Promise<AgentProposal[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const detected = await services.patternDetection.detectAgentProposals(
          userId
        );
        setProposals(detected);
        return detected;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to detect proposals:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Create an agent from a proposal
   */
  const createAgent = useCallback(
    async (
      userId: string,
      proposal: AgentProposal
    ): Promise<Agent | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const agent = await services.agentService.createAgent(
          userId,
          proposal.proposed_name,
          proposal.proposed_role,
          proposal.reason,
          proposal.reason
        );
        setAgents((prev) => [...prev, agent]);
        setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
        return agent;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to create agent:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Delete an agent
   */
  const deleteAgent = useCallback(
    async (userId: string, agentId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        await services.agentService.deleteAgent(agentId, userId);
        setAgents((prev) => prev.filter((a) => a.id !== agentId));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to delete agent:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Update agent autonomy level
   */
  const updateAgentAutonomy = useCallback(
    async (
      userId: string,
      agentId: string,
      level: AutonomyLevel
    ): Promise<Agent | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const updated = await services.agentService.setAgentAutonomy(
          agentId,
          userId,
          level
        );
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? updated : a))
        );
        return updated;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to update autonomy:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Get autonomy settings for the user
   */
  const loadAutonomySettings = useCallback(
    async (userId: string): Promise<AutonomySettings | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const settings = await services.autonomyManager.getAutonomySettings(
          userId
        );
        setAutonomySettings(settings);
        return settings;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to load autonomy settings:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Update autonomy settings
   */
  const updateAutonomySettings = useCallback(
    async (
      userId: string,
      updates: Partial<AutonomySettings>
    ): Promise<AutonomySettings | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const updated = await services.autonomyManager.updateAutonomySettings(
          userId,
          updates
        );
        setAutonomySettings(updated);
        return updated;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to update autonomy settings:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Get pending actions for user
   */
  const loadPendingActions = useCallback(
    async (userId: string): Promise<AutonomyAction[]> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const actions = await services.autonomyManager.getPendingActions(userId);
        setPendingActions(actions);
        return actions;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to load pending actions:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Approve an action
   */
  const approveAction = useCallback(
    async (userId: string, actionId: string): Promise<AutonomyAction | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const action = await services.autonomyManager.approveAction(
          actionId,
          userId
        );
        setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
        return action;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to approve action:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  /**
   * Reject an action
   */
  const rejectAction = useCallback(
    async (userId: string, actionId: string): Promise<AutonomyAction | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const services = getServices();
        const action = await services.autonomyManager.rejectAction(
          actionId,
          userId
        );
        setPendingActions((prev) => prev.filter((a) => a.id !== actionId));
        return action;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        console.error('Failed to reject action:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [getServices]
  );

  return {
    // State
    agents,
    proposals,
    autonomySettings,
    pendingActions,
    isLoading,
    error,

    // Agent management
    loadAgents,
    createAgent,
    deleteAgent,
    updateAgentAutonomy,

    // Proposal detection
    detectProposals,

    // Autonomy settings
    loadAutonomySettings,
    updateAutonomySettings,

    // Action approvals
    loadPendingActions,
    approveAction,
    rejectAction,
  };
}
