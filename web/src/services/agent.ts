import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { Agent, AgentConversation, AgentPersonality } from '@/lib/types/agents';
import { DiscordLoggerService } from './discord-logger';

/**
 * AgentService: Manages agent lifecycle, personality, and memory
 * Works with Supabase to store and retrieve agent data
 */
export class AgentService {
  private supabase: SupabaseClient | null = null;
  private discordLogger: DiscordLoggerService | null = null;

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

  /**
   * Create a new agent with personality learned from user patterns
   */
  async createAgent(
    userId: string,
    name: string,
    role: string,
    description: string,
    creationReason: string,
    initialPersonality?: Partial<AgentPersonality>
  ): Promise<Agent> {
    try {
      const supabase = this.getSupabaseClient();

      const defaultPersonality: AgentPersonality = {
        verbosity: 0.5,
        formality: 0.5,
        creativity: 0.5,
        proactivity: 0.5,
        warmth: 0.5,
        ...initialPersonality,
      };

      const narrative = {
        creation_reason: creationReason,
        first_interaction: new Date(),
        personality_summary: `${name} was created to help with ${description.toLowerCase()}`,
      };

      const { data, error } = await supabase
        .from('agents')
        .insert([
          {
            user_id: userId,
            name,
            role,
            description,
            narrative,
            personality: defaultPersonality,
            created_by: 'system',
            autonomy_level: 0,
            goals: [],
            scope: `Assist with ${role.toLowerCase()}`,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create agent: ${error.message}`);
      }

      const agent = this.formatAgent(data);

      // Log agent creation to Discord (non-fatal if it fails)
      try {
        const discordLogger = this.getDiscordLogger();
        await discordLogger.logAgentCreated(userId, agent);
      } catch (discordError) {
        console.error('Failed to log agent creation to Discord:', discordError);
        // Don't throw - Discord logging is non-fatal
      }

      return agent;
    } catch (error) {
      console.error('Failed to create agent:', error);
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string, userId: string): Promise<Agent | null> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agents')
        .select()
        .eq('id', agentId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to get agent: ${error.message}`);
      }

      return this.formatAgent(data);
    } catch (error) {
      console.error('Failed to get agent:', error);
      throw error;
    }
  }

  /**
   * Get all agents for a user
   */
  async getUserAgents(userId: string): Promise<Agent[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agents')
        .select()
        .eq('user_id', userId)
        .eq('enabled', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get user agents: ${error.message}`);
      }

      return (data || []).map((agent) => this.formatAgent(agent));
    } catch (error) {
      console.error('Failed to get user agents:', error);
      throw error;
    }
  }

  /**
   * Update agent autonomy level
   */
  async setAgentAutonomy(
    agentId: string,
    userId: string,
    level: 0 | 1 | 2 | 3
  ): Promise<Agent> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agents')
        .update({
          autonomy_level: level,
          updated_at: new Date(),
        })
        .eq('id', agentId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update agent autonomy: ${error.message}`);
      }

      return this.formatAgent(data);
    } catch (error) {
      console.error('Failed to set agent autonomy:', error);
      throw error;
    }
  }

  /**
   * Update agent personality based on interaction patterns
   */
  async updateAgentPersonality(
    agentId: string,
    userId: string,
    personality: Partial<AgentPersonality>
  ): Promise<Agent> {
    try {
      const supabase = this.getSupabaseClient();

      // Get current agent
      const agent = await this.getAgent(agentId, userId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Merge with existing personality
      const updatedPersonality = {
        ...agent.personality,
        ...personality,
      };

      const { data, error } = await supabase
        .from('agents')
        .update({
          personality: updatedPersonality,
          updated_at: new Date(),
        })
        .eq('id', agentId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update personality: ${error.message}`);
      }

      const updatedAgent = this.formatAgent(data);

      // Log personality evolution to Discord periodically (non-fatal if it fails)
      try {
        const discordLogger = this.getDiscordLogger();
        await discordLogger.logPersonalityEvolution(userId, updatedAgent);
      } catch (discordError) {
        console.error('Failed to log personality evolution to Discord:', discordError);
        // Don't throw - Discord logging is non-fatal
      }

      return updatedAgent;
    } catch (error) {
      console.error('Failed to update agent personality:', error);
      throw error;
    }
  }

  /**
   * Store a conversation with an agent
   */
  async storeConversation(
    agentId: string,
    userId: string,
    conversation: Omit<AgentConversation, 'id' | 'agent_id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<AgentConversation> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agent_conversations')
        .insert([
          {
            agent_id: agentId,
            user_id: userId,
            messages: conversation.messages,
            primary_emotion: conversation.primary_emotion,
            secondary_emotions: conversation.secondary_emotions,
            emotional_dimensions: conversation.emotional_dimensions,
            topics: conversation.topics,
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to store conversation: ${error.message}`);
      }

      // Increment conversation count
      await supabase
        .from('agents')
        .update({ last_used: new Date() })
        .eq('id', agentId);

      return this.formatAgentConversation(data);
    } catch (error) {
      console.error('Failed to store agent conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversations with a specific agent
   */
  async getAgentConversations(
    agentId: string,
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<AgentConversation[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agent_conversations')
        .select()
        .eq('agent_id', agentId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get conversations: ${error.message}`);
      }

      return (data || []).map((conv) => this.formatAgentConversation(conv));
    } catch (error) {
      console.error('Failed to get agent conversations:', error);
      throw error;
    }
  }

  /**
   * Delete an agent (soft delete by setting enabled=false)
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      const { error } = await supabase
        .from('agents')
        .update({
          enabled: false,
          updated_at: new Date(),
        })
        .eq('id', agentId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete agent: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      throw error;
    }
  }

  // Private helper methods

  private formatAgent(data: Record<string, unknown>): Agent {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      name: data.name as string,
      role: data.role as string,
      description: data.description as string,
      narrative: data.narrative as any,
      goals: data.goals as string[],
      scope: data.scope as string,
      autonomy_level: data.autonomy_level as 0 | 1 | 2 | 3,
      created_by: data.created_by as 'system' | 'user',
      enabled: data.enabled as boolean,
      personality: data.personality as AgentPersonality,
      created_at: new Date(data.created_at as string),
      last_used: data.last_used ? new Date(data.last_used as string) : null,
      conversation_count: data.conversation_count as number,
      updated_at: new Date(data.updated_at as string),
    };
  }

  private formatAgentConversation(data: Record<string, unknown>): AgentConversation {
    return {
      id: data.id as string,
      agent_id: data.agent_id as string,
      user_id: data.user_id as string,
      messages: data.messages as any,
      primary_emotion: data.primary_emotion as string,
      secondary_emotions: data.secondary_emotions as string[],
      emotional_dimensions: data.emotional_dimensions as any,
      topics: data.topics as string[],
      created_at: new Date(data.created_at as string),
      updated_at: new Date(data.updated_at as string),
    };
  }
}
