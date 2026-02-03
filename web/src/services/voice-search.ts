/**
 * Voice Transcript Search Service
 * Phase 4.1 Week 3: Full-text search on voice transcripts
 *
 * Provides:
 * - Full-text search on transcript content
 * - Tag-based filtering
 * - Date range filtering
 * - Confidence-based filtering
 * - Relevance scoring and result ranking
 */

import { createClient } from '@supabase/supabase-js';
import type { VoiceMemo, VoiceTranscript } from '../lib/types/voice-memo';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
) as any;

export interface VoiceSearchFilters {
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  minConfidence?: number;
  onlyTranscribed?: boolean;
}

export interface VoiceSearchResult {
  memo: VoiceMemo;
  transcript?: VoiceTranscript;
  snippet: string; // Highlighted excerpt
  relevance: number; // 0-1 score
  matchType: 'title' | 'transcript' | 'tag';
}

export interface VoiceSearchPaginationResult {
  results: VoiceSearchResult[];
  total: number;
  hasMore: boolean;
}

/**
 * Search voice transcripts and memos
 */
export async function searchVoiceTranscripts(
  query: string,
  filters: VoiceSearchFilters = {},
  limit = 20,
  offset = 0
): Promise<VoiceSearchPaginationResult> {
  try {
    if (!query || query.trim().length === 0) {
      return {
        results: [],
        total: 0,
        hasMore: false,
      };
    }

    const searchTerm = query.trim().toLowerCase();

    // Query memos with full-text search on transcript
    let query_builder = supabase
      .from('voice_memos')
      .select(
        `
        id,
        title,
        audio_url,
        audio_duration_ms,
        transcript,
        transcript_confidence,
        tags,
        recorded_at,
        transcription_status
      `,
        { count: 'exact' }
      )
      .order('recorded_at', { ascending: false });

    // Apply date filters
    if (filters.dateFrom) {
      query_builder = query_builder.gte('recorded_at', filters.dateFrom.toISOString());
    }

    if (filters.dateTo) {
      query_builder = query_builder.lte('recorded_at', filters.dateTo.toISOString());
    }

    // Apply confidence filter
    if (filters.minConfidence !== undefined) {
      query_builder = query_builder.gte('transcript_confidence', filters.minConfidence);
    }

    // Apply transcribed filter
    if (filters.onlyTranscribed) {
      query_builder = query_builder.eq('transcription_status', 'completed');
    }

    // Execute query with pagination
    const { data: memos, error: queryError, count } = await query_builder.range(offset, offset + limit - 1);

    if (queryError) {
      throw queryError;
    }

    // Post-process results for search matching and filtering
    const results: VoiceSearchResult[] = [];

    if (memos && Array.isArray(memos)) {
      for (const memo of memos) {
        // Check title match
        const titleMatch =
          memo.title && memo.title.toLowerCase().includes(searchTerm);

        // Check transcript match
        const transcriptMatch =
          memo.transcript && memo.transcript.toLowerCase().includes(searchTerm);

        // Check tag match
        const tagMatch = memo.tags?.some(tag => tag.toLowerCase().includes(searchTerm));

        // Apply tag filter if specified
        if (filters.tags && filters.tags.length > 0) {
          const hasMatchingTag = memo.tags?.some(tag => filters.tags!.includes(tag));
          if (!hasMatchingTag) {
            continue;
          }
        }

        // Only include if at least one match
        if (!titleMatch && !transcriptMatch && !tagMatch) {
          continue;
        }

        // Calculate relevance score
        let relevance = 0;
        let matchType: 'title' | 'transcript' | 'tag' = 'transcript';

        if (titleMatch) {
          relevance = 0.95; // Title matches are most relevant
          matchType = 'title';
        } else if (transcriptMatch) {
          relevance = 0.8; // Transcript matches are good
          matchType = 'transcript';
        } else if (tagMatch) {
          relevance = 0.6; // Tag matches are less relevant
          matchType = 'tag';
        }

        // Boost score if confidence is high
        if (memo.transcript_confidence && memo.transcript_confidence > 0.9) {
          relevance += 0.05;
        }

        // Create search snippet
        let snippet = '';
        if (transcriptMatch && memo.transcript) {
          snippet = createSnippet(memo.transcript, searchTerm, 100);
        } else if (titleMatch && memo.title) {
          snippet = memo.title;
        } else if (tagMatch) {
          snippet = `Tag: ${memo.tags?.find(t => t.toLowerCase().includes(searchTerm)) || ''}`;
        }

        results.push({
          memo,
          snippet,
          relevance: Math.min(relevance, 1),
          matchType,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return {
      results: results.slice(0, limit),
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error) {
    console.error('Voice search error:', error);
    return {
      results: [],
      total: 0,
      hasMore: false,
    };
  }
}

/**
 * Get suggested search terms from recent transcripts
 */
export async function getVoiceSearchSuggestions(
  partial: string,
  limit = 5
): Promise<string[]> {
  try {
    if (!partial || partial.length < 2) {
      return [];
    }

    const { data: memos, error } = await supabase
      .from('voice_memos')
      .select('transcript, tags')
      .neq('transcript', null)
      .limit(50);

    if (error) {
      throw error;
    }

    const suggestions = new Set<string>();
    const lowerPartial = partial.toLowerCase();

    if (memos && Array.isArray(memos)) {
      for (const memo of memos) {
        // Extract words from transcript
        if (memo.transcript) {
          const words = memo.transcript.toLowerCase().split(/\s+/);
          for (const word of words) {
            // Remove punctuation
            const cleanWord = word.replace(/[.,!?;:]/g, '');
            if (cleanWord.startsWith(lowerPartial) && cleanWord.length > lowerPartial.length) {
              suggestions.add(cleanWord);
              if (suggestions.size >= limit) {
                break;
              }
            }
          }
        }

        // Extract from tags
        if (memo.tags && Array.isArray(memo.tags)) {
          for (const tag of memo.tags) {
            if (tag.toLowerCase().startsWith(lowerPartial)) {
              suggestions.add(tag);
              if (suggestions.size >= limit) {
                break;
              }
            }
          }
        }

        if (suggestions.size >= limit) {
          break;
        }
      }
    }

    return Array.from(suggestions).slice(0, limit);
  } catch (error) {
    console.error('Suggestions error:', error);
    return [];
  }
}

/**
 * Get unique tags from voice memos
 */
export async function getVoiceMemTags(): Promise<string[]> {
  try {
    const { data: memos, error } = await supabase
      .from('voice_memos')
      .select('tags');

    if (error) {
      throw error;
    }

    const tags = new Set<string>();
    if (memos && Array.isArray(memos)) {
      for (const memo of memos) {
        if (memo.tags && Array.isArray(memo.tags)) {
          memo.tags.forEach(tag => tags.add(tag));
        }
      }
    }

    return Array.from(tags).sort();
  } catch (error) {
    console.error('Tags fetch error:', error);
    return [];
  }
}

/**
 * Create highlighted snippet from text
 */
function createSnippet(text: string, searchTerm: string, maxLength = 150): string {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(searchTerm.toLowerCase());

  if (index === -1) {
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // Calculate snippet boundaries
  const startOffset = Math.max(0, index - 30);
  const endOffset = Math.min(text.length, index + searchTerm.length + 100);

  let snippet = '';
  if (startOffset > 0) {
    snippet += '...';
  }

  snippet += text.substring(startOffset, endOffset);

  if (endOffset < text.length) {
    snippet += '...';
  }

  return snippet;
}

/**
 * Get voice memo search statistics
 */
export async function getVoiceSearchStats(): Promise<{
  totalMemos: number;
  totalTranscribed: number;
  averageConfidence: number;
  uniqueTags: number;
}> {
  try {
    const { data: memos, error } = await supabase
      .from('voice_memos')
      .select('transcript_confidence, transcription_status, tags');

    if (error) {
      throw error;
    }

    const stats = {
      totalMemos: 0,
      totalTranscribed: 0,
      averageConfidence: 0,
      uniqueTags: 0,
    };

    if (memos && Array.isArray(memos)) {
      stats.totalMemos = memos.length;
      stats.totalTranscribed = memos.filter(
        m => m.transcription_status === 'completed'
      ).length;

      const confidences = memos
        .filter(m => m.transcript_confidence !== null)
        .map(m => m.transcript_confidence);

      if (confidences.length > 0) {
        stats.averageConfidence =
          confidences.reduce((a, b) => a + b, 0) / confidences.length;
      }

      const uniqueTagsSet = new Set<string>();
      for (const memo of memos) {
        if (memo.tags && Array.isArray(memo.tags)) {
          memo.tags.forEach(tag => uniqueTagsSet.add(tag));
        }
      }
      stats.uniqueTags = uniqueTagsSet.size;
    }

    return stats;
  } catch (error) {
    console.error('Stats error:', error);
    return {
      totalMemos: 0,
      totalTranscribed: 0,
      averageConfidence: 0,
      uniqueTags: 0,
    };
  }
}
