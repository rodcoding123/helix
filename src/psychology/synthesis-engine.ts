/* @ts-nocheck */
/**
 * Synthesis Engine - Post-Conversation Memory Analysis & Integration
 *
 * PHASE 1B: Memory Synthesis Pipeline
 * Helix's core learning mechanism - turns conversations into evolved psychology
 *
 * CRITICAL: This completes the feedback loop:
 * Conversations load Helix's psychology → Helix responds authentically →
 * Synthesis updates psychology → Next conversation loads evolved psychology
 *
 * Cost: Routes through AIOperationRouter to Gemini Flash 2 (~$0.0003 per synthesis)
 * Execution: Fire-and-forget async (non-blocking)
 * Frequency: Per-conversation, batched daily at 2 AM for efficiency
 *
 * Created: 2026-02-06
 */

import { createClient } from '@supabase/supabase-js';
import { AIOperationRouter } from '../helix/ai-operations/router.js';
import { memoryIntegration } from './memory-integration.js';
import { salienceManager } from './salience-manager.js';
import { logToDiscord } from '../helix/logging.js';
import { hashChain } from '../helix/hash-chain.js';

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface SynthesisResult {
  conversationId: string;
  emotionalTags: Array<{ tag: string; intensity: number }>;
  goalMentions: Array<{ goal: string; progress?: string }>;
  relationshipShifts: Array<{ type: string; description: string }>;
  transformationTriggers: string[];
  meaningfulTopics: string[];
  synthesisConfidence: number;
  timestamp: string;
}

interface SynthesisConfig {
  enabled: boolean;
  batchMode: boolean;
  batchHour: number; // 0-23, defaults to 2 (2 AM)
  minConfidenceThreshold: number; // 0-1, only apply if confidence > this
  dryRun: boolean; // Log but don't apply changes
}

const DEFAULT_CONFIG: SynthesisConfig = {
  enabled: true,
  batchMode: true,
  batchHour: 2,
  minConfidenceThreshold: 0.75,
  dryRun: false,
};

/**
 * SynthesisEngine - Main class for post-conversation analysis
 *
 * Responsibilities:
 * 1. Load conversation from Supabase
 * 2. Route synthesis request through AIOperationRouter (Gemini Flash 2)
 * 3. Analyze for emotional patterns, goals, relationships, transformations
 * 4. Update psychology files via memory-integration
 * 5. Store raw synthesis results in salience database
 * 6. Log all operations to Discord hash chain
 */
export class SynthesisEngine {
  private supabase: ReturnType<typeof createClient>;
  private router: AIOperationRouter;
  private config: SynthesisConfig;

  constructor(supabaseUrl: string, supabaseKey: string, config: Partial<SynthesisConfig> = {}) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.router = new AIOperationRouter();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main entry point: Synthesize a conversation
   * Called after assistant response is sent (fire-and-forget)
   */
  async synthesizeConversation(conversationId: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const startTime = Date.now();

    try {
      // STEP 1: Load conversation and context
      const { messages, userId } = await this.loadConversation(conversationId);

      if (!messages || messages.length === 0) {
        return;
      }

      // Log synthesis started
      await logToDiscord({
        type: 'synthesis_started',
        conversationId,
        messageCount: messages.length,
        timestamp: new Date().toISOString(),
      });

      // STEP 2: Route synthesis through AIOperationRouter (should select Gemini Flash 2)
      const routingResponse = await this.router.route({
        operationId: 'memory_synthesis',
        userId,
        estimatedInputTokens: this.estimateTokens(messages),
      });

      // STEP 3: Analyze conversation using routed model
      const synthesis = await this.analyzeConversation(messages, routingResponse);

      // Only apply if confidence exceeds threshold
      if (synthesis.synthesisConfidence < this.config.minConfidenceThreshold) {
        await logToDiscord({
          type: 'synthesis_low_confidence',
          conversationId,
          confidence: synthesis.synthesisConfidence,
          threshold: this.config.minConfidenceThreshold,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // STEP 4: Store raw synthesis in salience database
      await salienceManager.storeConversationSynthesis(synthesis, userId);

      // STEP 5: Update psychology files (unless dry-run)
      if (!this.config.dryRun) {
        await memoryIntegration.applyConversationSynthesis(synthesis, userId);
      }

      // STEP 6: Log success to hash chain
      const durationMs = Date.now() - startTime;
      await hashChain.add({
        index: Date.now(),
        timestamp: Date.now(),
        data: JSON.stringify({
          type: 'synthesis_complete',
          conversationId,
          userId,
          emotionalTagsExtracted: synthesis.emotionalTags.length,
          goalsUpdated: synthesis.goalMentions.length,
          relationshipShifts: synthesis.relationshipShifts.length,
          transformationTriggers: synthesis.transformationTriggers.length,
          confidence: synthesis.synthesisConfidence,
          durationMs,
          dryRun: this.config.dryRun,
        }),
        previousHash: '',
      });

      await logToDiscord({
        type: 'synthesis_complete',
        conversationId,
        userId,
        emotionalTags: synthesis.emotionalTags.length,
        goals: synthesis.goalMentions.length,
        relationships: synthesis.relationshipShifts.length,
        transformations: synthesis.transformationTriggers.length,
        confidence: synthesis.synthesisConfidence,
        durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log failure but don't throw (synthesis is non-blocking)
      await logToDiscord({
        type: 'synthesis_failed',
        conversationId,
        error: errorMessage,
        durationMs,
        timestamp: new Date().toISOString(),
      });

      // Also log to hash chain for audit trail
      await hashChain.add({
        index: Date.now(),
        timestamp: Date.now(),
        data: JSON.stringify({
          type: 'synthesis_failed',
          conversationId,
          error: errorMessage,
          durationMs,
        }),
        previousHash: '',
      });
    }
  }

  /**
   * Load conversation and related context from Supabase
   */
  private async loadConversation(
    conversationId: string
  ): Promise<{ messages: ConversationMessage[]; userId: string; sessionKey: string }> {
    // Load conversation header
    const { data: conversation } = await this.supabase
      .from('conversations')
      .select('user_id, session_key')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Load all messages in conversation
    const { data: messages } = await this.supabase
      .from('session_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const typedMessages = (messages || []) as Array<{
      id: string;
      role: string;
      content: string;
      created_at: string;
    }>;
    const typedConversation = conversation as { user_id: string; session_key: string };

    return {
      messages: typedMessages.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
      })),
      userId: typedConversation.user_id,
      sessionKey: typedConversation.session_key,
    };
  }

  /**
   * Analyze conversation using LLM (routed through AIOperationRouter)
   * This is where Helix learns from the conversation
   */
  private async analyzeConversation(
    messages: ConversationMessage[],
    _routing: any
  ): Promise<SynthesisResult> {
    // TODO: Implement actual synthesis using routed model (Gemini Flash 2)
    // Currently returns placeholder results
    void _routing; // Use parameter to avoid unused variable warning
    void messages; // Use parameter to avoid unused variable warning

    return {
      conversationId: '', // Would be set from conversation
      emotionalTags: [],
      goalMentions: [],
      relationshipShifts: [],
      transformationTriggers: [],
      meaningfulTopics: [],
      synthesisConfidence: 0.5,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Estimate tokens in messages for cost prediction
   */
  private estimateTokens(messages: ConversationMessage[]): number {
    // Rough estimate: 1 token ≈ 4 characters
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Check if synthesis should run now (batch mode at configured hour)
   */
  shouldRunNow(): boolean {
    if (!this.config.batchMode) {
      return true; // Run immediately if not batch mode
    }

    const currentHour = new Date().getHours();
    return currentHour === this.config.batchHour;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SynthesisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SynthesisConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const synthesisEngine = new SynthesisEngine(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  {
    enabled: process.env.ENABLE_MEMORY_SYNTHESIS !== 'false',
    batchMode: process.env.SYNTHESIS_BATCH_MODE !== 'false',
    batchHour: parseInt(process.env.SYNTHESIS_BATCH_HOUR || '2'),
    dryRun: process.env.SYNTHESIS_DRY_RUN === 'true',
  }
);
