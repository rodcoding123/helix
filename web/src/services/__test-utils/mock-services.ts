/**
 * Comprehensive Mock Service Factory for Automation Tests
 * Properly mocks Supabase query chains and service implementations
 */

import type {
  AutomationTrigger,
  EmailTriggerCondition,
  CalendarTriggerCondition,
  CreateTaskActionConfig,
  WorkflowAction,
  MeetingContext,
  ActionItem,
} from '../automation.types.js';

/**
 * Create a properly chained Supabase query mock
 * Handles: insert().select().single(), select().eq().gte(), select().eq().eq(), update().eq(), delete().eq()
 */
export function createSupabaseMock() {
  return {
    from: (table: string) => {
      const chainedMethods = {
        // For INSERT operations: insert().select().single()
        insert: (data: any) => ({
          select: () => ({
            single: async () => ({
              data: {
                id: `${table}-${Date.now()}`,
                user_id: data.user_id,
                trigger_type: data.trigger_type,
                condition: data.condition,
                actions: data.actions,
                enabled: data.enabled ?? true,
                execution_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...data,
              },
              error: null,
            }),
          }),
        }),

        // For SELECT operations: select().eq().gte() for range queries
        select: (columns?: string) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              gte: (col3: string, val3: any) => ({
                then: async (cb: any) =>
                  cb({
                    data: [],
                    error: null,
                  }),
              }),
              // For single eq queries: select().eq().eq().single()
              single: async () => ({
                data: null,
                error: null,
              }),
              // For multi-eq queries: select().eq().eq() (no single)
              then: async (cb: any) =>
                cb({
                  data: [],
                  error: null,
                }),
            }),
            // For single eq: select().eq().single()
            single: async () => ({
              data: null,
              error: null,
            }),
            // For eq with additional methods
            gte: (col: string, val: any) => ({
              then: async (cb: any) =>
                cb({
                  data: [],
                  error: null,
                }),
            }),
            // For standard eq chain: select().eq() continuation
            then: async (cb: any) =>
              cb({
                data: [],
                error: null,
              }),
          }),
          gte: (col: string, val: any) => ({
            then: async (cb: any) =>
              cb({
                data: [],
                error: null,
              }),
          }),
          then: async (cb: any) =>
            cb({
              data: [],
              error: null,
            }),
        }),

        // For UPDATE operations: update().eq()
        update: (data: any) => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) =>
              cb({
                data: null,
                error: null,
              }),
          }),
        }),

        // For DELETE operations: delete().eq()
        delete: () => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) =>
              cb({
                data: null,
                error: null,
              }),
          }),
        }),
      };

      return chainedMethods;
    },
  };
}

/**
 * Create mock EmailService with all required methods
 */
export function createMockEmailService() {
  return {
    async getMessages(filter?: { from?: string; since?: Date; limit?: number }) {
      return [];
    },

    async sendEmail(to: string, subject: string, body: string) {
      return {
        id: `email-${Date.now()}`,
        to,
        subject,
        body,
        sentAt: new Date(),
      };
    },

    async addAccount(email: string, token: string) {
      return {
        id: `account-${Date.now()}`,
        email,
        connected: true,
      };
    },

    async getAccount(email: string) {
      return {
        id: `account-${Date.now()}`,
        email,
        connected: true,
      };
    },

    async disconnect(email: string) {
      return true;
    },
  };
}

/**
 * Create mock CalendarService with all required methods
 */
export function createMockCalendarService() {
  return {
    async getEvents(filter?: {
      userId?: string;
      start?: Date;
      end?: Date;
      limit?: number;
    }) {
      return [];
    },

    async createEvent(event: {
      title: string;
      start: Date;
      end: Date;
      attendees?: string[];
      description?: string;
    }) {
      return {
        id: `event-${Date.now()}`,
        ...event,
        createdAt: new Date(),
      };
    },

    async addAccount(email: string, token: string) {
      return {
        id: `calendar-account-${Date.now()}`,
        email,
        connected: true,
      };
    },

    async getAccount(email: string) {
      return {
        id: `calendar-account-${Date.now()}`,
        email,
        connected: true,
      };
    },

    async disconnect(email: string) {
      return true;
    },

    async getEvent(eventId: string) {
      return null;
    },

    async updateEvent(
      eventId: string,
      updates: Partial<{
        title: string;
        start: Date;
        end: Date;
        description: string;
      }>
    ) {
      return {
        id: eventId,
        ...updates,
        updatedAt: new Date(),
      };
    },
  };
}

/**
 * Create mock TaskService with all required methods
 */
export function createMockTaskService() {
  return {
    async getTasks(filter?: { userId?: string; status?: string; limit?: number }) {
      return [];
    },

    async createTask(task: {
      title: string;
      description?: string;
      priority?: string;
      dueDate?: Date;
      userId: string;
    }) {
      return {
        id: `task-${Date.now()}`,
        ...task,
        status: 'todo',
        createdAt: new Date(),
      };
    },

    async updateTask(taskId: string, updates: Partial<any>) {
      return {
        id: taskId,
        ...updates,
        updatedAt: new Date(),
      };
    },

    async deleteTask(taskId: string) {
      return true;
    },

    async getTask(taskId: string) {
      return null;
    },

    async completeTask(taskId: string) {
      return {
        id: taskId,
        status: 'done',
        completedAt: new Date(),
      };
    },
  };
}

/**
 * Create a mock automation trigger
 */
export function createMockAutomationTriggerData(
  overrides: Partial<AutomationTrigger> = {}
): AutomationTrigger {
  return {
    id: `trigger-${Date.now()}`,
    userId: 'user-123',
    triggerType: 'email_received',
    condition: {
      type: 'email',
      emailFrom: ['test@example.com'],
      subjectKeywords: [],
      bodyKeywords: [],
      matchAll: false,
    } as EmailTriggerCondition,
    actions: [
      {
        actionType: 'create_task',
        actionConfig: {
          title: 'Test task',
          priority: 'normal',
        } as CreateTaskActionConfig,
      } as WorkflowAction,
    ],
    enabled: true,
    executionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock meeting context
 */
export function createMockMeetingContextData(
  overrides: Partial<MeetingContext> = {}
): MeetingContext {
  return {
    id: `context-${Date.now()}`,
    userId: 'user-123',
    eventId: 'event-123',
    relevantEmails: [],
    actionItems: [],
    prepTaskId: `task-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock action item
 */
export function createMockActionItemData(
  overrides: Partial<ActionItem> = {}
): ActionItem {
  return {
    title: 'Complete report',
    context: 'Extracted from meeting notes',
    assigneeEmail: 'user@example.com',
    assigneeName: 'John Doe',
    priority: 'high',
    dueDate: new Date(Date.now() + 172800000),
    ...overrides,
  };
}

/**
 * Setup all service mocks in vitest
 * Call this in a beforeEach() hook in your tests
 */
export function setupServiceMocks() {
  const emailService = createMockEmailService();
  const calendarService = createMockCalendarService();
  const taskService = createMockTaskService();

  return {
    emailService,
    calendarService,
    taskService,
  };
}

/**
 * Create a complete Supabase mock with proper return types
 */
export function createCompleteSupabaseMock() {
  const store: Map<string, any[]> = new Map();

  return {
    from: (table: string) => {
      // Initialize table if needed
      if (!store.has(table)) {
        store.set(table, []);
      }

      const tableStore = store.get(table)!;

      return {
        // INSERT
        insert: (data: any) => ({
          select: () => ({
            single: async () => {
              const record = {
                id: `${table}-${Date.now()}`,
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              tableStore.push(record);
              return { data: record, error: null };
            },
          }),
        }),

        // SELECT
        select: (columns?: string) => ({
          eq: (col1: string, val1: any) => ({
            eq: (col2: string, val2: any) => ({
              gte: (col3: string, val3: any) => ({
                then: async (cb: any) => {
                  const results = tableStore.filter(
                    (r) => r[col1] === val1 && r[col2] === val2 && r[col3] >= val3
                  );
                  return cb({ data: results, error: null });
                },
              }),
              single: async () => {
                const result = tableStore.find(
                  (r) => r[col1] === val1 && r[col2] === val2
                );
                return { data: result || null, error: null };
              },
              then: async (cb: any) => {
                const results = tableStore.filter(
                  (r) => r[col1] === val1 && r[col2] === val2
                );
                return cb({ data: results, error: null });
              },
            }),
            single: async () => {
              const result = tableStore.find((r) => r[col1] === val1);
              return { data: result || null, error: null };
            },
            gte: (col: string, val: any) => ({
              then: async (cb: any) => {
                const results = tableStore.filter((r) => r[col1] === val1 && r[col] >= val);
                return cb({ data: results, error: null });
              },
            }),
            then: async (cb: any) => {
              const results = tableStore.filter((r) => r[col1] === val1);
              return cb({ data: results, error: null });
            },
          }),
          gte: (col: string, val: any) => ({
            then: async (cb: any) => {
              const results = tableStore.filter((r) => r[col1] === val1 && r[col] >= val);
              return cb({ data: results, error: null });
            },
          }),
          then: async (cb: any) => {
            const results = tableStore.filter((r) => r[col1] === val1);
            return cb({ data: results, error: null });
          },
        }),

        // UPDATE
        update: (data: any) => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) => {
              const index = tableStore.findIndex((r) => r[col] === val);
              if (index !== -1) {
                tableStore[index] = { ...tableStore[index], ...data };
              }
              return cb({ data: null, error: null });
            },
          }),
        }),

        // DELETE
        delete: () => ({
          eq: (col: string, val: any) => ({
            then: async (cb: any) => {
              const index = tableStore.findIndex((r) => r[col] === val);
              if (index !== -1) {
                tableStore.splice(index, 1);
              }
              return cb({ data: null, error: null });
            },
          }),
        }),
      };
    },
  };
}
