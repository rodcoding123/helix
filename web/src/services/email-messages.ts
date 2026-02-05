/**
 * Email Messages Service
 * Phase 5 Track 1: Email CRUD operations, search, and management
 *
 * Features:
 * - Fetch emails from account
 * - Search across emails
 * - Mark as read/unread
 * - Star/unstar emails
 * - Delete emails
 * - Get email details with attachments
 */

import { supabase } from '@/lib/supabase';

export interface EmailMessage {
  id: string;
  accountId: string;
  subject: string;
  from: string;
  fromName?: string;
  to: string[];
  cc: string[];
  bcc: string[];
  bodyText: string;
  bodyHtml?: string;
  dateReceived: Date;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  isSent: boolean;
  isArchived: boolean;
  isSpam: boolean;
  labels: string[];
  attachmentCount: number;
  contentPreview: string;
}

export interface EmailSearchOptions {
  query: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

class EmailMessagesService {
  /**
   * Get emails for account
   */
  async getEmails(
    userId: string,
    accountId: string,
    options?: {
      limit?: number;
      offset?: number;
      isRead?: boolean;
      isStarred?: boolean;
    }
  ): Promise<EmailMessage[]> {
    try {
      let query = supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .eq('account_id', accountId);

      if (options?.isRead !== undefined) {
        query = query.eq('is_read', options.isRead);
      }

      if (options?.isStarred !== undefined) {
        query = query.eq('is_starred', options.isStarred);
      }

      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      query = (query as any)
        .order('date_received', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch emails: ${error.message}`);
      }

      return data.map((email) => this.mapToEmailMessage(email));
    } catch (error) {
      console.error('Get emails error:', error);
      throw error;
    }
  }

  /**
   * Get single email with full details
   */
  async getEmailDetail(userId: string, emailId: string): Promise<EmailMessage | null> {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .eq('id', emailId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? this.mapToEmailMessage(data) : null;
    } catch (error) {
      console.error('Get email detail error:', error);
      throw error;
    }
  }

  /**
   * Search emails across all accounts
   */
  async searchEmails(userId: string, options: EmailSearchOptions): Promise<EmailMessage[]> {
    try {
      let query = supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId);

      // Full-text search using PostgreSQL
      if (options.query) {
        query = query.or(
          `subject.ilike.%${options.query}%,body_text.ilike.%${options.query}%,from_address.ilike.%${options.query}%`
        );
      }

      if (options.from) {
        query = query.eq('from_address', options.from);
      }

      if (options.to) {
        query = query.contains('to_addresses', [options.to]);
      }

      if (options.subject) {
        query = query.ilike('subject', `%${options.subject}%`);
      }

      if (options.hasAttachments !== undefined) {
        query = query.eq('has_attachments', options.hasAttachments);
      }

      if (options.isRead !== undefined) {
        query = query.eq('is_read', options.isRead);
      }

      if (options.isStarred !== undefined) {
        query = query.eq('is_starred', options.isStarred);
      }

      if (options.dateFrom) {
        query = query.gte('date_received', options.dateFrom.toISOString());
      }

      if (options.dateTo) {
        query = query.lte('date_received', options.dateTo.toISOString());
      }

      const limit = options.limit || 50;
      const offset = options.offset || 0;
      query = (query as any)
        .order('date_received', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      return data.map((email) => this.mapToEmailMessage(email));
    } catch (error) {
      console.error('Search emails error:', error);
      throw error;
    }
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(emailId: string, isRead: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('emails')
        .update({ is_read: isRead, updated_at: new Date().toISOString() })
        .eq('id', emailId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Star/unstar email
   */
  async toggleStar(emailId: string, isStar: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('emails')
        .update({ is_starred: isStar, updated_at: new Date().toISOString() })
        .eq('id', emailId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Toggle star error:', error);
      throw error;
    }
  }

  /**
   * Delete/archive email
   */
  async deleteEmail(emailId: string, softDelete = true): Promise<void> {
    try {
      if (softDelete) {
        const { error } = await supabase
          .from('emails')
          .update({
            is_deleted: true,
            is_archived: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', emailId);

        if (error) {
          throw error;
        }
      } else {
        // Hard delete
        const { error } = await supabase.from('emails').delete().eq('id', emailId);

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Delete email error:', error);
      throw error;
    }
  }

  /**
   * Batch mark multiple emails as read
   */
  async markMultipleAsRead(emailIds: string[], isRead: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('emails')
        .update({ is_read: isRead, updated_at: new Date().toISOString() })
        .in('id', emailIds);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Batch mark read error:', error);
      throw error;
    }
  }

  /**
   * Get email statistics
   * Uses single batch query instead of 4 separate queries
   * Performance: 4 queries → 1 query
   */
  async getEmailStats(userId: string): Promise<{
    totalEmails: number;
    unreadCount: number;
    starredCount: number;
    attachmentCount: number;
  }> {
    try {
      // Single query: fetch all email flags for aggregation
      const { data: emails, error } = await supabase
        .from('emails')
        .select('is_read,is_starred,has_attachments')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (error) throw error;

      if (!emails || emails.length === 0) {
        return {
          totalEmails: 0,
          unreadCount: 0,
          starredCount: 0,
          attachmentCount: 0,
        };
      }

      // Aggregate all metrics from single query result
      let unreadCount = 0;
      let starredCount = 0;
      let attachmentCount = 0;

      for (const email of emails) {
        if (!email.is_read) unreadCount++;
        if (email.is_starred) starredCount++;
        if (email.has_attachments) attachmentCount++;
      }

      return {
        totalEmails: emails.length,
        unreadCount,
        starredCount,
        attachmentCount,
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return {
        totalEmails: 0,
        unreadCount: 0,
        starredCount: 0,
        attachmentCount: 0,
      };
    }
  }

  /**
   * Get most frequent contacts
   */
  async getFrequentContacts(userId: string, limit = 10): Promise<
    Array<{
      emailAddress: string;
      displayName: string;
      messageCount: number;
    }>
  > {
    try {
      const { data, error } = await supabase
        .from('email_contacts')
        .select('email_address, display_name, message_count')
        .eq('user_id', userId)
        .order('message_count', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (
        data?.map((contact) => ({
          emailAddress: contact.email_address,
          displayName: contact.display_name || contact.email_address,
          messageCount: contact.message_count,
        })) || []
      );
    } catch (error) {
      console.error('Get contacts error:', error);
      return [];
    }
  }

  /**
   * Map database record to EmailMessage
   */
  private mapToEmailMessage(data: any): EmailMessage {
    return {
      id: data.id,
      accountId: data.account_id,
      subject: data.subject,
      from: data.from_address,
      fromName: data.from_name,
      to: data.to_addresses || [],
      cc: data.cc_addresses || [],
      bcc: data.bcc_addresses || [],
      bodyText: data.body_text,
      bodyHtml: data.body_html,
      dateReceived: new Date(data.date_received),
      isRead: data.is_read,
      isStarred: data.is_starred,
      isDraft: data.is_draft,
      isSent: data.is_sent,
      isArchived: data.is_archived,
      isSpam: data.is_spam,
      labels: data.labels || [],
      attachmentCount: data.attachment_count || 0,
      contentPreview: data.content_preview || data.body_text?.substring(0, 200),
    };
  }
}

export const emailMessagesService = new EmailMessagesService();
