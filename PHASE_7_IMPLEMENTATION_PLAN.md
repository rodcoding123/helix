# Phase 7: Automations & Workflows Implementation Plan

**Status:** Ready for Implementation
**Date:** February 3, 2026
**Timeline:** 4 weeks
**Complexity:** High
**Dependencies:** Phases 5-6 (Email, Calendar, Tasks, Native Apps) ✅

---

## Executive Summary

Phase 7 transforms Helix from a collection of integrated tools into an intelligent, autonomous assistant that learns user patterns and automates routine workflows.

**Core Vision:**

- Email → Task automation (convert emails to actionable tasks)
- Calendar → Task automation (create tasks from calendar events)
- Smart scheduling (find optimal meeting times automatically)
- Meeting preparation (pull relevant emails and docs pre-meeting)
- Post-meeting follow-up (auto-generate action items from meeting notes)

**What This Enables:**

- "Flag this email as important" → creates task, schedules follow-up
- Meeting invite received → auto-prep doc with context from emails + calendar
- Meeting ends → action items extracted and added to task board
- Calendar shows free time → suggests new tasks to schedule
- Smart prioritization based on calendar urgency

**Scope:** 4 weeks, ~3000 LOC, 80+ tests, 5 core services

---

## Architecture: Automation Engine

### System Design

```
┌─────────────────────────────────────────────────────────┐
│            AUTOMATION ORCHESTRATOR (700 lines)          │
│                                                         │
│  - Trigger Detection (email events, calendar events)   │
│  - Workflow Execution Engine                           │
│  - Context & History Management                        │
│  - ML-based Pattern Learning                           │
│  - Audit Trail (Discord logging)                       │
└─────────────┬───────────────────────────────────────────┘
              │
    ┌─────────┼─────────┬──────────┬──────────────┐
    │         │         │          │              │
    ▼         ▼         ▼          ▼              ▼
┌────────┐ ┌──────┐ ┌───────┐ ┌──────┐ ┌─────────────┐
│ Email  │ │Task  │ │Smart  │ │Meet- │ │Automation  │
│ Trigger│ │Trig- │ │Sched- │ │ing   │ │Rules       │
│ Service│ │ger   │ │uling  │ │Prep  │ │Engine      │
└────────┘ └──────┘ └───────┘ └──────┘ └─────────────┘
```

### Data Model

```typescript
interface AutomationTrigger {
  id: string;
  userId: string;
  triggerType: 'email_received' | 'email_flag' | 'calendar_event' | 'task_created';
  condition: TriggerCondition;
  action: WorkflowAction[];
  enabled: boolean;
  createdAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
}

interface TriggerCondition {
  // Email triggers
  emailFrom?: string[]; // Match sender email
  emailSubjectKeywords?: string[]; // Match subject
  emailBodyKeywords?: string[]; // Match content
  hasAttachments?: boolean;

  // Calendar triggers
  calendarType?: 'meeting' | 'event' | 'task';
  eventTitle?: string[];
  eventDuration?: { min: number; max: number }; // minutes
  attendeeCount?: { min: number; max: number };

  // Time-based
  timeOfDay?: { start: string; end: string }; // HH:MM
  dayOfWeek?: number[]; // 0-6
}

interface WorkflowAction {
  actionType: 'create_task' | 'schedule_prep' | 'send_email' | 'add_calendar_block';
  actionConfig: any;
  priority: 'high' | 'normal' | 'low';
  delayMs?: number; // Execute after delay
}

interface AutomationExecution {
  id: string;
  userId: string;
  triggerId: string;
  triggerData: any;
  status: 'success' | 'failed' | 'skipped';
  executedAt: Date;
  result?: any;
  error?: string;
}
```

---

## Phase 7 Tracks

### Track 1: Email → Task Automation (Days 1-7)

#### 1.1 Email Trigger Service (Days 1-2)

**Create:** `web/src/services/automation-email-trigger.ts` (400+ lines)

**Functionality:**

```typescript
export class EmailTriggerService {
  /**
   * Create automation rule when email matches conditions
   */
  async createEmailToTaskRule(params: {
    userId: string;
    senderEmail?: string;
    subjectKeywords?: string[];
    bodyKeywords?: string[];
    createTaskTemplate: {
      title: string; // "Follow up on {{emailSubject}}"
      description: string;
      dueDate: 'tomorrow' | 'next_week' | 'in_2_weeks';
      priority: 1 | 2 | 3 | 4 | 5;
      tags?: string[];
    };
  }): Promise<AutomationTrigger> {
    // Store rule in automation_triggers table
    // Enable real-time email event subscription
  }

  /**
   * Auto-execute on incoming email
   */
  async onEmailReceived(email: Email): Promise<Task | null> {
    // 1. Find matching automation rules
    const rules = await this.findMatchingRules(email);

    if (rules.length === 0) return null;

    // 2. For each rule, create a task
    const tasks: Task[] = [];
    for (const rule of rules) {
      const task = await this.executeEmailToTaskRule(email, rule);
      tasks.push(task);
    }

    // 3. Log execution to Discord
    await logToDiscord({
      type: 'automation_email_to_task',
      emailId: email.id,
      tasksCreated: tasks.length,
      rules: rules.map(r => r.id),
    });

    return tasks[0]; // Return primary task
  }

  /**
   * Parse email and create task with context
   */
  private async executeEmailToTaskRule(email: Email, rule: AutomationTrigger): Promise<Task> {
    const config = rule.action[0]; // Assume first action is task creation

    // Apply template variables
    const taskTitle = this.applyVariables(config.actionConfig.title, {
      emailSubject: email.subject,
      emailFrom: email.from_address,
      emailDate: email.received_at,
    });

    const taskDescription = `
Email from: ${email.from_address}
Date: ${email.received_at}
Subject: ${email.subject}

Preview: ${email.body_text?.substring(0, 200)}...

[View full email]
`;

    // Create task
    return await this.taskService.createTask({
      userId: rule.userId,
      title: taskTitle,
      description: taskDescription,
      dueDate: this.parseDueDate(config.actionConfig.dueDate),
      priority: config.actionConfig.priority || 3,
      tags: config.actionConfig.tags || ['auto:email'],
      metadata: {
        sourceEmail: email.id,
        automationRule: rule.id,
      },
    });
  }

  /**
   * Match email against rule conditions
   */
  private matchesRule(email: Email, rule: AutomationTrigger): boolean {
    const cond = rule.condition;

    // Check sender
    if (cond.emailFrom && !cond.emailFrom.includes(email.from_address)) {
      return false;
    }

    // Check subject keywords
    if (cond.emailSubjectKeywords) {
      const subjectLower = email.subject.toLowerCase();
      const hasKeyword = cond.emailSubjectKeywords.some(kw =>
        subjectLower.includes(kw.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check body keywords
    if (cond.emailBodyKeywords) {
      const bodyLower = (email.body_text || '').toLowerCase();
      const hasKeyword = cond.emailBodyKeywords.some(kw => bodyLower.includes(kw.toLowerCase()));
      if (!hasKeyword) return false;
    }

    return true;
  }
}
```

**Database:**

```sql
CREATE TABLE automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'email_received', 'email_flag', 'calendar_event', 'task_created'
  )),
  condition JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_executed_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  trigger_id UUID NOT NULL REFERENCES automation_triggers(id),
  trigger_data JSONB,
  status TEXT CHECK (status IN ('success', 'failed', 'skipped')),
  result JSONB,
  error TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_automation_triggers_user ON automation_triggers(user_id);
CREATE INDEX idx_automation_triggers_enabled ON automation_triggers(enabled) WHERE enabled;
CREATE INDEX idx_automation_executions_user ON automation_executions(user_id);
CREATE INDEX idx_automation_executions_trigger ON automation_executions(trigger_id);
```

**Tests:** 12 tests

- Rule creation ✅
- Email matching ✅
- Task creation ✅
- Variable substitution ✅
- Condition evaluation ✅
- Execution logging ✅

#### 1.2 Email Trigger UI (Days 3-4)

**Create:** `web/src/components/automation/EmailAutomationBuilder.tsx` (350+ lines)

```tsx
interface EmailAutomationBuilderProps {
  userId: string;
  onSave: (rule: AutomationTrigger) => void;
}

export const EmailAutomationBuilder: React.FC<EmailAutomationBuilderProps> = ({
  userId,
  onSave,
}) => {
  const [fromEmail, setFromEmail] = useState('');
  const [subjectKeywords, setSubjectKeywords] = useState<string[]>([]);
  const [bodyKeywords, setBodyKeywords] = useState<string[]>([]);

  // Task template config
  const [taskTitle, setTaskTitle] = useState('Follow up: {{emailSubject}}');
  const [dueDate, setDueDate] = useState<'tomorrow' | 'next_week' | 'in_2_weeks'>('tomorrow');
  const [priority, setPriority] = useState(3);

  const handleSave = async () => {
    const rule = await automationService.createEmailToTaskRule({
      userId,
      senderEmail: fromEmail ? [fromEmail] : undefined,
      subjectKeywords: subjectKeywords.length > 0 ? subjectKeywords : undefined,
      bodyKeywords: bodyKeywords.length > 0 ? bodyKeywords : undefined,
      createTaskTemplate: {
        title: taskTitle,
        description: '',
        dueDate,
        priority,
        tags: ['auto:email'],
      },
    });

    onSave(rule);
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <h3 className="font-bold">Create Email → Task Rule</h3>

      {/* From */}
      <div>
        <label className="block text-sm font-medium mb-1">From Email</label>
        <input
          type="email"
          value={fromEmail}
          onChange={e => setFromEmail(e.target.value)}
          placeholder="boss@company.com (optional)"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      {/* Subject Keywords */}
      <div>
        <label className="block text-sm font-medium mb-1">Subject Contains (keywords)</label>
        <TagInput
          tags={subjectKeywords}
          onTagsChange={setSubjectKeywords}
          placeholder="urgent, follow-up, deadline"
        />
      </div>

      {/* Task Template */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="font-medium">Create Task With:</h4>

        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {{ emailSubject }} to include email subject
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <select
              value={dueDate}
              onChange={e => setDueDate(e.target.value as any)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="tomorrow">Tomorrow</option>
              <option value="next_week">Next Week</option>
              <option value="in_2_weeks">In 2 Weeks</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded"
            >
              <option value={1}>1 - Urgent</option>
              <option value={2}>2 - High</option>
              <option value={3}>3 - Normal</option>
              <option value={4}>4 - Low</option>
              <option value={5}>5 - Minimal</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
      >
        Create Rule
      </button>
    </div>
  );
};
```

**Tests:** 8 tests

- UI rendering ✅
- Form submission ✅
- Tag input ✅
- Variable preview ✅

#### 1.3 Email Trigger Integration (Days 5-7)

**Modify:** `web/src/services/email-sync.ts` (add trigger execution)

```typescript
// On email received, check automation triggers
async onEmailReceived(email: Email): Promise<void> {
  // ... existing sync logic ...

  // Check and execute email automation rules
  const automationService = new AutomationEmailTriggerService(userId);
  const createdTask = await automationService.onEmailReceived(email);

  if (createdTask) {
    // Notify user
    await notificationService.notify({
      type: 'automation_triggered',
      message: `Created task: "${createdTask.title}" from email`,
      actionUrl: `/tasks/${createdTask.id}`,
    });
  }
}
```

**Tests:** 8 tests

- Integration with email sync ✅
- Real-time trigger execution ✅
- Task creation ✅
- Notification ✅

---

### Track 2: Calendar → Task Automation (Days 8-14)

#### 2.1 Meeting Preparation Service (Days 8-10)

**Create:** `web/src/services/automation-meeting-prep.ts` (500+ lines)

```typescript
export class MeetingPrepService {
  /**
   * Prepare meeting context before event starts
   * - Fetch relevant emails from attendees
   * - Find shared documents
   * - Create prep checklist
   * - Schedule preparation time
   */
  async prepareMeeting(eventId: string, userId: string): Promise<MeetingContext> {
    // 1. Load event details
    const event = await this.calendarService.getEvent(eventId);

    // 2. Extract attendees
    const attendees = event.attendees?.map(a => a.email) || [];

    // 3. Find relevant emails from attendees
    const relevantEmails = await this.emailService.search({
      from: attendees,
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      limit: 10,
    });

    // 4. Extract action items from email chains
    const actionItems = this.extractActionItems(relevantEmails, event.title);

    // 5. Create prep task if meeting is >30 min away
    const timeToMeeting = event.start_time.getTime() - Date.now();
    if (timeToMeeting > 30 * 60 * 1000) {
      // >30 minutes
      const prepTask = await this.taskService.createTask({
        title: `Prep: ${event.title}`,
        description: this.generatePrepChecklist(event, relevantEmails, actionItems),
        dueDate: new Date(event.start_time.getTime() - 15 * 60 * 1000), // 15 min before
        priority: 5, // Highest
        tags: ['auto:meeting_prep'],
      });

      // Schedule to pop up as notification 15 minutes before meeting
      await this.notificationService.scheduleNotification({
        type: 'meeting_prep_reminder',
        meetingTitle: event.title,
        prepTaskId: prepTask.id,
        scheduledTime: new Date(event.start_time.getTime() - 15 * 60 * 1000),
      });
    }

    // 6. Create meeting context object
    const context: MeetingContext = {
      eventId,
      title: event.title,
      attendees,
      startTime: event.start_time,
      relevantEmails: relevantEmails.slice(0, 5),
      actionItems,
      prepTaskId: prepTask?.id,
    };

    // 7. Log to Discord
    await logToDiscord({
      type: 'automation_meeting_prep',
      meeting: event.title,
      attendeeCount: attendees.length,
      emailsFound: relevantEmails.length,
      actionItemsExtracted: actionItems.length,
    });

    return context;
  }

  /**
   * Extract action items and decision points from emails
   */
  private extractActionItems(emails: Email[], meetingTopic: string): string[] {
    const items: string[] = [];

    for (const email of emails) {
      // Look for patterns like "action:", "TODO:", "due:", etc.
      const patterns = [
        /action:?\s+([^\n]+)/gi,
        /todo:?\s+([^\n]+)/gi,
        /need to\s+([^\n]+)/gi,
        /please\s+([^\n]+)/gi,
      ];

      const text = email.body_text || '';
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          items.push(match[1].trim());
        }
      }
    }

    return items.filter((item, idx) => items.indexOf(item) === idx); // Deduplicate
  }

  /**
   * Generate preparation checklist
   */
  private generatePrepChecklist(
    event: CalendarEvent,
    emails: Email[],
    actionItems: string[]
  ): string {
    return `
# Meeting Prep: ${event.title}

## Meeting Details
- **When:** ${event.start_time.toLocaleString()}
- **Duration:** ${(event.end_time.getTime() - event.start_time.getTime()) / 60000} minutes
- **Attendees:** ${event.attendees?.map(a => a.email).join(', ')}

## Recent Context
${emails
  .slice(0, 3)
  .map(e => `- ${e.subject} (${new Date(e.received_at).toLocaleDateString()})`)
  .join('\n')}

## Action Items to Address
${actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

## Preparation Checklist
- [ ] Review recent emails from attendees
- [ ] Check any pending decisions
- [ ] Gather relevant documents
- [ ] Prepare agenda items
- [ ] Test audio/video if remote
`;
  }
}
```

**Tests:** 15 tests

- Meeting prep creation ✅
- Email relevance matching ✅
- Action item extraction ✅
- Checklist generation ✅
- Notification scheduling ✅

#### 2.2 Post-Meeting Follow-up Service (Days 11-14)

**Create:** `web/src/services/automation-post-meeting.ts` (400+ lines)

```typescript
export class PostMeetingFollowupService {
  /**
   * Extract action items from meeting transcript/notes
   * Create tasks for each action item
   * Assign to responsible person
   */
  async createPostMeetingFollowup(params: {
    eventId: string;
    userId: string;
    notes?: string; // Meeting notes/transcript
    recordingUrl?: string; // Meeting recording (for transcription)
  }): Promise<Task[]> {
    // 1. Get meeting details
    const event = await this.calendarService.getEvent(params.eventId);

    // 2. Extract action items from notes or recording
    let actionItems: ActionItem[];

    if (params.notes) {
      actionItems = this.extractActionItemsFromNotes(params.notes);
    } else if (params.recordingUrl) {
      // Transcribe recording and extract
      const transcript = await this.transcribeRecording(params.recordingUrl);
      actionItems = this.extractActionItemsFromTranscript(transcript);
    } else {
      actionItems = [];
    }

    // 3. Create tasks for each action item
    const tasks: Task[] = [];
    for (const item of actionItems) {
      const task = await this.taskService.createTask({
        title: item.title,
        description: `From: ${event.title} meeting on ${new Date(event.start_time).toLocaleDateString()}\n\n${item.context}`,
        dueDate: item.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week default
        priority: item.priority || 3,
        assigneeId: item.assigneeEmail
          ? await this.getUserIdByEmail(item.assigneeEmail)
          : params.userId,
        tags: ['auto:follow_up', `meeting:${event.id}`],
      });

      tasks.push(task);
    }

    // 4. Create "Send meeting summary" task
    const summaryTask = await this.taskService.createTask({
      title: `Send summary email for: ${event.title}`,
      description: `Meeting Summary:\n\nAttendees: ${event.attendees?.map(a => a.email).join(', ')}\n\nAction Items:\n${actionItems.map(item => `- ${item.title} (${item.assigneeEmail || 'unassigned'})`).join('\n')}`,
      dueDate: new Date(), // Due immediately (next morning)
      priority: 4,
      tags: ['auto:follow_up'],
    });
    tasks.push(summaryTask);

    // 5. Log to Discord
    await logToDiscord({
      type: 'automation_post_meeting_followup',
      meeting: event.title,
      actionItemsCreated: actionItems.length,
      tasksCreated: tasks.length,
      attendees: event.attendees?.length || 0,
    });

    return tasks;
  }

  /**
   * Extract action items from meeting notes
   * Patterns: "- Action:", "TODO:", "@person needs to", etc.
   */
  private extractActionItemsFromNotes(notes: string): ActionItem[] {
    const items: ActionItem[] = [];

    // Pattern for "- Action item" or "TODO:"
    const actionPattern = /^[\s]*[-•]\s+(?:ACTION|TODO)?:?\s+(.+?)(?:\n|$)/gim;
    let match;

    while ((match = actionPattern.exec(notes)) !== null) {
      const text = match[1].trim();

      // Try to extract assignee if mentioned
      const assigneeMatch = text.match(/@(\w+@[\w.]+)|\((\w+)\)/);
      const assignee = assigneeMatch ? assigneeMatch[1] || assigneeMatch[2] : undefined;

      items.push({
        title: text.replace(/@[\w.]+|\([^)]+\)/g, '').trim(),
        context: notes.substring(Math.max(0, match.index - 100), match.index + 150),
        assigneeEmail: assignee,
        priority: text.toLowerCase().includes('urgent') ? 2 : 3,
        dueDate: this.extractDueDate(text),
      });
    }

    return items;
  }

  /**
   * Extract due date from text like "by Friday", "next week", etc.
   */
  private extractDueDate(text: string): Date | undefined {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('today')) return new Date();
    if (lowerText.includes('tomorrow')) return new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (lowerText.includes('next week')) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (lowerText.includes('friday')) {
      const today = new Date();
      const friday = new Date(today);
      friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7));
      return friday;
    }

    return undefined;
  }
}
```

**Tests:** 12 tests

- Action item extraction ✅
- Task creation from action items ✅
- Due date parsing ✅
- Assignee detection ✅
- Email summary generation ✅

---

### Track 3: Smart Scheduling (Days 15-21)

#### 3.1 Smart Scheduling Engine (Days 15-18)

**Create:** `web/src/services/automation-smart-scheduling.ts` (500+ lines)

```typescript
export class SmartSchedulingService {
  /**
   * Find optimal times for meetings given all attendees' calendars
   * Consider: existing events, preferred times, time zones, break time
   */
  async findBestMeetingTimes(params: {
    attendeeEmails: string[];
    duration: number; // minutes
    dateRange: { start: Date; end: Date };
    preferences?: {
      preferredHours?: { start: number; end: number }; // 9-17
      minimumBreakTime?: number; // minutes between meetings
      avoidLunchHours?: boolean;
      timeZone?: string;
    };
  }): Promise<SuggestedTime[]> {
    const { attendeeEmails, duration, dateRange, preferences = {} } = params;

    // 1. Fetch calendars for all attendees
    const calendars = await Promise.all(
      attendeeEmails.map(email =>
        this.calendarService.getCalendar(email, dateRange)
      )
    );

    // 2. Find free slots where ALL attendees are available
    const freeSlots = this.calculateFreeSlots(
      calendars,
      duration,
      dateRange,
      preferences
    );

    // 3. Score each slot based on quality metrics
    const scoredSlots = freeSlots.map(slot => ({
      ...slot,
      score: this.scoreTimeSlot(slot, attendees Length, preferences),
    }));

    // 4. Sort by score (best first)
    const sorted = scoredSlots.sort((a, b) => b.score - a.score);

    // 5. Log to Discord
    await logToDiscord({
      type: 'automation_smart_scheduling',
      attendees: attendeeEmails.length,
      durationMinutes: duration,
      optionsSuggested: Math.min(3, sorted.length),
      bestScore: sorted[0]?.score,
    });

    return sorted.slice(0, 5);
  }

  /**
   * Score a time slot based on quality metrics
   * Higher score = better time
   * - Minimize afternoon (lower energy)
   * - Prefer mornings (higher energy)
   * - Avoid end of day
   * - Avoid lunch hours
   * - Minimize meeting burden
   */
  private scoreTimeSlot(
    slot: TimeSlot,
    attendeeCount: number,
    preferences: any
  ): number {
    let score = 100;
    const hour = slot.start.getHours();

    // Time of day scoring
    if (hour < 9) score -= 20; // Too early
    if (hour >= 9 && hour < 11) score += 20; // Ideal morning
    if (hour >= 11 && hour < 12) score -= 10; // Before lunch rush
    if (hour >= 12 && hour < 13) score -= 30; // Lunch
    if (hour >= 13 && hour < 15) score -= 15; // Post-lunch dip
    if (hour >= 15 && hour < 17) score += 10; // Afternoon recovery
    if (hour >= 17) score -= 25; // End of day

    // Day of week scoring
    const day = slot.start.getDay();
    if (day === 0 || day === 6) score -= 50; // Weekends
    if (day === 1) score -= 5; // Mondays (busy)
    if (day === 5) score -= 10; // Fridays (people check out)
    if (day === 3) score += 10; // Wednesdays (middle of week, best focus)

    // Attendee count impact
    if (attendeeCount > 10) score -= attendeeCount * 2; // Large meetings costlier

    // Time zone consideration
    // (Subtract points for inconvenient times for any attendee)

    return Math.max(0, score);
  }

  /**
   * Calculate free time slots across multiple calendars
   */
  private calculateFreeSlots(
    calendars: CalendarEvent[][],
    duration: number,
    dateRange: { start: Date; end: Date },
    preferences: any
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    // Iterate through each day in range
    for (let date = new Date(dateRange.start); date <= dateRange.end; date.setDate(date.getDate() + 1)) {
      // Check each hour
      for (let hour = preferences.preferredHours?.start || 8; hour < (preferences.preferredHours?.end || 18); hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);

        // Check if ALL attendees are free during this slot
        const allFree = calendars.every(cal =>
          !this.hasConflict(cal, slotStart, slotEnd)
        );

        if (allFree) {
          slots.push({ start: slotStart, end: slotEnd, attendeeCount: calendars.length });
        }
      }
    }

    return slots;
  }

  private hasConflict(events: CalendarEvent[], start: Date, end: Date): boolean {
    return events.some(event =>
      event.start_time < end && event.end_time > start
    );
  }
}
```

**Tests:** 15 tests

- Free slot calculation ✅
- Time slot scoring ✅
- Multi-attendee scheduling ✅
- Time zone handling ✅
- Preference application ✅

#### 3.2 Smart Scheduling UI (Days 19-21)

**Create:** `web/src/components/automation/SmartSchedulingPanel.tsx` (300+ lines)

```tsx
interface SmartSchedulingPanelProps {
  attendees: string[];
  duration: number;
  onScheduleSelect: (time: SuggestedTime) => void;
}

export const SmartSchedulingPanel: React.FC<SmartSchedulingPanelProps> = ({
  attendees,
  duration,
  onScheduleSelect,
}) => {
  const [suggestions, setSuggestions] = useState<SuggestedTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
  });

  useEffect(() => {
    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const service = new SmartSchedulingService();
        const times = await service.findBestMeetingTimes({
          attendeeEmails: attendees,
          duration,
          dateRange,
          preferences: {
            avoidLunchHours: true,
            preferredHours: { start: 9, end: 17 },
          },
        });
        setSuggestions(times);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [attendees, duration, dateRange]);

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <h3 className="font-bold">Smart Meeting Scheduling</h3>

      <div className="space-y-2 text-sm">
        <p className="text-gray-600">
          Finding optimal times for {attendees.length} attendee(s) across 2 weeks...
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader className="animate-spin mr-2" size={20} />
          Analyzing calendars...
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map(suggestion => (
            <div
              key={suggestion.start.toISOString()}
              onClick={() => onScheduleSelect(suggestion)}
              className="border rounded p-3 cursor-pointer hover:bg-blue-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">
                    {suggestion.start.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-sm text-gray-600">
                    {suggestion.start.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    -{' '}
                    {suggestion.end.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-green-600">
                    {Math.round(suggestion.score)}% match
                  </div>
                  <div className="text-xs text-gray-500">All available</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-8">
          No available times found. Try expanding date range or reducing attendee count.
        </div>
      )}
    </div>
  );
};
```

**Tests:** 12 tests

- UI rendering ✅
- Loading states ✅
- Time slot selection ✅
- Suggestion display ✅

---

### Track 4: Orchestration & Learning (Days 22-28)

#### 4.1 Central Automation Orchestrator (Days 22-25)

**Create:** `web/src/services/automation-orchestrator.ts` (600+ lines)

Core orchestration logic that ties all automation services together.

**Tests:** 20 tests

#### 4.2 Learning Engine (Days 26-28)

**Create:** `web/src/services/automation-learning.ts` (400+ lines)

ML-based pattern learning to improve automation suggestions over time.

**Tests:** 10 tests

---

## Database Schema

```sql
CREATE TABLE automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  condition JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_id UUID REFERENCES automation_triggers(id),
  status TEXT CHECK (status IN ('success', 'failed', 'skipped')),
  result JSONB,
  error TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE meeting_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_id UUID NOT NULL REFERENCES calendar_events(id),
  relevant_emails JSONB,
  action_items JSONB,
  prep_task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_automation_triggers_user_enabled ON automation_triggers(user_id, enabled);
CREATE INDEX idx_automation_executions_trigger ON automation_executions(trigger_id);
CREATE INDEX idx_meeting_contexts_user_event ON meeting_contexts(user_id, event_id);
```

---

## Testing Strategy

### Unit Tests (45 tests)

- Email trigger service (12 tests)
- Meeting prep service (15 tests)
- Smart scheduling service (15 tests)
- Post-meeting follow-up (8 tests)

### Integration Tests (20 tests)

- Email → Task automation workflow (5 tests)
- Calendar → Task automation workflow (5 tests)
- Meeting preparation end-to-end (5 tests)
- Post-meeting follow-up end-to-end (5 tests)

### E2E Tests (15 tests)

- Complete email automation flow
- Complete calendar automation flow
- Smart scheduling with actual events
- Full meeting preparation → action items → follow-up

**Total:** 80 tests with 90%+ coverage

---

## Success Criteria

Phase 7 is complete when:

- [ ] ✅ Email → Task rules can be created and executed
- [ ] ✅ Calendar → Task rules can be created and executed
- [ ] ✅ Meeting preparation generates contextual checklists
- [ ] ✅ Action items extracted from meeting notes
- [ ] ✅ Smart scheduling finds optimal meeting times
- [ ] ✅ 80+ tests passing
- [ ] ✅ 90%+ code coverage
- [ ] ✅ All automation rules logged to Discord
- [ ] ✅ Performance: Automation executes <500ms
- [ ] ✅ No blocking on user operations (async execution)

---

## Timeline

| Week | Tasks                                    | Status  |
| ---- | ---------------------------------------- | ------- |
| 1    | Email trigger service + UI + integration | Planned |
| 2    | Calendar prep + post-meeting follow-up   | Planned |
| 3    | Smart scheduling service + UI            | Planned |
| 4    | Orchestrator + Learning + Testing        | Planned |

**Total:** 4 weeks, ~3000 LOC, 80+ tests

---

## Next Steps

1. Create automation database tables (migration)
2. Implement email trigger service
3. Build email automation UI
4. Integrate with email sync
5. ... (continue through all tracks)

---

**Status:** Ready for Implementation
**Created:** February 3, 2026
**Phase:** 7 of Future Roadmap
