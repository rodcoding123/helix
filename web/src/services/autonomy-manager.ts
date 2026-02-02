import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type {
  AutonomyAction,
  AutonomyLevel,
  ActionStatus,
  RiskLevel,
  AutonomySettings,
} from '@/lib/types/agents';
import { DiscordLoggerService } from './discord-logger';
import { OpenClawGatewayService } from './openclaw-gateway';
import { AgentService } from './agent';

/**
 * AutonomyManagerService: Manages the approval workflow and autonomy levels
 * Determines what needs approval based on user's autonomy settings and Helix's autonomy level
 */
export class AutonomyManagerService {
  private supabase: SupabaseClient | null = null;
  private discordLogger: DiscordLoggerService | null = null;
  private openclawGateway: OpenClawGatewayService | null = null;
  private agentService: AgentService | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;

    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  private getDiscordLogger(): DiscordLoggerService {
    if (!this.discordLogger) {
      this.discordLogger = new DiscordLoggerService();
    }
    return this.discordLogger;
  }

  private getOpenClawGateway(): OpenClawGatewayService {
    if (!this.openclawGateway) {
      this.openclawGateway = new OpenClawGatewayService();
    }
    return this.openclawGateway;
  }

  private getAgentService(): AgentService {
    if (!this.agentService) {
      this.agentService = new AgentService();
    }
    return this.agentService;
  }

  /**
   * Get or create user's autonomy settings
   */
  async getAutonomySettings(userId: string): Promise<AutonomySettings> {
    try {
      const supabase = this.getSupabaseClient();

      let { data, error } = await supabase
        .from('autonomy_settings')
        .select()
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Create default settings if they don't exist
        const defaults: AutonomySettings = {
          id: `settings_${userId}`,
          user_id: userId,
          helix_autonomy_level: 0,
          auto_agent_creation: true,
          agent_proposals_require_approval: true,
          discord_approval_enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        };

        const { data: created, error: createError } = await supabase
          .from('autonomy_settings')
          .insert([defaults])
          .select()
          .single();

        if (createError) {
          throw new Error(
            `Failed to create autonomy settings: ${createError.message}`
          );
        }

        return this.formatSettings(created);
      }

      if (error) {
        throw new Error(`Failed to get autonomy settings: ${error.message}`);
      }

      return this.formatSettings(data);
    } catch (error) {
      console.error('Failed to get autonomy settings:', error);
      throw error;
    }
  }

  /**
   * Update user's autonomy settings
   */
  async updateAutonomySettings(
    userId: string,
    updates: Partial<AutonomySettings>
  ): Promise<AutonomySettings> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('autonomy_settings')
        .update({
          ...updates,
          updated_at: new Date(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to update autonomy settings: ${error.message}`
        );
      }

      return this.formatSettings(data);
    } catch (error) {
      console.error('Failed to update autonomy settings:', error);
      throw error;
    }
  }

  /**
   * Propose an action (creates autonomy_action record)
   * Determines if approval is needed based on autonomy levels and risk
   */
  async proposeAction(
    userId: string,
    actionType: string,
    description: string,
    riskLevel: RiskLevel = 'medium',
    agentId?: string
  ): Promise<AutonomyAction> {
    try {
      const supabase = this.getSupabaseClient();
      const settings = await this.getAutonomySettings(userId);

      // Determine if this action needs approval
      const needsApproval = this.determineApprovalNeeded(
        settings.helix_autonomy_level,
        riskLevel,
        actionType
      );

      const status: ActionStatus = needsApproval ? 'pending' : 'approved';

      const { data, error } = await supabase
        .from('autonomy_actions')
        .insert([
          {
            user_id: userId,
            agent_id: agentId,
            action_type: actionType,
            action_description: description,
            risk_level: riskLevel,
            status,
            approval_method: settings.discord_approval_enabled
              ? 'discord_reaction'
              : 'web_ui',
            discord_channel: '#helix-autonomy',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to propose action: ${error.message}`);
      }

      const action = this.formatAction(data);

      // Log action to Discord if it needs approval (non-fatal if it fails)
      if (needsApproval) {
        try {
          const discordLogger = this.getDiscordLogger();
          const messageId = await discordLogger.logAutonomyAction(userId, action);

          // Store the Discord message ID for reference
          if (messageId) {
            await supabase
              .from('autonomy_actions')
              .update({ discord_message_id: messageId })
              .eq('id', action.id);
          }
        } catch (discordError) {
          console.error('Failed to log action to Discord:', discordError);
          // Don't throw - Discord logging is non-fatal
        }
      }

      // If doesn't need approval, auto-execute immediately
      if (!needsApproval) {
        await this.executeAction(action.id, userId);
      }

      return action;
    } catch (error) {
      console.error('Failed to propose action:', error);
      throw error;
    }
  }

  /**
   * Approve an action (via Discord or web UI)
   */
  async approveAction(
    actionId: string,
    userId: string,
    approvalMethod: 'discord_reaction' | 'web_ui' = 'web_ui'
  ): Promise<AutonomyAction> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('autonomy_actions')
        .update({
          status: 'approved',
          approval_method: approvalMethod,
          updated_at: new Date(),
        })
        .eq('id', actionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to approve action: ${error.message}`);
      }

      const action = this.formatAction(data);

      // Execute the approved action
      await this.executeAction(actionId, userId);

      return action;
    } catch (error) {
      console.error('Failed to approve action:', error);
      throw error;
    }
  }

  /**
   * Reject an action
   */
  async rejectAction(actionId: string, userId: string): Promise<AutonomyAction> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('autonomy_actions')
        .update({
          status: 'rejected',
          updated_at: new Date(),
        })
        .eq('id', actionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to reject action: ${error.message}`);
      }

      return this.formatAction(data);
    } catch (error) {
      console.error('Failed to reject action:', error);
      throw error;
    }
  }

  /**
   * Execute an action
   */
  async executeAction(actionId: string, userId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      // Get the action
      const { data: actionData, error: getError } = await supabase
        .from('autonomy_actions')
        .select()
        .eq('id', actionId)
        .eq('user_id', userId)
        .single();

      if (getError) {
        throw new Error(`Failed to get action: ${getError.message}`);
      }

      const action = actionData;

      try {
        // Execute action based on type
        let result: Record<string, unknown> = {
          executed: true,
          timestamp: new Date(),
          message: `${action.action_type} executed successfully`,
        };

        switch (action.action_type) {
          case 'agent_creation': {
            // Extract agent details from action description
            const agentMatch = action.action_description.match(
              /Create agent "([^"]+)" with role "([^"]+)"/
            );
            if (agentMatch) {
              const agentService = this.getAgentService();
              const newAgent = await agentService.createAgent(
                userId,
                agentMatch[1],
                agentMatch[2],
                action.action_description,
                'autonomy_action'
              );
              result = {
                ...result,
                agentId: newAgent.id,
                agentName: newAgent.name,
                agentRole: newAgent.role,
              };
            }
            break;
          }

          case 'agent_autonomy_upgrade': {
            // Extract agent ID and new autonomy level
            const agentMatch = action.action_description.match(
              /Upgrade agent ([a-f0-9-]+) autonomy to level (\d)/
            );
            if (agentMatch && action.agent_id) {
              const agentService = this.getAgentService();
              const level = parseInt(agentMatch[2]) as 0 | 1 | 2 | 3;
              const updatedAgent = await agentService.setAgentAutonomy(
                action.agent_id,
                userId,
                level
              );
              result = {
                ...result,
                agentId: updatedAgent.id,
                newAutonomyLevel: updatedAgent.autonomy_level,
              };
            }
            break;
          }

          case 'tool_execution': {
            // Execute tool via OpenClaw gateway
            const toolMatch = action.action_description.match(
              /Execute tool "([^"]+)"(?: with (.+))?/
            );
            if (toolMatch) {
              const toolName = toolMatch[1];
              const parameters = toolMatch[2]
                ? JSON.parse(`{${toolMatch[2]}}`)
                : {};

              const openclaw = this.getOpenClawGateway();
              const executionResult = await openclaw.executeTool(
                toolName,
                parameters
              );

              if (executionResult.success) {
                result = {
                  ...result,
                  toolName,
                  toolOutput: executionResult.output,
                };
              } else {
                throw new Error(
                  executionResult.error || 'Tool execution failed'
                );
              }
            }
            break;
          }

          case 'skill_creation': {
            // Register new skill with OpenClaw
            const skillMatch = action.action_description.match(
              /Register skill "([^"]+)": (.+)/
            );
            if (skillMatch) {
              const skillName = skillMatch[1];
              const skillDescription = skillMatch[2];

              const openclaw = this.getOpenClawGateway();
              const skillResult = await openclaw.registerSkill(
                skillName,
                skillDescription,
                []
              );

              if (skillResult.success) {
                result = {
                  ...result,
                  skillName,
                  skillRegistered: true,
                };
              } else {
                throw new Error(skillResult.error || 'Skill registration failed');
              }
            }
            break;
          }

          case 'code_edit': {
            // Propose code modifications
            const codeMatch = action.action_description.match(
              /Modify file "([^"]+)": (.+)/
            );
            if (codeMatch) {
              const filePath = codeMatch[1];
              const changes = codeMatch[2];

              const openclaw = this.getOpenClawGateway();
              const codeResult = await openclaw.proposeCodeModification(
                filePath,
                changes,
                'Proposed by Helix autonomy action'
              );

              if (codeResult.success) {
                result = {
                  ...result,
                  filePath,
                  modificationProposed: true,
                  output: codeResult.output,
                };
              } else {
                throw new Error(codeResult.error || 'Code modification failed');
              }
            }
            break;
          }

          // Add more action types as needed
          default:
            // For unknown action types, just log success
            result = {
              ...result,
              message: `Action type "${action.action_type}" executed (no specific handler)`,
            };
        }

        const { error: updateError } = await supabase
          .from('autonomy_actions')
          .update({
            status: 'executed',
            executed_at: new Date(),
            result,
            updated_at: new Date(),
          })
          .eq('id', actionId);

        if (updateError) {
          throw new Error(`Failed to update action: ${updateError.message}`);
        }

        // Log executed action to Discord (non-fatal if it fails)
        try {
          const { data: updatedActionData } = await supabase
            .from('autonomy_actions')
            .select()
            .eq('id', actionId)
            .single();

          if (updatedActionData) {
            const discordLogger = this.getDiscordLogger();
            const updatedAction = this.formatAction(updatedActionData);
            await discordLogger.logExecutedAction(userId, updatedAction);
          }
        } catch (discordError) {
          console.error('Failed to log executed action to Discord:', discordError);
          // Don't throw - Discord logging is non-fatal
        }
      } catch (execError) {
        // Mark action as failed
        const errorMessage =
          execError instanceof Error ? execError.message : String(execError);

        await supabase
          .from('autonomy_actions')
          .update({
            status: 'failed',
            executed_at: new Date(),
            error_message: errorMessage,
            updated_at: new Date(),
          })
          .eq('id', actionId);

        // Log failed action to Discord (non-fatal if it fails)
        try {
          const { data: failedActionData } = await supabase
            .from('autonomy_actions')
            .select()
            .eq('id', actionId)
            .single();

          if (failedActionData) {
            const discordLogger = this.getDiscordLogger();
            const failedAction = this.formatAction(failedActionData);
            await discordLogger.logExecutedAction(userId, failedAction);
          }
        } catch (discordError) {
          console.error('Failed to log failed action to Discord:', discordError);
          // Don't throw - Discord logging is non-fatal
        }

        throw execError;
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
      throw error;
    }
  }

  /**
   * Get pending actions for a user
   */
  async getPendingActions(userId: string): Promise<AutonomyAction[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('autonomy_actions')
        .select()
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get pending actions: ${error.message}`);
      }

      return (data || []).map((action) => this.formatAction(action));
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return [];
    }
  }

  /**
   * Get action history
   */
  async getActionHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<AutonomyAction[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('autonomy_actions')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get action history: ${error.message}`);
      }

      return (data || []).map((action) => this.formatAction(action));
    } catch (error) {
      console.error('Failed to get action history:', error);
      return [];
    }
  }

  // Private helper methods

  /**
   * Determine if an action needs approval based on autonomy level and risk
   */
  private determineApprovalNeeded(
    helixAutonomyLevel: AutonomyLevel,
    riskLevel: RiskLevel,
    actionType: string
  ): boolean {
    // High-risk actions always need approval
    if (riskLevel === 'high') {
      return true;
    }

    // Dangerous action types always need approval
    const dangerousActions = [
      'code_execution',
      'system_modification',
      'data_deletion',
    ];
    if (dangerousActions.includes(actionType)) {
      return true;
    }

    // Low autonomy = everything needs approval
    if (helixAutonomyLevel === 0) {
      return true;
    }

    // Level 1 = medium-risk tasks need approval
    if (helixAutonomyLevel === 1 && riskLevel === 'medium') {
      return true;
    }

    // Level 2 & 3 = only dangerous actions need approval
    return false;
  }

  private formatSettings(data: Record<string, unknown>): AutonomySettings {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      helix_autonomy_level: data.helix_autonomy_level as AutonomyLevel,
      auto_agent_creation: data.auto_agent_creation as boolean,
      agent_proposals_require_approval: data.agent_proposals_require_approval as boolean,
      discord_approval_enabled: data.discord_approval_enabled as boolean,
      created_at: new Date(data.created_at as string),
      updated_at: new Date(data.updated_at as string),
    };
  }

  private formatAction(data: Record<string, unknown>): AutonomyAction {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      agent_id: data.agent_id as string | undefined,
      action_type: data.action_type as string,
      action_description: data.action_description as string,
      risk_level: data.risk_level as RiskLevel,
      status: data.status as ActionStatus,
      approval_method: data.approval_method as string,
      discord_message_id: data.discord_message_id as string | undefined,
      discord_channel: data.discord_channel as string | undefined,
      executed_at: data.executed_at
        ? new Date(data.executed_at as string)
        : undefined,
      result: data.result as Record<string, unknown> | undefined,
      error_message: data.error_message as string | undefined,
      created_at: new Date(data.created_at as string),
      updated_at: new Date(data.updated_at as string),
    };
  }
}
