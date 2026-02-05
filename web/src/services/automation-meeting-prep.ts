/**
 * Meeting Preparation Service - Phase 7 Track 2
 * Generates meeting context, extracts relevant emails, and creates prep tasks
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import { hashChain } from '@/helix/hash-chain';
import type { MeetingContext, ActionItem } from './automation.types.js';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  attendees?: string[];
  description?: string;
  location?: string;
}

interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  snippet: string;
  date: Date;
}

export class MeetingPrepService {
  private static instance: MeetingPrepService;

  private constructor() {}

  static getInstance(): MeetingPrepService {
    if (!MeetingPrepService.instance) {
      MeetingPrepService.instance = new MeetingPrepService();
    }
    return MeetingPrepService.instance;
  }

  /**
   * Prepare meeting context before event starts
   */
  async prepareMeeting(eventId: string, userId: string): Promise<MeetingContext | null> {
    try {
      // Get calendar event details
      const event = await this.getCalendarEvent(eventId, userId);
      if (!event) {
        return null;
      }

      // Extract relevant emails from attendees
      const relevantEmails = await this.findRelevantEmails(event, userId);

      // Extract action items from emails
      const actionItems = this.extractActionItems(relevantEmails, event.title);

      // Generate prep checklist
      const checklist = this.generatePrepChecklist(event, relevantEmails, actionItems);

      // Create prep task
      const prepTaskId = await this.createPrepTask(userId, event, checklist);

      // Store meeting context
      const context: MeetingContext = {
        id: `context-${Date.now()}`,
        userId,
        eventId,
        relevantEmails: relevantEmails.slice(0, 5).map((e) => ({
          id: e.id,
          from: e.from,
          subject: e.subject,
          snippet: e.snippet,
          date: e.date,
        })),
        actionItems: actionItems as any,
        prepTaskId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save meeting context
      await this.saveMeetingContext(context);

      // Log to Discord
      await logToDiscord({
        channel: 'helix-automation',
        type: 'meeting_prep_generated',
        eventId,
        eventTitle: event.title,
        attendeeCount: event.attendees?.length || 0,
        relevantEmailsFound: relevantEmails.length,
        actionItemsExtracted: actionItems.length,
        userId,
        timestamp: new Date().toISOString(),
      });

      // Log to hash chain
      await hashChain.add({
        type: 'automation_execution',
        triggerId: eventId,
        triggerType: 'calendar_event',
        action: 'generate_meeting_prep',
        result: { contextId: context.id, prepTaskId },
        status: 'success',
        timestamp: new Date().toISOString(),
      });

      return context;
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'meeting_prep_failed',
        eventId,
        error: String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Get calendar event details
   */
  private async getCalendarEvent(eventId: string, userId: string): Promise<CalendarEvent | null> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        start: new Date(data.start_time),
        end: new Date(data.end_time),
        attendees: data.attendees || [],
        description: data.description,
        location: data.location,
      };
    } catch (error) {
      console.error('Failed to get calendar event:', error);
      return null;
    }
  }

  /**
   * Find relevant emails from attendees
   */
  private async findRelevantEmails(event: CalendarEvent, userId: string): Promise<Email[]> {
    try {
      // Get emails from attendees in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString())
        .order('date', { ascending: false })
        .limit(50);

      if (error || !data) {
        return [];
      }

      // Filter emails from attendees and with relevant keywords
      return data
        .filter(
          (email) =>
            event.attendees &&
            event.attendees.some((attendee) =>
              email.from.toLowerCase().includes(attendee.split('@')[0].toLowerCase())
            )
        )
        .map((e) => ({
          id: e.id,
          from: e.from,
          subject: e.subject,
          body: e.body,
          snippet: e.snippet || e.body.substring(0, 200),
          date: new Date(e.date),
        }))
        .slice(0, 10);
    } catch (error) {
      console.error('Failed to find relevant emails:', error);
      return [];
    }
  }

  /**
   * Extract action items from emails
   */
  private extractActionItems(emails: Email[], meetingTitle: string): ActionItem[] {
    const actionItems: ActionItem[] = [];

    // Keywords that indicate action items
    const actionKeywords = ['action', 'todo', 'required', 'need', 'please', 'must', 'should'];

    for (const email of emails) {
      const body = email.body.toLowerCase();

      // Check for action item patterns
      if (
        actionKeywords.some((keyword) =>
          body.includes(keyword) || email.subject.toLowerCase().includes(keyword)
        )
      ) {
        // Extract sentences with action keywords
        const sentences = email.body.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (actionKeywords.some((keyword) => sentence.toLowerCase().includes(keyword))) {
            actionItems.push({
              title: sentence.trim().substring(0, 100),
              context: `From ${email.from}: ${email.subject}`,
              priority: 'normal',
            });
          }
        }
      }
    }

    return actionItems.slice(0, 5); // Limit to 5 items
  }

  /**
   * Generate meeting prep checklist
   */
  private generatePrepChecklist(
    event: CalendarEvent,
    emails: Email[],
    actionItems: ActionItem[]
  ): string {
    let checklist = `# Meeting Prep: ${event.title}\n\n`;

    // Meeting details
    checklist += '## Meeting Details\n';
    checklist += `- **When**: ${event.start.toLocaleString()}\n`;
    checklist += `- **Duration**: ${Math.round((event.end.getTime() - event.start.getTime()) / 60000)} minutes\n`;
    if (event.attendees && event.attendees.length > 0) {
      checklist += `- **Attendees**: ${event.attendees.join(', ')}\n`;
    }
    if (event.location) {
      checklist += `- **Location**: ${event.location}\n`;
    }
    checklist += '\n';

    // Recent context
    if (emails.length > 0) {
      checklist += '## Recent Context\n';
      for (const email of emails.slice(0, 3)) {
        checklist += `- **${email.subject}** (from ${email.from})\n`;
        checklist += `  ${email.snippet}\n`;
      }
      checklist += '\n';
    }

    // Action items
    if (actionItems.length > 0) {
      checklist += '## Action Items to Address\n';
      for (const item of actionItems) {
        checklist += `- [ ] ${item.title}\n`;
      }
      checklist += '\n';
    }

    // Preparation checklist
    checklist += '## Preparation Checklist\n';
    checklist += '- [ ] Review recent emails from attendees\n';
    checklist += '- [ ] Check pending decisions\n';
    checklist += '- [ ] Gather related documents\n';
    checklist += '- [ ] Prepare agenda items\n';
    checklist += '- [ ] Test audio/video (if virtual)\n';

    return checklist;
  }

  /**
   * Create prep task
   */
  private async createPrepTask(
    userId: string,
    event: CalendarEvent,
    checklist: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          board_id: 'inbox',
          title: `Prep: ${event.title}`,
          description: checklist,
          status: 'todo',
          priority: 'high',
          due_date: new Date(event.start.getTime() - 15 * 60 * 1000).toISOString(), // 15 min before
          source: 'meeting_prep',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Failed to create prep task:', error);
      return null;
    }
  }

  /**
   * Save meeting context
   */
  private async saveMeetingContext(context: MeetingContext): Promise<void> {
    try {
      await supabase.from('meeting_contexts').insert({
        user_id: context.userId,
        event_id: context.eventId,
        relevant_emails: context.relevantEmails,
        action_items: context.actionItems,
        prep_task_id: context.prepTaskId,
      });
    } catch (error) {
      console.error('Failed to save meeting context:', error);
    }
  }

  /**
   * Get meeting context
   */
  async getMeetingContext(eventId: string, userId: string): Promise<MeetingContext | null> {
    try {
      const { data, error } = await supabase
        .from('meeting_contexts')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        eventId: data.event_id,
        relevantEmails: data.relevant_emails || [],
        actionItems: data.action_items || [],
        prepTaskId: data.prep_task_id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Failed to get meeting context:', error);
      return null;
    }
  }
}

export function getMeetingPrepService(): MeetingPrepService {
  return MeetingPrepService.getInstance();
}
