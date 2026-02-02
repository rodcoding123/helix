import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { AgentTemplate, EnrichedAgentTemplate } from '@/lib/types/agent-templates';

/**
 * TemplateMarketplaceService: Handles marketplace operations
 * Manages publishing, cloning, discovering, and rating templates
 */
export class TemplateMarketplaceService {
  private supabase: SupabaseClient | null = null;

  private getSupabaseClient(): SupabaseClient {
    if (this.supabase) return this.supabase;
    this.supabase = getSupabaseBrowserClient();
    return this.supabase;
  }

  /**
   * Get all public templates (marketplace discovery)
   */
  async getPublicTemplates(options?: {
    category_id?: string;
    search?: string;
    sortBy?: 'popularity' | 'newest' | 'rating';
    limit?: number;
    offset?: number;
  }): Promise<EnrichedAgentTemplate[]> {
    try {
      const supabase = this.getSupabaseClient();
      let query = supabase
        .from('agent_templates')
        .select(
          `*,
          agent_template_categories(*)`
        )
        .eq('visibility', 'public');

      // Filter by category
      if (options?.category_id) {
        query = query.eq('category_id', options.category_id);
      }

      // Search
      if (options?.search) {
        query = query.or(
          `name.ilike.%${options.search}%,description.ilike.%${options.search}%,tags.cs.{"${options.search}"}`
        );
      }

      // Sort
      const sortBy = options?.sortBy || 'popularity';
      if (sortBy === 'popularity') {
        query = query.order('clone_count', { ascending: false });
      } else if (sortBy === 'rating') {
        query = query.order('rating', { ascending: false });
      } else if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      }

      // Pagination
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch public templates: ${error.message}`);
      }

      return (data || []).map((t: any) => ({
        ...t,
        category: t.agent_template_categories,
      }));
    } catch (error) {
      console.error('Failed to get public templates:', error);
      throw error;
    }
  }

  /**
   * Clone a public template as a private copy
   */
  async cloneTemplate(
    userId: string,
    templateId: string,
    newName?: string
  ): Promise<AgentTemplate> {
    try {
      const supabase = this.getSupabaseClient();

      // Get original template
      const { data: original, error: fetchError } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (fetchError || !original) {
        throw new Error('Template not found');
      }

      // Create cloned version
      const cloned = {
        ...original,
        id: undefined, // Let database generate new ID
        creator_user_id: userId,
        visibility: 'private' as const,
        name: newName || `${original.name} (Clone)`,
        clone_count: 0,
        active_instances: 0,
        rating: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('agent_templates')
        .insert([cloned])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to clone template: ${error.message}`);
      }

      // Log usage
      await this.logMarketplaceEvent(userId, templateId, 'cloned');

      return data;
    } catch (error) {
      console.error('Failed to clone template:', error);
      throw error;
    }
  }

  /**
   * Publish a private template to the marketplace
   */
  async publishTemplate(
    userId: string,
    templateId: string,
    visibility: 'public' | 'unlisted' = 'public'
  ): Promise<AgentTemplate> {
    try {
      const supabase = this.getSupabaseClient();

      // Verify ownership
      const { data: template, error: fetchError } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('id', templateId)
        .eq('creator_user_id', userId)
        .single();

      if (fetchError || !template) {
        throw new Error('Template not found or you do not own this template');
      }

      // Update visibility
      const { data, error } = await supabase
        .from('agent_templates')
        .update({ visibility })
        .eq('id', templateId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to publish template: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to publish template:', error);
      throw error;
    }
  }

  /**
   * Get templates created by a specific user
   */
  async getUserCreatedTemplates(userId: string): Promise<EnrichedAgentTemplate[]> {
    try {
      const supabase = this.getSupabaseClient();

      const { data, error } = await supabase
        .from('agent_templates')
        .select(
          `*,
          agent_template_categories(*)`
        )
        .eq('creator_user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch user templates: ${error.message}`);
      }

      return (data || []).map((t: any) => ({
        ...t,
        category: t.agent_template_categories,
      }));
    } catch (error) {
      console.error('Failed to get user templates:', error);
      throw error;
    }
  }

  /**
   * Rate a template
   */
  async rateTemplate(templateId: string, rating: number): Promise<void> {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const supabase = this.getSupabaseClient();

      // Get current rating
      const { data: template } = await supabase
        .from('agent_templates')
        .select('rating')
        .eq('id', templateId)
        .single();

      if (!template) {
        throw new Error('Template not found');
      }

      // Simple average - in production, would track individual ratings
      const newRating = template.rating ? (template.rating + rating) / 2 : rating;

      await supabase
        .from('agent_templates')
        .update({ rating: newRating })
        .eq('id', templateId);
    } catch (error) {
      console.error('Failed to rate template:', error);
      throw error;
    }
  }

  /**
   * Log marketplace events for analytics
   */
  private async logMarketplaceEvent(
    userId: string,
    templateId: string,
    eventType: 'viewed' | 'cloned' | 'published'
  ): Promise<void> {
    try {
      const supabase = this.getSupabaseClient();

      await supabase.from('template_usage_log').insert([
        {
          template_id: templateId,
          user_id: userId,
          event_type: eventType,
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'marketplace',
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to log marketplace event:', error);
      // Non-fatal
    }
  }
}
