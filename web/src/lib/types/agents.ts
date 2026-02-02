// Agent and Autonomy types for Phase 2/3

export type AutonomyLevel = 0 | 1 | 2 | 3;
export type AgentCreationType = 'system' | 'user';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'auto_created';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type RiskLevel = 'low' | 'medium' | 'high';

// Agent personality dimensions (0-1 scale)
export interface AgentPersonality {
  verbosity: number; // Concise (0) ↔ Detailed (1)
  formality: number; // Casual (0) ↔ Formal (1)
  creativity: number; // Practical (0) ↔ Playful (1)
  proactivity: number; // Reactive (0) ↔ Initiating (1)
  warmth: number; // Neutral (0) ↔ Caring (1)
}

// Layer 1: Narrative (agent's story)
export interface AgentNarrative {
  creation_reason: string; // Why Helix created this agent
  first_interaction: Date;
  personality_summary: string;
}

// Main Agent interface
export interface Agent {
  id: string;
  user_id: string;

  // Identity
  name: string;
  role: string;
  description: string;

  // Psychology
  narrative: AgentNarrative;
  goals: string[];
  scope: string;

  // Autonomy
  autonomy_level: AutonomyLevel;
  created_by: AgentCreationType;
  enabled: boolean;

  // Personality state
  personality: AgentPersonality;

  // Metadata
  created_at: Date;
  last_used: Date | null;
  conversation_count: number;
  updated_at: Date;
}

// Agent conversation record
export interface AgentConversation {
  id: string;
  agent_id: string;
  user_id: string;

  // Conversation data
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;

  // Emotional analysis
  primary_emotion: string;
  secondary_emotions: string[];
  emotional_dimensions: {
    valence: number;
    arousal: number;
    dominance: number;
    novelty: number;
    self_relevance: number;
  };

  topics: string[];

  created_at: Date;
  updated_at: Date;
}

// Pattern detected by PatternDetectionService
export interface DetectedPattern {
  topic_cluster: string[];
  frequency: number; // times per week
  confidence: number; // 0-1
  context: string;
}

// Agent Proposal from Helix
export interface AgentProposal {
  id: string;
  user_id: string;

  // Proposal details
  proposed_name: string;
  proposed_role: string;
  reason: string;
  detected_pattern: DetectedPattern;

  // Status
  status: ProposalStatus;

  // Resolution
  agent_id?: string;
  approved_at?: Date;
  rejected_at?: Date;
  created_at: Date;
}

// User's autonomy settings
export interface AutonomySettings {
  id: string;
  user_id: string;

  // Helix autonomy level
  helix_autonomy_level: AutonomyLevel;

  // Feature toggles
  auto_agent_creation: boolean;
  agent_proposals_require_approval: boolean;
  discord_approval_enabled: boolean;

  created_at: Date;
  updated_at: Date;
}

// Autonomy action (for approval workflow)
export interface AutonomyAction {
  id: string;
  user_id: string;
  agent_id?: string;

  // Action details
  action_type: string;
  action_description: string;
  risk_level: RiskLevel;

  // Status
  status: ActionStatus;
  approval_method?: string;

  // Discord logging
  discord_message_id?: string;
  discord_channel?: string;

  // Execution
  executed_at?: Date;
  result?: Record<string, unknown>;
  error_message?: string;

  created_at: Date;
  updated_at: Date;
}

// Pattern analysis results
export interface PatternAnalysisResult {
  topicClusters: Array<{
    topic: string;
    frequency: number;
    confidence: number;
  }>;
  emotionPatterns: Array<{
    emotion: string;
    topic: string;
    correlation: number;
  }>;
  workflowPatterns: Array<{
    sequence: string[];
    frequency: number;
  }>;
  recommendations: AgentProposal[];
}
