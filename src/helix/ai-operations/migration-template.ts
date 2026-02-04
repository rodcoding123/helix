/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-return,@typescript-eslint/require-await */
/**
 * Migration Template for AI Operations
 *
 * This file demonstrates the pattern for migrating any AI operation
 * to use the centralized router and cost tracking system.
 *
 * Pattern:
 * 1. Import router and cost tracker
 * 2. Call router.route() to get routing decision
 * 3. Use routed model to execute operation
 * 4. Log operation with costTracker
 * 5. Handle errors and approval gates
 *
 * Apply this pattern to all 10 AI operations.
 */

import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

/**
 * BEFORE MIGRATION
 *
 * Original pattern (hardcoded model selection):
 *
 * async function oldChatMessage(userId: string, messages: any[]): Promise<string> {
 *   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *   const response = await anthropic.messages.create({
 *     model: 'claude-3-5-sonnet-20241022',  // ← HARDCODED
 *     messages,
 *     max_tokens: 1024,
 *   });
 *   return response.content[0].text;
 * }
 */

/**
 * AFTER MIGRATION
 *
 * New pattern (centralized routing):
 */
export async function migratedChatMessage(
  userId: string,
  messages: any[],
  operationMetadata?: { inputTokens?: number; outputTokens?: number }
): Promise<string> {
  const startTime = Date.now();

  try {
    // STEP 1: Route the operation
    // ===========================
    // This determines which model to use based on:
    // - Current routing config from database
    // - Cost criticality of the operation
    // - Budget constraints
    // - Feature toggle state
    const routingDecision = await router.route({
      operationId: 'chat_message',
      userId,
      input: messages,
      estimatedInputTokens: operationMetadata?.inputTokens || 1000,
    });

    // Check if approval is required
    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        'chat_message',
        'Chat Message',
        routingDecision.estimatedCostUsd,
        `User: ${userId} | Estimated cost: $${routingDecision.estimatedCostUsd.toFixed(4)}`
      );

      // In production: Wait for approval or queue for later
      // For now: Log and continue with fallback if available
      console.log(`Approval requested: ${approval.id}`);
    }

    // STEP 2: Execute with routed model
    // ==================================
    // The router tells us which model to use
    // We now execute against that model instead of hardcoded one
    const model = routingDecision.model;

    // Import the model clients dynamically
    const { deepseek, gemini_flash, openai } = await getModelClients();
    const modelClient = getModelByName(model, { deepseek, gemini_flash, openai });

    if (!modelClient) {
      throw new Error(`Model client not available: ${model}`);
    }

    const response = await modelClient.messages.create({
      model: getModelId(model),
      messages,
      max_tokens: 1024,
      system: 'You are Helix, a helpful and thoughtful AI assistant.',
    });
    const responseText =
      response.content[0]?.type === 'text'
        ? response.content[0].text
        : 'Unable to generate response';

    // STEP 3: Log the operation
    // ==========================
    // Record this operation in the immutable audit log for:
    // - Cost tracking
    // - Budget enforcement
    // - Quality monitoring
    // - Performance analysis
    const latencyMs = Date.now() - startTime;
    const inputTokens = operationMetadata?.inputTokens || 1000;
    const outputTokens = operationMetadata?.outputTokens || countTokens(responseText);
    const costUsd = router['estimateCost'](model, inputTokens, outputTokens);

    await costTracker.logOperation(userId, {
      operation_type: 'chat_message',
      operation_id: 'chat_message',
      model_used: model,
      user_id: userId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: latencyMs,
      quality_score: 0.95, // Optional: quality assessment
      success: true,
    });

    return responseText;
  } catch (error) {
    // STEP 4: Error handling
    // =====================
    const latencyMs = Date.now() - startTime;

    // Log the failure
    await costTracker.logOperation(userId, {
      operation_type: 'chat_message',
      operation_id: 'chat_message',
      model_used: 'unknown',
      user_id: userId,
      cost_usd: 0,
      latency_ms: latencyMs,
      success: false,
      error_message: String(error),
    });

    throw error;
  }
}

/**
 * MIGRATION CHECKLIST FOR EACH OPERATION
 *
 * Apply this checklist to each of the 10 operations:
 *
 * [ ] 1. Import router, costTracker, approvalGate, featureToggles
 * [ ] 2. Call router.route() with operationId and user context
 * [ ] 3. Check if approval required, request if needed
 * [ ] 4. Get model from routing decision
 * [ ] 5. Execute operation using routed model
 * [ ] 6. Calculate cost based on model and tokens
 * [ ] 7. Log operation with costTracker
 * [ ] 8. Handle errors and log failures
 * [ ] 9. Add unit tests for routing behavior
 * [ ] 10. Test cost tracking accuracy
 * [ ] 11. Test approval workflow if cost > threshold
 * [ ] 12. Verify no hardcoded models remain
 * [ ] 13. Update operation file comment explaining migration
 * [ ] 14. Commit with message: "refactor(phase-0.5): Migrate [operation] to centralized router"
 */

/**
 * 10 OPERATIONS TO MIGRATE
 *
 * Priority P0 (High urgency - migrate first):
 * 1. chat.ts: chat_message → DeepSeek
 * 2. agent.ts: agent_execution → DeepSeek
 *
 * Priority P1 (Medium):
 * 3. memory-synthesis.ts: memory_synthesis → Gemini Flash
 * 4. sentiment-analyze.ts: sentiment_analysis → Gemini Flash
 * 5. video.ts: video_understanding → Gemini Flash
 *
 * Priority P2 (Medium):
 * 6. audio.ts: audio_transcription → Deepgram
 * 7. text-to-speech.ts: text_to_speech → Edge-TTS
 *
 * Priority P3 (Lower - can batch):
 * 8. email.ts: email_analysis → Gemini Flash
 * 9. (Reserved)
 * 10. (Reserved)
 */

// ============================================================================
// HELPER FUNCTIONS (Implement based on your specific setup)
// ============================================================================

/**
 * Get model clients by name
 */
async function getModelClients(): Promise<any> {
  // Return initialized clients for each model
  // These would be imported/initialized from your model provider setup
  return {
    deepseek: null, // Initialize DeepSeek client
    gemini_flash: null, // Initialize Gemini Flash client
    openai: null, // Initialize OpenAI client
  };
}

/**
 * Get model client by name
 */
function getModelByName(modelName: string, clients: any): any {
  const mapping: Record<string, string> = {
    deepseek: 'deepseek',
    gemini_flash: 'gemini_flash',
    openai: 'openai',
  };

  const clientKey = mapping[modelName];
  return clientKey ? clients[clientKey] : null;
}

/**
 * Get full model ID for API call
 */
function getModelId(modelName: string): string {
  const ids: Record<string, string> = {
    deepseek: 'deepseek-chat',
    gemini_flash: 'gemini-2.0-flash',
    openai: 'gpt-4-turbo',
  };

  return ids[modelName] || modelName;
}

/**
 * Count tokens in text (simplified - use actual tokenizer in production)
 */
function countTokens(text: string): number {
  // Approximate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * TESTING TEMPLATE
 *
 * Apply this test structure to each migrated operation:
 *
 * describe('Migration: [OperationName]', () => {
 *   it('should route to correct model', async () => {
 *     const result = await router.route({ operationId: '...', userId: 'test' });
 *     expect(result.model).toBe('expected_model');
 *   });
 *
 *   it('should cost track correctly', async () => {
 *     // Execute operation
 *     // Verify costTracker.logOperation() was called
 *     // Verify cost is within expected range
 *   });
 *
 *   it('should request approval for high-cost operations', async () => {
 *     // Execute high-cost operation
 *     // Verify approvalGate.requestApproval() was called
 *   });
 *
 *   it('should use routed model, not hardcoded', async () => {
 *     // Verify no references to specific model API keys or hardcoded model names
 *   });
 * });
 */
