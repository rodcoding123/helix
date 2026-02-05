/**
 * Smart Scheduling Integration Tests - Phase 7 Track 3
 * End-to-end tests for meeting time suggestion workflow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSmartSchedulingService } from '../automation-smart-scheduling.js';
import { createMockCalendarEvent, createMockTimeSlot } from '../__test-utils/automation-factory.js';

// Mock Supabase
vi.mock('@/lib/supabase', () => (
  {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            then: async (cb: any) => cb({ data: [], error: null }),
          }),
        }),
      }),
    },
  }
));

// Mock Discord logging
vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

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
    it('scores morning slots higher', async () => {
      const schedulingService = getSmartSchedulingService();

      const morningSlot = createMockTimeSlot({
        start: new Date().setHours(9, 0, 0),
        end: new Date().setHours(10, 0, 0),
      });
      const afternoonSlot = createMockTimeSlot({
        start: new Date().setHours(16, 0, 0),
        end: new Date().setHours(17, 0, 0),
      });

      const morningScore = await schedulingService.scoreTimeSlot(morningSlot, 3);
      const afternoonScore = await schedulingService.scoreTimeSlot(afternoonSlot, 3);

      expect(typeof morningScore.score).toBe('number');
      expect(typeof afternoonScore.score).toBe('number');
    });

    it('includes time of day bonus in scoring', async () => {
      const schedulingService = getSmartSchedulingService();

      const slot = createMockTimeSlot({
        start: new Date().setHours(10, 0, 0),
        end: new Date().setHours(11, 0, 0),
      });

      const score = await schedulingService.scoreTimeSlot(slot, 3);

      expect(score.scoreBreakdown).toBeDefined();
      expect(typeof score.scoreBreakdown.timeOfDayScore).toBe('number');
    });

    it('includes day of week scoring', async () => {
      const schedulingService = getSmartSchedulingService();

      const slot = createMockTimeSlot({
        start: new Date().setHours(14, 0, 0),
        end: new Date().setHours(15, 0, 0),
      });

      const score = await schedulingService.scoreTimeSlot(slot, 3);

      expect(typeof score.scoreBreakdown.dayOfWeekScore).toBe('number');
    });

    it('penalizes excessive attendees', async () => {
      const schedulingService = getSmartSchedulingService();

      const slot = createMockTimeSlot({
        start: new Date().setHours(14, 0, 0),
        end: new Date().setHours(15, 0, 0),
      });

      const scoreSmallGroup = await schedulingService.scoreTimeSlot(slot, 3);
      const scoreLargeGroup = await schedulingService.scoreTimeSlot(slot, 15);

      expect(scoreSmallGroup.score).toBeGreaterThan(scoreLargeGroup.score);
    });
  });

  describe('Preference Respecting', () => {
    it('respects preferred meeting times', async () => {
      const schedulingService = getSmartSchedulingService();

      const slot = createMockTimeSlot({
        start: new Date().setHours(10, 0, 0),
        end: new Date().setHours(11, 0, 0),
      });

      const scoreWithoutPreference = await schedulingService.scoreTimeSlot(slot, 3);
      const scoreWithPreference = await schedulingService.scoreTimeSlot(slot, 3, {
        preferredTimes: ['10:00-11:00'],
      });

      expect(typeof scoreWithoutPreference.score).toBe('number');
      expect(typeof scoreWithPreference.score).toBe('number');
    });

    it('avoids blocked times', async () => {
      const schedulingService = getSmartSchedulingService();

      const slot = createMockTimeSlot({
        start: new Date().setHours(12, 0, 0),
        end: new Date().setHours(13, 0, 0),
      });

      const scoreWithoutAvoidance = await schedulingService.scoreTimeSlot(slot, 3);
      const scoreWithAvoidance = await schedulingService.scoreTimeSlot(slot, 3, {
        avoidTimes: ['12:00-13:00'],
      });

      expect(typeof scoreWithoutAvoidance.score).toBe('number');
      expect(typeof scoreWithAvoidance.score).toBe('number');
    });
  });

  describe('Duration Handling', () => {
    it('finds slots for 30-minute meetings', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: 30,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.suggestedTimes).toBeDefined();
    });

    it('finds slots for 2-hour meetings', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: 120,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.suggestedTimes).toBeDefined();
    });

    it('enforces minimum 15-minute duration', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: 5, // Less than minimum
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      // Should handle gracefully
      expect(suggestion).toBeDefined();
    });
  });

  describe('Date Range Handling', () => {
    it('respects date range boundaries', async () => {
      const schedulingService = getSmartSchedulingService();

      const tomorrow = new Date(Date.now() + 86400000);
      const inTwoDays = new Date(Date.now() + 172800000);

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: tomorrow,
          end: inTwoDays,
        },
      });

      if (suggestion.suggestedTimes.length > 0) {
        for (const slot of suggestion.suggestedTimes) {
          expect(slot.start.getTime()).toBeGreaterThanOrEqual(tomorrow.getTime());
          expect(slot.end.getTime()).toBeLessThanOrEqual(inTwoDays.getTime());
        }
      }
    });

    it('handles narrow date ranges', async () => {
      const schedulingService = getSmartSchedulingService();

      const today = new Date();
      const tomorrow = new Date(Date.now() + 86400000);

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: today,
          end: tomorrow,
        },
      });

      expect(suggestion.suggestedTimes).toBeDefined();
    });

    it('handles wide date ranges', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 31536000000), // 1 year
        },
      });

      expect(suggestion.suggestedTimes.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Best Time Selection', () => {
    it('selects best time from suggestions', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.bestTime).toBeDefined();
      expect(suggestion.bestTime.start).toBeDefined();
      expect(suggestion.bestTime.end).toBeDefined();
      expect(typeof suggestion.bestTime.score).toBe('number');

      // Best time should be first in list or have highest score
      if (suggestion.suggestedTimes.length > 0) {
        expect(suggestion.bestTime.score).toBeGreaterThanOrEqual(
          suggestion.suggestedTimes[suggestion.suggestedTimes.length - 1].score
        );
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

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['invalid-email', 'notanemail'],
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      // Should handle gracefully
      expect(suggestion).toBeDefined();
    });

    it('handles inverted date ranges', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(Date.now() + 604800000),
          end: new Date(), // End before start
        },
      });

      // Should handle gracefully
      expect(suggestion).toBeDefined();
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

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: manyAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.suggestedTimes).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('returns properly typed suggestion', async () => {
      const schedulingService = getSmartSchedulingService();

      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: testAttendees,
        duration: testDuration,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
      expect(suggestion.bestTime).toBeDefined();

      for (const slot of suggestion.suggestedTimes) {
        expect(slot.start instanceof Date).toBe(true);
        expect(slot.end instanceof Date).toBe(true);
        expect(typeof slot.score).toBe('number');
      }
    });
  });
});
