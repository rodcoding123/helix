/**
 * Phase 7: Automations & Workflows
 * Core type definitions for automation triggers, conditions, actions, and execution
 */

/**
 * Email-based trigger condition
 * Matches emails based on sender, subject, and body keywords
 */
export interface EmailTriggerCondition {
  type: 'email';
  emailFrom?: string[]; // Array of sender email addresses to match
  subjectKeywords?: string[]; // Keywords that must appear in subject
  bodyKeywords?: string[]; // Keywords that must appear in body
  hasAttachments?: boolean; // Only match emails with attachments
  matchAll?: boolean; // If true, all conditions must match; if false, any condition matches
}

/**
 * Calendar-based trigger condition
 * Matches calendar events based on type, title, duration, attendees
 */
export interface CalendarTriggerCondition {
  type: 'calendar';
  eventType?: 'meeting' | 'event' | 'task'; // Type of calendar event
  eventTitleKeywords?: string[]; // Keywords in event title
  durationMs?: { min: number; max: number }; // Event duration range in milliseconds
  attendeeCount?: { min: number; max: number }; // Number of attendees range
  isOptional?: boolean; // Only match non-optional events
}

/**
 * Time-based trigger condition
 * Restricts automation execution to specific times
 */
export interface TimeTriggerCondition {
  type: 'time';
  timeOfDay?: { start: string; end: string }; // HH:MM format, e.g. "09:00" - "17:00"
  dayOfWeek?: number[]; // 0-6 (Sunday-Saturday)
  timezone?: string; // IANA timezone identifier
}

/**
 * Combined trigger condition - can be any of the above
 */
export type TriggerCondition = EmailTriggerCondition | CalendarTriggerCondition | TimeTriggerCondition;

/**
 * Workflow action to execute when trigger fires
 * Actions are executed in sequence with optional delays
 */
export interface WorkflowAction {
  actionType: 'create_task' | 'send_email' | 'add_calendar_block' | 'update_task' | 'custom_webhook';
  actionConfig: Record<string, any>; // Action-specific configuration
  priority?: 'high' | 'normal' | 'low';
  delayMs?: number; // Delay before executing this action (for sequencing)
  retryOnFailure?: boolean; // Retry up to 3 times if action fails
  timeout?: number; // Timeout in milliseconds (default 30000)
}

/**
 * Task creation action configuration
 * Variables like {{emailSubject}}, {{emailFrom}} are substituted at execution time
 */
export interface CreateTaskActionConfig {
  title: string; // Task title (supports template variables)
  description?: string; // Task description (supports template variables)
  dueDate?: string | Date; // Due date string or date object
  priority?: 'high' | 'normal' | 'low'; // Task priority
  tags?: string[]; // Tags to add to task
  assigneeEmail?: string; // Optional assignee email
}

/**
 * Email action configuration
 * Sends an email with optional template variables
 */
export interface SendEmailActionConfig {
  to: string | string[]; // Recipient(s)
  subject: string; // Email subject (supports template variables)
  body: string; // Email body (supports template variables)
  cc?: string[]; // CC recipients
  bcc?: string[]; // BCC recipients
}

/**
 * Calendar block action configuration
 * Creates a calendar block (busy time) to prevent scheduling
 */
export interface AddCalendarBlockActionConfig {
  title: string; // Block title
  durationMinutes: number; // Duration in minutes
  daysFromNow?: number; // Days from now to create block (default 0)
  timeOfDay?: 'morning' | 'afternoon' | 'evening'; // Suggested time slot
}

/**
 * Main automation trigger definition
 * Contains the trigger type, conditions, and actions to execute
 */
export interface AutomationTrigger {
  id: string;
  userId: string;
  triggerType: 'email_received' | 'email_flag' | 'calendar_event' | 'task_created';
  condition: TriggerCondition;
  actions: WorkflowAction[];
  enabled: boolean;
  executionCount: number;
  lastExecutedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Automation execution record
 * Logs every time an automation trigger fires, whether successful or not
 */
export interface AutomationExecution {
  id: string;
  userId: string;
  triggerId: string;
  triggerData?: Record<string, any>; // Data that triggered the automation (email, event, etc.)
  status: 'success' | 'failed' | 'skipped';
  result?: Record<string, any>; // Execution result (created task ID, etc.)
  error?: string; // Error message if status is 'failed'
  executedAt: Date;
}

/**
 * Meeting preparation context
 * Pre-calculated data for meeting preparation (emails, action items, etc.)
 */
export interface MeetingContext {
  id: string;
  userId: string;
  eventId: string;
  relevantEmails: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: Date;
  }>;
  actionItems: Array<{
    text: string;
    context: string; // Email or meeting subject where action item was found
    priority?: 'high' | 'normal' | 'low';
  }>;
  prepTaskId?: string; // Task ID for prep checklist
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Meeting action item extracted from notes or transcript
 * Parsed from meeting follow-up notes
 */
export interface ActionItem {
  title: string; // Action item title
  context: string; // Full text where action item was found
  assigneeEmail?: string; // Detected assignee email from mentions
  assigneeName?: string; // Extracted assignee name
  priority: 'high' | 'normal' | 'low'; // Detected from keywords or context
  dueDate?: Date; // Extracted due date from text (e.g., "by Friday")
  taskId?: string; // Created task ID
}

/**
 * Suggested automation from learning engine
 * ML-based automation suggestions based on user patterns
 */
export interface AutomationSuggestion {
  id: string;
  userId: string;
  suggestedTrigger: TriggerCondition;
  suggestedActions: WorkflowAction[];
  confidence: number; // 0-1, confidence score for suggestion
  basedOnPatterns: string[]; // Pattern names that led to this suggestion
  createdAt: Date;
  acceptedAt?: Date; // When user accepted this suggestion
}

/**
 * Automation pattern detected by learning engine
 * Represents a frequently occurring automation pattern
 */
export interface DetectedPattern {
  id: string;
  userId: string;
  pattern: string; // Pattern name (e.g., "email_flag_to_task")
  frequency: number; // How many times this pattern occurred
  lastOccurrenceAt: Date;
  triggerType: string;
  successRate: number; // 0-1, success rate of automations matching this pattern
}

/**
 * Smart scheduling suggestion
 * Time slot suggestion for scheduling meetings
 */
export interface TimeSlot {
  start: Date;
  end: Date;
  attendeeCount: number; // How many attendees are available
  score: number; // Quality score (0-100)
  scoreBreakdown?: {
    timeOfDayScore: number; // Morning preferred
    dayOfWeekScore: number; // Wednesday preferred
    attendeeAvailabilityScore: number; // All attendees available
    preferenceScore: number; // Matches user preferences
  };
}

/**
 * Meeting suggestion from smart scheduling
 * Contains suggested times and reasoning
 */
export interface SchedulingSuggestion {
  attendeeEmails: string[];
  duration: number; // Duration in minutes
  suggestedSlots: TimeSlot[];
  bestSlot?: TimeSlot; // Single best recommendation
  timezone: string;
  createdAt: Date;
}

/**
 * Template variable replacements for action execution
 * Used to substitute variables like {{emailSubject}} in action configs
 */
export interface TemplateVariables {
  emailSubject?: string;
  emailFrom?: string;
  emailTo?: string;
  emailBody?: string;
  eventTitle?: string;
  eventTime?: string;
  eventDate?: string;
  eventAttendees?: string[];
  taskTitle?: string;
  taskDescription?: string;
  [key: string]: any; // Allow custom variables
}

/**
 * Automation execution context
 * Full context passed through automation execution pipeline
 */
export interface AutomationContext {
  triggerId: string;
  userId: string;
  triggerType: 'email_received' | 'email_flag' | 'calendar_event' | 'task_created';
  triggerData: Record<string, any>;
  templateVariables: TemplateVariables;
  createdAt: Date;
}
