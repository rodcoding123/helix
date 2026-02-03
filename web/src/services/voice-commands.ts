/**
 * Voice Command Service
 * Phase 4.1 Week 3: Voice command management and execution
 *
 * Provides:
 * - Create/update/delete voice commands
 * - Trigger phrase matching with fuzzy matching
 * - Command execution with parameter mapping
 * - Integration with custom tools and composite skills
 * - Command usage tracking
 */

import { createClient } from '@supabase/supabase-js';
import type { VoiceCommand } from '../lib/types/voice-memo';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
) as any;

export interface VoiceCommandCreateRequest {
  triggerPhrase: string;
  actionType: 'tool' | 'skill' | 'navigation' | 'system';
  toolId?: string;
  skillId?: string;
  navigationTarget?: string;
  actionParams?: Record<string, any>;
}

export interface VoiceCommandExecutionContext {
  command: VoiceCommand;
  transcript: string;
  confidence: number;
  extractedParams?: Record<string, any>;
  executedAt: string;
}

export interface VoiceCommandExecutionResult {
  success: boolean;
  command: VoiceCommand;
  output?: any;
  error?: string;
  executionTimeMs: number;
}

/**
 * Create a new voice command
 */
export async function createVoiceCommand(
  request: VoiceCommandCreateRequest
): Promise<{ success: boolean; commandId?: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('voice_commands')
      .insert({
        user_id: sessionData.session.user.id,
        trigger_phrase: request.triggerPhrase.toLowerCase(),
        action_type: request.actionType,
        tool_id: request.toolId,
        skill_id: request.skillId,
        navigation_target: request.navigationTarget,
        action_params: request.actionParams,
        enabled: true,
        usage_count: 0,
      })
      .select('id');

    if (error) {
      throw error;
    }

    return {
      success: true,
      commandId: data?.[0]?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create command',
    };
  }
}

/**
 * Get all voice commands for current user
 */
export async function getVoiceCommands(): Promise<VoiceCommand[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('voice_commands')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .order('usage_count', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get commands:', error);
    return [];
  }
}

/**
 * Update voice command
 */
export async function updateVoiceCommand(
  commandId: string,
  updates: Partial<VoiceCommandCreateRequest>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: Record<string, any> = {};

    if (updates.triggerPhrase) {
      updateData.trigger_phrase = updates.triggerPhrase.toLowerCase();
    }
    if (updates.actionType) {
      updateData.action_type = updates.actionType;
    }
    if (updates.toolId) {
      updateData.tool_id = updates.toolId;
    }
    if (updates.skillId) {
      updateData.skill_id = updates.skillId;
    }
    if (updates.navigationTarget) {
      updateData.navigation_target = updates.navigationTarget;
    }
    if (updates.actionParams) {
      updateData.action_params = updates.actionParams;
    }

    const { error } = await supabase
      .from('voice_commands')
      .update(updateData)
      .eq('id', commandId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update command',
    };
  }
}

/**
 * Delete voice command
 */
export async function deleteVoiceCommand(
  commandId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('voice_commands')
      .delete()
      .eq('id', commandId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete command',
    };
  }
}

/**
 * Match transcript to voice command using fuzzy matching
 */
export function matchVoiceCommand(
  transcript: string,
  commands: VoiceCommand[]
): VoiceCommand | null {
  const lowerTranscript = transcript.toLowerCase().trim();

  // First try exact match
  for (const cmd of commands) {
    if (cmd.enabled && lowerTranscript === cmd.trigger_phrase) {
      return cmd;
    }
  }

  // Then try prefix match
  for (const cmd of commands) {
    if (cmd.enabled && lowerTranscript.startsWith(cmd.trigger_phrase)) {
      return cmd;
    }
  }

  // Finally try fuzzy match
  let bestMatch: VoiceCommand | null = null;
  let bestScore = 0.7; // Require 70% match

  for (const cmd of commands) {
    if (!cmd.enabled) continue;

    const score = calculateSimilarity(lowerTranscript, cmd.trigger_phrase);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = cmd;
    }
  }

  return bestMatch;
}

/**
 * Calculate similarity between two strings (Levenshtein distance based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Extract parameters from transcript based on command
 */
export function extractCommandParameters(
  transcript: string,
  command: VoiceCommand
): Record<string, any> {
  const params: Record<string, any> = {};

  // Remove trigger phrase from transcript
  const phraseIndex = transcript
    .toLowerCase()
    .indexOf(command.trigger_phrase.toLowerCase());

  if (phraseIndex === -1) {
    return params;
  }

  const remaining = transcript
    .substring(phraseIndex + command.trigger_phrase.length)
    .trim();

  // If there are template parameters, try to extract them
  if (command.action_params && typeof command.action_params === 'object') {
    for (const [key, template] of Object.entries(command.action_params)) {
      if (typeof template === 'string' && template === '{{transcript}}') {
        params[key] = remaining;
      }
    }
  }

  return params;
}

/**
 * Track command usage
 */
export async function recordCommandUsage(
  commandId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current usage count
    const { data: command, error: fetchError } = await supabase
      .from('voice_commands')
      .select('usage_count')
      .eq('id', commandId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Increment usage count
    const { error: updateError } = await supabase
      .from('voice_commands')
      .update({
        usage_count: (command?.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', commandId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to record usage:', error);
    return { success: false };
  }
}

/**
 * Get command statistics
 */
export async function getCommandStatistics(): Promise<{
  totalCommands: number;
  enabledCommands: number;
  mostUsed: VoiceCommand | null;
  totalExecutions: number;
}> {
  try {
    const commands = await getVoiceCommands();

    const stats = {
      totalCommands: commands.length,
      enabledCommands: commands.filter(c => c.enabled).length,
      mostUsed: commands.length > 0 ? commands[0] : null,
      totalExecutions: commands.reduce((sum, c) => sum + (c.usage_count || 0), 0),
    };

    return stats;
  } catch (error) {
    console.error('Failed to get statistics:', error);
    return {
      totalCommands: 0,
      enabledCommands: 0,
      mostUsed: null,
      totalExecutions: 0,
    };
  }
}
