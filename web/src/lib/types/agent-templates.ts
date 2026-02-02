/**
 * Agent Templates System Types
 * Enables template-based agent creation and marketplace functionality
 */

export interface AgentTemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
  created_at: string;
}

export interface PersonalityProfile {
  verbosity: number; // 0-1: how much detail in responses
  formality: number; // 0-1: formality level
  creativity: number; // 0-1: creativity in approach
  proactivity: number; // 0-1: initiative level
  warmth: number; // 0-1: empathy and friendliness
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category_id: string | null;
  creator_user_id: string | null;
  creator_name: string;
  visibility: 'public' | 'private' | 'unlisted';
  is_system: boolean;

  // Agent definition
  role: string;
  scope: string | null;
  goals: string[] | null;
  personality: PersonalityProfile;
  autonomy_level: number; // 0-3

  // Usage statistics
  clone_count: number;
  active_instances: number;
  rating: number;
  use_cases: string[] | null;

  // Metadata
  tags: string[] | null;
  version: string;
  created_at: string;
  updated_at: string;
}

export interface UserAgentTemplate {
  id: string;
  user_id: string;
  template_id: string;
  is_favorite: boolean;
  custom_name: string | null;
  custom_personality: PersonalityProfile | null;
  notes: string | null;
  used_count: number;
  last_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateUsageLog {
  id: string;
  template_id: string;
  user_id: string;
  agent_id: string | null;
  event_type: 'viewed' | 'cloned' | 'customized' | 'deployed';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Enriched template with category information
 */
export interface EnrichedAgentTemplate extends AgentTemplate {
  category?: AgentTemplateCategory;
  user_preferences?: UserAgentTemplate;
}

/**
 * Configuration for instantiating a template as an agent
 */
export interface TemplateInstantiationConfig {
  template_id: string;
  agent_name: string;
  custom_personality?: Partial<PersonalityProfile>;
  custom_goals?: string[];
  custom_scope?: string;
}
