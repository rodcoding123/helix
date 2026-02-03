/**
 * Voice Memos Service
 * Manages voice memo storage, retrieval, and transcription
 */

import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { VoiceMemo, VoiceCommand } from '@/lib/types/voice-memos';

export class VoiceMemoService {
  private supabase = getSupabaseBrowserClient();

  /**
   * Create a new voice memo
   */
  async createVoiceMemo(
    userId: string,
    audioBlob: Blob,
    transcript: string,
    options: {
      title?: string;
      tags?: string[];
      sessionKey?: string;
      model?: 'openai' | 'google' | 'deepgram';
      confidence?: number;
      durationMs: number;
    }
  ): Promise<VoiceMemo | null> {
    try {
      // Upload audio file to storage
      const fileName = `voice-memos/${userId}/${Date.now()}.webm`;
      const { error: uploadError } = await this.supabase.storage
        .from('voice-memos')
        .upload(fileName, audioBlob);

      if (uploadError) {
        throw new Error(`Audio upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('voice-memos')
        .getPublicUrl(fileName);

      // Create database record
      const { data, error } = await this.supabase
        .from('voice_memos')
        .insert([
          {
            user_id: userId,
            audio_url: urlData.publicUrl,
            transcript,
            duration_ms: options.durationMs,
            title: options.title,
            tags: options.tags || [],
            session_key: options.sessionKey,
            model: options.model || 'openai',
            transcript_confidence: options.confidence,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Database insert failed: ${error.message}`);
      }

      return data as VoiceMemo;
    } catch (error) {
      console.error('Failed to create voice memo:', error);
      return null;
    }
  }

  /**
   * Get voice memo by ID
   */
  async getVoiceMemo(userId: string, memoId: string): Promise<VoiceMemo | null> {
    try {
      const { data, error } = await this.supabase
        .from('voice_memos')
        .select('*')
        .eq('id', memoId)
        .eq('user_id', userId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as VoiceMemo;
    } catch (error) {
      console.error('Failed to get voice memo:', error);
      return null;
    }
  }

  /**
   * List user's voice memos
   */
  async listVoiceMemos(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      orderBy?: 'created_at' | 'updated_at';
      orderDirection?: 'asc' | 'desc';
    } = {}
  ): Promise<VoiceMemo[]> {
    try {
      const {
        limit = 20,
        offset = 0,
        orderBy = 'created_at',
        orderDirection = 'desc',
      } = options;

      let query = this.supabase
        .from('voice_memos')
        .select('*')
        .eq('user_id', userId);

      if (orderBy === 'created_at') {
        query = query.order('created_at', { ascending: orderDirection === 'asc' });
      } else {
        query = query.order('updated_at', { ascending: orderDirection === 'asc' });
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw new Error(error.message);
      }

      return (data || []) as VoiceMemo[];
    } catch (error) {
      console.error('Failed to list voice memos:', error);
      return [];
    }
  }

  /**
   * Search voice memo transcripts
   */
  async searchTranscripts(userId: string, query: string): Promise<VoiceMemo[]> {
    try {
      const { data, error } = await this.supabase
        .from('voice_memos')
        .select('*')
        .eq('user_id', userId)
        .textSearch('transcript', query);

      if (error) {
        throw new Error(error.message);
      }

      // Log search for analytics
      await this.logSearch(userId, query, data?.length || 0, data?.map((m) => m.id) || []);

      return (data || []) as VoiceMemo[];
    } catch (error) {
      console.error('Failed to search transcripts:', error);
      return [];
    }
  }

  /**
   * Update voice memo
   */
  async updateVoiceMemo(
    userId: string,
    memoId: string,
    updates: {
      title?: string;
      tags?: string[];
    }
  ): Promise<VoiceMemo | null> {
    try {
      const { data, error } = await this.supabase
        .from('voice_memos')
        .update(updates)
        .eq('id', memoId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as VoiceMemo;
    } catch (error) {
      console.error('Failed to update voice memo:', error);
      return null;
    }
  }

  /**
   * Delete voice memo
   */
  async deleteVoiceMemo(userId: string, memoId: string): Promise<boolean> {
    try {
      // Get memo to get audio URL
      const memo = await this.getVoiceMemo(userId, memoId);
      if (!memo) {
        return false;
      }

      // Delete from storage
      const fileName = memo.audioUrl.split('/').pop();
      if (fileName) {
        await this.supabase.storage.from('voice-memos').remove([`voice-memos/${userId}/${fileName}`]);
      }

      // Delete from database
      const { error } = await this.supabase
        .from('voice_memos')
        .delete()
        .eq('id', memoId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete voice memo:', error);
      return false;
    }
  }

  /**
   * Create voice command
   */
  async createVoiceCommand(
    userId: string,
    command: {
      triggerPhrase: string;
      actionType: 'tool' | 'skill' | 'navigation';
      targetId: string;
      actionParams?: Record<string, any>;
    }
  ): Promise<VoiceCommand | null> {
    try {
      const { data, error } = await this.supabase
        .from('voice_commands')
        .insert([
          {
            user_id: userId,
            trigger_phrase: command.triggerPhrase,
            action_type: command.actionType,
            target_id: command.targetId,
            action_params: command.actionParams,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as VoiceCommand;
    } catch (error) {
      console.error('Failed to create voice command:', error);
      return null;
    }
  }

  /**
   * List voice commands for user
   */
  async listVoiceCommands(userId: string): Promise<VoiceCommand[]> {
    try {
      const { data, error } = await this.supabase
        .from('voice_commands')
        .select('*')
        .eq('user_id', userId)
        .eq('enabled', true)
        .order('usage_count', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data || []) as VoiceCommand[];
    } catch (error) {
      console.error('Failed to list voice commands:', error);
      return [];
    }
  }

  /**
   * Log search for analytics
   */
  private async logSearch(
    userId: string,
    query: string,
    resultsCount: number,
    resultIds: string[]
  ): Promise<void> {
    try {
      await this.supabase.from('voice_transcript_searches').insert([
        {
          user_id: userId,
          query,
          results_count: resultsCount,
          result_ids: resultIds,
        },
      ]);
    } catch (error) {
      console.error('Failed to log search:', error);
    }
  }
}

// Export singleton instance
export const voiceMemoService = new VoiceMemoService();
