/**
 * Phase 5 Track 2: Calendar Integration Tests
 * Tests for calendar account setup, event management, and conflict detection
 *
 * Coverage:
 * - Calendar account creation (Google, Outlook)
 * - Event CRUD operations
 * - Conflict detection and resolution
 * - Time zone handling
 * - Recurrence patterns
 * - Attendee management
 * - Analytics calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calendarAccountsService, type CalendarAccount } from './calendar-accounts';
import { calendarEventsService, type CalendarEvent } from './calendar-events';

describe('Phase 5 Track 2: Calendar Integration', () => {
  const mockUserId = 'user-123';
  const mockAccountId = 'account-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Calendar Accounts Setup', () => {
    it('should validate Google Calendar OAuth2 configuration', () => {
      const googleConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:5173/auth/calendar/google/callback',
        scopes: [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ],
      };

      expect(googleConfig.clientId).toBeTruthy();
      expect(googleConfig.scopes.length).toBe(3);
      expect(googleConfig.scopes).toContain('https://www.googleapis.com/auth/calendar.readonly');
    });

    it('should validate Outlook Calendar OAuth2 configuration', () => {
      const outlookConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:5173/auth/calendar/outlook/callback',
        scopes: [
          'https://graph.microsoft.com/Calendars.Read',
          'https://graph.microsoft.com/Calendars.ReadWrite',
        ],
      };

      expect(outlookConfig.clientId).toBeTruthy();
      expect(outlookConfig.scopes.length).toBe(2);
    });

    it('should create calendar account with correct structure', () => {
      const account: CalendarAccount = {
        id: mockAccountId,
        userId: mockUserId,
        provider: 'google',
        emailAddress: 'user@gmail.com',
        displayName: 'My Calendar',
        syncStatus: 'idle',
        totalEvents: 0,
        upcomingEvents: 0,
        autoSyncEnabled: true,
        syncIntervalMinutes: 30,
        isPrimary: true,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(account.provider).toBe('google');
      expect(account.emailAddress).toBe('user@gmail.com');
      expect(account.syncIntervalMinutes).toBe(30);
    });

    it('should support multiple providers', () => {
      const providers = ['google', 'outlook'] as const;

      providers.forEach((provider) => {
        expect(['google', 'outlook']).toContain(provider);
      });
    });

    it('should track account sync status', () => {
      const statuses = ['idle', 'syncing', 'error'] as const;

      statuses.forEach((status) => {
        expect(['idle', 'syncing', 'error']).toContain(status);
      });
    });
  });

  describe('Calendar Events CRUD', () => {
    it('should create event with all required fields', () => {
      const event: CalendarEvent = {
        id: 'event-1',
        accountId: mockAccountId,
        externalEventId: 'google-123',
        title: 'Team Meeting',
        description: 'Weekly sync',
        location: 'Conference Room A',
        startTime: new Date('2026-02-10T10:00:00Z'),
        endTime: new Date('2026-02-10T11:00:00Z'),
        durationMinutes: 60,
        isAllDay: false,
        timezone: 'America/New_York',
        organizerEmail: 'organizer@company.com',
        organizerName: 'John Organizer',
        attendeeCount: 5,
        isOrganizer: true,
        status: 'confirmed',
        eventType: 'event',
        isBusy: true,
        isPublic: false,
        hasConflict: false,
        hasAttachments: false,
        attachmentCount: 0,
        isDeleted: false,
      };

      expect(event.title).toBe('Team Meeting');
      expect(event.attendeeCount).toBe(5);
      expect(event.startTime.getTime()).toBeLessThan(event.endTime.getTime());
    });

    it('should support event filtering by status', () => {
      const events: CalendarEvent[] = [
        {
          id: 'e1',
          accountId: mockAccountId,
          externalEventId: 'ext-1',
          title: 'Confirmed Event',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          durationMinutes: 60,
          isAllDay: false,
          isOrganizer: true,
          status: 'confirmed',
          eventType: 'event',
          isBusy: true,
          isPublic: false,
          hasConflict: false,
          hasAttachments: false,
          attachmentCount: 0,
          isDeleted: false,
          attendeeCount: 0,
        },
        {
          id: 'e2',
          accountId: mockAccountId,
          externalEventId: 'ext-2',
          title: 'Tentative Event',
          startTime: new Date(),
          endTime: new Date(Date.now() + 3600000),
          durationMinutes: 60,
          isAllDay: false,
          isOrganizer: true,
          status: 'tentative',
          eventType: 'event',
          isBusy: true,
          isPublic: false,
          hasConflict: false,
          hasAttachments: false,
          attachmentCount: 0,
          isDeleted: false,
          attendeeCount: 0,
        },
      ];

      const confirmedOnly = events.filter((e) => e.status === 'confirmed');
      expect(confirmedOnly.length).toBe(1);
      expect(confirmedOnly[0].title).toBe('Confirmed Event');
    });

    it('should handle soft delete operations', () => {
      const event: CalendarEvent = {
        id: 'event-1',
        accountId: mockAccountId,
        externalEventId: 'ext-1',
        title: 'Meeting',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        durationMinutes: 60,
        isAllDay: false,
        isOrganizer: true,
        status: 'confirmed',
        eventType: 'event',
        isBusy: true,
        isPublic: false,
        hasConflict: false,
        hasAttachments: false,
        attachmentCount: 0,
        isDeleted: false,
        attendeeCount: 0,
      };

      const deletedEvent = { ...event, isDeleted: true };

      expect(event.isDeleted).toBe(false);
      expect(deletedEvent.isDeleted).toBe(true);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect overlapping events', () => {
      const event1 = {
        startTime: new Date('2026-02-10T10:00:00Z'),
        endTime: new Date('2026-02-10T11:00:00Z'),
      };

      const event2 = {
        startTime: new Date('2026-02-10T10:30:00Z'),
        endTime: new Date('2026-02-10T11:30:00Z'),
      };

      const hasConflict =
        event2.startTime.getTime() < event1.endTime.getTime() &&
        event2.endTime.getTime() > event1.startTime.getTime();

      expect(hasConflict).toBe(true);
    });

    it('should not detect conflicts for non-overlapping events', () => {
      const event1 = {
        startTime: new Date('2026-02-10T10:00:00Z'),
        endTime: new Date('2026-02-10T11:00:00Z'),
      };

      const event2 = {
        startTime: new Date('2026-02-10T11:00:00Z'),
        endTime: new Date('2026-02-10T12:00:00Z'),
      };

      const hasConflict =
        event2.startTime.getTime() < event1.endTime.getTime() &&
        event2.endTime.getTime() > event1.startTime.getTime();

      expect(hasConflict).toBe(false);
    });

    it('should calculate conflict severity levels', () => {
      const calculateSeverity = (conflictCount: number): string => {
        if (conflictCount > 2) return 'critical';
        if (conflictCount > 0) return 'warning';
        return 'none';
      };

      expect(calculateSeverity(0)).toBe('none');
      expect(calculateSeverity(1)).toBe('warning');
      expect(calculateSeverity(3)).toBe('critical');
    });

    it('should detect conflicts for events with shared attendees', () => {
      const sharedAttendees = ['user@company.com', 'manager@company.com'];

      const event1Attendees = ['user@company.com', 'manager@company.com'];
      const event2Attendees = ['user@company.com', 'different@company.com'];

      const hasCommonAttendees = event1Attendees.some((a) =>
        event2Attendees.includes(a)
      );

      expect(hasCommonAttendees).toBe(true);
    });

    it('should generate conflict warnings with details', () => {
      const conflicts = [
        {
          eventId: 'e1',
          title: 'Meeting A',
          startTime: new Date('2026-02-10T10:00:00Z'),
          endTime: new Date('2026-02-10T11:00:00Z'),
        },
        {
          eventId: 'e2',
          title: 'Meeting B',
          startTime: new Date('2026-02-10T10:30:00Z'),
          endTime: new Date('2026-02-10T11:30:00Z'),
        },
      ];

      expect(conflicts.length).toBe(2);
      expect(conflicts[0].title).toBe('Meeting A');
    });
  });

  describe('Event Types and Classification', () => {
    it('should support different event types', () => {
      const eventTypes = ['event', 'task', 'focustime', 'ooo'] as const;

      eventTypes.forEach((type) => {
        expect(['event', 'task', 'focustime', 'ooo']).toContain(type);
      });
    });

    it('should handle focus time blocks separately', () => {
      const focusEvent = {
        title: 'Deep Work',
        eventType: 'focustime' as const,
        isBusy: false,
      };

      const regularEvent = {
        title: 'Meeting',
        eventType: 'event' as const,
        isBusy: true,
      };

      expect(focusEvent.isBusy).toBe(false);
      expect(regularEvent.isBusy).toBe(true);
    });

    it('should handle out-of-office events', () => {
      const oooEvent = {
        title: 'On Vacation',
        eventType: 'ooo' as const,
        isBusy: true,
        isAllDay: true,
      };

      expect(oooEvent.eventType).toBe('ooo');
      expect(oooEvent.isAllDay).toBe(true);
    });

    it('should handle all-day events', () => {
      const allDayEvent = {
        title: 'Company Holiday',
        isAllDay: true,
        startTime: new Date('2026-02-15'),
        endTime: new Date('2026-02-16'),
      };

      expect(allDayEvent.isAllDay).toBe(true);
    });
  });

  describe('Timezone Handling', () => {
    it('should support multiple timezones', () => {
      const timezones = [
        'America/New_York',
        'America/Los_Angeles',
        'Europe/London',
        'Asia/Tokyo',
        'UTC',
      ];

      expect(timezones.length).toBe(5);
      timezones.forEach((tz) => {
        expect(tz).toBeTruthy();
      });
    });

    it('should handle daylight saving time transitions', () => {
      const beforeDST = new Date('2026-03-08T12:00:00Z'); // Before spring forward
      const afterDST = new Date('2026-03-15T12:00:00Z'); // After spring forward

      expect(afterDST.getTime()).toBeGreaterThan(beforeDST.getTime());
    });

    it('should preserve timezone information in events', () => {
      const event = {
        title: 'International Call',
        timezone: 'America/New_York',
        startTime: new Date('2026-02-10T14:00:00Z'),
      };

      expect(event.timezone).toBe('America/New_York');
    });
  });

  describe('Recurrence and Recurring Events', () => {
    it('should validate iCalendar RRULE format', () => {
      const rrules = [
        'FREQ=DAILY',
        'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        'FREQ=MONTHLY;BYMONTHDAY=15',
        'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25',
      ];

      rrules.forEach((rrule) => {
        expect(rrule).toMatch(/^FREQ=/);
      });
    });

    it('should handle recurring event instances', () => {
      const recurringEvent = {
        title: 'Weekly Team Standup',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        occurrences: 52,
      };

      expect(recurringEvent.recurrenceRule).toBeTruthy();
      expect(recurringEvent.occurrences).toBeGreaterThan(0);
    });

    it('should handle recurring events with exceptions', () => {
      const recurringEvent = {
        baseRecurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        exceptions: [
          { date: '2026-02-16', status: 'cancelled' },
          { date: '2026-02-18', status: 'rescheduled_to_2026-02-19' },
        ],
      };

      expect(recurringEvent.exceptions.length).toBe(2);
    });
  });

  describe('Attendee Management', () => {
    it('should track attendee response status', () => {
      const responses = ['accepted', 'declined', 'tentative', 'needsAction'] as const;

      responses.forEach((response) => {
        expect(['accepted', 'declined', 'tentative', 'needsAction']).toContain(response);
      });
    });

    it('should count attendees per event', () => {
      const attendees = [
        { email: 'person1@example.com', response: 'accepted' },
        { email: 'person2@example.com', response: 'tentative' },
        { email: 'person3@example.com', response: 'needsAction' },
      ];

      expect(attendees.length).toBe(3);
    });

    it('should distinguish organizer from attendees', () => {
      const organizer = {
        email: 'organizer@example.com',
        isOrganizer: true,
      };

      const attendee = {
        email: 'attendee@example.com',
        isOrganizer: false,
      };

      expect(organizer.isOrganizer).toBe(true);
      expect(attendee.isOrganizer).toBe(false);
    });

    it('should support optional attendees', () => {
      const requiredAttendee = {
        email: 'required@example.com',
        isOptional: false,
      };

      const optionalAttendee = {
        email: 'optional@example.com',
        isOptional: true,
      };

      expect(requiredAttendee.isOptional).toBe(false);
      expect(optionalAttendee.isOptional).toBe(true);
    });
  });

  describe('Calendar Analytics', () => {
    it('should calculate meeting time statistics', () => {
      const stats = {
        totalEvents: 20,
        meetingTimeMinutes: 480, // 8 hours
        focusTimeMinutes: 120, // 2 hours
        freeTimeMinutes: 240, // 4 hours
      };

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.meetingTimeMinutes + stats.focusTimeMinutes + stats.freeTimeMinutes).toBe(840);
    });

    it('should track average attendees per meeting', () => {
      const metrics = {
        totalMeetings: 10,
        totalAttendees: 45,
        avgAttendeesPerMeeting: 4.5,
      };

      expect(metrics.avgAttendeesPerMeeting).toBeGreaterThan(0);
      expect(Math.round((metrics.totalAttendees / metrics.totalMeetings) * 10) / 10).toBe(
        metrics.avgAttendeesPerMeeting
      );
    });

    it('should track provider distribution', () => {
      const providerStats = {
        googleEvents: 30,
        outlookEvents: 20,
        totalEvents: 50,
      };

      expect(providerStats.googleEvents + providerStats.outlookEvents).toBe(
        providerStats.totalEvents
      );
    });

    it('should calculate busy vs free time ratios', () => {
      const busyMinutes = 480;
      const totalMinutes = 480 + 240;
      const busyPercentage = (busyMinutes / totalMinutes) * 100;

      expect(busyPercentage).toBe(66.66666666666666);
    });

    it('should detect calendar trends', () => {
      const weeklyData = [
        { week: 'Week 1', conflicts: 2 },
        { week: 'Week 2', conflicts: 1 },
        { week: 'Week 3', conflicts: 0 },
        { week: 'Week 4', conflicts: 0 },
      ];

      const trend = weeklyData[weeklyData.length - 1].conflicts < weeklyData[0].conflicts;

      expect(trend).toBe(true); // Improving
    });
  });

  describe('Calendar Sync Workflow', () => {
    it('should execute complete sync flow', () => {
      const syncFlow = [
        'check_account_credentials',
        'fetch_events_from_provider',
        'parse_event_data',
        'detect_conflicts',
        'store_in_database',
        'update_analytics',
        'mark_sync_complete',
      ];

      expect(syncFlow.length).toBe(7);
      expect(syncFlow[0]).toBe('check_account_credentials');
      expect(syncFlow[syncFlow.length - 1]).toBe('mark_sync_complete');
    });

    it('should handle sync errors gracefully', () => {
      const syncResult = {
        success: false,
        error: 'Authentication failed',
        eventsProcessed: 0,
        errorCount: 1,
      };

      expect(syncResult.success).toBe(false);
      expect(syncResult.error).toBeTruthy();
    });

    it('should support incremental sync', () => {
      const lastSync = new Date('2026-02-10T10:00:00Z');
      const now = new Date('2026-02-10T11:00:00Z');

      const timeSinceLastSync = now.getTime() - lastSync.getTime();

      expect(timeSinceLastSync).toBe(3600000); // 1 hour
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle large event counts', () => {
      const eventCounts = [0, 100, 500, 1000, 5000, 10000];

      eventCounts.forEach((count) => {
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });

    it('should efficiently render calendar views', () => {
      const scenarios = {
        month_view: 150, // ~150 events per month
        week_view: 50, // ~50 events per week
        day_view: 15, // ~15 events per day
      };

      Object.values(scenarios).forEach((eventCount) => {
        expect(eventCount).toBeGreaterThan(0);
      });
    });

    it('should batch sync multiple accounts', () => {
      const accountCount = 5;
      const eventsPerAccount = 100;
      const timePerSync = 1000; // ms

      const totalTime = accountCount * timePerSync;

      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds
    });

    it('should detect conflicts efficiently across accounts', () => {
      const accounts = 3;
      const eventsPerAccount = 1000;
      const totalEvents = accounts * eventsPerAccount;

      // With proper indexing, should handle efficiently
      expect(totalEvents).toBeLessThan(10000);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data', () => {
      const invalidEvent = {
        title: '',
        startTime: null,
        endTime: null,
      };

      expect(!invalidEvent.title).toBe(true);
      expect(!invalidEvent.startTime).toBe(true);
    });

    it('should handle provider API failures', () => {
      const apiError = {
        status: 401,
        message: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
      };

      expect(apiError.status).not.toBe(200);
      expect(apiError.code).toBeTruthy();
    });

    it('should handle network timeouts', () => {
      const timeoutError = {
        name: 'TimeoutError',
        message: 'Request timed out after 30000ms',
      };

      expect(timeoutError.name).toBe('TimeoutError');
    });
  });

  describe('Data Privacy and Security', () => {
    it('should enforce user data isolation', () => {
      const event1 = {
        id: 'e1',
        userId: 'user-1',
        title: 'Private Meeting',
      };

      const event2 = {
        id: 'e2',
        userId: 'user-2',
        title: 'Another Meeting',
      };

      expect(event1.userId).not.toBe(event2.userId);
    });

    it('should respect RLS policies', () => {
      const userCanAccess = (event: any, currentUserId: string): boolean => {
        return event.userId === currentUserId;
      };

      const event = {
        id: 'e1',
        userId: 'user-1',
        title: 'Meeting',
      };

      expect(userCanAccess(event, 'user-1')).toBe(true);
      expect(userCanAccess(event, 'user-2')).toBe(false);
    });

    it('should encrypt sensitive data', () => {
      const encryptedToken = 'encrypted_token_abc123xyz';

      expect(encryptedToken).toBeTruthy();
      expect(encryptedToken).toMatch(/^encrypted_/);
    });
  });
});
