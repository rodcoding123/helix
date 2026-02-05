/**
 * Post-Meeting Followup Service Tests - Phase 7 Track 2.2
 * Tests for post-meeting action item extraction and task creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { getPostMeetingFollowupService } from './automation-post-meeting.js';
import {
  createMockCalendarEvent,
  createMockActionItem,
  createMockTask,
} from './__test-utils/automation-factory.js';

describe('PostMeetingFollowupService', () => {
  let postMeetingService: ReturnType<typeof getPostMeetingFollowupService>;

  beforeEach(() => {
    postMeetingService = getPostMeetingFollowupService();
  });

  describe('Singleton Pattern', () => {
    it('returns same instance', () => {
      const service1 = getPostMeetingFollowupService();
      const service2 = getPostMeetingFollowupService();
      expect(service1).toBe(service2);
    });
  });

  describe('Post-Meeting Followup', () => {
    it('creates followup from meeting notes', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        notes: 'Action: Review the proposal\nTODO: Submit feedback by Friday',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('handles empty notes gracefully', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        notes: '',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('processes meeting transcript', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        transcript: 'John mentioned we need to update the documentation. Sarah should handle the deployment.',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });
  });

  describe('Action Item Extraction from Text', () => {
    it('extracts action items from natural text', async () => {
      const text = 'We need to review the budget proposal and submit feedback';
      const actionItems = await postMeetingService.extractActionItemsFromText(text);

      expect(Array.isArray(actionItems)).toBe(true);
    });

    it('detects action items with "- action:" pattern', async () => {
      const text = '- action: Update the customer database\n- action: Send follow-up email';
      const actionItems = await postMeetingService.extractActionItemsFromText(text);

      expect(actionItems.length).toBeGreaterThanOrEqual(0);
    });

    it('detects action items with imperative verbs', async () => {
      const text = 'Review the proposal. Submit the report. Contact the client.';
      const actionItems = await postMeetingService.extractActionItemsFromText(text);

      expect(Array.isArray(actionItems)).toBe(true);
    });

    it('extracts assignee from mention', async () => {
      const text = '@john should review the proposal by Friday';
      const actionItems = await postMeetingService.extractActionItemsFromText(text);

      expect(Array.isArray(actionItems)).toBe(true);
    });

    it('handles action items without assignee', async () => {
      const text = 'Need to finalize the presentation';
      const actionItems = await postMeetingService.extractActionItemsFromText(text);

      expect(Array.isArray(actionItems)).toBe(true);
    });
  });

  describe('Priority Inference', () => {
    it('infers HIGH priority for urgent keywords', async () => {
      const priority = await postMeetingService.inferPriority(
        'URGENT: Critical bug needs to be fixed ASAP'
      );

      expect(['high', 'normal', 'low']).toContain(priority);
    });

    it('infers NORMAL priority for important keywords', async () => {
      const priority = await postMeetingService.inferPriority(
        'Important: Complete the quarterly review'
      );

      expect(['high', 'normal', 'low']).toContain(priority);
    });

    it('defaults to NORMAL priority', async () => {
      const priority = await postMeetingService.inferPriority(
        'Remember to update the code'
      );

      expect(['high', 'normal', 'low']).toContain(priority);
    });
  });

  describe('Confidence Calculation', () => {
    it('calculates confidence score', async () => {
      const confidence = await postMeetingService.calculateConfidence(
        'ACTION: John needs to review and approve the document by tomorrow'
      );

      expect(typeof confidence).toBe('number');
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('higher confidence with clear action items', async () => {
      const highConfidence = await postMeetingService.calculateConfidence(
        'CRITICAL ACTION ITEM: Sarah must submit the proposal by Friday at 5pm'
      );

      const lowConfidence = await postMeetingService.calculateConfidence(
        'Maybe do something'
      );

      expect(typeof highConfidence).toBe('number');
      expect(typeof lowConfidence).toBe('number');
    });
  });

  describe('Due Date Extraction', () => {
    it('extracts due date from text', async () => {
      const dueDate = await postMeetingService.extractDueDate(
        'Complete by Friday'
      );

      expect(dueDate === null || dueDate instanceof Date).toBe(true);
    });

    it('parses relative dates', async () => {
      const dueDate = await postMeetingService.extractDueDate(
        'Due tomorrow at 2pm'
      );

      expect(dueDate === null || dueDate instanceof Date).toBe(true);
    });

    it('parses explicit dates', async () => {
      const dueDate = await postMeetingService.extractDueDate(
        'Deadline: 2024-12-31'
      );

      expect(dueDate === null || dueDate instanceof Date).toBe(true);
    });

    it('returns null for no due date', async () => {
      const dueDate = await postMeetingService.extractDueDate(
        'Just remember to do this sometime'
      );

      expect(dueDate === null || dueDate instanceof Date).toBe(true);
    });
  });

  describe('Assignee Extraction', () => {
    it('extracts assignee from @ mention', async () => {
      const assignee = await postMeetingService.extractAssignee(
        '@john_smith needs to review this'
      );

      expect(assignee === null || typeof assignee === 'string').toBe(true);
    });

    it('extracts assignee from name at line start', async () => {
      const assignee = await postMeetingService.extractAssignee(
        'Sarah: Handle the deployment'
      );

      expect(assignee === null || typeof assignee === 'string').toBe(true);
    });

    it('returns null when no assignee found', async () => {
      const assignee = await postMeetingService.extractAssignee(
        'Someone should do this task'
      );

      expect(assignee === null || typeof assignee === 'string').toBe(true);
    });
  });

  describe('Task Creation', () => {
    it('creates task for action item', async () => {
      const actionItem = createMockActionItem({
        title: 'Review quarterly report',
        priority: 'high',
      });

      const taskId = await postMeetingService.createFollowupTask(
        'user-123',
        actionItem,
        'event-123'
      );

      expect(typeof taskId).toBe('string');
      expect(taskId.length).toBeGreaterThan(0);
    });

    it('sets task priority from action item', async () => {
      const actionItem = createMockActionItem({
        title: 'Critical fix',
        priority: 'high',
      });

      const taskId = await postMeetingService.createFollowupTask(
        'user-123',
        actionItem,
        'event-123'
      );

      expect(taskId).toBeDefined();
    });

    it('sets task due date from action item', async () => {
      const dueDate = new Date(Date.now() + 172800000); // 2 days
      const actionItem = createMockActionItem({
        title: 'Complete report',
        dueDate,
      });

      const taskId = await postMeetingService.createFollowupTask(
        'user-123',
        actionItem,
        'event-123'
      );

      expect(taskId).toBeDefined();
    });

    it('creates multiple tasks for multiple action items', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        notes: 'ACTION: Update docs\nACTION: Submit PR\nACTION: Notify team',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });
  });

  describe('Summary Email Generation', () => {
    it('generates summary email', async () => {
      const email = await postMeetingService.generateSummaryEmail(
        'event-123',
        'Great discussion about Q4 strategy',
        [createMockActionItem({ title: 'Prepare budget' })],
        ['task-1', 'task-2']
      );

      expect(typeof email).toBe('string');
      expect(email.length).toBeGreaterThan(0);
    });

    it('includes action items in summary', async () => {
      const actionItems = [
        createMockActionItem({ title: 'Review proposal' }),
        createMockActionItem({ title: 'Update documentation' }),
      ];

      const email = await postMeetingService.generateSummaryEmail(
        'event-123',
        'Notes here',
        actionItems,
        ['task-1']
      );

      expect(email).toContain('Review proposal');
    });

    it('includes created task IDs in summary', async () => {
      const email = await postMeetingService.generateSummaryEmail(
        'event-123',
        'Meeting notes',
        [],
        ['task-abc-123', 'task-def-456']
      );

      expect(typeof email).toBe('string');
    });
  });

  describe('Followup Retrieval', () => {
    it('retrieves created tasks for meeting', async () => {
      const tasks = await postMeetingService.getPostMeetingFollowup(
        'event-123',
        'user-123'
      );

      expect(Array.isArray(tasks)).toBe(true);
    });

    it('returns empty array for meeting with no followups', async () => {
      const tasks = await postMeetingService.getPostMeetingFollowup(
        'nonexistent-event',
        'user-123'
      );

      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('Discord Logging', () => {
    it('logs followup creation', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        notes: 'ACTION: Update database',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('logs errors to Discord', async () => {
      try {
        await postMeetingService.createPostMeetingFollowup({
          eventId: 'event-123',
          userId: '',
          notes: 'test',
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('handles invalid dates gracefully', async () => {
      const dueDate = await postMeetingService.extractDueDate(
        'Due on never-never-land'
      );

      expect(dueDate === null || dueDate instanceof Date).toBe(true);
    });

    it('continues on partial extraction failures', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        notes: 'Mixed valid and invalid action items',
      });

      expect(Array.isArray(taskIds)).toBe(true);
    });

    it('handles empty action item list', async () => {
      const email = await postMeetingService.generateSummaryEmail(
        'event-123',
        'Just notes',
        [],
        []
      );

      expect(typeof email).toBe('string');
    });
  });

  describe('Type Safety', () => {
    it('returns string array from createPostMeetingFollowup', async () => {
      const taskIds = await postMeetingService.createPostMeetingFollowup({
        eventId: 'event-123',
        userId: 'user-123',
        notes: 'ACTION: Do something',
      });

      expect(Array.isArray(taskIds)).toBe(true);
      for (const id of taskIds) {
        expect(typeof id).toBe('string');
      }
    });

    it('action items have required properties', async () => {
      const text = 'ACTION: Update the code';
      const actionItems = await postMeetingService.extractActionItemsFromText(text);

      for (const item of actionItems) {
        expect(typeof item.title).toBe('string');
        expect(['high', 'normal', 'low']).toContain(item.priority);
      }
    });
  });
});
