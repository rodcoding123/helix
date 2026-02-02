/**
 * Composite Skills Hook for Desktop
 * Provides skill building, validation, and execution via gateway RPC
 */

import { useState, useCallback, useRef } from 'react';
import { useGateway } from './useGateway';
import type { GatewayClient } from '../lib/gateway-client';

export interface SkillStep {
  stepId: string;
  toolName: string;
  description?: string;
  inputMapping?: Record<string, string>;
  outputMapping?: string;
  condition?: string;
  errorHandling?: 'stop' | 'continue' | 'retry';
  retryAttempts?: number;
}

export interface CompositeSkill {
  id: string;
  name: string;
  description?: string;
  steps: SkillStep[];
  version?: string;
  tags?: string[];
  executionCount?: number;
  lastExecuted?: string;
  visibility?: 'private' | 'public';
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
}

export interface SkillExecutionResult {
  success: boolean;
  skillId: string;
  stepResults: StepResult[];
  finalOutput: unknown;
  executionContext: Record<string, unknown>;
  executionTimeMs: number;
  stepsCompleted: number;
  totalSteps: number;
}

export function useCompositeSkills() {
  const { getClient, connected } = useGateway();

  const [compositeSkills, setCompositeSkills] = useState<CompositeSkill[]>([]);
  const [publicSkills, setPublicSkills] = useState<CompositeSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<SkillValidationResult | null>(null);

  const clientRef = useRef<GatewayClient | null>(null);

  // Get client reference
  const ensureClient = useCallback(() => {
    const client = getClient();
    if (!client?.connected) {
      throw new Error('Gateway not connected');
    }
    clientRef.current = client;
    return client;
  }, [getClient]);

  // Load user's composite skills
  const loadCompositeSkills = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      const result = await client.request<{ skills: CompositeSkill[] }>('skills.list_composite', {});
      setCompositeSkills(result.skills || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load composite skills';
      setError(message);
      console.error('Failed to load composite skills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient]);

  // Load public skills
  const loadPublicSkills = useCallback(async () => {
    try {
      const client = ensureClient();

      const result = await client.request<{ skills: CompositeSkill[] }>('skills.list_composite', {
        visibility: 'public'
      });
      setPublicSkills(result.skills || []);
    } catch (err) {
      console.error('Failed to load public skills:', err);
    }
  }, [ensureClient]);

  // Validate skill definition
  const validateSkill = useCallback(async (skill: CompositeSkill) => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      const result = await client.request<SkillValidationResult>('skills.validate_composite', {
        skill
      });

      setValidationResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Skill validation failed';
      setError(message);
      console.error('Skill validation failed:', err);
      return {
        valid: false,
        errors: [message]
      };
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient]);

  // Create new composite skill
  const createCompositeSkill = useCallback(async (skill: Omit<CompositeSkill, 'id'>) => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      // Validate first
      const skillWithId: CompositeSkill = { ...skill, id: Math.random().toString(36).substring(7) };
      const validation = await validateSkill(skillWithId);

      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const result = await client.request<{ id: string }>('skills.create_composite', {
        ...skill
      });

      // Reload skills
      await loadCompositeSkills();

      return result.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create skill';
      setError(message);
      console.error('Failed to create skill:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient, validateSkill, loadCompositeSkills]);

  // Execute composite skill
  const executeSkill = useCallback(async (skillId: string, input?: Record<string, unknown>) => {
    try {
      setIsLoading(true);
      setError(null);

      const client = ensureClient();

      const result = await client.request<SkillExecutionResult>('skills.execute_composite', {
        skillId,
        input: input || {}
      });

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Skill execution failed';
      setError(message);
      console.error('Skill execution failed:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient]);

  // Get skill metadata
  const getSkillMetadata = useCallback(async (skillId: string) => {
    try {
      const client = ensureClient();

      const result = await client.request<CompositeSkill>('skills.get_metadata', {
        skillId
      });

      return result;
    } catch (err) {
      console.error('Failed to get skill metadata:', err);
      throw err;
    }
  }, [ensureClient]);

  // Clone skill
  const cloneSkill = useCallback(async (sourceSkillId: string, name: string) => {
    try {
      setIsLoading(true);
      const client = ensureClient();

      const source = await getSkillMetadata(sourceSkillId);

      const result = await client.request<{ id: string }>('skills.create_composite', {
        ...source,
        name,
        id: undefined
      });

      await loadCompositeSkills();
      return result.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone skill';
      setError(message);
      console.error('Failed to clone skill:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient, getSkillMetadata, loadCompositeSkills]);

  // Delete skill
  const deleteSkill = useCallback(async (skillId: string) => {
    try {
      setIsLoading(true);
      const client = ensureClient();

      await client.request('skills.delete_composite', { skillId });

      await loadCompositeSkills();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete skill';
      setError(message);
      console.error('Failed to delete skill:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [ensureClient, loadCompositeSkills]);

  return {
    // State
    compositeSkills,
    publicSkills,
    isLoading,
    error,
    validationResult,
    connected,

    // Methods
    loadCompositeSkills,
    loadPublicSkills,
    validateSkill,
    createCompositeSkill,
    executeSkill,
    getSkillMetadata,
    cloneSkill,
    deleteSkill,
  };
}
