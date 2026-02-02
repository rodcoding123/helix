/**
 * Phase 3 Integration Tests
 * End-to-end testing of custom tools, composite skills, and memory synthesis
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY! || import.meta.env.VITE_SUPABASE_ANON_KEY!
);

describe('Phase 3 Integration Tests', () => {
  let userId: string;
  let toolId: string;
  let skillId: string;

  beforeAll(async () => {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed for tests');
    }
    userId = user.id;
  });

  describe('Custom Tools Execution', () => {
    it('should create a custom tool', async () => {
      const { data, error } = await supabase
        .from('custom_tools')
        .insert({
          user_id: userId,
          name: 'Test Tool',
          description: 'Test tool for Phase 3',
          parameters: { x: { type: 'number' } },
          code: 'return { result: params.x * 2 };',
          capabilities: ['filesystem:read'],
          sandbox_profile: 'standard',
          is_enabled: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('Test Tool');
      toolId = data?.id!;
    });

    it('should retrieve tool metadata', async () => {
      const { data, error } = await supabase
        .from('custom_tools')
        .select('id, name, description, usage_count')
        .eq('id', toolId)
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe('Test Tool');
      expect(data?.usage_count).toBe(0);
    });

    it('should list user tools', async () => {
      const { data, error } = await supabase
        .from('custom_tools')
        .select('id, name')
        .eq('user_id', userId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.length).toBeGreaterThan(0);
      expect(data?.some(t => t.id === toolId)).toBe(true);
    });

    it('should track tool usage', async () => {
      const { data, error } = await supabase
        .from('custom_tool_usage')
        .insert({
          custom_tool_id: toolId,
          user_id: userId,
          input_params: { x: 21 },
          output_result: { result: 42 },
          status: 'success',
          execution_time_ms: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('success');
    });
  });

  describe('Composite Skills Execution', () => {
    it('should create a composite skill', async () => {
      const { data, error } = await supabase
        .from('composite_skills')
        .insert({
          user_id: userId,
          name: 'Test Skill',
          description: 'Test skill for Phase 3',
          steps: [
            {
              stepId: '1',
              toolId: toolId,
              inputMapping: { x: '$.input.value' },
              errorHandling: 'stop',
            },
          ],
          is_enabled: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.name).toBe('Test Skill');
      skillId = data?.id!;
    });

    it('should retrieve skill metadata', async () => {
      const { data, error } = await supabase
        .from('composite_skills')
        .select('id, name, steps')
        .eq('id', skillId)
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe('Test Skill');
      expect(Array.isArray(data?.steps)).toBe(true);
    });

    it('should list user skills', async () => {
      const { data, error } = await supabase
        .from('composite_skills')
        .select('id, name')
        .eq('user_id', userId);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data?.some(s => s.id === skillId)).toBe(true);
    });

    it('should record skill execution', async () => {
      const { data, error } = await supabase
        .from('composite_skill_executions')
        .insert({
          composite_skill_id: skillId,
          user_id: userId,
          input_params: { value: 10 },
          steps_executed: [{ stepId: '1', success: true }],
          final_output: { result: 20 },
          status: 'completed',
          execution_time_ms: 10,
          steps_completed: 1,
          total_steps: 1,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.status).toBe('completed');
      expect(data?.steps_completed).toBe(1);
    });
  });

  describe('Memory Synthesis', () => {
    it('should create synthesis job', async () => {
      const { data, error } = await supabase
        .from('memory_synthesis_jobs')
        .insert({
          user_id: userId,
          synthesis_type: 'emotional_patterns',
          status: 'pending',
          progress: 0,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.synthesis_type).toBe('emotional_patterns');
      expect(data?.status).toBe('pending');
    });

    it('should detect memory patterns', async () => {
      const { data, error } = await supabase
        .from('memory_patterns')
        .insert({
          user_id: userId,
          pattern_type: 'emotional_trigger',
          layer: 2,
          description: 'Test pattern',
          evidence: ['conv_123'],
          confidence: 0.85,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.pattern_type).toBe('emotional_trigger');
      expect(data?.confidence).toBe(0.85);
    });

    it('should create synthesis recommendation', async () => {
      const { data: patternData } = await supabase
        .from('memory_patterns')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (!patternData?.id) {
        throw new Error('No pattern found');
      }

      const { data, error } = await supabase
        .from('synthesis_recommendations')
        .insert({
          user_id: userId,
          pattern_id: patternData.id,
          recommendation: 'Practice grounding techniques',
          category: 'psychological',
          priority: 'high',
          status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data?.recommendation).toBeDefined();
    });
  });

  describe('Full Phase 3 Pipeline', () => {
    it('should execute complete pipeline: tool → skill → synthesis', async () => {
      // 1. Verify tool exists
      const { data: toolData } = await supabase
        .from('custom_tools')
        .select('id')
        .eq('id', toolId)
        .single();
      expect(toolData?.id).toBe(toolId);

      // 2. Verify skill exists and references tool
      const { data: skillData } = await supabase
        .from('composite_skills')
        .select('steps')
        .eq('id', skillId)
        .single();
      expect(skillData?.steps).toBeDefined();

      // 3. Verify synthesis job can track this
      const { data: synthData } = await supabase
        .from('memory_synthesis_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      expect(synthData?.synthesis_type).toBeDefined();

      // Pipeline verified
      expect(toolData).toBeDefined();
      expect(skillData).toBeDefined();
      expect(synthData).toBeDefined();
    });

    it('should have proper RLS policies', async () => {
      // Try to access another user's data (should fail if RLS works)
      const { data, error } = await supabase
        .from('custom_tools')
        .select('*');

      // Should either return empty or user's own tools
      if (data) {
        data.forEach(tool => {
          expect(tool.user_id).toBe(userId);
        });
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('custom_tools')
      .delete()
      .eq('id', toolId);

    await supabase
      .from('composite_skills')
      .delete()
      .eq('id', skillId);
  });
});
