import { useState, useCallback, useRef } from 'react';
import type {
  CompositeSkill,
  CompositeSkillDefinition,
  CompositeSkillExecution,
  SkillValidationResult,
} from '@/lib/types/composite-skills';
import { CompositeSkillsService } from '@/services/composite-skills';

export function useCompositeSkills() {
  const [compositeSkills, setCompositeSkills] = useState<CompositeSkill[]>([]);
  const [currentSkill, setCurrentSkill] = useState<CompositeSkill | null>(null);
  const [executionHistory, setExecutionHistory] = useState<CompositeSkillExecution[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<SkillValidationResult | null>(null);
  const [currentExecution, setCurrentExecution] = useState<CompositeSkillExecution | null>(null);

  const serviceRef = useRef<CompositeSkillsService | null>(null);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new CompositeSkillsService();
    }
    return serviceRef.current;
  }, []);

  /**
   * Validate skill steps
   */
  const validateSteps = useCallback((steps: any[]) => {
    const service = getService();
    const result = service.validateSkillSteps(steps);
    setValidationResult(result);
    return result;
  }, [getService]);

  /**
   * Create composite skill
   */
  const createCompositeSkill = useCallback(
    async (userId: string, definition: CompositeSkillDefinition): Promise<CompositeSkill> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const skill = await service.createCompositeSkill(userId, definition);
        setCompositeSkills((prev) => [skill, ...prev]);
        return skill;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create skill';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load user's composite skills
   */
  const loadCompositeSkills = useCallback(
    async (userId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const skills = await service.getCompositeSkills(userId);
        setCompositeSkills(skills);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load skills';
        setError(message);
        console.error('Failed to load composite skills:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load a specific skill
   */
  const loadSkill = useCallback(
    async (skillId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const skill = await service.getCompositeSkill(skillId);
        setCurrentSkill(skill);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load skill';
        setError(message);
        console.error('Failed to load skill:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Update skill
   */
  const updateSkill = useCallback(
    async (skillId: string, updates: Partial<CompositeSkillDefinition>): Promise<CompositeSkill> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const skill = await service.updateCompositeSkill(skillId, updates);
        setCompositeSkills((prev) =>
          prev.map((s) => (s.id === skillId ? skill : s))
        );
        if (currentSkill?.id === skillId) {
          setCurrentSkill(skill);
        }
        return skill;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update skill';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, currentSkill?.id]
  );

  /**
   * Delete skill
   */
  const deleteSkill = useCallback(
    async (skillId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        await service.deleteCompositeSkill(skillId);
        setCompositeSkills((prev) => prev.filter((s) => s.id !== skillId));
        if (currentSkill?.id === skillId) {
          setCurrentSkill(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete skill';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, currentSkill?.id]
  );

  /**
   * Execute skill
   */
  const executeSkill = useCallback(
    async (
      skill: CompositeSkill,
      userId: string,
      inputParams: Record<string, any>,
      onProgress?: (stepResult: any) => void
    ): Promise<CompositeSkillExecution> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();

        // Simulate execution
        const execution = await service.simulateSkillExecution(
          skill,
          inputParams,
          onProgress
        );

        // Save to database
        await service.saveExecution(userId, execution);

        setCurrentExecution(execution);
        return execution;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to execute skill';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Get execution history
   */
  const loadExecutionHistory = useCallback(
    async (skillId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const history = await service.getExecutionHistory(skillId);
        setExecutionHistory(history);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load history';
        setError(message);
        console.error('Failed to load execution history:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  return {
    // State
    compositeSkills,
    currentSkill,
    executionHistory,
    currentExecution,
    isLoading,
    error,
    validationResult,

    // Methods
    validateSteps,
    createCompositeSkill,
    loadCompositeSkills,
    loadSkill,
    updateSkill,
    deleteSkill,
    executeSkill,
    loadExecutionHistory,
  };
}
