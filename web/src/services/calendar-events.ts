/**
 * Calendar Events Service
 * Phase 5 Track 2: Event CRUD operations, search, and conflict management
 *
 * Features:
 * - Fetch events from account
 * - Search across events
 * - Create, update, delete events
 * - Detect and manage conflicts
 * - Get event statistics
 * - Manage attendees
 */

import { supabase } from '@/lib/supabase';

export interface CalendarEvent {
  id: string;
  accountId: string;
  externalEventId: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  isAllDay: boolean;
  timezone?: string;
  recurrenceRule?: string;
  organizerEmail?: string;
  organizerName?: string;
  attendeeCount: number;
  isOrganizer: boolean;
  status: 'confirmed' | 'tentative' | 'cancelled';
  eventType: 'event' | 'task' | 'focustime' | 'ooo';
  isBusy: boolean;
  isPublic: boolean;
  hasConflict: boolean;
  conflictSeverity?: 'none' | 'warning' | 'critical';
  hasAttachments: boolean;
  attachmentCount: number;
  isDeleted: boolean;
  syncedAt?: Date;
}

export interface CalendarEventSearchOptions {
  query?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  eventType?: 'event' | 'task' | 'focustime' | 'ooo';
  hasConflict?: boolean;
  organizerEmail?: string;
  limit?: number;
  offset?: number;
}

class CalendarEventsService {
  /**
   * Get events for account within date range
   */
  async getCalendarEvents(
    userId: string,
    accountId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<CalendarEvent[]> {
    try {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('account_id', accountId)
        .eq('is_deleted', false);

      if (options?.startDate) {
        query = query.gte('start_time', options.startDate.toISOString());
      }

      if (options?.endDate) {
        query = query.lte('end_time', options.endDate.toISOString());
      }

      const limit = options?.limit || 100;
      const offset = options?.offset || 0;
      query = (query as any)
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch events: ${error.message}`);
      }

      return data.map((event) => this.mapToCalendarEvent(event));
    } catch (error) {
      console.error('Get events error:', error);
      throw error;
    }
  }

  /**
   * Get single event with full details
   */
  async getEventDetail(userId: string, eventId: string): Promise<CalendarEvent | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('id', eventId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ? this.mapToCalendarEvent(data) : null;
    } catch (error) {
      console.error('Get event detail error:', error);
      throw error;
    }
  }

  /**
   * Search events across all accounts
   */
  async searchEvents(
    userId: string,
    options: CalendarEventSearchOptions
  ): Promise<CalendarEvent[]> {
    try {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (options.query) {
        query = query.or(
          `title.ilike.%${options.query}%,description.ilike.%${options.query}%,location.ilike.%${options.query}%`
        );
      }

      if (options.startDate) {
        query = query.gte('start_time', options.startDate.toISOString());
      }

      if (options.endDate) {
        query = query.lte('end_time', options.endDate.toISOString());
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.eventType) {
        query = query.eq('event_type', options.eventType);
      }

      if (options.hasConflict !== undefined) {
        query = query.eq('has_conflict', options.hasConflict);
      }

      if (options.organizerEmail) {
        query = query.eq('organizer_email', options.organizerEmail);
      }

      const limit = options.limit || 100;
      const offset = options.offset || 0;
      query = (query as any)
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      return data.map((event) => this.mapToCalendarEvent(event));
    } catch (error) {
      console.error('Search events error:', error);
      throw error;
    }
  }

  /**
   * Create a new event
   */
  async createEvent(
    userId: string,
    accountId: string,
    eventData: Partial<CalendarEvent>
  ): Promise<CalendarEvent> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([
          {
            user_id: userId,
            account_id: accountId,
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            external_event_id: eventData.externalEventId || `local-${Date.now()}`,
            start_time: eventData.startTime?.toISOString(),
            end_time: eventData.endTime?.toISOString(),
            duration_minutes: eventData.durationMinutes,
            is_all_day: eventData.isAllDay || false,
            timezone: eventData.timezone,
            recurrence_rule: eventData.recurrenceRule,
            organizer_email: eventData.organizerEmail,
            organizer_name: eventData.organizerName,
            attendee_count: eventData.attendeeCount || 0,
            is_organizer: eventData.isOrganizer ?? true,
            status: eventData.status || 'confirmed',
            event_type: eventData.eventType || 'event',
            is_busy: eventData.isBusy ?? true,
            is_public: eventData.isPublic || false,
            has_conflict: false,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapToCalendarEvent(data);
    } catch (error) {
      console.error('Create event error:', error);
      throw error;
    }
  }

  /**
   * Update event
   */
  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapToCalendarEvent(data);
    } catch (error) {
      console.error('Update event error:', error);
      throw error;
    }
  }

  /**
   * Delete event (soft delete)
   */
  async deleteEvent(eventId: string, hardDelete = false): Promise<void> {
    try {
      if (hardDelete) {
        const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('calendar_events')
          .update({
            is_deleted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventId);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Delete event error:', error);
      throw error;
    }
  }

  /**
   * Check for conflicts with existing events
   */
  async checkConflicts(
    userId: string,
    startTime: Date,
    endTime: Date,
    excludeEventId?: string
  ): Promise<CalendarEvent[]> {
    try {
      let query = supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString());

      if (excludeEventId) {
        query = query.neq('id', excludeEventId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data.map((event) => this.mapToCalendarEvent(event));
    } catch (error) {
      console.error('Check conflicts error:', error);
      throw error;
    }
  }

  /**
   * Mark conflicts for event
   */
  async markConflicts(eventId: string, conflictingEventIds: string[]): Promise<void> {
    try {
      if (conflictingEventIds.length > 0) {
        const severity =
          conflictingEventIds.length > 2
            ? 'critical'
            : conflictingEventIds.length > 0
              ? 'warning'
              : 'none';

        await supabase
          .from('calendar_events')
          .update({
            has_conflict: true,
            conflict_with_ids: conflictingEventIds,
            conflict_severity: severity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventId);
      } else {
        await supabase
          .from('calendar_events')
          .update({
            has_conflict: false,
            conflict_with_ids: [],
            conflict_severity: 'none',
            updated_at: new Date().toISOString(),
          })
          .eq('id', eventId);
      }
    } catch (error) {
      console.error('Mark conflicts error:', error);
      throw error;
    }
  }

  /**
   * Get calendar statistics
   * Uses single batch query instead of 6+ separate queries
   * Performance: 6 queries → 1 query
   */
  async getCalendarStats(userId: string): Promise<{
    totalEvents: number;
    upcomingEvents: number;
    busyTimeMinutes: number;
    conflictCount: number;
    meetingCount: number;
    focusTimeMinutes: number;
  }> {
    try {
      const now = new Date();

      // Single query: fetch all events with necessary fields for aggregation
      const { data: events, error } = await supabase
        .from('calendar_events')
        .select('start_time,duration_minutes,has_conflict,event_type,is_busy')
        .eq('user_id', userId)
        .eq('is_deleted', false);

      if (error) throw error;

      if (!events || events.length === 0) {
        return {
          totalEvents: 0,
          upcomingEvents: 0,
          busyTimeMinutes: 0,
          conflictCount: 0,
          meetingCount: 0,
          focusTimeMinutes: 0,
        };
      }

      // Aggregate all metrics from single query result
      let upcomingCount = 0;
      let conflictCount = 0;
      let meetingCount = 0;
      let busyMinutes = 0;
      let focusMinutes = 0;

      for (const event of events) {
        // Count upcoming events
        if (event.start_time && new Date(event.start_time) >= now) {
          upcomingCount++;
        }

        // Count conflicts
        if (event.has_conflict) {
          conflictCount++;
        }

        // Count meetings
        if (event.event_type === 'event') {
          meetingCount++;
        }

        // Sum busy time
        if (event.is_busy && event.duration_minutes) {
          busyMinutes += event.duration_minutes;
        }

        // Sum focus time
        if (event.event_type === 'focustime' && event.duration_minutes) {
          focusMinutes += event.duration_minutes;
        }
      }

      return {
        totalEvents: events.length,
        upcomingEvents: upcomingCount,
        busyTimeMinutes: busyMinutes,
        conflictCount,
        meetingCount,
        focusTimeMinutes: focusMinutes,
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return {
        totalEvents: 0,
        upcomingEvents: 0,
        busyTimeMinutes: 0,
        conflictCount: 0,
        meetingCount: 0,
        focusTimeMinutes: 0,
      };
    }
  }

  /**
   * Get attendees for event
   */
  async getEventAttendees(
    userId: string,
    eventId: string
  ): Promise<
    Array<{
      email: string;
      displayName?: string;
      responseStatus: string;
      isOrganizer: boolean;
    }>
  > {
    try {
      const { data, error } = await supabase
        .from('calendar_event_attendees')
        .select('email_address, display_name, response_status, is_organizer')
        .eq('user_id', userId)
        .eq('event_id', eventId);

      if (error) {
        throw error;
      }

      return (
        data?.map((a) => ({
          email: a.email_address,
          displayName: a.display_name,
          responseStatus: a.response_status,
          isOrganizer: a.is_organizer,
        })) || []
      );
    } catch (error) {
      console.error('Get attendees error:', error);
      return [];
    }
  }

  /**
   * Map database record to CalendarEvent
   */
  private mapToCalendarEvent(data: any): CalendarEvent {
    return {
      id: data.id,
      accountId: data.account_id,
      externalEventId: data.external_event_id,
      title: data.title,
      description: data.description,
      location: data.location,
      startTime: new Date(data.start_time),
      endTime: new Date(data.end_time),
      durationMinutes: data.duration_minutes,
      isAllDay: data.is_all_day,
      timezone: data.timezone,
      recurrenceRule: data.recurrence_rule,
      organizerEmail: data.organizer_email,
      organizerName: data.organizer_name,
      attendeeCount: data.attendee_count || 0,
      isOrganizer: data.is_organizer,
      status: data.status,
      eventType: data.event_type,
      isBusy: data.is_busy,
      isPublic: data.is_public,
      hasConflict: data.has_conflict,
      conflictSeverity: data.conflict_severity,
      hasAttachments: data.has_attachments,
      attachmentCount: data.attachment_count || 0,
      isDeleted: data.is_deleted,
      syncedAt: data.synced_at ? new Date(data.synced_at) : undefined,
    };
  }
}

export const calendarEventsService = new CalendarEventsService();
