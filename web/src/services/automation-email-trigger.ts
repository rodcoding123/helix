/**
 * Email Trigger Service - Phase 7 Track 1
 * Automatically creates tasks from incoming emails based on user-defined rules
 * Handles rule creation, email matching, and task generation with template variables
 */

import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import { hashChain } from '@/helix/hash-chain';
import type {
  AutomationTrigger,
  EmailTriggerCondition,
  CreateTaskActionConfig,
  WorkflowAction,
} from './automation.types.js';

interface EmailToTaskRuleParams {
  userId: string;
  emailFrom?: string[];
  subjectKeywords?: string[];
  bodyKeywords?: string[];
  hasAttachments?: boolean;
  createTaskConfig: CreateTaskActionConfig;
  enabled?: boolean;
}

interface EmailData {
  id: string;
  from: string;
  subject: string;
  body: string;
  hasAttachments?: boolean;
  [key: string]: any;
}

export class AutomationEmailTriggerService {
  private static instance: AutomationEmailTriggerService;

  private constructor() {}

  static getInstance(): AutomationEmailTriggerService {
    if (!AutomationEmailTriggerService.instance) {
      AutomationEmailTriggerService.instance = new AutomationEmailTriggerService();
    }
    return AutomationEmailTriggerService.instance;
  }

  /**
   * Create a new email-to-task automation rule
   */
  async createEmailToTaskRule(params: EmailToTaskRuleParams): Promise<AutomationTrigger> {
    try {
      const condition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: params.emailFrom,
        subjectKeywords: params.subjectKeywords,
        bodyKeywords: params.bodyKeywords,
        hasAttachments: params.hasAttachments,
        matchAll: false, // At least one condition must match
      };

      const action: WorkflowAction = {
        actionType: 'create_task',
        actionConfig: params.createTaskConfig,
        priority: 'normal',
        retryOnFailure: true,
      };

      // Create trigger in database
      const { data, error } = await supabase
        .from('automation_triggers')
        .insert({
          user_id: params.userId,
          trigger_type: 'email_received',
          condition,
          actions: [action],
          enabled: params.enabled !== false,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const trigger: AutomationTrigger = {
        id: data.id,
        userId: data.user_id,
        triggerType: data.trigger_type,
        condition: data.condition,
        actions: data.actions,
        enabled: data.enabled,
        executionCount: data.execution_count || 0,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      await logToDiscord({
        channel: 'helix-automation',
        type: 'email_trigger_created',
        triggerId: trigger.id,
        userId: params.userId,
        emailFromFilters: params.emailFrom?.length || 0,
        subjectKeywords: params.subjectKeywords?.length || 0,
        timestamp: new Date().toISOString(),
      });

      return trigger;
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'email_trigger_creation_failed',
        error: String(error),
        userId: params.userId,
      });
      throw error;
    }
  }

  /**
   * Handle incoming email and check if it matches any triggers
   */
  async onEmailReceived(email: EmailData, userId: string): Promise<string | null> {
    try {
      // Load user's email triggers
      const { data: triggers, error: loadError } = await supabase
        .from('automation_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', 'email_received')
        .eq('enabled', true);

      if (loadError) {
        throw loadError;
      }

      if (!triggers || triggers.length === 0) {
        return null; // No triggers for this user
      }

      let createdTaskId: string | null = null;

      // Check each trigger for a match
      for (const triggerRecord of triggers) {
        const condition = triggerRecord.condition as EmailTriggerCondition;

        if (this.matchesCondition(email, condition)) {
          // Execute the trigger
          createdTaskId = await this.executeTrigger(
            triggerRecord.id,
            email,
            triggerRecord.actions,
            userId
          );

          // Update trigger execution stats
          await supabase
            .from('automation_triggers')
            .update({
              execution_count: (triggerRecord.execution_count || 0) + 1,
              last_executed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', triggerRecord.id);

          break; // Execute first matching rule
        }
      }

      return createdTaskId;
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'email_trigger_execution_failed',
        error: String(error),
        emailFrom: email.from,
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if email matches trigger condition
   */
  private matchesCondition(email: EmailData, condition: EmailTriggerCondition): boolean {
    // Check email from filter
    if (condition.emailFrom && condition.emailFrom.length > 0) {
      const fromMatches = condition.emailFrom.some(
        (from) =>
          email.from.toLowerCase().includes(from.toLowerCase()) || from === email.from
      );
      if (!fromMatches) {
        return false;
      }
    }

    // Check subject keywords
    if (condition.subjectKeywords && condition.subjectKeywords.length > 0) {
      const subjectMatches = condition.subjectKeywords.some((keyword) =>
        email.subject.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!subjectMatches) {
        return false;
      }
    }

    // Check body keywords
    if (condition.bodyKeywords && condition.bodyKeywords.length > 0) {
      const bodyMatches = condition.bodyKeywords.some((keyword) =>
        email.body.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!bodyMatches) {
        return false;
      }
    }

    // Check attachments
    if (condition.hasAttachments !== undefined) {
      if (condition.hasAttachments && !email.hasAttachments) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute trigger action (create task)
   */
  private async executeTrigger(
    triggerId: string,
    email: EmailData,
    actions: WorkflowAction[],
    userId: string
  ): Promise<string | null> {
    let createdTaskId: string | null = null;

    for (const action of actions) {
      if (action.actionType === 'create_task') {
        try {
          // Apply template variables
          const config = action.actionConfig as CreateTaskActionConfig;
          const taskTitle = this.applyVariables(
            config.title,
            this.buildTemplateVariables(email)
          );
          const taskDescription = config.description
            ? this.applyVariables(config.description, this.buildTemplateVariables(email))
            : undefined;

          // Create task in database
          const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .insert({
              user_id: userId,
              board_id: 'inbox', // Default board
              title: taskTitle,
              description: taskDescription,
              status: 'todo',
              priority: config.priority || 'normal',
              due_date: config.dueDate,
              source: 'email_automation',
              source_email_id: email.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (taskError) {
            throw taskError;
          }

          createdTaskId = taskData.id;

          // Log successful execution
          await logToDiscord({
            channel: 'helix-automation',
            type: 'email_trigger_executed',
            triggerId,
            emailId: email.id,
            emailFrom: email.from,
            taskCreated: true,
            taskId: taskData.id,
            taskTitle,
            userId,
            timestamp: new Date().toISOString(),
          });

          // Add to hash chain
          await hashChain.add({
            type: 'automation_execution',
            triggerId,
            triggerType: 'email_received',
            action: 'create_task',
            result: { taskId: taskData.id },
            status: 'success',
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          await logToDiscord({
            channel: 'helix-alerts',
            type: 'email_trigger_task_creation_failed',
            triggerId,
            emailId: email.id,
            error: String(error),
            userId,
          });
          throw error;
        }
      }
    }

    return createdTaskId;
  }

  /**
   * Build template variables from email data
   */
  private buildTemplateVariables(email: EmailData): Record<string, string> {
    return {
      emailSubject: email.subject,
      emailFrom: email.from,
      emailTo: email.to || '',
      emailBody: email.body,
      emailSnippet: email.body.substring(0, 100),
    };
  }

  /**
   * Apply template variables to text
   * Replaces {{variableName}} with actual values
   */
  private applyVariables(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      // @ts-ignore - replaceAll is supported in ES2021
      result = result.replaceAll(placeholder, value || '');
    }

    return result;
  }

  /**
   * Get all email triggers for a user
   */
  async getEmailTriggers(userId: string): Promise<AutomationTrigger[]> {
    try {
      const { data, error } = await supabase
        .from('automation_triggers')
        .select('*')
        .eq('user_id', userId)
        .eq('trigger_type', 'email_received');

      if (error) {
        throw error;
      }

      return (data || []).map((record) => ({
        id: record.id,
        userId: record.user_id,
        triggerType: record.trigger_type,
        condition: record.condition,
        actions: record.actions,
        enabled: record.enabled,
        executionCount: record.execution_count || 0,
        lastExecutedAt: record.last_executed_at ? new Date(record.last_executed_at) : undefined,
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
      }));
    } catch (error) {
      console.error('Failed to get email triggers:', error);
      return [];
    }
  }

  /**
   * Update an email trigger
   */
  async updateEmailTrigger(
    triggerId: string,
    updates: Partial<EmailToTaskRuleParams>
  ): Promise<AutomationTrigger | null> {
    try {
      const condition: EmailTriggerCondition = {
        type: 'email',
        emailFrom: updates.emailFrom,
        subjectKeywords: updates.subjectKeywords,
        bodyKeywords: updates.bodyKeywords,
        hasAttachments: updates.hasAttachments,
        matchAll: false,
      };

      const action: WorkflowAction = {
        actionType: 'create_task',
        actionConfig: updates.createTaskConfig || {},
        priority: 'normal',
      };

      const { data, error } = await supabase
        .from('automation_triggers')
        .update({
          condition,
          actions: [action],
          enabled: updates.enabled !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', triggerId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return {
        id: data.id,
        userId: data.user_id,
        triggerType: data.trigger_type,
        condition: data.condition,
        actions: data.actions,
        enabled: data.enabled,
        executionCount: data.execution_count || 0,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      console.error('Failed to update email trigger:', error);
      return null;
    }
  }

  /**
   * Delete an email trigger
   */
  async deleteEmailTrigger(triggerId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('automation_triggers')
        .delete()
        .eq('id', triggerId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete email trigger:', error);
      return false;
    }
  }
}

export function getEmailTriggerService(): AutomationEmailTriggerService {
  return AutomationEmailTriggerService.getInstance();
}
