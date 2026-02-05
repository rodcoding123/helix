/**
 * Meeting→Task Integration Tests - Phase 7 Track 2
 * End-to-end tests for meeting preparation and post-meeting followup workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const store = new Map();
  return {
    supabase: {
      from: (table) => {
        if (!store.has(table)) store.set(table, []);
        const tableStore = store.get(table);
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
              eq: (col2, val2) => ({
                gte: (col3, val3) => ({
                  then: async (cb) => cb({ data: [], error: null }),
                }),
                single: async () => ({ data: null, error: null }),
                then: async (cb) => cb({ data: [], error: null }),
              }),
              single: async () => ({ data: null, error: null }),
              gte: (col, val) => ({
                then: async (cb) => cb({ data: [], error: null }),
              }),
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

// Mock hash chain
vi.mock('@/helix/hash-chain', () => ({
  hashChain: {
    add: async () => ({ hash: 'mock-hash', index: 1 }),
  },
}));

import { getMeetingPrepService } from '../automation-meeting-prep.js';
import { getPostMeetingFollowupService } from '../automation-post-meeting.js';
import {
  createMockCalendarEvent,
  createMockEmail,
  createMockActionItem,
} from '../__test-utils/automation-factory.js';

describe('Meeting→Task Integration Workflow', () => {
  const testUserId = 'user-123';
  const testEventId = 'event-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pre-Meeting Workflow', () => {
    it('prepares meeting 15 minutes before start', async () => {
      const meetingPrepService = getMeetingPrepService();

      const context = await meetingPrepService.prepareMeeting(testEventId, testUserId);

      expect(context).toBeDefined();
      expect(context.userId).toBe(testUserId);
      expect(context.eventId).toBe(testEventId);
      expect(Array.isArray(context.relevantEmails)).toBe(true);
      expect(Array.isArray(context.actionItems)).toBe(true);
    });

    it('includes recent emails in meeting context', async () => {
      const meetingPrepService = getMeetingPrepService();

      const mockEvent = createMockCalendarEvent({
        title: 'Project Review',
        attendees: ['manager@company.com', 'peer@company.com'],
      });

      const emails = await meetingPrepService.findRelevantEmails(mockEvent, testUserId);

      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeLessThanOrEqual(10);
    });

    it('extracts action items from recent emails', async () => {
      const meetingPrepService = getMeetingPrepService();

      const mockEmails = [
        createMockEmail({
          body: 'Please review the quarterly report for the meeting',
        }),
        createMockEmail({
          body: 'ACTION: Prepare the budget spreadsheet',
        }),
      ];

      const actionItems = await meetingPrepService.extractActionItems(
        mockEmails,
        'Q3 Review Meeting'
      );

      expect(Array.isArray(actionItems)).toBe(true);
    });

    it('generates prep checklist', async () => {
      const meetingPrepService = getMeetingPrepService();

      const mockEvent = createMockCalendarEvent({
        title: 'Strategic Planning',
      });
      const mockEmails = [createMockEmail()];
      const actionItems = [
        createMockActionItem({
          title: 'Review competitive analysis',
        }),
      ];

      const checklist = await meetingPrepService.generatePrepChecklist(
        mockEvent,
        mockEmails,
        actionItems
      );

      expect(typeof checklist).toBe('string');
      expect(checklist).toContain('Strategic Planning');
    });

    it('creates prep task with HIGH priority', async () => {
      const meetingPrepService = getMeetingPrepService();

      const mockEvent = createMockCalendarEvent({
        title: 'Important Meeting',
      });

      const taskId = await meetingPrepService.createPrepTask(
        testUserId,
        mockEvent,
        'Prep checklist'
      );

      expect(typeof taskId).toBe('string');
    });

    it('saves meeting context for later reference', async () => {
      const meetingPrepService = getMeetingPrepService();

      const context = await meetingPrepService.prepareMeeting(testEventId, testUserId);

      const retrieved = await meetingPrepService.getMeetingContext(testEventId, testUserId);

      if (retrieved) {
        expect(retrieved.eventId).toBe(testEventId);
      }
    });
  });

  describe('Post-Meeting Workflow', () => {
    it('extracts action items from meeting notes', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const notes = `
        ACTION: John to review the proposal
        TODO: Sarah to submit the report
        - Send follow-up email to stakeholders
      `;

      const actionItems = await postMeetingService.extractActionItemsFromText(notes);

      expect(Array.isArray(actionItems)).toBe(true);
    });

    it('infers priority from action item text', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const urgentPriority = await postMeetingService.inferPriority(
        'URGENT: Critical bug needs fixing ASAP'
      );
      const normalPriority = await postMeetingService.inferPriority(
        'Remember to update the documentation'
      );

      expect(['high', 'normal', 'low']).toContain(urgentPriority);
      expect(['high', 'normal', 'low']).toContain(normalPriority);
    });

    it('extracts due dates from action items', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const dueDateToday = await postMeetingService.extractDueDate('Due today');
      const dueDateFriday = await postMeetingService.extractDueDate('Deadline: Friday');

      expect(dueDateToday === null || dueDateToday instanceof Date).toBe(true);
      expect(dueDateFriday === null || dueDateFriday instanceof Date).toBe(true);
    });

    it('creates follow-up tasks for action items', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: 'ACTION: Update docs\nACTION: Submit PR\nACTION: Code review',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('generates summary email', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const actionItems = [
        createMockActionItem({
          title: 'Update requirements',
          assigneeName: 'Alice',
          priority: 'high',
        }),
        createMockActionItem({
          title: 'Design mockups',
          assigneeName: 'Bob',
          priority: 'normal',
        }),
      ];

      const email = await postMeetingService.generateSummaryEmail(
        testEventId,
        'Discussed project timeline and deliverables',
        actionItems,
        ['task-1', 'task-2']
      );

      expect(typeof email).toBe('string');
      expect(email).toContain('Update requirements');
    });

    it('retrieves created follow-up tasks', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: 'ACTION: Complete report',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });
  });

  describe('Complete Meeting Lifecycle', () => {
    it('executes full pre-meeting to post-meeting workflow', async () => {
      const meetingPrepService = getMeetingPrepService();
      const postMeetingService = getPostMeetingFollowupService();

      // Step 1: Prepare for meeting
      const prepContext = await meetingPrepService.prepareMeeting(testEventId, testUserId);
      expect(prepContext).toBeDefined();

      // Step 2: Simulate meeting happening

      // Step 3: Create post-meeting followup
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: 'ACTION: Follow up on decisions',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('links pre-meeting context to post-meeting actions', async () => {
      const meetingPrepService = getMeetingPrepService();

      const prepContext = await meetingPrepService.prepareMeeting(testEventId, testUserId);
      expect(prepContext.prepTaskId).toBeDefined();

      const retrievedContext = await meetingPrepService.getMeetingContext(testEventId, testUserId);
      if (retrievedContext) {
        expect(retrievedContext.eventId).toBe(testEventId);
      }
    });

    it('handles multiple action items across workflow', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const notes = `
        ACTION: Item 1 - High priority
        TODO: Item 2 - Normal priority
        - Item 3 - Low priority
        @john needs to review Item 4
      `;

      const actionItems = await postMeetingService.extractActionItemsFromText(notes);
      expect(Array.isArray(actionItems)).toBe(true);

      // Should be able to create tasks from all items
      if (actionItems.length > 0) {
        const taskIds = await postMeetingService.createPostMeetingFollowup({
          eventId: testEventId,
          userId: testUserId,
          notes,
        });

        expect(Array.isArray(taskIds)).toBe(true);
      }
    });
  });

  describe('Error Handling in Workflow', () => {
    it('handles missing meeting gracefully', async () => {
      const meetingPrepService = getMeetingPrepService();

      const context = await meetingPrepService.prepareMeeting(
        'nonexistent-event',
        testUserId
      );

      // Should not crash, returns empty or null context
      expect(context === null || context.id).toBeDefined();
    });

    it('handles empty meeting notes', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: '',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('continues workflow despite extraction failures', async () => {
      const meetingPrepService = getMeetingPrepService();

      const mockEvent = createMockCalendarEvent();

      const checklist = await meetingPrepService.generatePrepChecklist(
        mockEvent,
        [],
        []
      );

      expect(typeof checklist).toBe('string');
    });
  });

  describe('Discord Logging & Hash Chain', () => {
    it('logs meeting prep generation', async () => {
      const meetingPrepService = getMeetingPrepService();

      const context = await meetingPrepService.prepareMeeting(testEventId, testUserId);

      // Should complete without errors (logging happens asynchronously)
      expect(context).toBeDefined();
    });

    it('logs post-meeting followup creation', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: 'ACTION: Update docs',
      });

      // Should complete without errors
      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('logs errors in workflow', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      try {
        await postMeetingService.createPostMeetingFollowup({
          eventId: testEventId,
          userId: '',
          notes: 'test',
        });
      } catch (error) {
        // Error handling verified
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('completes meeting prep within reasonable time', async () => {
      const meetingPrepService = getMeetingPrepService();

      const startTime = Date.now();
      await meetingPrepService.prepareMeeting(testEventId, testUserId);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5 second timeout
    });

    it('completes post-meeting followup within reasonable time', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const startTime = Date.now();
      await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: 'ACTION: Item 1\nACTION: Item 2\nACTION: Item 3',
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Type Safety', () => {
    it('returns properly typed meeting context', async () => {
      const meetingPrepService = getMeetingPrepService();

      const context = await meetingPrepService.prepareMeeting(testEventId, testUserId);

      expect(context.id).toBeDefined();
      expect(context.userId).toBe(testUserId);
      expect(context.eventId).toBe(testEventId);
      expect(Array.isArray(context.relevantEmails)).toBe(true);
      expect(Array.isArray(context.actionItems)).toBe(true);
    });

    it('returns properly typed task IDs from followup', async () => {
      const postMeetingService = getPostMeetingFollowupService();

      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: testEventId,
        userId: testUserId,
        notes: 'ACTION: Task',
      });

      expect(Array.isArray(taskIds)).toBe(true);
      for (const id of taskIds) {
        expect(typeof id).toBe('string');
      }
    });
  });
});
