// Core memory types for Phase 1: Memory System

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

// Emotional Analysis (5-dimensional space)
export interface EmotionalDimensions {
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0 (calm) to 1 (intense)
  dominance: number; // 0 (powerless) to 1 (empowered)
  novelty: number; // 0 (routine) to 1 (surprising)
  self_relevance: number; // 0 (external) to 1 (identity-defining)
}

export interface EmotionAnalysis {
  primary_emotion: string;
  secondary_emotions: string[];
  dimensions: EmotionalDimensions;
  salience_score: number; // 0-1
  salience_tier: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
}

export type ExtractedTopic = string;

export interface Conversation {
  id: string;
  user_id: string;
  messages: ConversationMessage[];
  primary_emotion: string;
  secondary_emotions: string[];
  valence: number;
  arousal: number;
  dominance: number;
  novelty: number;
  self_relevance: number;
  emotional_salience: number;
  salience_tier: string;
  extracted_topics: ExtractedTopic[];
  embedding: number[]; // 768-dimensional vector
  decay_multiplier: number;
  user_marked_important: boolean;
  is_deleted: boolean;
  attachment_context?: string;
  prospective_self_context?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MemoryGreetingData {
  conversation_id: string;
  summary: string;
  topics: string[];
  emotions: string[];
  when: string; // e.g., "2 days ago"
}
