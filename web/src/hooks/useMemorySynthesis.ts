import { useState, useCallback, useRef } from 'react';
import type {
  MemorySynthesisJob,
  SynthesisJobDefinition,
  MemoryPattern,
  SynthesisRecommendation,
  SynthesisInsights,
  PatternConfirmation,
} from '@/lib/types/memory-synthesis';
import { MemorySynthesisService } from '@/services/memory-synthesis';

export function useMemorySynthesis() {
  const [synthesisJobs, setSynthesisJobs] = useState<MemorySynthesisJob[]>([]);
  const [memoryPatterns, setMemoryPatterns] = useState<MemoryPattern[]>([]);
  const [recommendations, setRecommendations] = useState<SynthesisRecommendation[]>([]);
  const [currentJob, setCurrentJob] = useState<MemorySynthesisJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MemorySynthesisService | null>(null);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new MemorySynthesisService();
    }
    return serviceRef.current;
  }, []);

  /**
   * Create synthesis job
   */
  const createSynthesisJob = useCallback(
    async (userId: string, definition: SynthesisJobDefinition): Promise<MemorySynthesisJob> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const job = await service.createSynthesisJob(userId, definition);
        setSynthesisJobs((prev) => [job, ...prev]);
        setCurrentJob(job);
        return job;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create synthesis job';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load synthesis jobs
   */
  const loadSynthesisJobs = useCallback(
    async (userId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const jobs = await service.getSynthesisJobs(userId);
        setSynthesisJobs(jobs);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load synthesis jobs';
        setError(message);
        console.error('Failed to load synthesis jobs:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load memory patterns
   */
  const loadMemoryPatterns = useCallback(
    async (userId: string, layer?: number): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const patterns = await service.getMemoryPatterns(userId, layer);
        setMemoryPatterns(patterns);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load memory patterns';
        setError(message);
        console.error('Failed to load memory patterns:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Load recommendations
   */
  const loadRecommendations = useCallback(
    async (userId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const recs = await service.getRecommendations(userId);
        setRecommendations(recs);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load recommendations';
        setError(message);
        console.error('Failed to load recommendations:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [getService]
  );

  /**
   * Run synthesis analysis
   */
  const runSynthesis = useCallback(
    async (userId: string, jobId: string, synthesisType: string): Promise<SynthesisInsights> => {
      setIsLoading(true);
      setError(null);
      try {
        const service = getService();
        const insights = await service.synthesizeMemoryPatterns(userId, jobId, synthesisType);

        // Reload jobs and patterns
        await loadSynthesisJobs(userId);
        await loadMemoryPatterns(userId);

        return insights;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to run synthesis';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, loadSynthesisJobs, loadMemoryPatterns]
  );

  /**
   * Confirm pattern
   */
  const confirmPattern = useCallback(
    async (patternId: string, confirmation: PatternConfirmation): Promise<void> => {
      try {
        const service = getService();
        await service.confirmPattern(patternId, confirmation);

        // Update local state
        setMemoryPatterns((prev) =>
          prev.map((p) =>
            p.id === patternId
              ? { ...p, user_confirmed: confirmation.confirmed, user_notes: confirmation.notes ?? null }
              : p
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to confirm pattern';
        setError(message);
        throw err;
      }
    },
    [getService]
  );

  /**
   * Update recommendation status
   */
  const updateRecommendationStatus = useCallback(
    async (recId: string, status: SynthesisRecommendation['status']): Promise<void> => {
      try {
        const service = getService();
        await service.updateRecommendationStatus(recId, status);

        // Update local state
        setRecommendations((prev) =>
          prev.map((r) => (r.id === recId ? { ...r, status } : r))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update recommendation';
        setError(message);
        throw err;
      }
    },
    [getService]
  );

  /**
   * Schedule recurring synthesis
   */
  const scheduleRecurringSynthesis = useCallback(
    async (userId: string, synthesisType: string, cronSchedule: string): Promise<void> => {
      try {
        const service = getService();
        await service.scheduleRecurringSynthesis(userId, synthesisType, cronSchedule);
        await loadSynthesisJobs(userId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to schedule synthesis';
        setError(message);
        throw err;
      }
    },
    [getService, loadSynthesisJobs]
  );

  /**
   * Cancel job
   */
  const cancelJob = useCallback(
    async (jobId: string): Promise<void> => {
      try {
        const service = getService();
        await service.cancelSynthesisJob(jobId);

        setSynthesisJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'failed' as const, error_message: 'Cancelled by user' } : j
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel job';
        setError(message);
        throw err;
      }
    },
    [getService]
  );

  return {
    // State
    synthesisJobs,
    memoryPatterns,
    recommendations,
    currentJob,
    isLoading,
    error,

    // Methods
    createSynthesisJob,
    loadSynthesisJobs,
    loadMemoryPatterns,
    loadRecommendations,
    runSynthesis,
    confirmPattern,
    updateRecommendationStatus,
    scheduleRecurringSynthesis,
    cancelJob,
  };
}
