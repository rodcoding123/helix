/**
 * Voicemail Service
 * Phase 4.1 Week 4: Voicemail management and playback
 *
 * Provides:
 * - Fetch voicemail messages
 * - Mark messages as read/important
 * - Archive and delete voicemails
 * - Voicemail inbox statistics
 */

import { createClient } from '@supabase/supabase-js';
import type { VoicemailMessage } from '../lib/types/voice-memo';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
) as any;

export interface VoicemailStats {
  totalMessages: number;
  unreadCount: number;
  importantCount: number;
  archivedCount: number;
  averageDuration: number;
}

export interface VoicemailPaginationResult {
  messages: VoicemailMessage[];
  total: number;
  hasMore: boolean;
}

/**
 * Get all voicemails for current user
 */
export async function getVoicemails(
  limit = 20,
  offset = 0,
  showArchived = false
): Promise<VoicemailPaginationResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    let query = supabase
      .from('voicemail_messages')
      .select('*', { count: 'exact' })
      .eq('user_id', sessionData.session.user.id);

    // Filter archived status
    if (!showArchived) {
      query = query.eq('is_archived', false);
    }

    // Order by received date (newest first)
    query = query.order('received_at', { ascending: false });

    // Apply pagination
    const { data: messages, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      messages: messages || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error) {
    console.error('Failed to fetch voicemails:', error);
    return {
      messages: [],
      total: 0,
      hasMore: false,
    };
  }
}

/**
 * Get single voicemail by ID
 */
export async function getVoicemail(voicemailId: string): Promise<VoicemailMessage | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { data, error } = await supabase
      .from('voicemail_messages')
      .select('*')
      .eq('id', voicemailId)
      .eq('user_id', sessionData.session.user.id)
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to fetch voicemail:', error);
    return null;
  }
}

/**
 * Mark voicemail as read
 */
export async function markVoicemailAsRead(
  voicemailId: string,
  isRead = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('voicemail_messages')
      .update({ is_read: isRead })
      .eq('id', voicemailId)
      .eq('user_id', sessionData.session.user.id);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update voicemail',
    };
  }
}

/**
 * Mark voicemail as important
 */
export async function toggleVoicemailImportant(
  voicemailId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    // Get current important status
    const { data: voicemail, error: fetchError } = await supabase
      .from('voicemail_messages')
      .select('is_important')
      .eq('id', voicemailId)
      .eq('user_id', sessionData.session.user.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    // Toggle it
    const { error: updateError } = await supabase
      .from('voicemail_messages')
      .update({ is_important: !voicemail.is_important })
      .eq('id', voicemailId)
      .eq('user_id', sessionData.session.user.id);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle important flag',
    };
  }
}

/**
 * Archive voicemail
 */
export async function archiveVoicemail(
  voicemailId: string,
  isArchived = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('voicemail_messages')
      .update({ is_archived: isArchived })
      .eq('id', voicemailId)
      .eq('user_id', sessionData.session.user.id);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive voicemail',
    };
  }
}

/**
 * Delete voicemail
 */
export async function deleteVoicemail(voicemailId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { error } = await supabase
      .from('voicemail_messages')
      .delete()
      .eq('id', voicemailId)
      .eq('user_id', sessionData.session.user.id);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete voicemail',
    };
  }
}

/**
 * Get voicemail inbox statistics
 */
export async function getVoicemailStats(): Promise<VoicemailStats> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const { data: messages, error } = await supabase
      .from('voicemail_messages')
      .select('*')
      .eq('user_id', sessionData.session.user.id)
      .eq('is_archived', false);

    if (error) {
      throw error;
    }

    const stats: VoicemailStats = {
      totalMessages: messages?.length || 0,
      unreadCount: messages?.filter(m => !m.is_read).length || 0,
      importantCount: messages?.filter(m => m.is_important).length || 0,
      archivedCount: 0, // Would need separate query if needed
      averageDuration: 0,
    };

    // Calculate average duration
    if (messages && messages.length > 0) {
      const validDurations = messages
        .filter((m: any) => m.audio_duration_ms)
        .map((m: any) => m.audio_duration_ms);

      if (validDurations.length > 0) {
        stats.averageDuration =
          validDurations.reduce((a: number, b: number) => a + b, 0) / validDurations.length;
      }
    }

    return stats;
  } catch (error) {
    console.error('Failed to get voicemail stats:', error);
    return {
      totalMessages: 0,
      unreadCount: 0,
      importantCount: 0,
      archivedCount: 0,
      averageDuration: 0,
    };
  }
}

/**
 * Get unread voicemail count
 */
export async function getUnreadVoicemailCount(): Promise<number> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      return 0;
    }

    const { count, error } = await supabase
      .from('voicemail_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', sessionData.session.user.id)
      .eq('is_read', false)
      .eq('is_archived', false);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
}

/**
 * Search voicemail transcripts
 */
export async function searchVoicemails(
  query: string,
  limit = 20,
  offset = 0
): Promise<VoicemailPaginationResult> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        messages: [],
        total: 0,
        hasMore: false,
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      throw new Error('Not authenticated');
    }

    const searchTerm = query.toLowerCase();

    const { data: messages, error, count } = await supabase
      .from('voicemail_messages')
      .select('*', { count: 'exact' })
      .eq('user_id', sessionData.session.user.id)
      .eq('is_archived', false)
      .or(`from_name.ilike.%${searchTerm}%,transcript.ilike.%${searchTerm}%`)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      messages: messages || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error) {
    console.error('Failed to search voicemails:', error);
    return {
      messages: [],
      total: 0,
      hasMore: false,
    };
  }
}

/**
 * Format duration in MM:SS
 */
export function formatDuration(durationMs: number | undefined): string {
  if (!durationMs) return '0:00';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format received time
 */
export function formatReceivedTime(receivedAt: string): string {
  const date = new Date(receivedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
