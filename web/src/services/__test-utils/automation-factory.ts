/**
 * Test Data Factory for Phase 7 Automations
 * Creates mock data for testing automation services
 * Follows factory pattern for DRY testing
 */

import type {
  AutomationTrigger,
  AutomationExecution,
  EmailTriggerCondition,
  CalendarTriggerCondition,
  CreateTaskActionConfig,
  WorkflowAction,
  MeetingContext,
  ActionItem,
  TimeSlot,
} from '../automation.types.js';

/**
 * Create mock email trigger condition
 */
export function createMockEmailTriggerCondition(
  overrides: Partial<EmailTriggerCondition> = {}
): EmailTriggerCondition {
  return {
    type: 'email',
    emailFrom: ['test@example.com'],
    subjectKeywords: ['urgent'],
    bodyKeywords: [],
    matchAll: false,
    ...overrides,
  };
}

/**
 * Create mock calendar trigger condition
 */
export function createMockCalendarTriggerCondition(
  overrides: Partial<CalendarTriggerCondition> = {}
): CalendarTriggerCondition {
  return {
    type: 'calendar',
    eventType: 'meeting',
    eventTitleKeywords: [],
    attendeeCount: { min: 1, max: 10 },
    ...overrides,
  };
}

/**
 * Create mock task creation action
 */
export function createMockCreateTaskAction(
  overrides: Partial<CreateTaskActionConfig> = {}
): WorkflowAction {
  return {
    actionType: 'create_task',
    actionConfig: {
      title: 'Test task from automation',
      description: 'Task created by automation',
      priority: 'normal',
      ...overrides,
    } as CreateTaskActionConfig,
  };
}

/**
 * Create mock email trigger
 */
export function createMockAutomationTrigger(
  overrides: Partial<AutomationTrigger> = {}
): AutomationTrigger {
  return {
    id: 'trigger-' + Math.random().toString(36).substring(7),
    userId: 'user-123',
    triggerType: 'email_received',
    condition: createMockEmailTriggerCondition(),
    actions: [createMockCreateTaskAction()],
    enabled: true,
    executionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock automation execution
 */
export function createMockAutomationExecution(
  overrides: Partial<AutomationExecution> = {}
): AutomationExecution {
  return {
    id: 'execution-' + Math.random().toString(36).substring(7),
    userId: 'user-123',
    triggerId: 'trigger-123',
    status: 'success',
    result: { taskId: 'task-123' },
    executedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock email
 */
export function createMockEmail(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: 'email-' + Math.random().toString(36).substring(7),
    from: 'sender@example.com',
    to: 'user@example.com',
    subject: 'Test email',
    body: 'This is a test email body',
    snippet: 'This is a test email...',
    date: new Date(),
    hasAttachments: false,
    ...overrides,
  };
}

/**
 * Create mock calendar event
 */
export function createMockCalendarEvent(
  overrides: Record<string, any> = {}
): Record<string, any> {
  return {
    id: 'event-' + Math.random().toString(36).substring(7),
    title: 'Team Meeting',
    start: new Date(),
    end: new Date(Date.now() + 3600000),
    attendees: ['user1@example.com', 'user2@example.com'],
    description: 'Regular team meeting',
    location: 'Zoom',
    isOptional: false,
    ...overrides,
  };
}

/**
 * Create mock task
 */
export function createMockTask(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: 'task-' + Math.random().toString(36).substring(7),
    userId: 'user-123',
    boardId: 'board-123',
    title: 'Test task',
    description: 'Task description',
    status: 'todo',
    priority: 'normal',
    urgencyScore: 5,
    importanceScore: 5,
    dueDate: new Date(Date.now() + 86400000),
    timeSpentMinutes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock meeting context
 */
export function createMockMeetingContext(
  overrides: Partial<MeetingContext> = {}
): MeetingContext {
  return {
    id: 'context-' + Math.random().toString(36).substring(7),
    userId: 'user-123',
    eventId: 'event-123',
    relevantEmails: [
      {
        id: 'email-1',
        from: 'boss@company.com',
        subject: 'Project update',
        snippet: 'Here is the latest status...',
        date: new Date(Date.now() - 86400000),
      },
    ],
    actionItems: [
      {
        text: 'Review the proposal',
        context: 'Discussed in last meeting',
        priority: 'high',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock action item
 */
export function createMockActionItem(
  overrides: Partial<ActionItem> = {}
): ActionItem {
  return {
    title: 'Complete report',
    context: 'Extracted from meeting notes',
    assigneeEmail: 'user@example.com',
    assigneeName: 'John Doe',
    priority: 'high',
    dueDate: new Date(Date.now() + 172800000), // 2 days
    ...overrides,
  };
}

/**
 * Create mock time slot
 */
export function createMockTimeSlot(overrides: Partial<TimeSlot> = {}): TimeSlot {
  const tomorrow = new Date(Date.now() + 86400000);
  const start = new Date(tomorrow);
  start.setHours(10, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setHours(11, 0, 0, 0);
  return {
    start,
    end,
    attendeeCount: 3,
    score: 85,
    scoreBreakdown: {
      timeOfDayScore: 20,
      dayOfWeekScore: 10,
      attendeeAvailabilityScore: 30,
      preferenceScore: 25,
    },
    ...overrides,
  };
}

/**
 * Create multiple mock triggers (for batch testing)
 */
export function createMockAutomationTriggers(
  count: number,
  overrides: Partial<AutomationTrigger> = {}
): AutomationTrigger[] {
  const triggers: AutomationTrigger[] = [];
  for (let i = 0; i < count; i++) {
    triggers.push(
      createMockAutomationTrigger({
        ...overrides,
        id: `trigger-${i}`,
      })
    );
  }
  return triggers;
}

/**
 * Create multiple mock emails (for batch testing)
 */
export function createMockEmails(
  count: number,
  overrides: Record<string, any> = {}
): Record<string, any>[] {
  const emails: Record<string, any>[] = [];
  for (let i = 0; i < count; i++) {
    emails.push(
      createMockEmail({
        ...overrides,
        id: `email-${i}`,
        from: `sender${i}@example.com`,
      })
    );
  }
  return emails;
}

/**
 * Create multiple mock action items (for batch testing)
 */
export function createMockActionItems(
  count: number,
  overrides: Partial<ActionItem> = {}
): ActionItem[] {
  const items: ActionItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push(
      createMockActionItem({
        ...overrides,
        title: `Action item ${i}`,
      })
    );
  }
  return items;
}

/**
 * Create multiple mock time slots (for batch testing)
 */
export function createMockTimeSlots(
  count: number,
  overrides: Partial<TimeSlot> = {}
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const baseTime = Date.now() + 86400000;
  for (let i = 0; i < count; i++) {
    const start = new Date(baseTime + i * 3600000);
    slots.push(
      createMockTimeSlot({
        ...overrides,
        start,
        end: new Date(start.getTime() + 3600000),
      })
    );
  }
  return slots;
}
