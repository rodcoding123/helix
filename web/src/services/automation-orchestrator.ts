/**
 * Automation Orchestrator - Phase 7
 * Central event coordinator for all automation workflows
 * Manages trigger registration, event handling, and execution pipeline
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logToDiscord } from '@/helix/logging';
import { hashChain } from '@/helix/hash-chain';
import type {
  AutomationTrigger,
  AutomationExecution,
  WorkflowAction,
  TemplateVariables,
  AutomationContext,
  TriggerCondition,
} from './automation.types.js';

interface ExecutionOptions {
  dryRun?: boolean;
  skipLogging?: boolean;
}

export class AutomationOrchestrator {
  private userId: string | null = null;
  private triggers: Map<string, AutomationTrigger> = new Map();
  private initialized: boolean = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  private getSupabaseClient(): SupabaseClient {
    return supabase;
  }

  /**
   * Initialize orchestrator for a specific user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    await this.loadTriggers();
    this.setupEventListeners();
    this.initialized = true;

    await logToDiscord({
      channel: 'helix-automation',
      type: 'orchestrator_initialized',
      userId,
      triggerCount: this.triggers.size,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Load all active triggers for the user from Supabase
   */
  private async loadTriggers(): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    try {
      const { data, error } = await this.getSupabaseClient()
        .from('automation_triggers')
        .select('*')
        .eq('user_id', this.userId)
        .eq('enabled', true);

      if (error) {
        throw error;
      }

      this.triggers.clear();
      if (data) {
        for (const trigger of data) {
          this.triggers.set(trigger.id, this.parseAutomationTrigger(trigger));
        }
      }
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'orchestrator_load_failed',
        error: String(error),
        userId: this.userId,
      });
      throw error;
    }
  }

  /**
   * Parse database record into AutomationTrigger
   */
  private parseAutomationTrigger(record: any): AutomationTrigger {
    return {
      id: record.id,
      userId: record.user_id,
      triggerType: record.trigger_type,
      condition: record.condition as TriggerCondition,
      actions: record.actions as WorkflowAction[],
      enabled: record.enabled,
      executionCount: record.execution_count || 0,
      lastExecutedAt: record.last_executed_at ? new Date(record.last_executed_at) : undefined,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at),
    };
  }

  /**
   * Register a new automation trigger
   */
  async registerTrigger(trigger: Omit<AutomationTrigger, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt'>): Promise<AutomationTrigger> {
    if (!this.userId) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      const { data, error } = await this.getSupabaseClient()
        .from('automation_triggers')
        .insert({
          user_id: this.userId,
          trigger_type: trigger.triggerType,
          condition: trigger.condition,
          actions: trigger.actions,
          enabled: trigger.enabled,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const parsed = this.parseAutomationTrigger(data);
      this.triggers.set(parsed.id, parsed);

      await logToDiscord({
        channel: 'helix-automation',
        type: 'trigger_registered',
        triggerId: parsed.id,
        triggerType: parsed.triggerType,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      });

      return parsed;
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'trigger_registration_failed',
        error: String(error),
        userId: this.userId,
      });
      throw error;
    }
  }

  /**
   * Unregister an automation trigger
   */
  async unregisterTrigger(triggerId: string): Promise<void> {
    if (!this.userId) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      const { error } = await this.getSupabaseClient()
        .from('automation_triggers')
        .delete()
        .eq('id', triggerId)
        .eq('user_id', this.userId);

      if (error) {
        throw error;
      }

      this.triggers.delete(triggerId);

      await logToDiscord({
        channel: 'helix-automation',
        type: 'trigger_unregistered',
        triggerId,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'trigger_unregistration_failed',
        triggerId,
        error: String(error),
        userId: this.userId,
      });
      throw error;
    }
  }

  /**
   * Get all registered triggers
   */
  getTriggers(userId?: string): AutomationTrigger[] {
    const id = userId || this.userId;
    if (!id) {
      return [];
    }
    return Array.from(this.triggers.values()).filter(t => t.userId === id);
  }

  /**
   * Handle incoming email event
   */
  async onEmailReceived(email: Record<string, any>): Promise<void> {
    const context: AutomationContext = {
      triggerId: '',
      userId: this.userId || '',
      triggerType: 'email_received',
      triggerData: email,
      templateVariables: {
        emailSubject: email.subject,
        emailFrom: email.from,
        emailTo: email.to,
        emailBody: email.body,
      },
      createdAt: new Date(),
    };

    await this.executeTriggersOfType('email_received', context);
  }

  /**
   * Handle incoming calendar event
   */
  async onCalendarEventStarting(eventId: string, event: Record<string, any>): Promise<void> {
    const context: AutomationContext = {
      triggerId: '',
      userId: this.userId || '',
      triggerType: 'calendar_event',
      triggerData: { ...event, eventId },
      templateVariables: {
        eventTitle: event.title,
        eventTime: event.start?.toLocaleTimeString(),
        eventDate: event.start?.toLocaleDateString(),
        eventAttendees: event.attendees || [],
      },
      createdAt: new Date(),
    };

    await this.executeTriggersOfType('calendar_event', context);
  }

  /**
   * Handle calendar event ended
   */
  async onCalendarEventEnded(eventId: string, event: Record<string, any>): Promise<void> {
    // Emit custom event for post-meeting automations
    await this.emit('calendar_event_ended', { eventId, event });
  }

  /**
   * Handle task creation
   */
  async onTaskCreated(task: Record<string, any>): Promise<void> {
    const context: AutomationContext = {
      triggerId: '',
      userId: this.userId || '',
      triggerType: 'task_created',
      triggerData: task,
      templateVariables: {
        taskTitle: task.title,
        taskDescription: task.description,
      },
      createdAt: new Date(),
    };

    await this.executeTriggersOfType('task_created', context);
  }

  /**
   * Execute all triggers of a specific type
   */
  private async executeTriggersOfType(
    triggerType: string,
    context: AutomationContext
  ): Promise<void> {
    const matchingTriggers = Array.from(this.triggers.values()).filter(
      t => t.triggerType === triggerType && t.enabled
    );

    for (const trigger of matchingTriggers) {
      try {
        await this.executeTrigger(trigger, context);
      } catch (error) {
        await logToDiscord({
          channel: 'helix-alerts',
          type: 'trigger_execution_failed',
          triggerId: trigger.id,
          triggerType: trigger.triggerType,
          error: String(error),
          userId: this.userId,
        });
      }
    }
  }

  /**
   * Execute a specific trigger
   */
  async executeTrigger(
    trigger: AutomationTrigger,
    context: AutomationContext,
    options: ExecutionOptions = {}
  ): Promise<AutomationExecution> {
    const startTime = Date.now();

    try {
      // Check if trigger matches condition
      const matches = await this.evaluateCondition(trigger.condition, context);
      if (!matches) {
        return this.logExecution(trigger, context, 'skipped', undefined, undefined, options);
      }

      // Execute actions
      const result = await this.executeActions(trigger.actions, context, options);

      // Log successful execution
      const execution = await this.logExecution(
        trigger,
        context,
        'success',
        result,
        undefined,
        options
      );

      // Update trigger execution count
      await this.updateTriggerStats(trigger.id);

      const duration = Date.now() - startTime;
      await logToDiscord({
        channel: 'helix-automation',
        type: 'trigger_executed',
        triggerId: trigger.id,
        status: 'success',
        executionTime: duration,
        userId: this.userId,
        timestamp: new Date().toISOString(),
      });

      return execution;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.logExecution(
        trigger,
        context,
        'failed',
        undefined,
        String(error),
        options
      );

      await logToDiscord({
        channel: 'helix-alerts',
        type: 'trigger_execution_failed',
        triggerId: trigger.id,
        triggerType: trigger.triggerType,
        error: String(error),
        executionTime: duration,
        userId: this.userId,
      });

      throw error;
    }
  }

  /**
   * Evaluate trigger condition against context
   */
  private async evaluateCondition(
    condition: TriggerCondition,
    context: AutomationContext
  ): Promise<boolean> {
    // This will be implemented by specific condition evaluators
    // For now, return true (condition always matches)
    return true;
  }

  /**
   * Execute all actions for a trigger
   */
  private async executeActions(
    actions: WorkflowAction[],
    context: AutomationContext,
    options: ExecutionOptions = {}
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};

    for (const action of actions) {
      try {
        // Delay before execution if specified
        if (action.delayMs && action.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, action.delayMs));
        }

        // Execute action
        const result = await this.executeAction(action, context);
        results[action.actionType] = result;
      } catch (error) {
        if (action.retryOnFailure) {
          // Retry up to 3 times
          let lastError = error;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              const result = await this.executeAction(action, context);
              results[action.actionType] = result;
              break;
            } catch (retryError) {
              lastError = retryError;
            }
          }
          if (lastError) {
            throw lastError;
          }
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: WorkflowAction,
    context: AutomationContext
  ): Promise<any> {
    // This will be implemented by specific action handlers
    // For now, return empty result
    return {};
  }

  /**
   * Log automation execution to database and hash chain
   */
  private async logExecution(
    trigger: AutomationTrigger,
    context: AutomationContext,
    status: 'success' | 'failed' | 'skipped',
    result?: Record<string, any>,
    error?: string,
    options: ExecutionOptions = {}
  ): Promise<AutomationExecution> {
    if (options.skipLogging) {
      return {
        id: '',
        userId: context.userId,
        triggerId: trigger.id,
        status,
        executedAt: new Date(),
      };
    }

    try {
      const { data, error: dbError } = await this.getSupabaseClient()
        .from('automation_executions')
        .insert({
          user_id: context.userId,
          trigger_id: trigger.id,
          trigger_data: context.triggerData,
          status,
          result: result || null,
          error: error || null,
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      // Add to hash chain
      await hashChain.add({
        type: 'automation_execution',
        triggerId: trigger.id,
        triggerType: trigger.triggerType,
        status,
        timestamp: new Date().toISOString(),
      });

      return {
        id: data.id,
        userId: data.user_id,
        triggerId: data.trigger_id,
        triggerData: data.trigger_data,
        status: data.status,
        result: data.result,
        error: data.error,
        executedAt: new Date(data.executed_at),
      };
    } catch (error) {
      // Log error but don't throw (execution already happened)
      await logToDiscord({
        channel: 'helix-alerts',
        type: 'execution_logging_failed',
        error: String(error),
        triggerId: trigger.id,
        userId: context.userId,
      });

      // Return minimal execution record
      return {
        id: '',
        userId: context.userId,
        triggerId: trigger.id,
        status,
        executedAt: new Date(),
      };
    }
  }

  /**
   * Update trigger execution stats
   */
  private async updateTriggerStats(triggerId: string): Promise<void> {
    try {
      const trigger = this.triggers.get(triggerId);
      if (!trigger) {
        return;
      }

      await this.getSupabaseClient()
        .from('automation_triggers')
        .update({
          execution_count: (trigger.executionCount || 0) + 1,
          last_executed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', triggerId);

      // Update local cache
      trigger.executionCount = (trigger.executionCount || 0) + 1;
      trigger.lastExecutedAt = new Date();
    } catch (error) {
      // Silently fail stats update
      console.error('Failed to update trigger stats:', error);
    }
  }

  /**
   * Get execution history for a trigger
   */
  async getExecutionHistory(
    triggerId: string,
    limit: number = 50
  ): Promise<AutomationExecution[]> {
    if (!this.userId) {
      return [];
    }

    try {
      const { data, error } = await this.getSupabaseClient()
        .from('automation_executions')
        .select('*')
        .eq('trigger_id', triggerId)
        .eq('user_id', this.userId)
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map(record => ({
        id: record.id,
        userId: record.user_id,
        triggerId: record.trigger_id,
        triggerData: record.trigger_data,
        status: record.status,
        result: record.result,
        error: record.error,
        executedAt: new Date(record.executed_at),
      }));
    } catch (error) {
      console.error('Failed to get execution history:', error);
      return [];
    }
  }

  /**
   * Setup event listeners for custom events
   */
  private setupEventListeners(): void {
    this.eventListeners.set('calendar_event_ended', new Set());
  }

  /**
   * Emit a custom event to registered listeners
   */
  private async emit(eventName: string, data: any): Promise<void> {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        try {
          await listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      }
    }
  }

  /**
   * Subscribe to custom events
   */
  on(eventName: string, listener: Function): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName)!.add(listener);
  }

  /**
   * Unsubscribe from custom events
   */
  off(eventName: string, listener: Function): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    this.triggers.clear();
    this.eventListeners.clear();
    this.initialized = false;

    await logToDiscord({
      channel: 'helix-automation',
      type: 'orchestrator_shutdown',
      userId: this.userId,
      timestamp: new Date().toISOString(),
    });
  }
}

// Singleton instance
let orchestratorInstance: AutomationOrchestrator | null = null;

export function getAutomationOrchestrator(): AutomationOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new AutomationOrchestrator();
  }
  return orchestratorInstance;
}

export function setAutomationOrchestrator(instance: AutomationOrchestrator | null): void {
  orchestratorInstance = instance;
}
