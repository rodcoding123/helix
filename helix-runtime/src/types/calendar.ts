/**
 * Calendar Integration Types
 * Week 4 Track 4: Calendar Foundation
 */

export interface CalendarEvent {
  id: string;
  user_id: string;
  account_id?: string;
  title: string;
  description?: string;
  start_time: string; // ISO 8601 timestamp
  end_time: string; // ISO 8601 timestamp
  is_all_day: boolean;
  location?: string;
  attendees?: CalendarAttendee[];
  recurrence_rule?: string; // RFC 5545 RRULE format
  event_id?: string; // Provider's event ID
  created_at: string;
  updated_at: string;
}

export interface CalendarAttendee {
  id: string;
  event_id: string;
  email: string;
  name?: string;
  status: 'accepted' | 'pending' | 'declined';
  response_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarSyncLog {
  id: string;
  account_id?: string;
  started_at: string;
  completed_at?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message?: string;
  events_synced: number;
  created_at: string;
}

export interface CreateEventParams {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  is_all_day?: boolean;
  location?: string;
  attendees?: Omit<CalendarAttendee, 'id' | 'event_id' | 'created_at' | 'updated_at'>[];
  recurrence_rule?: string;
  account_id?: string;
}

export interface UpdateEventParams {
  id: string;
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  location?: string;
  attendees?: Omit<CalendarAttendee, 'id' | 'event_id' | 'created_at' | 'updated_at'>[];
  recurrence_rule?: string;
}

export interface GetEventsParams {
  user_id: string;
  account_id?: string;
  start_time: string;
  end_time: string;
  limit?: number;
  offset?: number;
}

export interface SearchEventsParams {
  user_id: string;
  query: string;
  start_time?: string;
  end_time?: string;
  account_id?: string;
  limit?: number;
  offset?: number;
}

export interface CalendarViewParams {
  user_id: string;
  start_time: string;
  end_time: string;
  view_type: 'month' | 'week' | 'day';
  account_id?: string;
}

export interface UpdateAttendeeParams {
  event_id: string;
  attendees: Omit<CalendarAttendee, 'id' | 'event_id' | 'created_at' | 'updated_at'>[];
}

export interface SyncCalendarParams {
  account_id: string;
  user_id: string;
  full_sync?: boolean; // true for initial full sync, false for incremental
}

export interface CalendarViewData {
  events: CalendarEvent[];
  date_range: {
    start: string;
    end: string;
  };
  view_type: 'month' | 'week' | 'day';
  total_events: number;
}

export interface RecurrenceExpansion {
  original_event_id: string;
  expanded_instances: Array<{
    start_time: string;
    end_time: string;
  }>;
}
