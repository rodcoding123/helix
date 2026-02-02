import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type {
  AgentTemplate,
  AgentTemplateCategory,
  UserAgentTemplate,
  TemplateUsageLog,
  TemplateInstantiationConfig,
  EnrichedAgentTemplate,
  PersonalityProfile,
} from '@/lib/types/agent-templates';

/**
 * AgentTemplateService: Manages agent templates for the marketplace
 * Handles template discovery, customization, and usage tracking
 */
export class AgentTemplateService {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Get all template categories
   */
  async getCategories(): Promise<AgentTemplateCategory[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agent_template_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch categories: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get template categories:', error);
      throw error;
    }
  }

  /**
   * Get templates (with optional filtering)
   */
  async getTemplates(options?: {
    category_id?: string;
    search?: string;
    visibility?: string;
    limit?: number;
    offset?: number;
  }): Promise<EnrichedAgentTemplate[]> {
    try {
      const supabase = this.getSupabaseClient();
      let query = supabase.from('agent_templates').select(
        `*,
        agent_template_categories(*)`,
        { count: 'estimated' }
      );

      // Filter by visibility (public or system)
      if (options?.visibility) {
        query = query.eq('visibility', options.visibility);
      } else {
        query = query.in('visibility', ['public']);
      }

      // Filter by category
      if (options?.category_id) {
        query = query.eq('category_id', options.category_id);
      }

      // Search by name or description
      if (options?.search) {
        query = query.or(
          `name.ilike.%${options.search}%,description.ilike.%${options.search}%,tags.cs.{"${options.search}"}`
        );
      }

      // Pagination
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Sort by clone count (popularity)
      query = query.order('clone_count', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }

      return (data || []).map((t: any) => ({
        ...t,
        category: t.agent_template_categories,
      }));
    } catch (error) {
      console.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * Get a specific template by ID
   */
  async getTemplate(templateId: string): Promise<EnrichedAgentTemplate> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agent_templates')
        .select(
          `*,
          agent_template_categories(*)`
        )
        .eq('id', templateId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      return {
        ...data,
        category: data.agent_template_categories,
      };
    } catch (error) {
      console.error('Failed to get template:', error);
      throw error;
    }
  }

  /**
   * Create a new agent from a template
   */
  async instantiateTemplate(
    userId: string,
    config: TemplateInstantiationConfig
  ): Promise<any> {
    try {
      const supabase = this.getSupabaseClient();

      // Get template
      const template = await this.getTemplate(config.template_id);

      // Create agent from template
      const agent = {
        user_id: userId,
        name: config.agent_name,
        role: template.role,
        description: template.description,
        scope: config.custom_scope || template.scope,
        goals: config.custom_goals || template.goals,
        personality: {
          ...template.personality,
          ...config.custom_personality,
        },
        autonomy_level: template.autonomy_level,
        created_by: 'user',
        enabled: true,
        narrative: {
          template_source: config.template_id,
          template_name: template.name,
          instantiation_reason: `Created from ${template.name} template`,
        },
      };

      const { data, error } = await supabase
        .from('agents')
        .insert([agent])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to instantiate template: ${error.message}`);
      }

      // Log usage
      await this.logTemplateUsage(userId, config.template_id, data.id, 'deployed');

      // Increment clone count
      await this.incrementCloneCount(config.template_id);

      return data;
    } catch (error) {
      console.error('Failed to instantiate template:', error);
      throw error;
    }
  }

  /**
   * Save an agent as a template
   */
  async saveAgentAsTemplate(
    userId: string,
    agentId: string,
    templateName: string,
    description: string,
    categoryId?: string,
    visibility: 'public' | 'private' | 'unlisted' = 'private'
  ): Promise<AgentTemplate> {
    try {
      const supabase = this.getSupabaseClient();

      // Get the agent
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', userId)
        .single();

      if (agentError || !agent) {
        throw new Error('Agent not found');
      }

      // Create template
      const template = {
        name: templateName,
        description,
        category_id: categoryId,
        creator_user_id: userId,
        visibility,
        is_system: false,
        role: agent.role,
        scope: agent.scope,
        goals: agent.goals,
        personality: agent.personality,
        autonomy_level: agent.autonomy_level,
        clone_count: 0,
        active_instances: 1,
        rating: 0,
        tags: [],
        version: '1.0.0',
      };

      const { data, error } = await supabase
        .from('agent_templates')
        .insert([template])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save template: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to save agent as template:', error);
      throw error;
    }
  }

  /**
   * Toggle template as favorite for user
   */
  async toggleFavorite(userId: string, templateId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      // Check if already favorited
      const { data: existing } = await supabase
        .from('user_agent_templates')
        .select('id, is_favorite')
        .eq('user_id', userId)
        .eq('template_id', templateId)
        .single();

      if (existing) {
        // Toggle favorite
        await supabase
          .from('user_agent_templates')
          .update({ is_favorite: !existing.is_favorite })
          .eq('id', existing.id);
      } else {
        // Create entry as favorite
        await supabase
          .from('user_agent_templates')
          .insert([
            {
              user_id: userId,
              template_id: templateId,
              is_favorite: true,
            },
          ]);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  }

  /**
   * Get user's favorite templates
   */
  async getFavorites(userId: string): Promise<EnrichedAgentTemplate[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('user_agent_templates')
        .select(
          `*,
          agent_templates(
            *,
            agent_template_categories(*)
          )`
        )
        .eq('user_id', userId)
        .eq('is_favorite', true)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch favorites: ${error.message}`);
      }

      return (data || []).map((item: any) => ({
        ...item.agent_templates,
        category: item.agent_templates.agent_template_categories,
        user_preferences: item,
      }));
    } catch (error) {
      console.error('Failed to get favorites:', error);
      throw error;
    }
  }

  /**
   * Log template usage for analytics
   */
  private async logTemplateUsage(
    userId: string,
    templateId: string,
    agentId: string | null,
    eventType: 'viewed' | 'cloned' | 'customized' | 'deployed'
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase.from('template_usage_log').insert([
        {
          template_id: templateId,
          user_id: userId,
          agent_id: agentId,
          event_type: eventType,
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to log template usage:', error);
      // Non-fatal - don't throw
    }
  }

  /**
   * Increment template clone count
   */
  private async incrementCloneCount(templateId: string): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      const { data: template } = await supabase
        .from('agent_templates')
        .select('clone_count')
        .eq('id', templateId)
        .single();

      if (template) {
        await supabase
          .from('agent_templates')
          .update({ clone_count: (template.clone_count || 0) + 1 })
          .eq('id', templateId);
      }
    } catch (error) {
      console.error('Failed to increment clone count:', error);
      // Non-fatal - don't throw
    }
  }
}
