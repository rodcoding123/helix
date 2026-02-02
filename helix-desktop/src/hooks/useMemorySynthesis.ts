/**
 * Memory Synthesis Hook for Desktop
 * Provides synthesis job submission, monitoring, and pattern analysis via gateway RPC
 */

import { useState, useCallback, useRef } from 'react';
import { useGateway } from './useGateway';
import type { GatewayClient } from '../lib/gateway-client';

export type SynthesisType =
  | 'emotional_patterns'
  | 'prospective_self'
  | 'relational_memory'
  | 'narrative_coherence'
  | 'full_synthesis';

export interface ConversationData {
  id: string;
  text: string;
  timestamp: string;
}

export interface SynthesisPattern {
  type: string;
  description: string;
  evidence?: string[];
  confidence: number;
  layer?: number;
  recommendations?: string[];
}

export interface SynthesisAnalysis {
  patterns: SynthesisPattern[];
  summary?: string;
  recommendations?: string[];
  lastUpdated?: string;
}

export interface SynthesisJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  synthesisType: SynthesisType;
  progress: number;
  analysis?: SynthesisAnalysis;
  error?: string;
  executionTimeMs?: number;
  conversationCount?: number;
}

export interface MemoryPattern {
  id: string;
  type: string;
  description: string;
  layer: number;
  confidence: number;
  firstDetected: string;
  observationCount: number;
}

export function useMemorySynthesis() {
  const { getClient, connected } = useGateway();

  const [synthesisJobs, setSynthesisJobs] = useState<SynthesisJob[]>([]);
  const [memoryPatterns, setMemoryPatterns] = useState<MemoryPattern[]>([]);
  const [currentJob, setCurrentJob] = useState<SynthesisJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<GatewayClient | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get client reference
  const ensureClient = useCallback(() => {
    const client = getClient();
    if (!client?.connected) {
      throw new Error('Gateway not connected');
    }
    clientRef.current = client;
    return client;
  }, [getClient]);

  // Submit synthesis job
  const submitSynthesisJob = useCallback(
    async (synthesisType: SynthesisType, conversations: ConversationData[]) => {
      try {
        setIsLoading(true);
        setError(null);

        const client = ensureClient();

        const result = await client.request<SynthesisJob>('memory.synthesize', {
          synthesisType,
          conversations
        });

        // Create job record
        const job: SynthesisJob = {
          jobId: Math.random().toString(36).substring(7),
          status: result.status,
          synthesisType,
          progress: result.progress || 0,
          analysis: result.analysis,
          executionTimeMs: result.executionTimeMs,
          conversationCount: conversations.length
        };

        setSynthesisJobs(prev => [...prev, job]);
        setCurrentJob(job);

        return job;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit synthesis job';
        setError(message);
        console.error('Failed to submit synthesis job:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient]
  );

  // Get synthesis job status
  const getSynthesisStatus = useCallback(async (jobId: string) => {
    try {
      const client = ensureClient();

      const result = await client.request<SynthesisJob>('memory.synthesis_status', {
        jobId
      });

      // Update job in list
      setSynthesisJobs(prev =>
        prev.map(j => (j.jobId === jobId ? { ...j, ...result } : j))
      );

      return result;
    } catch (err) {
      console.error('Failed to get synthesis status:', err);
      throw err;
    }
  }, [ensureClient]);

  // Poll for job completion
  const pollJobStatus = useCallback(
    async (jobId: string, onComplete?: (job: SynthesisJob) => void) => {
      // Clear any existing poll
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Poll every 2 seconds
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await getSynthesisStatus(jobId);

          if (status.status === 'completed' || status.status === 'failed') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setCurrentJob(status);
            onComplete?.(status);
          }
        } catch (err) {
          console.error('Poll error:', err);
        }
      }, 2000);
    },
    [getSynthesisStatus]
  );

  // List memory patterns
  const listMemoryPatterns = useCallback(
    async (layer?: number, patternType?: string) => {
      try {
        setIsLoading(true);

        const client = ensureClient();

        const result = await client.request<{ patterns: MemoryPattern[] }>(
          'memory.list_patterns',
          {
            layer,
            patternType
          }
        );

        setMemoryPatterns(result.patterns || []);
        return result.patterns || [];
      } catch (err) {
        console.error('Failed to list memory patterns:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient]
  );

  // Get synthesis analysis
  const getAnalysis = useCallback(
    async (jobId: string) => {
      try {
        const job = synthesisJobs.find(j => j.jobId === jobId);
        return job?.analysis || null;
      } catch (err) {
        console.error('Failed to get analysis:', err);
        return null;
      }
    },
    [synthesisJobs]
  );

  // Get synthesis history
  const getSynthesisHistory = useCallback(() => {
    return synthesisJobs;
  }, [synthesisJobs]);

  // Clear synthesis jobs
  const clearJobs = useCallback(() => {
    setSynthesisJobs([]);
    setCurrentJob(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  return {
    // State
    synthesisJobs,
    currentJob,
    memoryPatterns,
    isLoading,
    error,
    connected,

    // Methods
    submitSynthesisJob,
    getSynthesisStatus,
    pollJobStatus,
    listMemoryPatterns,
    getAnalysis,
    getSynthesisHistory,
    clearJobs,
    cleanup
  };
}
