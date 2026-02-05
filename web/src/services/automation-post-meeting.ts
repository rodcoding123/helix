/**
 * Post-Meeting Follow-up Service - Phase 7 Track 2
 * Extracts action items from meeting notes and creates follow-up tasks
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import { hashChain } from '@/helix/hash-chain';
import type { ActionItem } from './automation.types.js';

interface PostMeetingFollowupParams {
  eventId: string;
  userId: string;
  notes?: string;
  recordingUrl?: string;
  transcript?: string;
}

interface ExtractedActionItem extends ActionItem {
  lineNumber?: number;
  confidence?: number;
}

export class PostMeetingFollowupService {
  private static instance: PostMeetingFollowupService;

  private constructor() {}

  static getInstance(): PostMeetingFollowupService {
    if (!PostMeetingFollowupService.instance) {
      PostMeetingFollowupService.instance = new PostMeetingFollowupService();
    }
    return PostMeetingFollowupService.instance;
  }

  /**
   * Create post-meeting follow-up from notes/transcript
   */
  async createPostMeetingFollowup(params: PostMeetingFollowupParams): Promise<string[]> {
    try {
      const source = params.notes || params.transcript || '';

      if (!source.trim()) {
        return [];
      }

      // Extract action items from notes or transcript
      const actionItems = this.extractActionItemsFromText(source);

      // Create tasks for each action item
      const taskIds: string[] = [];
      for (const item of actionItems) {
        const taskId = await this.createFollowupTask(params.userId, item, params.eventId);
        if (taskId) {
          taskIds.push(taskId);
        }
      }

      // Generate summary email
      const summaryEmail = this.generateSummaryEmail(
        params.eventId,
        source,
        actionItems,
        taskIds
      );

      // Log to Discord
      await logToDiscord({
        channel: 'helix-automation',
        type: 'meeting_followup_created',
        eventId: params.eventId,
        actionItemsExtracted: actionItems.length,
        tasksCreated: taskIds.length,
        userId: params.userId,
        timestamp: new Date().toISOString(),
      });

      // Log to hash chain
      await hashChain.add({
        type: 'automation_execution',
        triggerId: params.eventId,
        triggerType: 'calendar_event',
        action: 'create_post_meeting_followup',
        result: { tasksCreated: taskIds.length, actionItems: actionItems.length },
        status: 'success',
        timestamp: new Date().toISOString(),
      });

      return taskIds;
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'post_meeting_followup_failed',
        eventId: params.eventId,
        error: String(error),
        userId: params.userId,
      });
      throw error;
    }
  }

  /**
   * Extract action items from meeting notes/transcript
   */
  private extractActionItemsFromText(text: string): ExtractedActionItem[] {
    const actionItems: ExtractedActionItem[] = [];

    // Patterns for action items
    const patterns = [
      /[-•]\s*(?:action|task|todo|do|need|must|should):\s*(.+)/gi,
      /action\s+items?:?\s*(?:\n|)([\s\S]*?)(?:\n\n|$)/gi,
      /@(\w+)\s+(.+?)(?:\n|$)/gi, // @ mentions
      /(?:by|due|deadline|until)\s+(.+?)(?:\n|$)/gi,
    ];

    // Extract using patterns
    const lines = text.split('\n');
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;

      // Skip empty lines and headers
      if (!line.trim() || line.startsWith('#')) {
        continue;
      }

      // Check for action item patterns
      for (const pattern of patterns) {
        const matches = pattern.exec(line);
        if (matches && matches[1]) {
          const title = matches[1].trim().substring(0, 200);
          if (title.length > 5) {
            // Filter out very short matches
            actionItems.push({
              title,
              context: `Line ${lineNumber}: ${line.trim()}`,
              priority: this.inferPriority(line),
              lineNumber,
              confidence: this.calculateConfidence(line),
            });
          }
        }
      }

      // Check for imperative verbs (Review, Submit, Send, etc.)
      if (
        /^(Review|Submit|Send|Update|Prepare|Schedule|Contact|Follow|Check|Confirm)/.test(
          line.trim()
        )
      ) {
        actionItems.push({
          title: line.trim().substring(0, 200),
          context: `Line ${lineNumber}`,
          priority: this.inferPriority(line),
          lineNumber,
          confidence: 0.9,
        });
      }
    }

    // Deduplicate and sort by confidence
    const uniqueItems = Array.from(
      new Map(
        actionItems
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
          .map((item) => [item.title.toLowerCase(), item])
      ).values()
    );

    return uniqueItems.slice(0, 10); // Limit to 10 items
  }

  /**
   * Infer priority from action item text
   */
  private inferPriority(text: string): 'low' | 'normal' | 'high' {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes('urgent') ||
      lowerText.includes('critical') ||
      lowerText.includes('asap') ||
      lowerText.includes('immediately')
    ) {
      return 'high';
    }

    if (
      lowerText.includes('important') ||
      lowerText.includes('priority') ||
      lowerText.includes('deadline')
    ) {
      return 'normal';
    }

    return 'normal';
  }

  /**
   * Calculate confidence score for action item extraction
   */
  private calculateConfidence(text: string): number {
    let score = 0.5; // Base score

    // Boost for action keywords
    if (/action|task|todo|must|should|need/i.test(text)) {
      score += 0.2;
    }

    // Boost for priority keywords
    if (/urgent|critical|important|asap/i.test(text)) {
      score += 0.1;
    }

    // Boost for assignee mentions
    if (/@\w+/.test(text)) {
      score += 0.1;
    }

    // Boost for due date mentions
    if (/by|due|deadline|until|when/i.test(text)) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract due date from action item text
   */
  private extractDueDate(text: string): Date | undefined {
    const now = new Date();

    // Check for relative dates
    if (/today/i.test(text)) {
      return new Date(now.setHours(17, 0, 0, 0)); // End of today
    }

    if (/tomorrow/i.test(text)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (/this week/i.test(text) || /by friday/i.test(text)) {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() + (5 - endOfWeek.getDay())); // Friday
      return endOfWeek;
    }

    if (/next week/i.test(text)) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }

    // Try to parse date
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) {
      const month = parseInt(dateMatch[1]) - 1;
      const day = parseInt(dateMatch[2]);
      const date = new Date(now.getFullYear(), month, day);
      if (date > now) {
        return date;
      }
    }

    return undefined;
  }

  /**
   * Extract assignee from action item text
   */
  private extractAssignee(text: string): string | undefined {
    // Look for @ mentions
    const mentionMatch = text.match(/@(\w+)/);
    if (mentionMatch) {
      return mentionMatch[1];
    }

    // Look for names at start
    const nameMatch = text.match(/^(\w+)[\s:]/);
    if (nameMatch) {
      return nameMatch[1];
    }

    return undefined;
  }

  /**
   * Create follow-up task from action item
   */
  private async createFollowupTask(
    userId: string,
    actionItem: ExtractedActionItem,
    eventId: string
  ): Promise<string | null> {
    try {
      const dueDate = this.extractDueDate(actionItem.title);
      const assignee = this.extractAssignee(actionItem.title);

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          board_id: 'inbox',
          title: actionItem.title,
          description: `Action item from meeting\n\nContext: ${actionItem.context}`,
          status: 'todo',
          priority: actionItem.priority,
          due_date: dueDate?.toISOString(),
          assignee_email: assignee,
          source: 'post_meeting_followup',
          source_event_id: eventId,
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
      console.error('Failed to create follow-up task:', error);
      return null;
    }
  }

  /**
   * Generate summary email from meeting notes
   */
  private generateSummaryEmail(
    eventId: string,
    notes: string,
    actionItems: ExtractedActionItem[],
    taskIds: string[]
  ): string {
    let email = 'Subject: Meeting Summary and Action Items\n\n';

    email += 'Hi Team,\n\n';
    email += 'Here is a summary of our meeting with action items:\n\n';

    if (actionItems.length > 0) {
      email += 'Action Items:\n';
      for (const item of actionItems) {
        const dueDate = this.extractDueDate(item.title);
        const dueStr = dueDate ? ` - Due: ${dueDate.toLocaleDateString()}` : '';
        email += `• ${item.title}${dueStr}\n`;
      }
      email += '\n';
    }

    email += `Meeting Notes:\n${notes.substring(0, 500)}...\n\n`;
    email +=
      'Tasks have been created in your task management system for each action item.\n\n';
    email += 'Best regards,\nHelix';

    return email;
  }

  /**
   * Get post-meeting follow-up for event
   */
  async getPostMeetingFollowup(eventId: string, userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id')
        .eq('source_event_id', eventId)
        .eq('source', 'post_meeting_followup')
        .eq('user_id', userId);

      if (error) {
        return [];
      }

      return (data || []).map((task) => task.id);
    } catch (error) {
      console.error('Failed to get post-meeting follow-up:', error);
      return [];
    }
  }
}

export function getPostMeetingFollowupService(): PostMeetingFollowupService {
  return PostMeetingFollowupService.getInstance();
}
