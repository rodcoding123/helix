/**
 * Calendar Client Hook
 * Week 4 Track 4: Calendar Foundation - Task 4.3
 * State management for calendar operations
 */

import { useState, useCallback, useEffect } from 'react';
import { getGatewayClient } from '../lib/gateway-connection';
import type { CalendarEvent, CreateEventParams } from '../../../helix-runtime/src/types/calendar';

interface UseCalendarClientOptions {
  initialStartDate?: Date;
  initialEndDate?: Date;
  viewType?: 'month' | 'week' | 'day';
}

interface CalendarState {
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  isLoading: boolean;
  isCreating: boolean;
  isSyncing: boolean;
  error: string | null;
  viewType: 'month' | 'week' | 'day';
  currentDate: Date;
  syncStatus?: {
    status: string;
    events_synced: number;
  };
}

export function useCalendarClient(options: UseCalendarClientOptions = {}) {
  const {
    initialStartDate = new Date(new Date().setDate(1)),
    initialEndDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    viewType = 'month',
  } = options;

  const [state, setState] = useState<CalendarState>({
    events: [],
    selectedEvent: null,
    isLoading: false,
    isCreating: false,
    isSyncing: false,
    error: null,
    viewType,
    currentDate: new Date(),
  });

  const client = getGatewayClient();

  /**
   * Load events for the given date range
   */
  const loadEvents = useCallback(
    async (startDate: Date, endDate: Date) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await client.request('calendar.get_events', {
          user_id: 'current_user', // Would come from auth context
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          limit: 100,
        });

        setState(prev => ({
          ...prev,
          events: result.events || [],
          isLoading: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isLoading: false,
        }));
      }
    },
    [client]
  );

  /**
   * Search events by query
   */
  const searchEvents = useCallback(
    async (query: string, startDate?: Date, endDate?: Date) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await client.request('calendar.search_events', {
          user_id: 'current_user',
          query,
          start_time: startDate?.toISOString(),
          end_time: endDate?.toISOString(),
          limit: 50,
        });

        setState(prev => ({
          ...prev,
          events: result.events || [],
          isLoading: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isLoading: false,
        }));
      }
    },
    [client]
  );

  /**
   * Get a specific event with all attendees
   */
  const getEvent = useCallback(
    async (eventId: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const result = await client.request('calendar.get_event', {
          event_id: eventId,
        });

        setState(prev => ({
          ...prev,
          selectedEvent: result.event,
          isLoading: false,
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isLoading: false,
        }));
      }
    },
    [client]
  );

  /**
   * Create a new event
   */
  const createEvent = useCallback(
    async (event: CreateEventParams) => {
      setState(prev => ({ ...prev, isCreating: true, error: null }));
      try {
        const result = await client.request('calendar.add_event', {
          user_id: 'current_user',
          event,
        });

        setState(prev => ({
          ...prev,
          events: [...prev.events, result],
          isCreating: false,
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isCreating: false,
        }));
      }
    },
    [client]
  );

  /**
   * Update an existing event
   */
  const updateEvent = useCallback(
    async (eventId: string, updates: Partial<CreateEventParams>) => {
      setState(prev => ({ ...prev, isCreating: true, error: null }));
      try {
        const result = await client.request('calendar.update_event', {
          event_id: eventId,
          event: updates,
        });

        setState(prev => ({
          ...prev,
          events: prev.events.map(e => (e.id === eventId ? result : e)),
          selectedEvent: result,
          isCreating: false,
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isCreating: false,
        }));
      }
    },
    [client]
  );

  /**
   * Delete an event
   */
  const deleteEvent = useCallback(
    async (eventId: string) => {
      setState(prev => ({ ...prev, isCreating: true, error: null }));
      try {
        await client.request('calendar.delete_event', {
          event_id: eventId,
        });

        setState(prev => ({
          ...prev,
          events: prev.events.filter(e => e.id !== eventId),
          selectedEvent: null,
          isCreating: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isCreating: false,
        }));
      }
    },
    [client]
  );

  /**
   * Create a recurring event
   */
  const createRecurringEvent = useCallback(
    async (event: CreateEventParams, rrule: string) => {
      setState(prev => ({ ...prev, isCreating: true, error: null }));
      try {
        const result = await client.request('calendar.create_recurring', {
          user_id: 'current_user',
          event,
          rrule,
        });

        setState(prev => ({
          ...prev,
          events: [...prev.events, result],
          isCreating: false,
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isCreating: false,
        }));
      }
    },
    [client]
  );

  /**
   * Sync calendar with external provider
   */
  const syncCalendar = useCallback(
    async (accountId: string) => {
      setState(prev => ({ ...prev, isSyncing: true, error: null }));
      try {
        const result = await client.request('calendar.sync_calendar', {
          account_id: accountId,
          user_id: 'current_user',
        });

        setState(prev => ({
          ...prev,
          isSyncing: false,
          syncStatus: result,
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isSyncing: false,
        }));
      }
    },
    [client]
  );

  /**
   * Get calendar view (month/week/day)
   */
  const getCalendarView = useCallback(
    async (startDate: Date, endDate: Date, type: 'month' | 'week' | 'day') => {
      setState(prev => ({ ...prev, isLoading: true, error: null, viewType: type }));
      try {
        const result = await client.request('calendar.get_calendar_view', {
          user_id: 'current_user',
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          view_type: type,
        });

        setState(prev => ({
          ...prev,
          events: result.events || [],
          viewType: type,
          isLoading: false,
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: (error as Error).message,
          isLoading: false,
        }));
      }
    },
    [client]
  );

  /**
   * Change current date and load events
   */
  const changeDate = useCallback(
    async (date: Date) => {
      setState(prev => ({ ...prev, currentDate: date }));

      // Calculate new date range based on view type
      let startDate = date;
      let endDate = new Date(date);

      if (state.viewType === 'month') {
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      } else if (state.viewType === 'week') {
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(date.setDate(diff));
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
      } else {
        // day view
        endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
      }

      await getCalendarView(startDate, endDate, state.viewType);
    },
    [state.viewType, getCalendarView]
  );

  // Load initial events on mount
  useEffect(() => {
    loadEvents(initialStartDate, initialEndDate);
  }, []);

  return {
    // State
    events: state.events,
    selectedEvent: state.selectedEvent,
    isLoading: state.isLoading,
    isCreating: state.isCreating,
    isSyncing: state.isSyncing,
    error: state.error,
    viewType: state.viewType,
    currentDate: state.currentDate,
    syncStatus: state.syncStatus,

    // Methods
    loadEvents,
    searchEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    createRecurringEvent,
    syncCalendar,
    getCalendarView,
    changeDate,
  };
}
