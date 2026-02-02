/**
 * Voice Services - Client-side voice feature integration
 *
 * Handles:
 * - Voice memo recording and uploading
 * - Transcript search
 * - Voice command management
 * - Voice settings
 * - Real-time voice session management
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

/**
 * Upload voice memo to storage and queue transcription
 */
export async function uploadVoiceMemo(
  audioBlob: Blob,
  title?: string,
  tags?: string[]
): Promise<{
  success: boolean;
  memoId: string;
  status: 'pending' | 'processing' | 'completed';
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const userId = sessionData.session.user.id;
    const memoId = crypto.randomUUID();

    // Upload to Supabase Storage
    const fileName = `${userId}/${memoId}.webm`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('voice-memos')
      .upload(fileName, audioBlob);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data } = supabase.storage.from('voice-memos').getPublicUrl(fileName);

    // Create memo record via API
    const response = await fetch('/api/voice/upload-memo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memoId,
        audioUrl: data.publicUrl,
        durationMs: audioBlob.size, // Approximate
        title,
        tags,
        fileSizeBytes: audioBlob.size,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    return {
      success: true,
      memoId,
      status: 'pending',
    };
  } catch (error) {
    return {
      success: false,
      memoId: '',
      status: 'pending',
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Get voice memo by ID
 */
export async function getVoiceMemo(memoId: string) {
  try {
    const { data } = await supabase
      .from('voice_memos')
      .select('*')
      .eq('id', memoId)
      .single();

    return { success: true, memo: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Fetch failed' };
  }
}

/**
 * Search voice transcripts
 */
export async function searchTranscripts(
  query: string,
  limit = 20,
  offset = 0
): Promise<{
  success: boolean;
  results: Array<{
    id: string;
    text: string;
    speaker: string;
    source: string;
    createdAt: string;
  }>;
  total: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/voice/search-transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit, offset }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Search failed');
    }

    return {
      success: true,
      results: result.results || [],
      total: result.total || 0,
    };
  } catch (error) {
    return {
      success: false,
      results: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

/**
 * Create voice command
 */
export async function createVoiceCommand(
  triggerPhrase: string,
  toolId: string,
  actionConfig?: Record<string, unknown>
): Promise<{
  success: boolean;
  commandId: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/voice/create-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerPhrase, toolId, actionConfig }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Command creation failed');
    }

    return {
      success: true,
      commandId: result.commandId,
    };
  } catch (error) {
    return {
      success: false,
      commandId: '',
      error: error instanceof Error ? error.message : 'Command creation failed',
    };
  }
}

/**
 * Get all voice commands for user
 */
export async function listVoiceCommands(): Promise<{
  success: boolean;
  commands: Array<{
    id: string;
    triggerPhrase: string;
    toolId: string;
    isEnabled: boolean;
    usageCount: number;
  }>;
  error?: string;
}> {
  try {
    const response = await fetch('/api/voice/list-commands');
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'List failed');
    }

    return {
      success: true,
      commands: result.commands || [],
    };
  } catch (error) {
    return {
      success: false,
      commands: [],
      error: error instanceof Error ? error.message : 'List failed',
    };
  }
}

/**
 * Delete voice command
 */
export async function deleteVoiceCommand(commandId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/voice/command/${commandId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Delete failed');
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Update voice settings
 */
export async function updateVoiceSettings(settings: {
  sttProvider?: string;
  ttsProvider?: string;
  ttsVoiceId?: string;
  wakeWordEnabled?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('/api/voice/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Settings update failed');
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Settings update failed',
    };
  }
}

/**
 * Get or create voice session for real-time conversation
 */
export async function getVoiceSession(sessionKey: string): Promise<{
  success: boolean;
  sessionId: string;
  status: 'active' | 'completed';
  inputModel: string;
  outputModel: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/voice/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Session retrieval failed');
    }

    return {
      success: true,
      sessionId: result.sessionId,
      status: result.status,
      inputModel: result.inputModel,
      outputModel: result.outputModel,
    };
  } catch (error) {
    return {
      success: false,
      sessionId: '',
      status: 'completed',
      inputModel: '',
      outputModel: '',
      error: error instanceof Error ? error.message : 'Session retrieval failed',
    };
  }
}

/**
 * List voice memos
 */
export async function listVoiceMemos(limit = 20, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('voice_memos')
      .select('id, title, duration_ms, transcript, transcription_status, recorded_at')
      .order('recorded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      success: true,
      memos: data || [],
    };
  } catch (error) {
    return {
      success: false,
      memos: [],
      error: error instanceof Error ? error.message : 'List failed',
    };
  }
}

/**
 * List voicemail messages
 */
export async function listVoicemails(limit = 20, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('voicemail_messages')
      .select('id, from_name, transcript, is_read, received_at')
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      success: true,
      messages: data || [],
    };
  } catch (error) {
    return {
      success: false,
      messages: [],
      error: error instanceof Error ? error.message : 'List failed',
    };
  }
}

/**
 * Mark voicemail as read
 */
export async function markVoicemailAsRead(voicemailId: string) {
  try {
    const { error } = await supabase
      .from('voicemail_messages')
      .update({ is_read: true })
      .eq('id', voicemailId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    };
  }
}
