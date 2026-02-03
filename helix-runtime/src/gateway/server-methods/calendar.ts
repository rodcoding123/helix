/**
 * Calendar Integration RPC Methods
 * Week 4 Track 4: Calendar Foundation - Task 4.2
 * 10 RPC handlers for event management, sync, and calendar views
 */

import { GatewayRequestHandlers } from '../protocol/types';
import {
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  GetEventsParams,
  SearchEventsParams,
  CalendarViewParams,
  UpdateAttendeeParams,
  SyncCalendarParams,
} from '../../types/calendar';

export const calendarHandlers: GatewayRequestHandlers = {
  /**
   * calendar.add_event
   * Create a new calendar event
   */
  'calendar.add_event': async ({ params, respond, context }) => {
    const { user_id, event } = params as { user_id: string; event: CreateEventParams };

    try {
      const result = await context.db.query(
        `INSERT INTO calendar_events
        (user_id, account_id, title, description, start_time, end_time, is_all_day, location, attendees, recurrence_rule)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          user_id,
          event.account_id || null,
          event.title,
          event.description || null,
          event.start_time,
          event.end_time,
          event.is_all_day || false,
          event.location || null,
          event.attendees ? JSON.stringify(event.attendees) : null,
          event.recurrence_rule || null,
        ]
      );

      // Log to Discord
      await context.discord.send('commands', {
        type: 'calendar_event_created',
        user_id,
        event_title: event.title,
        start_time: event.start_time,
      });

      respond(true, { event_id: result.rows[0].id, ...result.rows[0] });
    } catch (error) {
      await context.discord.send('alerts', {
        type: 'calendar_error',
        error: (error as Error).message,
        method: 'calendar.add_event',
      });
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.get_events
   * Get events for a date range with optional pagination
   */
  'calendar.get_events': async ({ params, respond, context }) => {
    const { user_id, start_time, end_time, account_id, limit = 50, offset = 0 } = params as GetEventsParams;

    try {
      const query = `
        SELECT * FROM calendar_events
        WHERE user_id = $1
        AND start_time >= $2
        AND end_time <= $3
        ${account_id ? 'AND account_id = $4' : ''}
        ORDER BY start_time ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const queryParams = account_id ? [user_id, start_time, end_time, account_id] : [user_id, start_time, end_time];

      const result = await context.db.query(query, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM calendar_events
        WHERE user_id = $1
        AND start_time >= $2
        AND end_time <= $3
        ${account_id ? 'AND account_id = $4' : ''}
      `;

      const countResult = await context.db.query(countQuery, queryParams);

      respond(true, {
        events: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
      });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.search_events
   * Full-text search across event titles and descriptions
   */
  'calendar.search_events': async ({ params, respond, context }) => {
    const { user_id, query, start_time, end_time, account_id, limit = 50, offset = 0 } = params as SearchEventsParams;

    try {
      const queryStr = `
        SELECT * FROM calendar_events
        WHERE user_id = $1
        AND (
          to_tsvector('english', title) @@ plainto_tsquery('english', $2)
          OR to_tsvector('english', description) @@ plainto_tsquery('english', $2)
        )
        ${start_time ? 'AND start_time >= $3' : ''}
        ${end_time ? `AND end_time <= $${start_time ? 4 : 3}` : ''}
        ${account_id ? `AND account_id = $${start_time && end_time ? 5 : start_time || end_time ? 4 : 3}` : ''}
        ORDER BY ts_rank(to_tsvector('english', title), plainto_tsquery('english', $2)) DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const queryParams = [user_id, query];
      if (start_time) queryParams.push(start_time);
      if (end_time) queryParams.push(end_time);
      if (account_id) queryParams.push(account_id);

      const result = await context.db.query(queryStr, queryParams);

      respond(true, {
        events: result.rows,
        query,
        limit,
        offset,
      });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.get_event
   * Get a specific event by ID with all attendees
   */
  'calendar.get_event': async ({ params, respond, context }) => {
    const { event_id } = params as { event_id: string };

    try {
      const eventResult = await context.db.query(
        'SELECT * FROM calendar_events WHERE id = $1',
        [event_id]
      );

      if (eventResult.rows.length === 0) {
        respond(false, { error: 'Event not found' });
        return;
      }

      const attendeesResult = await context.db.query(
        'SELECT * FROM calendar_attendees WHERE event_id = $1 ORDER BY created_at ASC',
        [event_id]
      );

      respond(true, {
        event: eventResult.rows[0],
        attendees: attendeesResult.rows,
      });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.update_event
   * Update an existing event
   */
  'calendar.update_event': async ({ params, respond, context }) => {
    const { event_id, event } = params as { event_id: string; event: UpdateEventParams };

    try {
      const updateFields: string[] = [];
      const updateValues: unknown[] = [];
      let paramIndex = 1;

      if (event.title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        updateValues.push(event.title);
      }
      if (event.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(event.description);
      }
      if (event.start_time !== undefined) {
        updateFields.push(`start_time = $${paramIndex++}`);
        updateValues.push(event.start_time);
      }
      if (event.end_time !== undefined) {
        updateFields.push(`end_time = $${paramIndex++}`);
        updateValues.push(event.end_time);
      }
      if (event.is_all_day !== undefined) {
        updateFields.push(`is_all_day = $${paramIndex++}`);
        updateValues.push(event.is_all_day);
      }
      if (event.location !== undefined) {
        updateFields.push(`location = $${paramIndex++}`);
        updateValues.push(event.location);
      }
      if (event.recurrence_rule !== undefined) {
        updateFields.push(`recurrence_rule = $${paramIndex++}`);
        updateValues.push(event.recurrence_rule);
      }

      updateValues.push(event_id);

      const query = `UPDATE calendar_events SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

      const result = await context.db.query(query, updateValues);

      respond(true, result.rows[0]);
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.delete_event
   * Delete an event and all related attendees
   */
  'calendar.delete_event': async ({ params, respond, context }) => {
    const { event_id } = params as { event_id: string };

    try {
      // Attendees will be deleted via cascade
      const result = await context.db.query(
        'DELETE FROM calendar_events WHERE id = $1 RETURNING id',
        [event_id]
      );

      if (result.rows.length === 0) {
        respond(false, { error: 'Event not found' });
        return;
      }

      respond(true, { deleted_event_id: event_id });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.create_recurring
   * Create a recurring event with RFC 5545 RRULE
   */
  'calendar.create_recurring': async ({ params, respond, context }) => {
    const { user_id, event, rrule } = params as {
      user_id: string;
      event: CreateEventParams;
      rrule: string;
    };

    try {
      const result = await context.db.query(
        `INSERT INTO calendar_events
        (user_id, account_id, title, description, start_time, end_time, is_all_day, location, recurrence_rule, attendees)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          user_id,
          event.account_id || null,
          event.title,
          event.description || null,
          event.start_time,
          event.end_time,
          event.is_all_day || false,
          event.location || null,
          rrule,
          event.attendees ? JSON.stringify(event.attendees) : null,
        ]
      );

      respond(true, {
        event_id: result.rows[0].id,
        rrule,
        ...result.rows[0],
      });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.update_attendees
   * Manage event attendees (add/update/remove)
   */
  'calendar.update_attendees': async ({ params, respond, context }) => {
    const { event_id, attendees } = params as UpdateAttendeeParams;

    try {
      // Delete existing attendees
      await context.db.query('DELETE FROM calendar_attendees WHERE event_id = $1', [event_id]);

      // Insert new attendees
      const insertedAttendees = [];
      for (const attendee of attendees) {
        const result = await context.db.query(
          `INSERT INTO calendar_attendees (event_id, email, name, status)
          VALUES ($1, $2, $3, $4)
          RETURNING *`,
          [event_id, attendee.email, attendee.name || null, attendee.status || 'pending']
        );
        insertedAttendees.push(result.rows[0]);
      }

      respond(true, { attendees: insertedAttendees });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.sync_calendar
   * Start calendar sync with external providers
   */
  'calendar.sync_calendar': async ({ params, respond, context }) => {
    const { account_id, user_id } = params as SyncCalendarParams;

    try {
      // Create sync log entry
      const syncResult = await context.db.query(
        `INSERT INTO calendar_sync_log (account_id, started_at, status)
        VALUES ($1, NOW(), $2)
        RETURNING *`,
        [account_id, 'running']
      );

      const syncId = syncResult.rows[0].id;

      // Start async sync (in real implementation, would trigger background worker)
      setImmediate(async () => {
        try {
          // Mock sync - in real implementation would call provider API
          const mockEventsCount = 0;

          await context.db.query(
            `UPDATE calendar_sync_log SET completed_at = NOW(), status = $1, events_synced = $2 WHERE id = $3`,
            ['completed', mockEventsCount, syncId]
          );

          await context.discord.send('commands', {
            type: 'calendar_sync_completed',
            sync_id: syncId,
            events: mockEventsCount,
          });
        } catch (error) {
          await context.db.query(
            `UPDATE calendar_sync_log SET completed_at = NOW(), status = $1, error_message = $2 WHERE id = $3`,
            ['failed', (error as Error).message, syncId]
          );
        }
      });

      respond(true, { sync_id: syncId, status: 'running' });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.get_sync_status
   * Check calendar sync progress
   */
  'calendar.get_sync_status': async ({ params, respond, context }) => {
    const { sync_id } = params as { sync_id: string };

    try {
      const result = await context.db.query(
        'SELECT * FROM calendar_sync_log WHERE id = $1',
        [sync_id]
      );

      if (result.rows.length === 0) {
        respond(false, { error: 'Sync not found' });
        return;
      }

      respond(true, result.rows[0]);
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },

  /**
   * calendar.get_calendar_view
   * Get events formatted for month/week/day views
   */
  'calendar.get_calendar_view': async ({ params, respond, context }) => {
    const { user_id, start_time, end_time, view_type, account_id } = params as CalendarViewParams;

    try {
      const query = `
        SELECT * FROM calendar_events
        WHERE user_id = $1
        AND start_time >= $2
        AND end_time <= $3
        ${account_id ? 'AND account_id = $4' : ''}
        ORDER BY start_time ASC
      `;

      const queryParams = account_id ? [user_id, start_time, end_time, account_id] : [user_id, start_time, end_time];

      const result = await context.db.query(query, queryParams);

      // Format events based on view type
      const formattedEvents = result.rows.map(event => ({
        ...event,
        display_time: view_type === 'day' ? event.start_time : event.start_time,
      }));

      respond(true, {
        events: formattedEvents,
        date_range: { start: start_time, end: end_time },
        view_type,
        total_events: result.rows.length,
      });
    } catch (error) {
      respond(false, { error: (error as Error).message });
    }
  },
};
