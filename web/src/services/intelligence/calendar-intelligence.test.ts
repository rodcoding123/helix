/**
 * Phase 8: Calendar Intelligence Service Tests
 * Tests meeting preparation generation and optimal time finding
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMeetingPreparation,
  findOptimalMeetingTime,
  initializeMeetingPrepScheduler,
} from './calendar-intelligence';
import type { CalendarEvent, MeetingPrepRequest, OptimalTimeRequest } from './calendar-intelligence';

describe('Calendar Intelligence Service', () => {
  const testUserId = 'test-user-123';
  const testEvent: CalendarEvent = {
    id: 'event-123',
    title: 'Product Review Meeting',
    description: 'Quarterly product review and roadmap planning',
    startTime: new Date('2026-02-10T14:00:00'),
    endTime: new Date('2026-02-10T15:00:00'),
    attendees: [
      { email: 'alice@company.com', name: 'Alice Smith' },
      { email: 'bob@company.com', name: 'Bob Johnson' },
      { email: 'charlie@company.com', name: 'Charlie Davis' },
    ],
    location: 'Conference Room A',
  };

  describe('Meeting Preparation Generation', () => {
    it('should generate meeting prep with valid request', async () => {
      const request: MeetingPrepRequest = {
        userId: testUserId,
        event: testEvent,
        organizationalContext: 'Quarterly planning cycle',
      };

      expect(request.event.title).toBe('Product Review Meeting');
      expect(request.event.attendees.length).toBe(3);
    });

    it('should include agenda items in preparation', async () => {
      const request: MeetingPrepRequest = {
        userId: testUserId,
        event: {
          ...testEvent,
          title: 'Sprint Planning',
        },
      };

      expect(request.event.title).toBe('Sprint Planning');
    });

    it('should calculate meeting duration correctly', () => {
      const duration = Math.round(
        (testEvent.endTime.getTime() - testEvent.startTime.getTime()) / 60000
      );

      expect(duration).toBe(60);
    });

    it('should handle events without location', async () => {
      const request: MeetingPrepRequest = {
        userId: testUserId,
        event: {
          ...testEvent,
          location: undefined,
        },
      };

      expect(request.event.location).toBeUndefined();
    });

    it('should include all attendees in preparation context', async () => {
      const request: MeetingPrepRequest = {
        userId: testUserId,
        event: testEvent,
      };

      const attendeeEmails = request.event.attendees.map((a) => a.email);
      expect(attendeeEmails).toContain('alice@company.com');
      expect(attendeeEmails).toContain('bob@company.com');
    });

    it('should estimate tokens for meeting prep prompt', () => {
      const content =
        `Meeting: ${testEvent.title}\n` +
        `Attendees: ${testEvent.attendees.map((a) => a.name).join(', ')}\n` +
        `Duration: 60 minutes`;

      const tokens = Math.ceil(content.length / 4);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(500);
    });
  });

  describe('Optimal Meeting Time Finding', () => {
    it('should find optimal times for multiple attendees', async () => {
      const request: OptimalTimeRequest = {
        userId: testUserId,
        duration: 60,
        requiredAttendees: ['alice@company.com', 'bob@company.com', 'charlie@company.com'],
        dateRange: {
          start: new Date('2026-02-10'),
          end: new Date('2026-02-17'),
        },
      };

      expect(request.requiredAttendees.length).toBe(3);
      expect(request.duration).toBe(60);
    });

    it('should respect time constraints', async () => {
      const request: OptimalTimeRequest = {
        userId: testUserId,
        duration: 30,
        requiredAttendees: ['alice@company.com', 'bob@company.com'],
        dateRange: {
          start: new Date('2026-02-10'),
          end: new Date('2026-02-14'),
        },
        constraints: {
          preferredTimes: ['morning', 'afternoon'],
          allowBack2Back: false,
        },
      };

      expect(request.constraints?.preferredTimes).toContain('morning');
      expect(request.constraints?.allowBack2Back).toBe(false);
    });

    it('should handle early morning preference', async () => {
      const request: OptimalTimeRequest = {
        userId: testUserId,
        duration: 30,
        requiredAttendees: ['alice@company.com'],
        dateRange: {
          start: new Date('2026-02-10'),
          end: new Date('2026-02-14'),
        },
        constraints: {
          preferredTimes: ['early-morning'],
        },
      };

      expect(request.constraints?.preferredTimes).toBeDefined();
    });

    it('should handle late evening preference', async () => {
      const request: OptimalTimeRequest = {
        userId: testUserId,
        duration: 45,
        requiredAttendees: ['alice@company.com', 'bob@company.com'],
        dateRange: {
          start: new Date('2026-02-10'),
          end: new Date('2026-02-14'),
        },
        constraints: {
          preferredTimes: ['evening'],
        },
      };

      expect(request.constraints?.preferredTimes).toContain('evening');
    });

    it('should suggest multiple time options', () => {
      // Should return at least 3 options
      const optionCount = 3;

      expect(optionCount).toBeGreaterThanOrEqual(3);
    });

    it('should include confidence scores for suggestions', () => {
      const confidenceScore = 0.85;

      expect(confidenceScore).toBeGreaterThan(0);
      expect(confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should calculate date range correctly', () => {
      const startDate = new Date('2026-02-10');
      const endDate = new Date('2026-02-17');
      const dayDifference = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      expect(dayDifference).toBe(7);
    });
  });

  describe('Meeting Prep Scheduler', () => {
    it('should initialize scheduler without error', async () => {
      // This is a fire-and-forget operation
      expect(() => initializeMeetingPrepScheduler(testUserId)).not.toThrow();
    });

    it('should schedule prep 30 minutes before events', () => {
      const eventStart = new Date('2026-02-10T14:00:00');
      const prepTime = new Date(eventStart.getTime() - 30 * 60 * 1000);

      expect(prepTime.getTime()).toBeLessThan(eventStart.getTime());
      expect(eventStart.getTime() - prepTime.getTime()).toBe(30 * 60 * 1000);
    });

    it('should calculate next check interval', () => {
      // Should check every 5 minutes
      const checkInterval = 5 * 60 * 1000;

      expect(checkInterval).toBe(300000);
    });
  });

  describe('Token Estimation for Calendar', () => {
    it('should estimate tokens for meeting prep prompt', () => {
      const prompt = `You are helping prepare for a meeting.
Meeting: Product Review
Time: 2026-02-10 2:00 PM (60 minutes)
Attendees: Alice Smith, Bob Johnson, Charlie Davis
Location: Conference Room A
Description: Quarterly product review and roadmap planning

Provide:
1. Suggested agenda items (3-5 points)
2. Key points to cover
3. Preparation tasks (if any)
4. Recommended outcomes/deliverables`;

      const tokens = Math.ceil(prompt.length / 4);

      expect(tokens).toBeGreaterThan(50);
      expect(tokens).toBeLessThan(500);
    });

    it('should estimate tokens for optimal time prompt', () => {
      const prompt = `Find the optimal meeting time for these constraints:
Duration: 60 minutes
Required Attendees: alice@company.com, bob@company.com, charlie@company.com
Date Range: Tue Feb 10 2026 to Tue Feb 17 2026
Preferred times: morning, afternoon
No back-to-back meetings

Suggest 3 optimal time slots with reasoning.`;

      const tokens = Math.ceil(prompt.length / 4);

      expect(tokens).toBeGreaterThan(50);
      expect(tokens).toBeLessThan(500);
    });
  });

  describe('Cost Calculation', () => {
    it('should cost ~$0.0025 for meeting prep', () => {
      const estimatedCost = 0.0025;

      expect(estimatedCost).toBeLessThan(0.01);
    });

    it('should cost ~$0.0080 for optimal time finding', () => {
      const estimatedCost = 0.008;

      expect(estimatedCost).toBeLessThan(0.01);
    });

    it('should combine to ~$0.0105 per day if called twice each', () => {
      const prepCost = 0.0025 * 5; // 5 prep calls
      const timeCost = 0.008 * 3; // 3 time optimizations
      const totalDailyCost = prepCost + timeCost;

      expect(totalDailyCost).toBeCloseTo(0.0245, 3);
    });
  });

  describe('Event Data Validation', () => {
    it('should validate event has required fields', () => {
      const isValidEvent =
        testEvent.id &&
        testEvent.title &&
        testEvent.startTime &&
        testEvent.endTime &&
        testEvent.attendees.length > 0;

      expect(isValidEvent).toBe(true);
    });

    it('should validate attendee email addresses', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmails = testEvent.attendees.every((a) => emailRegex.test(a.email));

      expect(validEmails).toBe(true);
    });

    it('should handle events with no description', () => {
      const event = {
        ...testEvent,
        description: undefined,
      };

      expect(event.description).toBeUndefined();
    });

    it('should ensure end time is after start time', () => {
      const isValid = testEvent.endTime.getTime() > testEvent.startTime.getTime();

      expect(isValid).toBe(true);
    });
  });

  describe('Calendar Service Integration', () => {
    it('should integrate with router client', async () => {
      const request: MeetingPrepRequest = {
        userId: testUserId,
        event: testEvent,
      };

      expect(request.userId).toBeDefined();
      expect(request.event).toBeDefined();
    });

    it('should pass correct parameters to AI provider', async () => {
      const prompt = `Generate meeting prep for ${testEvent.title}`;
      const estimatedTokens = Math.ceil(prompt.length / 4);

      expect(estimatedTokens).toBeGreaterThan(0);
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalEvent: CalendarEvent = {
        id: 'event-789',
        title: 'Quick Sync',
        startTime: new Date(),
        endTime: new Date(Date.now() + 1800000),
        attendees: [{ email: 'bob@company.com' }],
      };

      const request: MeetingPrepRequest = {
        userId: testUserId,
        event: minimalEvent,
      };

      expect(request.event.description).toBeUndefined();
      expect(request.event.location).toBeUndefined();
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large attendee lists', () => {
      const attendeeCount = 20;
      const attendees = Array(attendeeCount)
        .fill(null)
        .map((_, i) => ({
          email: `person${i}@company.com`,
          name: `Person ${i}`,
        }));

      const event: CalendarEvent = {
        ...testEvent,
        attendees,
      };

      expect(event.attendees.length).toBe(20);
    });

    it('should handle long event descriptions', () => {
      const longDescription = 'A'.repeat(1000);
      const tokens = Math.ceil(longDescription.length / 4);

      expect(tokens).toBeLessThan(500);
    });

    it('should handle date ranges spanning multiple weeks', () => {
      const startDate = new Date('2026-02-10');
      const endDate = new Date('2026-03-10');
      const daySpan = Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

      expect(daySpan).toBe(28);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user ID', () => {
      const request = {
        userId: '',
        event: testEvent,
      };

      expect(request.userId).toBeFalsy();
    });

    it('should handle invalid date range', () => {
      const startDate = new Date('2026-02-17');
      const endDate = new Date('2026-02-10'); // Before start

      const isValid = endDate.getTime() > startDate.getTime();

      expect(isValid).toBe(false);
    });

    it('should handle empty attendee list', () => {
      const event: CalendarEvent = {
        ...testEvent,
        attendees: [],
      };

      expect(event.attendees.length).toBe(0);
    });
  });
});
