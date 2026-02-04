/**
 * Phase 8: Email Intelligence Service
 * Integrates with Phase 0.5 AIOperationRouter for composition, classification, and response suggestions
 *
 * Cost Tracking:
 * - email-compose: ~$0.0015/call × 10/day = $0.015/day
 * - email-classify: ~$0.0006/call × 20/day = $0.012/day
 * - email-respond: ~$0.0012/call × 5/day = $0.006/day
 */

import { aiRouter } from './router-client';
import { getProviderClient, AIProviderClient } from '../../lib/ai-provider-client';
import type { AIOperationRouter } from '../../lib/ai-router';

interface EmailComposeRequest {
  userId: string;
  accountId: string;
  subject: string;
  recipientContext?: string;
  draftStart?: string;
}

interface EmailComposeResponse {
  suggestions: string[];
  tone?: 'professional' | 'casual' | 'formal';
  estimatedLength?: number;
}

interface EmailClassifyRequest {
  userId: string;
  accountId: string;
  emailId: string;
  subject: string;
  body: string;
  from: string;
}

interface EmailClassifyResponse {
  category: 'personal' | 'work' | 'promotional' | 'notification' | 'other';
  priority: 'high' | 'medium' | 'low';
  urgency: 'immediate' | 'soon' | 'normal' | 'low';
  suggestedLabel?: string;
  metadata: Record<string, unknown>;
}

interface EmailRespondRequest {
  userId: string;
  accountId: string;
  emailId: string;
  originalSubject: string;
  originalBody: string;
  fromAddress: string;
  previousResponses?: string[];
}

interface EmailRespondResponse {
  suggestions: Array<{
    response: string;
    tone: string;
    length: 'short' | 'medium' | 'long';
  }>;
}

/**
 * Email Composition Assistance
 * Helps draft new emails with AI suggestions
 */
export async function suggestEmailComposition(
  request: EmailComposeRequest
): Promise<EmailComposeResponse> {
  // Estimate tokens for routing
  const estimatedTokens = Math.ceil(
    (request.subject.length + (request.draftStart?.length || 0) + (request.recipientContext?.length || 0)) / 4
  );

  // Route through Phase 0.5 unified router
  const routing = await aiRouter.route({
    operationId: 'email-compose',
    userId: request.userId,
    input: {
      subject: request.subject,
      context: request.recipientContext,
      draft: request.draftStart,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildEmailComposePrompt(request),
    maxTokens: 500,
  });

  // Parse response
  return parseEmailComposeResponse(response);
}

/**
 * Email Classification & Metadata Extraction
 * Auto-categorizes emails and extracts metadata
 */
export async function classifyEmail(
  request: EmailClassifyRequest
): Promise<EmailClassifyResponse> {
  // Estimate tokens
  const estimatedTokens = Math.ceil(
    (request.subject.length + request.body.length + request.from.length) / 4
  );

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'email-classify',
    userId: request.userId,
    input: {
      subject: request.subject,
      body: request.body.substring(0, 2000), // Truncate for efficiency
      from: request.from,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildEmailClassifyPrompt(request),
    maxTokens: 200,
  });

  // Parse response
  return parseEmailClassifyResponse(response);
}

/**
 * Email Response Suggestions
 * Generates suggested replies to incoming emails
 */
export async function suggestEmailResponse(
  request: EmailRespondRequest
): Promise<EmailRespondResponse> {
  // Estimate tokens
  const estimatedTokens = Math.ceil(
    (request.originalSubject.length +
      request.originalBody.length +
      (request.previousResponses?.join('').length || 0)) /
      4
  );

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'email-respond',
    userId: request.userId,
    input: {
      subject: request.originalSubject,
      body: request.originalBody.substring(0, 2000),
      from: request.fromAddress,
      history: request.previousResponses || [],
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildEmailRespondPrompt(request),
    maxTokens: 1000,
  });

  // Parse response
  return parseEmailRespondResponse(response);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildEmailComposePrompt(request: EmailComposeRequest): string {
  return `You are helping draft an email.
Subject: ${request.subject}
${request.recipientContext ? `Context about recipient: ${request.recipientContext}` : ''}
${request.draftStart ? `Email draft so far: ${request.draftStart}` : ''}

Generate 3 different ways to complete or improve this email. Provide natural, professional continuations.`;
}

function buildEmailClassifyPrompt(request: EmailClassifyRequest): string {
  return `Classify this email into one category: personal, work, promotional, notification, or other.
Also assign priority (high/medium/low) and urgency (immediate/soon/normal/low).
Suggest a label if appropriate.

From: ${request.from}
Subject: ${request.subject}
Body: ${request.body}

Return JSON: { "category": "...", "priority": "...", "urgency": "...", "suggestedLabel": "..." }`;
}

function buildEmailRespondPrompt(request: EmailRespondRequest): string {
  return `Generate 3 suggested responses to this email.
Vary the tone: one professional, one friendly, one brief.

From: ${request.fromAddress}
Subject: ${request.originalSubject}
Body: ${request.originalBody}
${request.previousResponses?.length ? `Previous responses in thread: ${request.previousResponses.join('\n---\n')}` : ''}

For each response, provide the full email text and indicate the tone.`;
}

function parseEmailComposeResponse(response: string): EmailComposeResponse {
  try {
    // Parse LLM response into structured format
    const suggestions = response
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .slice(0, 3);

    return {
      suggestions,
      tone: 'professional',
      estimatedLength: suggestions.reduce((sum, s) => sum + s.length, 0) / suggestions.length,
    };
  } catch {
    return { suggestions: [response], tone: 'professional' };
  }
}

function parseEmailClassifyResponse(response: string): EmailClassifyResponse {
  try {
    const json = JSON.parse(response);
    return {
      category: json.category || 'other',
      priority: json.priority || 'medium',
      urgency: json.urgency || 'normal',
      suggestedLabel: json.suggestedLabel,
      metadata: json,
    };
  } catch {
    return {
      category: 'other',
      priority: 'medium',
      urgency: 'normal',
      metadata: {},
    };
  }
}

function parseEmailRespondResponse(response: string): EmailRespondResponse {
  const suggestions = response
    .split('---')
    .map((block) => ({
      response: block.trim(),
      tone: 'professional' as const,
      length: 'medium' as const,
    }))
    .filter((s) => s.response.length > 50)
    .slice(0, 3);

  return { suggestions };
}

async function callAIModel(
  routing: Awaited<ReturnType<AIOperationRouter['route']>>,
  options: { prompt: string; maxTokens: number }
): Promise<string> {
  const provider = getProviderClient();

  try {
    const response = await provider.callModel(routing, {
      model: routing.model as any,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
      temperature: 0.7,
      systemPrompt: 'You are a helpful email assistant for professionals. Provide practical, clear advice.',
    });

    return response.content;
  } catch (error) {
    console.error(`Email intelligence error with ${routing.model}:`, error);
    // Fallback: return placeholder
    return 'Email assistance unavailable. Please try again.';
  }
}
