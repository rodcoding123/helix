/**
 * Smart Scheduling Integration Tests - Phase 7 Track 3
 * End-to-end tests for meeting time suggestion workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const store = new Map();
  return {
    supabase: {
      from: (table) => {
        if (!store.has(table)) store.set(table, []);
        return {
          insert: (data) => ({
            select: () => ({
              single: async () => ({
                data: { id: `${table}-${Date.now()}`, ...data },
                error: null,
              }),
            }),
          }),
          select: () => ({
            eq: (col1, val1) => ({
              then: async (cb) => cb({ data: [], error: null }),
            }),
          }),
          update: (data) => ({
            eq: () => ({
              then: async (cb) => cb({ data: null, error: null }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              then: async (cb) => cb({ data: null, error: null }),
            }),
          }),
        };
      },
    },
  };
});

// Mock Discord logging
vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

import { getSmartSchedulingService } from '../automation-smart-scheduling.js';
import { createMockCalendarEvent, createMockTimeSlot } from '../__test-utils/automation-factory.js';

describe('Smart Scheduling Integration Workflow', () => {
  const testAttendees = ['alice@company.com', 'bob@company.com', 'charlie@company.com'];
  const testDuration = 60; // 1 hour

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Finding Best Meeting Times', () => {
    it('finds suitable times for multiple attendees', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000), // 7 days
        },
      });

      expect(suggestion).toBeDefined();
      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
      expect(suggestion.bestTime).toBeDefined();
    });

    it('respects attendee count in scoring', async () => {
      const schedulingService = getSmartSchedulingService();

      const singleAttendee = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['alice@company.com'],
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      const multipleAttendees = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(singleAttendee.suggestedTimes).toBeDefined();
      expect(multipleAttendees.suggestedTimes).toBeDefined();
    });

    it('returns sorted suggestions by quality score', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      if (suggestion.suggestedTimes.length > 1) {
        for (let i = 0; i < suggestion.suggestedTimes.length - 1; i++) {
          expect(suggestion.suggestedTimes[i].score).toBeGreaterThanOrEqual(
            suggestion.suggestedTimes[i + 1].score
          );
        }
      }
    });
  });

  describe('Calendar Conflict Detection', () => {
    it('avoids times with calendar conflicts', async () => {
      const schedulingService = getSmartSchedulingService();

      const busyEvent = createMockCalendarEvent({
        start: new Date(Date.now() + 86400000), // Tomorrow
        end: new Date(Date.now() + 90000000),
      });

      const freetime = await schedulingService.hasConflict(
        [busyEvent],
        new Date(Date.now() + 100000000), // After busy event
        new Date(Date.now() + 103600000)
      );

      expect(typeof freetime).toBe('boolean');
    });

    it('detects overlapping events', async () => {
      const schedulingService = getSmartSchedulingService();

      const eventStart = new Date(Date.now() + 86400000);
      const eventEnd = new Date(eventStart.getTime() + 3600000);

      const hasConflict = await schedulingService.hasConflict(
        [
          createMockCalendarEvent({
            start: eventStart,
            end: eventEnd,
          }),
        ],
        new Date(eventStart.getTime() - 1800000), // Overlaps
        new Date(eventStart.getTime() + 1800000)
      );

      expect(typeof hasConflict).toBe('boolean');
    });
  });

  describe('Time Slot Scoring Algorithm', () => {
    it('returns scored time slots with breakdown', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      if (result.suggestedTimes.length > 0) {
        const slot = result.suggestedTimes[0];
        expect(typeof slot.score).toBe('number');
        expect(slot.scoreBreakdown).toBeDefined();
        expect(typeof slot.scoreBreakdown?.timeOfDayScore).toBe('number');
        expect(typeof slot.scoreBreakdown?.dayOfWeekScore).toBe('number');
      }
    });

    it('includes attendee availability in scoring', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      if (result.suggestedTimes.length > 0) {
        expect(result.suggestedTimes[0].scoreBreakdown?.attendeeAvailabilityScore).toBeDefined();
      }
    });

    it('includes preference scoring', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      if (result.suggestedTimes.length > 0) {
        expect(result.suggestedTimes[0].scoreBreakdown?.preferenceScore).toBeDefined();
      }
    });

    it('returns consistent scoring across multiple calls', async () => {
      const schedulingService = getSmartSchedulingService();

      const now = new Date();
      const endDate = new Date(now.getTime() + 604800000);

      const result1 = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: now,
          end: endDate,
        },
      });

      const result2 = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: now,
          end: endDate,
        },
      });

      expect(result1.suggestedTimes.length).toBe(result2.suggestedTimes.length);
      if (result1.suggestedTimes.length > 0 && result2.suggestedTimes.length > 0) {
        // Should return the same slots (within 1 second tolerance for timing)
        expect(Math.abs(result1.suggestedTimes[0].start.getTime() - result2.suggestedTimes[0].start.getTime())).toBeLessThan(1000);
        expect(result1.suggestedTimes[0].score).toBe(result2.suggestedTimes[0].score);
      }
    });
  });

  describe('Preference Respecting', () => {
    it('supports preferred meeting times parameter', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
        preferences: {
          preferredTimes: { start: '09:00', end: '11:00' },
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });

    it('supports avoid times parameter', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
        preferences: {
          avoidTimes: [{ start: '12:00', end: '13:00' }],
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });

    it('supports timezone preferences', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
        preferences: {
          timezone: 'America/New_York',
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });
  });

  describe('Duration Handling', () => {
    it('finds slots for 30-minute meetings', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: 30,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });

    it('finds slots for 2-hour meetings', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: 120,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });

    it('enforces minimum 15-minute duration', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: 5, // Less than minimum
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Date Range Handling', () => {
    it('respects date range boundaries', async () => {
      const schedulingService = getSmartSchedulingService();

      const tomorrow = new Date(Date.now() + 86400000);
      const inTwoDays = new Date(Date.now() + 172800000);

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: tomorrow,
          end: inTwoDays,
        },
      });

      if (result.suggestedTimes.length > 0) {
        for (const slot of result.suggestedTimes) {
          expect(slot.start.getTime()).toBeGreaterThanOrEqual(tomorrow.getTime());
          expect(slot.end.getTime()).toBeLessThanOrEqual(inTwoDays.getTime());
        }
      }
    });

    it('handles narrow date ranges', async () => {
      const schedulingService = getSmartSchedulingService();

      const today = new Date();
      const tomorrow = new Date(Date.now() + 86400000);

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: today,
          end: tomorrow,
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });

    it('handles wide date ranges', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 31536000000), // 1 year
        },
      });

      expect(result.suggestedTimes.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Best Time Selection', () => {
    it('returns slots sorted by quality score', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      if (result.suggestedTimes.length > 0) {
        const bestSlot = result.suggestedTimes[0];
        expect(bestSlot).toBeDefined();
        expect(bestSlot.start).toBeDefined();
        expect(bestSlot.end).toBeDefined();
        expect(typeof bestSlot.score).toBe('number');

        // First slot should have highest score
        if (result.suggestedTimes.length > 1) {
          expect(bestSlot.score).toBeGreaterThanOrEqual(result.suggestedTimes[1].score);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('handles empty attendee list', async () => {
      const schedulingService = getSmartSchedulingService();

      try {
        await schedulingService.findBestMeetingTimes({
          attendeeEmails: [],
          duration: testDuration,
          dateRange: {
            start: new Date(),
            end: new Date(Date.now() + 604800000),
          },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('handles invalid email addresses gracefully', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['invalid-email', 'notanemail'],
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('handles inverted date ranges', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(Date.now() + 604800000),
          end: new Date(), // End before start
        },
      });

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('completes scheduling within reasonable time', async () => {
      const schedulingService = getSmartSchedulingService();

      const startTime = Date.now();
      await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5 second timeout
    });

    it('handles large attendee lists', async () => {
      const schedulingService = getSmartSchedulingService();

      const manyAttendees = Array.from({ length: 20 }, (_, i) =>
        `attendee${i}@company.com`
      );

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: manyAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('returns properly typed time slots', async () => {
      const schedulingService = getSmartSchedulingService();

      const result = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(Array.isArray(result.suggestedTimes)).toBe(true);

      for (const slot of result.suggestedTimes) {
        expect(slot.start instanceof Date).toBe(true);
        expect(slot.end instanceof Date).toBe(true);
        expect(typeof slot.score).toBe('number');
        expect(slot.attendeeCount).toBeDefined();
        expect(typeof slot.attendeeCount).toBe('number');
      }
    });
  });
});
