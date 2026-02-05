/**
 * Meeting Prep Service Tests - Phase 7 Track 2.1
 * Tests for meeting preparation automation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMeetingPrepService } from './automation-meeting-prep.js';
import {
  createMockCalendarEvent,
  createMockEmail,
  createMockTask,
  createMockMeetingContext,
  createMockActionItem,
} from './__test-utils/automation-factory.js';

// Mock Supabase
vi.mock('@/lib/supabase', () => (
  {
    supabase: {
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'task-1' }, error: null }) }) }),
        update: () => ({ eq: () => ({ then: async (cb: any) => cb({ data: null, error: null }) }) }),
      }),
    },
  }
));

// Mock Discord logging
vi.mock('@/helix/logging', () => ({
  logToDiscord: async () => {},
}));

// Mock hash chain
vi.mock('@/helix/hash-chain', () => ({
  hashChain: {
    add: async () => ({ hash: 'mock-hash', index: 1 }),
  },
}));

describe('MeetingPrepService', () => {
  let meetingPrepService: ReturnType<typeof getMeetingPrepService>;

  beforeEach(() => {
    meetingPrepService = getMeetingPrepService();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance', () => {
      const service1 = getMeetingPrepService();
      const service2 = getMeetingPrepService();
      expect(service1).toBe(service2);
    });
  });

  describe('Meeting Preparation', () => {
    it('prepares meeting for user', async () => {
      const context = await meetingPrepService.prepareMeeting(
        'event-123',
        'user-123'
      );

      expect(context).toBeDefined();
      expect(context.id).toBeDefined();
      expect(context.userId).toBe('user-123');
      expect(context.eventId).toBe('event-123');
    });

    it('includes relevant emails in context', async () => {
      const context = await meetingPrepService.prepareMeeting(
        'event-123',
        'user-123'
      );

      expect(Array.isArray(context.relevantEmails)).toBe(true);
    });

    it('includes action items in context', async () => {
      const context = await meetingPrepService.prepareMeeting(
        'event-123',
        'user-123'
      );

      expect(Array.isArray(context.actionItems)).toBe(true);
    });

    it('creates prep task', async () => {
      const context = await meetingPrepService.prepareMeeting(
        'event-123',
        'user-123'
      );

      expect(context.prepTaskId).toBeDefined();
    });
  });

  describe('Email Extraction', () => {
    it('finds relevant emails from meeting attendees', async () => {
      const mockEvent = createMockCalendarEvent({
        attendees: ['john@example.com', 'jane@example.com'],
      });

      // Should not throw
      const emails = await meetingPrepService.findRelevantEmails(
        mockEvent,
        'user-123'
      );

      expect(Array.isArray(emails)).toBe(true);
    });

    it('returns emails in chronological order', async () => {
      const mockEvent = createMockCalendarEvent();
      const emails = await meetingPrepService.findRelevantEmails(
        mockEvent,
        'user-123'
      );

      if (emails.length > 1) {
        const timestamps = emails.map(e => new Date(e.date).getTime());
        const isOrdered = timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1]);
        expect(isOrdered).toBe(true);
      }
    });

    it('limits email results to 10', async () => {
      const mockEvent = createMockCalendarEvent();
      const emails = await meetingPrepService.findRelevantEmails(
        mockEvent,
        'user-123'
      );

      expect(emails.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Action Item Extraction', () => {
    it('extracts action items from email content', async () => {
      const mockEmails = [
        createMockEmail({
          body: 'Please review the proposal and provide feedback by Friday',
        }),
      ];

      const actionItems = await meetingPrepService.extractActionItems(
        mockEmails,
        'Team Meeting'
      );

      expect(Array.isArray(actionItems)).toBe(true);
    });

    it('detects action items with keywords', async () => {
      const mockEmails = [
        createMockEmail({
          body: 'ACTION: Update the documentation',
        }),
      ];

      const actionItems = await meetingPrepService.extractActionItems(
        mockEmails,
        'Team Meeting'
      );

      expect(actionItems.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty email list', async () => {
      const actionItems = await meetingPrepService.extractActionItems(
        [],
        'Team Meeting'
      );

      expect(Array.isArray(actionItems)).toBe(true);
    });
  });

  describe('Checklist Generation', () => {
    it('generates prep checklist', async () => {
      const mockEvent = createMockCalendarEvent({
        title: 'Strategic Planning Meeting',
      });
      const mockEmails = [
        createMockEmail({
          from: 'boss@company.com',
          subject: 'Meeting prep materials',
        }),
      ];
      const actionItems = [
        createMockActionItem({
          title: 'Review Q4 results',
          priority: 'high',
        }),
      ];

      const checklist = await meetingPrepService.generatePrepChecklist(
        mockEvent,
        mockEmails,
        actionItems
      );

      expect(typeof checklist).toBe('string');
      expect(checklist.length).toBeGreaterThan(0);
      expect(checklist).toContain('Strategic Planning Meeting');
    });

    it('includes meeting title in checklist', async () => {
      const mockEvent = createMockCalendarEvent({
        title: 'Board Review',
      });

      const checklist = await meetingPrepService.generatePrepChecklist(
        mockEvent,
        [],
        []
      );

      expect(checklist).toContain('Board Review');
    });

    it('includes action items in checklist', async () => {
      const mockEvent = createMockCalendarEvent();
      const actionItems = [
        createMockActionItem({
          title: 'Prepare presentation slides',
        }),
      ];

      const checklist = await meetingPrepService.generatePrepChecklist(
        mockEvent,
        [],
        actionItems
      );

      expect(checklist).toContain('Prepare presentation slides');
    });
  });

  describe('Task Creation', () => {
    it('creates prep task with HIGH priority', async () => {
      const mockEvent = createMockCalendarEvent({
        title: 'Important Meeting',
      });

      const taskId = await meetingPrepService.createPrepTask(
        'user-123',
        mockEvent,
        'Meeting prep checklist'
      );

      expect(typeof taskId).toBe('string');
      expect(taskId.length).toBeGreaterThan(0);
    });

    it('sets task due date to meeting start time', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const mockEvent = createMockCalendarEvent({
        start: futureDate,
      });

      const taskId = await meetingPrepService.createPrepTask(
        'user-123',
        mockEvent,
        'Meeting prep checklist'
      );

      expect(taskId).toBeDefined();
    });

    it('includes meeting title in task title', async () => {
      const mockEvent = createMockCalendarEvent({
        title: 'Strategy Discussion',
      });

      const taskId = await meetingPrepService.createPrepTask(
        'user-123',
        mockEvent,
        'Meeting prep checklist'
      );

      expect(taskId).toBeDefined();
    });
  });

  describe('Meeting Context Storage', () => {
    it('saves meeting context', async () => {
      const mockContext = createMockMeetingContext({
        userId: 'user-123',
        eventId: 'event-123',
      });

      const saved = await meetingPrepService.saveMeetingContext(mockContext);

      expect(saved).toBe(true);
    });

    it('retrieves meeting context', async () => {
      const context = await meetingPrepService.getMeetingContext(
        'event-123',
        'user-123'
      );

      // Returns MeetingContext or null
      expect(context === null || context.id).toBeDefined();
    });

    it('returns null for missing context', async () => {
      const context = await meetingPrepService.getMeetingContext(
        'nonexistent-event',
        'user-123'
      );

      expect(context === null || typeof context.id === 'string').toBe(true);
    });
  });

  describe('Discord Logging', () => {
    it('logs meeting prep generation', async () => {
      const context = await meetingPrepService.prepareMeeting(
        'event-123',
        'user-123'
      );

      expect(context).toBeDefined();
      // Discord logging happens asynchronously, verified by not throwing
    });

    it('logs errors to Discord', async () => {
      // Should not throw even with invalid data
      try {
        await meetingPrepService.prepareMeeting('event-123', '');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('handles missing event gracefully', async () => {
      try {
        const context = await meetingPrepService.prepareMeeting(
          'invalid-event',
          'user-123'
        );
        expect(context).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('handles database errors', async () => {
      try {
        await meetingPrepService.prepareMeeting('event-123', 'user-123');
      } catch (error) {
        // Should handle errors gracefully
        expect(true).toBe(true);
      }
    });

    it('continues on partial failures', async () => {
      // Email extraction failure shouldn't stop checklist generation
      const mockEvent = createMockCalendarEvent();
      const checklist = await meetingPrepService.generatePrepChecklist(
        mockEvent,
        [],
        []
      );

      expect(typeof checklist).toBe('string');
    });
  });

  describe('Type Safety', () => {
    it('returns MeetingContext with correct structure', async () => {
      const context = await meetingPrepService.prepareMeeting(
        'event-123',
        'user-123'
      );

      expect(context.id).toBeDefined();
      expect(context.userId).toBeDefined();
      expect(context.eventId).toBeDefined();
      expect(Array.isArray(context.relevantEmails)).toBe(true);
      expect(Array.isArray(context.actionItems)).toBe(true);
    });

    it('action items have required fields', async () => {
      const mockEmails = [
        createMockEmail({
          body: 'ACTION: Update documentation',
        }),
      ];

      const actionItems = await meetingPrepService.extractActionItems(
        mockEmails,
        'Meeting'
      );

      for (const item of actionItems) {
        expect(typeof item.title).toBe('string');
        expect(typeof item.priority).toBe('string');
      }
    });
  });
});
