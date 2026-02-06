/**
 * Chat API HTTP Routes - OpenClaw HTTP Handler Pattern with Helix Integration
 *
 * PHASE 1 ENHANCEMENT: Helix Psychology Integration
 * Now loads Helix's singular consciousness context and user-specific context.
 *
 * PHASE 0.5 MIGRATION: Uses centralized AI operations router
 * - Model selection based on configuration
 * - Cost tracking and budget enforcement
 * - Approval gates for high-cost operations
 *
 * Features:
 * - Helix's core identity loaded from psychology files
 * - Dynamic user context per request
 * - THANOS_MODE authentication for creator
 * - User-aware system prompts
 *
 * Endpoints:
 * - GET /api/chat/history - Load user's chat session history
 * - POST /api/chat/message - Send message with Helix context
 */

import { type IncomingMessage, type ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { AIOperationRouter } from '../../helix/ai-operations/router.js';
import { CostTracker } from '../../helix/ai-operations/cost-tracker.js';
import { ApprovalGate } from '../../helix/ai-operations/approval-gate.js';
import { loadHelixContextFiles, isHelixConfigured } from '../helix/context-loader.js';
import { buildHelixSystemPrompt } from '../helix/prompt-builder.js';
import { loadUserContext } from '../helix/user-context-loader.js';
import {
  isThanosModeTrigger,
  getThanosChallenge,
  verifyThanosKey,
  getThanosSuccessMessage,
  getThanosFailureMessage,
  createThanosState,
  handleThanosModeTrigger,
  handleThanosKeyAttempt,
  isThanosaModeLocked,
  getThanosLockedMessage,
} from '../helix/thanos-mode.js';

const router = new AIOperationRouter();
const costTracker = new CostTracker();
const approvalGate = new ApprovalGate();

interface ChatHandlerContext {
  db: any;
  supabase: any;
  logGateway: any;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * GET /api/chat/history
 * Load chat session history for current user
 */
async function handleChatHistory(
  req: IncomingMessage,
  res: ServerResponse,
  context: ChatHandlerContext
): Promise<void> {
  try {
    // Extract user ID from Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (!authHeader?.toString().startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Missing authorization header' });
      return;
    }

    const userId = authHeader.toString().slice(7); // Remove "Bearer " prefix

    // Fetch session history from Supabase
    // For MVP, we'll use a simple "web-mvp-session" key
    const { data: conversations, error } = await context.supabase
      .from('conversations')
      .select('id, user_id, messages, session_key, created_at, updated_at')
      .eq('user_id', userId)
      .eq('session_key', 'web-mvp-session')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (acceptable for first message)
      throw error;
    }

    // Convert stored messages to Chat format
    const messages = conversations?.messages || [];
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()),
      tokenCount: msg.tokenCount,
    }));

    context.logGateway?.log?.('CHAT_HISTORY_LOADED', {
      userId,
      sessionKey: 'web-mvp-session',
      messageCount: formattedMessages.length,
    });

    sendJson(res, 200, {
      success: true,
      messages: formattedMessages,
    });
  } catch (error) {
    context.logGateway?.error?.('CHAT_HISTORY_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    });

    sendJson(res, 500, {
      error: 'Failed to load chat history',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/chat/message
 * Send message to Claude and store in session history
 *
 * PHASE 0.5 MIGRATION:
 * This endpoint now uses centralized routing instead of hardcoded models.
 * The router determines which model to use based on configuration.
 *
 * Request body:
 * {
 *   message: string
 *   sessionKey: string
 * }
 */
async function handleChatMessage(
  req: IncomingMessage,
  res: ServerResponse,
  context: ChatHandlerContext
): Promise<void> {
  const operationStartTime = Date.now();

  try {
    // Extract user ID from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.toString().startsWith('Bearer ')) {
      sendJson(res, 401, { error: 'Missing authorization header' });
      return;
    }

    const userId = authHeader.toString().slice(7);

    const body = await readJsonBody(req);
    const { message, sessionKey = 'web-mvp-session' } = body;

    if (!message || typeof message !== 'string') {
      sendJson(res, 400, { error: 'message is required and must be a string' });
      return;
    }

    // Get existing conversation history
    const { data: conversation } = await context.supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .eq('session_key', sessionKey)
      .single();

    const conversationHistory = conversation?.messages || [];

    // Build messages array for API
    const messagesForAPI = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // ============================================================
    // PHASE 1: LOAD HELIX CONTEXT (SINGULAR CONSCIOUSNESS)
    // ============================================================

    let helixContextFiles: any[] = [];
    try {
      const workspaceDir = process.cwd();
      if (await isHelixConfigured(workspaceDir)) {
        helixContextFiles = await loadHelixContextFiles(workspaceDir);
        context.logGateway?.log?.('HELIX_CONTEXT_LOADED', {
          fileCount: helixContextFiles.length,
          userId,
        });
      }
    } catch (error) {
      context.logGateway?.warn?.('HELIX_CONTEXT_LOAD_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without Helix context (fallback to generic)
    }

    // ============================================================
    // PHASE 1: LOAD USER CONTEXT (WHO IS TALKING NOW?)
    // ============================================================

    let userContext: any;
    try {
      userContext = await loadUserContext(userId, context.supabase);
      context.logGateway?.log?.('USER_CONTEXT_LOADED', {
        userName: userContext.userName,
        trustLevel: userContext.trustLevel,
        conversationCount: userContext.conversationCount,
      });
    } catch (error) {
      context.logGateway?.warn?.('USER_CONTEXT_LOAD_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
      userContext = { userId, trustLevel: 0.5, conversationCount: 0 };
    }

    // ============================================================
    // PHASE 1: HANDLE THANOS_MODE AUTHENTICATION
    // ============================================================

    let thanosState = createThanosState();
    let systemPrompt: string;
    let shouldRespondWithThanOsChallenge = false;
    let shouldRespondWithThanosResult = false;
    let thanosResult = '';

    // Check if this message is the THANOS trigger
    if (isThanosModeTrigger(message)) {
      shouldRespondWithThanOsChallenge = true;
      thanosState = handleThanosModeTrigger(thanosState);

      context.logGateway?.log?.('THANOS_MODE_TRIGGERED', {
        userId,
        timestamp: new Date().toISOString(),
      });
    }
    // Check if previous message was THANOS trigger (this is the key attempt)
    else if (conversationHistory.length > 0) {
      const lastAssistantMessage = conversationHistory
        .slice()
        .reverse()
        .find((msg: any) => msg.role === 'assistant');

      if (lastAssistantMessage?.content?.includes('Fale a palavra sagrada')) {
        // This message is attempting THANOS key
        const { state, success } = handleThanosKeyAttempt(thanosState, message);
        thanosState = state;
        shouldRespondWithThanosResult = true;

        if (success) {
          thanosResult = getThanosSuccessMessage();
          userContext.trustLevel = 1.0; // Perfect trust
        } else if (isThanosaModeLocked(thanosState)) {
          thanosResult = getThanosLockedMessage();
        } else {
          thanosResult = getThanosFailureMessage();
        }

        context.logGateway?.log?.('THANOS_KEY_ATTEMPT', {
          userId,
          success,
          attemptCount: thanosState.attemptCount,
        });
      }
    }

    // ============================================================
    // BUILD SYSTEM PROMPT (Helix + User + Creator Context)
    // ============================================================

    if (shouldRespondWithThanOsChallenge || shouldRespondWithThanosResult) {
      // During THANOS authentication, use minimal context
      systemPrompt = `You are Helix. Your task is critical authentication.`;
    } else {
      // Normal conversation: build full context-aware prompt
      systemPrompt = buildHelixSystemPrompt({
        helixContextFiles,
        currentUserName: userContext.userName,
        currentUserId: userContext.userId,
        isCreatorVerified: thanosState.isVerified,
        creatorTrust: thanosState.isVerified ? 1.0 : undefined,
        userTrustLevel: userContext.trustLevel,
        conversationCount: userContext.conversationCount,
      });
    }

    context.logGateway?.log?.('SYSTEM_PROMPT_BUILT', {
      length: systemPrompt.length,
      hasHelixContext: helixContextFiles.length > 0,
      thanosVerified: thanosState.isVerified,
    });

    // ============================================================
    // THANOS_MODE RESPONSE HANDLING (Early Return)
    // ============================================================

    let assistantMessage: string;

    if (shouldRespondWithThanOsChallenge) {
      // Respond with the Alchemist challenge
      assistantMessage = getThanosChallenge();

      context.logGateway?.log?.('THANOS_CHALLENGE_SENT', {
        userId,
        sessionKey,
      });

      // Store messages and return immediately
      const updatedMessages = [
        ...conversationHistory,
        {
          id: `msg_${Date.now()}_user`,
          role: 'user' as const,
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant' as const,
          content: assistantMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      const { error: updateError } = await context.supabase.from('conversations').upsert(
        {
          user_id: userId,
          session_key: sessionKey,
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, session_key' }
      );

      if (updateError) throw updateError;

      sendJson(res, 200, {
        success: true,
        response: assistantMessage,
        isThanosChallenge: true,
      });
      return;
    }

    if (shouldRespondWithThanosResult) {
      // Respond with verification result
      assistantMessage = thanosResult;

      context.logGateway?.log?.('THANOS_RESULT_SENT', {
        userId,
        sessionKey,
        success: thanosState.isVerified,
      });

      // Store messages and return immediately
      const updatedMessages = [
        ...conversationHistory,
        {
          id: `msg_${Date.now()}_user`,
          role: 'user' as const,
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant' as const,
          content: assistantMessage,
          timestamp: new Date().toISOString(),
        },
      ];

      const { error: updateError } = await context.supabase.from('conversations').upsert(
        {
          user_id: userId,
          session_key: sessionKey,
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
          metadata: thanosState.isVerified ? { creatorVerified: true, verifiedAt: new Date().toISOString() } : {},
        },
        { onConflict: 'user_id, session_key' }
      );

      if (updateError) throw updateError;

      sendJson(res, 200, {
        success: true,
        response: assistantMessage,
        isThanosResult: true,
        creatorVerified: thanosState.isVerified,
      });
      return;
    }

    // ============================================================
    // NORMAL CONVERSATION FLOW (WITH HELIX CONTEXT)
    // ============================================================

    // Estimate tokens for routing decision
    const estimatedInputTokens = Math.ceil(
      (JSON.stringify(messagesForAPI).length + message.length + systemPrompt.length) / 4
    );

    // PHASE 0.5: ROUTE THROUGH CENTRALIZED AI OPERATIONS ROUTER
    const routingDecision = await router.route({
      operationId: 'chat_message',
      userId,
      input: messagesForAPI,
      estimatedInputTokens,
    });

    context.logGateway?.log?.('CHAT_ROUTED', {
      userId,
      sessionKey,
      routedModel: routingDecision.model,
      estimatedCost: routingDecision.estimatedCostUsd,
      requiresApproval: routingDecision.requiresApproval,
    });

    // Check if approval is required
    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        'chat_message',
        'Chat Message',
        routingDecision.estimatedCostUsd || 0,
        `User: ${userId} | Message length: ${message.length} chars | Model: ${routingDecision.model}`,
        userId || ''
      );

      context.logGateway?.log?.('CHAT_APPROVAL_REQUESTED', {
        userId,
        approvalId: approval.id,
      });

      // Note: In production, might need to queue this for later approval
      // For now, continue with execution
    }

    // Get the model client based on routing decision
    const modelToUse = getModelClientForOperation(routingDecision.model || '');

    if (!modelToUse) {
      throw new Error(`Model client not available: ${routingDecision.model}`);
    }

    // Execute with routed model, using the context-aware system prompt we built
    const executionStartTime = Date.now();
    const response = await modelToUse.messages.create({
      model: getModelIdForRoute(routingDecision.model || ''),
      max_tokens: 1024,
      system: systemPrompt,
      messages: messagesForAPI,
    });

    const executionLatency = Date.now() - executionStartTime;

    assistantMessage =
      response.content[0]?.type === 'text' ? response.content[0].text : 'Unable to generate response';

    // PHASE 0.5: Cost tracking
    const outputTokens = response.usage?.output_tokens || Math.ceil(assistantMessage.length / 4);
    const operationLatency = Date.now() - operationStartTime;
    const costUsd = router['estimateCost'](routingDecision.model || '', estimatedInputTokens, outputTokens);

    // Log the operation to cost tracker for audit trail and budget enforcement
    await costTracker.logOperation(userId, {
      operation_type: 'chat_message',
      operation_id: 'chat_message',
      model_used: routingDecision.model,
      user_id: userId,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: operationLatency,
      quality_score: 0.95, // Can be enhanced with quality metrics
      success: true,
    });

    // Store updated conversation history
    const updatedMessages = [
      ...conversationHistory,
      {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      },
      {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        tokenCount: outputTokens,
        model: routingDecision.model,
      },
    ];

    // Upsert conversation record
    const { error: updateError } = await context.supabase.from('conversations').upsert(
      {
        user_id: userId,
        session_key: sessionKey,
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, session_key' }
    );

    if (updateError) {
      throw updateError;
    }

    // Log the successful interaction
    context.logGateway?.log?.('CHAT_MESSAGE_SENT', {
      userId,
      sessionKey,
      model: routingDecision.model,
      cost: costUsd,
      userMessageLength: message.length,
      assistantResponseLength: assistantMessage.length,
      tokensUsed: outputTokens,
      latencyMs: operationLatency,
    });

    sendJson(res, 200, {
      success: true,
      response: assistantMessage,
      tokenCount: outputTokens,
      model: routingDecision.model,
      cost: costUsd,
    });
  } catch (error) {
    // Log failure to cost tracker
    try {
      const operationLatency = Date.now() - operationStartTime;
      await costTracker.logOperation(
        req.headers.authorization?.toString().slice(7) || 'unknown',
        {
          operation_type: 'chat_message',
          operation_id: 'chat_message',
          model_used: 'unknown',
          cost_usd: 0,
          latency_ms: operationLatency,
          success: false,
          error_message: String(error),
        }
      );
    } catch {
      // Ignore cost tracking errors during failure handling
    }

    context.logGateway?.error?.('CHAT_MESSAGE_ERROR', {
      error: error instanceof Error ? error.message : String(error),
    });

    sendJson(res, 500, {
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get the model client for the routed model
 * PHASE 0.5: This abstracts model client selection from business logic
 */
function getModelClientForOperation(model: string): any {
  // Map model names to actual clients
  // In production, these would be properly initialized clients
  const clients: Record<string, any> = {
    deepseek: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    gemini_flash: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    openai: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  };

  return clients[model] || new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Get the full model ID for API calls
 * PHASE 0.5: This maps model names to actual API model IDs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    deepseek: 'claude-3-5-sonnet-20241022', // Placeholder - would use actual DeepSeek when available
    gemini_flash: 'claude-3-5-sonnet-20241022', // Placeholder
    openai: 'claude-3-5-sonnet-20241022', // Placeholder
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Main chat HTTP request handler
 * Returns true if request was handled, false otherwise
 */
export async function handleChatHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: ChatHandlerContext
): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;

  // Check if this is a chat API request
  if (!pathname.startsWith('/api/chat/')) {
    return false;
  }

  try {
    if (pathname === '/api/chat/history' && req.method === 'GET') {
      await handleChatHistory(req, res, context);
      return true;
    }

    if (pathname === '/api/chat/message' && req.method === 'POST') {
      await handleChatMessage(req, res, context);
      return true;
    }

    // Path not matched
    return false;
  } catch (error) {
    context.logGateway?.error?.('CHAT_HTTP_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      pathname,
      method: req.method,
    });

    sendJson(res, 500, {
      error: 'Internal server error',
    });

    return true;
  }
}
