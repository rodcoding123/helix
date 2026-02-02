/**
 * Chat API HTTP Routes - OpenClaw HTTP Handler Pattern
 * Handles basic chat functionality for Web MVP
 *
 * Endpoints:
 * - GET /api/chat/history - Load user's chat session history
 * - POST /api/chat/message - Send message to Claude and get response
 */

import { type IncomingMessage, type ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

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

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Get existing conversation history
    const { data: conversation } = await context.supabase
      .from('conversations')
      .select('messages')
      .eq('user_id', userId)
      .eq('session_key', sessionKey)
      .single();

    const conversationHistory = conversation?.messages || [];

    // Build messages array for Claude API
    const messagesForClaude = [
      ...conversationHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system:
        "You are Helix, a helpful and thoughtful AI assistant. You remember what users share and reference it in future conversations. Be warm, authentic, and genuinely interested in helping.",
      messages: messagesForClaude,
    });

    const assistantMessage =
      response.content[0]?.type === 'text' ? response.content[0].text : 'Unable to generate response';

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
        tokenCount: response.usage?.output_tokens || 0,
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

    // Log the interaction
    context.logGateway?.log?.('CHAT_MESSAGE_SENT', {
      userId,
      sessionKey,
      userMessageLength: message.length,
      assistantResponseLength: assistantMessage.length,
      tokensUsed: response.usage?.output_tokens,
    });

    sendJson(res, 200, {
      success: true,
      response: assistantMessage,
      tokenCount: response.usage?.output_tokens,
    });
  } catch (error) {
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
