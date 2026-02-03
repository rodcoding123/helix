import { createClient } from '@supabase/supabase-js';

interface EmailSearchFilters {
  // Text search
  query?: string;
  searchFields?: ('subject' | 'body' | 'from' | 'to')[];

  // Senders/recipients
  from?: string[];
  to?: string[];

  // Status
  isRead?: boolean;
  isStarred?: boolean;
  isSpam?: boolean;
  isDeleted?: boolean;
  isDraft?: boolean;

  // Labels and tags
  labels?: string[];
  userTags?: string[];

  // Dates
  dateFrom?: Date;
  dateTo?: Date;

  // Attachments
  hasAttachments?: boolean;

  // Account
  accountId?: string;

  // Pagination
  limit?: number;
  offset?: number;

  // Sorting
  sortBy?: 'date' | 'relevance' | 'sender';
  sortOrder?: 'asc' | 'desc';
}

interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  query: string;
  filters: EmailSearchFilters;
  usage_count: number;
  last_used?: Date;
  created_at: Date;
}

interface SearchResult {
  id: string;
  subject: string;
  from: string;
  from_name?: string;
  preview: string;
  date_received: Date;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  executionTimeMs: number;
}

/**
 * Service for advanced email search and filtering
 */
export class EmailSearchService {
  private supabase: ReturnType<typeof createClient>;
  private userId: string;

  constructor(userId: string, supabaseUrl: string, supabaseKey: string) {
    this.userId = userId;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Search emails with advanced filters
   */
  async search(filters: EmailSearchFilters): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      let query = this.supabase
        .from('emails')
        .select('id, subject, from_address, from_name, content_preview, date_received, is_read, is_starred, has_attachments', {
          count: 'exact',
        })
        .eq('user_id', this.userId);

      // Apply status filters
      if (filters.isRead !== undefined) {
        query = query.eq('is_read', filters.isRead);
      }
      if (filters.isStarred !== undefined) {
        query = query.eq('is_starred', filters.isStarred);
      }
      if (filters.isSpam !== undefined) {
        query = query.eq('is_spam', filters.isSpam);
      }
      if (filters.isDeleted !== undefined) {
        query = query.eq('is_deleted', filters.isDeleted);
      }
      if (filters.isDraft !== undefined) {
        query = query.eq('is_draft', filters.isDraft);
      }

      // Apply account filter
      if (filters.accountId) {
        query = query.eq('account_id', filters.accountId);
      }

      // Apply date range
      if (filters.dateFrom) {
        query = query.gte('date_received', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        query = query.lte('date_received', filters.dateTo.toISOString());
      }

      // Apply sender filter
      if (filters.from && filters.from.length > 0) {
        query = query.in('from_address', filters.from);
      }

      // Apply recipient filter
      if (filters.to && filters.to.length > 0) {
        // Note: This would need an OR condition which Supabase doesn't support directly
        // In a real implementation, you'd use a more sophisticated approach
        // For now, we'll skip this filter in the basic implementation
      }

      // Apply attachment filter
      if (filters.hasAttachments !== undefined) {
        query = query.eq('has_attachments', filters.hasAttachments);
      }

      // Apply label/tag filters
      if (filters.labels && filters.labels.length > 0) {
        query = query.contains('labels', filters.labels);
      }
      if (filters.userTags && filters.userTags.length > 0) {
        query = query.contains('user_tags', filters.userTags);
      }

      // Apply full-text search if query provided
      if (filters.query) {
        // Determine search fields
        const searchFields = filters.searchFields || ['subject', 'body'];
        const searchQuery = filters.query.toLowerCase();

        // In a real implementation, use PostgreSQL full-text search
        // For now, use basic contains search
        if (searchFields.includes('subject')) {
          query = query.ilike('subject', `%${searchQuery}%`);
        }
        if (searchFields.includes('body')) {
          // Note: In production, use the full-text search vector column
          // query = query.textSearch('full_text_search_vector', searchQuery);
        }
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'date';
      const sortOrder = filters.sortOrder === 'asc' ? true : false;

      if (sortBy === 'date') {
        query = query.order('date_received', { ascending: sortOrder });
      } else if (sortBy === 'sender') {
        query = query.order('from_address', { ascending: sortOrder });
      }

      // Apply pagination
      const limit = Math.min(filters.limit || 50, 100); // Max 100
      const offset = filters.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      // Track search
      await this.trackSearch(filters.query || '', filters);

      const results: SearchResult[] = (data || []).map((email: unknown) => {
        const e = email as Record<string, unknown>;
        return {
          id: e.id as string,
          subject: e.subject as string,
          from: e.from_address as string,
          from_name: e.from_name as string | undefined,
          preview: e.content_preview as string,
          date_received: new Date(e.date_received as string),
          is_read: e.is_read as boolean,
          is_starred: e.is_starred as boolean,
          has_attachments: e.has_attachments as boolean,
        };
      });

      return {
        results,
        total: count || 0,
        query: filters.query || '',
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get saved searches for user
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    try {
      const { data, error } = await this.supabase
        .from('email_saved_searches')
        .select('*')
        .eq('user_id', this.userId)
        .order('last_used', { ascending: false, nullsFirst: false });

      if (error) {
        throw error;
      }

      return (data || []).map((search: unknown) => {
        const s = search as Record<string, unknown>;
        return {
          id: s.id as string,
          user_id: s.user_id as string,
          name: s.name as string,
          query: s.query as string,
          filters: (s.filters as EmailSearchFilters) || {},
          usage_count: s.usage_count as number,
          last_used: s.last_used ? new Date(s.last_used as string) : undefined,
          created_at: new Date(s.created_at as string),
        };
      });
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      return [];
    }
  }

  /**
   * Save a search query
   */
  async saveSearch(
    name: string,
    query: string,
    filters: EmailSearchFilters
  ): Promise<SavedSearch> {
    try {
      const { data, error } = await this.supabase
        .from('email_saved_searches')
        .insert({
          user_id: this.userId,
          name,
          query,
          filters,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        id: (data as Record<string, unknown>).id as string,
        user_id: this.userId,
        name,
        query,
        filters,
        usage_count: 0,
        created_at: new Date(),
      };
    } catch (error) {
      console.error('Error saving search:', error);
      throw error;
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('email_saved_searches')
        .delete()
        .eq('id', searchId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting saved search:', error);
      throw error;
    }
  }

  /**
   * Track search for analytics
   */
  private async trackSearch(query: string, filters: EmailSearchFilters): Promise<void> {
    try {
      // In a real implementation, store in email_search_history table
      // For now, just log it
      console.log('Search tracked:', { query, filters });
    } catch (error) {
      console.error('Error tracking search:', error);
      // Non-fatal: don't throw
    }
  }

  /**
   * Get popular search terms
   */
  async getPopularSearchTerms(limit: number = 10): Promise<Array<{ term: string; count: number }>> {
    try {
      const { data, error } = await this.supabase
        .from('email_search_history')
        .select('query')
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      // Group and count
      const counts: Record<string, number> = {};
      (data || []).forEach((item: unknown) => {
        const query = (item as Record<string, unknown>).query as string;
        counts[query] = (counts[query] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([term, count]) => ({ term, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching popular searches:', error);
      return [];
    }
  }

  /**
   * Get search history
   */
  async getSearchHistory(limit: number = 20): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('email_search_history')
        .select('query')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Get unique queries
      const uniqueQueries = Array.from(
        new Set((data || []).map((item: unknown) => (item as Record<string, unknown>).query as string))
      );

      return uniqueQueries.slice(0, limit);
    } catch (error) {
      console.error('Error fetching search history:', error);
      return [];
    }
  }
}

/**
 * Factory function to create email search service
 */
export function useEmailSearchService(userId: string): EmailSearchService {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables for search service');
  }

  return new EmailSearchService(userId, supabaseUrl, supabaseKey);
}

export type { EmailSearchFilters, SavedSearch, SearchResult, SearchResponse };
