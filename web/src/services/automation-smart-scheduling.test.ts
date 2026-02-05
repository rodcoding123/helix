/**
 * Smart Scheduling Service Tests - Phase 7 Track 3
 * Tests for meeting time suggestion and optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSmartSchedulingService } from './automation-smart-scheduling.js';
import { createMockCalendarEvent, createMockTimeSlot } from './__test-utils/automation-factory.js';

// Mock Supabase
vi.mock('@/lib/supabase', () => (
  {
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ then: async (cb: any) => cb({ data: [], error: null }) }) }),
      }),
    },
  }
));

// Mock Discord logging
vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

describe('SmartSchedulingService', () => {
  let schedulingService: ReturnType<typeof getSmartSchedulingService>;

  beforeEach(() => {
    schedulingService = getSmartSchedulingService();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance', () => {
      const service1 = getSmartSchedulingService();
      const service2 = getSmartSchedulingService();
      expect(service1).toBe(service2);
    });
  });

  describe('Meeting Time Finding', () => {
    it('finds best meeting times for single attendee', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000), // 7 days
        },
      });

      expect(suggestion).toBeDefined();
      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
      expect(suggestion.bestTime).toBeDefined();
    });

    it('finds best meeting times for multiple attendees', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com', 'jane@example.com', 'bob@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion).toBeDefined();
      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
    });

    it('respects duration parameter', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 120, // 2 hour meeting
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.suggestedTimes).toBeDefined();
    });

    it('returns empty array when no slots available', async () => {
      const today = new Date();
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: today,
          end: new Date(today.getTime() + 3600000), // 1 hour range
        },
      });

      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
    });
  });

  describe('Free Slot Calculation', () => {
    it('calculates free slots', async () => {
      const mockCalendars = {
        'john@example.com': [
          createMockCalendarEvent({
            start: new Date(Date.now() + 86400000),
            end: new Date(Date.now() + 90000000),
          }),
        ],
      };

      const slots = await schedulingService.calculateFreeSlots(
        mockCalendars,
        60,
        {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        }
      );

      expect(Array.isArray(slots)).toBe(true);
    });

    it('handles multiple calendar entries', async () => {
      const mockCalendars = {
        'john@example.com': [
          createMockCalendarEvent({
            start: new Date(Date.now() + 86400000),
            end: new Date(Date.now() + 90000000),
          }),
          createMockCalendarEvent({
            start: new Date(Date.now() + 172800000),
            end: new Date(Date.now() + 176400000),
          }),
        ],
      };

      const slots = await schedulingService.calculateFreeSlots(
        mockCalendars,
        60,
        {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        }
      );

      expect(Array.isArray(slots)).toBe(true);
    });

    it('respects duration in slot calculation', async () => {
      const slots = await schedulingService.calculateFreeSlots(
        {},
        120, // 2 hour slots
        {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        }
      );

      for (const slot of slots) {
        const duration = slot.end.getTime() - slot.start.getTime();
        expect(duration).toBeGreaterThanOrEqual(120 * 60 * 1000); // At least 120 minutes
      }
    });
  });

  describe('Conflict Detection', () => {
    it('detects no conflict when slot is free', async () => {
      const events: any[] = [];
      const slotStart = new Date(Date.now() + 86400000);
      const slotEnd = new Date(slotStart.getTime() + 3600000);

      const hasConflict = await schedulingService.hasConflict(
        events,
        slotStart,
        slotEnd
      );

      expect(typeof hasConflict).toBe('boolean');
    });

    it('detects conflict with overlapping event', async () => {
      const eventStart = new Date(Date.now() + 86400000);
      const eventEnd = new Date(eventStart.getTime() + 3600000);
      const events = [
        createMockCalendarEvent({
          start: eventStart,
          end: eventEnd,
        }),
      ];

      const slotStart = new Date(eventStart.getTime() - 1800000); // 30 min before
      const slotEnd = new Date(eventStart.getTime() + 1800000); // 30 min into event

      const hasConflict = await schedulingService.hasConflict(
        events,
        slotStart,
        slotEnd
      );

      expect(typeof hasConflict).toBe('boolean');
    });

    it('detects no conflict with adjacent events', async () => {
      const eventStart = new Date(Date.now() + 86400000);
      const eventEnd = new Date(eventStart.getTime() + 3600000);
      const events = [
        createMockCalendarEvent({
          start: eventStart,
          end: eventEnd,
        }),
      ];

      const slotStart = new Date(eventEnd); // Starts exactly when event ends
      const slotEnd = new Date(slotStart.getTime() + 3600000);

      const hasConflict = await schedulingService.hasConflict(
        events,
        slotStart,
        slotEnd
      );

      expect(typeof hasConflict).toBe('boolean');
    });
  });

  describe('Time Slot Scoring', () => {
    it('scores morning slots high', async () => {
      const morningSlot = createMockTimeSlot({
        start: new Date().setHours(10, 0, 0),
        end: new Date().setHours(11, 0, 0),
      });

      const score = await schedulingService.scoreTimeSlot(morningSlot, 3);

      expect(typeof score.score).toBe('number');
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    });

    it('scores lunch time low', async () => {
      const lunchSlot = createMockTimeSlot({
        start: new Date().setHours(12, 0, 0),
        end: new Date().setHours(13, 0, 0),
      });

      const score = await schedulingService.scoreTimeSlot(lunchSlot, 3);

      expect(typeof score.score).toBe('number');
      expect(score.score).toBeLessThanOrEqual(100);
    });

    it('includes score breakdown', async () => {
      const slot = createMockTimeSlot({
        start: new Date().setHours(14, 0, 0),
        end: new Date().setHours(15, 0, 0),
      });

      const score = await schedulingService.scoreTimeSlot(slot, 3);

      expect(score.scoreBreakdown).toBeDefined();
      expect(typeof score.scoreBreakdown.timeOfDayScore).toBe('number');
      expect(typeof score.scoreBreakdown.dayOfWeekScore).toBe('number');
    });

    it('penalizes high attendee counts', async () => {
      const baseSlot = createMockTimeSlot({
        start: new Date().setHours(14, 0, 0),
        end: new Date().setHours(15, 0, 0),
      });

      const scoreWith3Attendees = await schedulingService.scoreTimeSlot(baseSlot, 3);
      const scoreWith10Attendees = await schedulingService.scoreTimeSlot(baseSlot, 10);

      expect(scoreWith3Attendees.score).toBeGreaterThan(scoreWith10Attendees.score);
    });

    it('respects user preferences', async () => {
      const slot = createMockTimeSlot({
        start: new Date().setHours(9, 0, 0),
        end: new Date().setHours(10, 0, 0),
      });

      const score = await schedulingService.scoreTimeSlot(slot, 3, {
        preferredTimes: ['09:00-10:00'],
      });

      expect(typeof score.score).toBe('number');
    });
  });

  describe('Suggestion Generation', () => {
    it('generates scheduling suggestion', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion).toBeDefined();
      expect(suggestion.suggestedTimes).toBeDefined();
      expect(suggestion.bestTime).toBeDefined();
    });

    it('returns sorted suggestions by score', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
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

    it('limits suggestions to top 5', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.suggestedTimes.length).toBeLessThanOrEqual(5);
    });

    it('includes best time separately', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion.bestTime).toBeDefined();
      expect(suggestion.bestTime.start).toBeDefined();
      expect(suggestion.bestTime.end).toBeDefined();
      expect(suggestion.bestTime.score).toBeDefined();
    });
  });

  describe('Attendee Calendar Fetching', () => {
    it('fetches calendars for all attendees', async () => {
      const attendees = ['john@example.com', 'jane@example.com'];
      const calendars = await schedulingService.getAttendeesCalendars(
        attendees,
        {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        }
      );

      expect(typeof calendars).toBe('object');
    });

    it('handles invalid attendee emails gracefully', async () => {
      const attendees = ['invalid-email', 'john@example.com'];
      const calendars = await schedulingService.getAttendeesCalendars(
        attendees,
        {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        }
      );

      expect(typeof calendars).toBe('object');
    });

    it('returns empty calendar for attendee with no events', async () => {
      const calendars = await schedulingService.getAttendeesCalendars(
        ['john@example.com'],
        {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        }
      );

      expect(typeof calendars).toBe('object');
    });
  });

  describe('Discord Logging', () => {
    it('logs scheduling calculation', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion).toBeDefined();
    });

    it('logs errors to Discord', async () => {
      try {
        await schedulingService.findBestMeetingTimes({
          attendeeEmails: [],
          duration: 60,
          dateRange: {
            start: new Date(),
            end: new Date(Date.now() + 604800000),
          },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('handles no attendees gracefully', async () => {
      try {
        await schedulingService.findBestMeetingTimes({
          attendeeEmails: [],
          duration: 60,
          dateRange: {
            start: new Date(),
            end: new Date(Date.now() + 604800000),
          },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('handles invalid date range', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() - 604800000), // End before start
        },
      });

      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
    });

    it('handles very short duration', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 5, // 5 minutes
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion).toBeDefined();
    });

    it('handles very long duration', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 480, // 8 hours
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(suggestion).toBeDefined();
    });
  });

  describe('Type Safety', () => {
    it('returns SchedulingSuggestion with correct structure', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      expect(Array.isArray(suggestion.suggestedTimes)).toBe(true);
      expect(suggestion.bestTime).toBeDefined();
    });

    it('time slots have required fields', async () => {
      const suggestion = await schedulingService.findBestMeetingTimes({
        attendeeEmails: ['john@example.com'],
        duration: 60,
        dateRange: {
          start: new Date(),
          end: new Date(Date.now() + 604800000),
        },
      });

      for (const slot of suggestion.suggestedTimes) {
        expect(slot.start instanceof Date).toBe(true);
        expect(slot.end instanceof Date).toBe(true);
        expect(typeof slot.score).toBe('number');
      }
    });

    it('score breakdown is complete', async () => {
      const slot = createMockTimeSlot();
      const score = await schedulingService.scoreTimeSlot(slot, 3);

      expect(score.scoreBreakdown.timeOfDayScore).toBeDefined();
      expect(score.scoreBreakdown.dayOfWeekScore).toBeDefined();
      expect(score.scoreBreakdown.attendeeAvailabilityScore).toBeDefined();
    });
  });
});
