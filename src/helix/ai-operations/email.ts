/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Email Analysis Operations - Phase 0.5
 *
 * Centralized email analysis with routing, cost tracking, and approval gates.
 * Handles email metadata extraction, sentiment analysis, and categorization.
 *
 * Note: ESLint exceptions used for staging. Supabase types will be properly generated in production.
 */

import { router } from './router.js';
import { costTracker } from './cost-tracker.js';
import { approvalGate } from './approval-gate.js';

/**
 * Email analysis configuration
 */
export interface EmailAnalysisConfig {
  operationId: string;
  userId?: string;
  emailFrom: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  analysisType?: 'sentiment' | 'categorization' | 'extraction' | 'full';
  metadata?: Record<string, unknown>;
}

/**
 * Email analysis result
 */
export interface EmailAnalysisResult {
  success: boolean;
  sentiment?: string;
  category?: string;
  extractedData?: Record<string, unknown>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  metadata: {
    routed: boolean;
    requiresApproval: boolean;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    quality_score: number;
    analysisType: string;
  };
}

/**
 * Analyze email with centralized routing and cost tracking
 *
 * Pattern: Estimate Tokens → Route → Approve → Execute → Track Cost
 */
export async function analyzeEmail(config: EmailAnalysisConfig): Promise<EmailAnalysisResult> {
  const startTime = Date.now();

  try {
    // Step 1: Estimate tokens for routing decision
    // Email token estimation: headers (100) + body (length/4) + analysis (500)
    const headerTokens = 100;
    const bodyTokens = Math.ceil(config.emailBody.length / 4);
    const analysisTokens = 500;
    const estimatedInputTokens = headerTokens + bodyTokens;
    const estimatedOutputTokens = analysisTokens;

    // Step 2: Route through centralized router
    const routingDecision = await router.route({
      operationId: config.operationId,
      userId: config.userId,
      input: [{ role: 'user' as const, content: `Analyze email: ${config.emailSubject}` }],
      estimatedInputTokens,
    });

    // Step 3: Check if approval is required (HIGH criticality operations)
    let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved';

    if (routingDecision.requiresApproval) {
      const approval = await approvalGate.requestApproval(
        config.operationId,
        `Email Analysis: ${config.operationId}`,
        routingDecision.estimatedCostUsd,
        `From: ${config.emailFrom} | Subject: ${config.emailSubject.substring(0, 50)}...`
      );

      approvalStatus = approval.status;

      if (approval.status === 'rejected') {
        return {
          success: false,
          sentiment: undefined,
          category: undefined,
          model: routingDecision.model,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: Date.now() - startTime,
          metadata: {
            routed: true,
            requiresApproval: true,
            approvalStatus: 'rejected',
            quality_score: 0,
            analysisType: config.analysisType || 'full',
          },
        };
      }
    }

    // Step 4: Get model client for routed model
    const modelClient = getModelClientForOperation(routingDecision.model);
    const modelId = getModelIdForRoute(routingDecision.model);

    // Step 5: Execute with routed model (Email analysis API call)
    const analysisPrompt = buildAnalysisPrompt(config);
    const message = await modelClient.messages.create({
      model: modelId,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    });

    // Step 6: Extract response
    const analysisText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const { sentiment, category, extractedData } = parseAnalysisResponse(analysisText);

    // Step 7: Calculate actual cost
    const outputTokens = message.usage?.output_tokens || estimatedOutputTokens;
    const totalLatency = Date.now() - startTime;
    const costUsd = router['estimateCost'](
      routingDecision.model,
      estimatedInputTokens,
      outputTokens
    );

    // Step 8: Log operation to cost tracker
    await costTracker.logOperation(config.userId || 'system', {
      operation_type: 'email_analysis',
      operation_id: config.operationId,
      model_used: routingDecision.model,
      user_id: config.userId,
      input_tokens: estimatedInputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      latency_ms: totalLatency,
      quality_score: 0.82, // Email analysis quality baseline
      success: true,
    });

    return {
      success: true,
      sentiment,
      category,
      extractedData,
      model: routingDecision.model,
      inputTokens: estimatedInputTokens,
      outputTokens,
      costUsd,
      latencyMs: totalLatency,
      metadata: {
        routed: true,
        requiresApproval: routingDecision.requiresApproval,
        approvalStatus,
        quality_score: 0.82,
        analysisType: config.analysisType || 'full',
      },
    };
  } catch (error) {
    const totalLatency = Date.now() - startTime;

    // Log failure
    console.error('Email analysis failed:', {
      operationId: config.operationId,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: totalLatency,
    });

    // Attempt to log the failure to cost tracker
    try {
      await costTracker.logOperation(config.userId || 'system', {
        operation_type: 'email_analysis',
        operation_id: config.operationId,
        model_used: 'unknown',
        user_id: config.userId,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms: totalLatency,
        quality_score: 0,
        success: false,
      });
    } catch (_trackingError) {
      console.error('Failed to log email analysis failure:', _trackingError);
    }

    throw error;
  }
}

/**
 * Build analysis prompt based on analysis type
 */
function buildAnalysisPrompt(config: EmailAnalysisConfig): string {
  const analysisType = config.analysisType || 'full';
  const emailContent = `
From: ${config.emailFrom}
To: ${config.emailTo}
Subject: ${config.emailSubject}

${config.emailBody}
`;

  switch (analysisType) {
    case 'sentiment':
      return `Analyze the sentiment of this email. Respond with: POSITIVE, NEGATIVE, or NEUTRAL.\n\n${emailContent}`;
    case 'categorization':
      return `Categorize this email into one of: PROMOTIONAL, TRANSACTIONAL, SOCIAL, NOTIFICATION, or OTHER.\n\n${emailContent}`;
    case 'extraction':
      return `Extract key information from this email (dates, names, actions, amounts). Respond in JSON format.\n\n${emailContent}`;
    case 'full':
    default:
      return `Perform a full analysis of this email including:
1. Sentiment (POSITIVE/NEGATIVE/NEUTRAL)
2. Category (PROMOTIONAL/TRANSACTIONAL/SOCIAL/NOTIFICATION/OTHER)
3. Key extracted information (dates, names, actions)
4. Priority level (HIGH/MEDIUM/LOW)

${emailContent}`;
  }
}

/**
 * Parse analysis response into structured data
 */
function parseAnalysisResponse(response: string): {
  sentiment?: string;
  category?: string;
  extractedData?: Record<string, unknown>;
} {
  const result: {
    sentiment?: string;
    category?: string;
    extractedData?: Record<string, unknown>;
  } = {};

  // Simple pattern matching for sentiment
  if (response.includes('POSITIVE')) {
    result.sentiment = 'positive';
  } else if (response.includes('NEGATIVE')) {
    result.sentiment = 'negative';
  } else if (response.includes('NEUTRAL')) {
    result.sentiment = 'neutral';
  }

  // Simple pattern matching for category
  const categories = ['PROMOTIONAL', 'TRANSACTIONAL', 'SOCIAL', 'NOTIFICATION', 'OTHER'];
  for (const category of categories) {
    if (response.includes(category)) {
      result.category = category.toLowerCase();
      break;
    }
  }

  // Try to extract JSON data if present
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      result.extractedData = JSON.parse(jsonMatch[0]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      result.extractedData = { raw: response };
    }
  }

  return result;
}

/**
 * Get model client for operation
 * Phase 0.5: Uses Anthropic SDK with email analysis placeholder
 */
interface ModelClientResponse {
  content: Array<{ type: string; text: string }>;
  usage: { output_tokens: number };
}

interface ModelClient {
  messages: {
    create: (params: Record<string, unknown>) => Promise<ModelClientResponse>;
  };
}

function getModelClientForOperation(_model: string): ModelClient {
  // In production Phase 3, this would use specialized email analysis APIs
  // For now, return a mock client compatible with Anthropic SDK interface
  return {
    messages: {
      create: async (_params: Record<string, unknown>): Promise<ModelClientResponse> => {
        // Placeholder implementation - in production this would call actual email analysis API
        await Promise.resolve(); // Placeholder await
        return {
          content: [
            {
              type: 'text' as const,
              text: 'POSITIVE sentiment, TRANSACTIONAL category',
            },
          ],
          usage: { output_tokens: 50 },
        };
      },
    },
  };
}

/**
 * Get model ID for API calls
 * Phase 0.5: Uses Claude as placeholder for email analysis
 * Phase 3: Will use actual email analysis model IDs
 */
function getModelIdForRoute(model: string): string {
  const modelIds: Record<string, string> = {
    email_analyzer: 'email-analysis-v1', // Placeholder - Phase 3: actual email API
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-3-5-sonnet-20241022',
    opus: 'claude-opus-4-1-20250805',
  };

  return modelIds[model] || 'claude-3-5-sonnet-20241022';
}

/**
 * Batch analyze multiple emails
 */
export async function analyzeBatchEmails(
  configs: EmailAnalysisConfig[]
): Promise<EmailAnalysisResult[]> {
  const results: EmailAnalysisResult[] = [];

  for (const config of configs) {
    try {
      const result = await analyzeEmail(config);
      results.push(result);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      results.push({
        success: false,
        sentiment: undefined,
        category: undefined,
        model: 'unknown',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        metadata: {
          routed: false,
          requiresApproval: false,
          quality_score: 0,
          analysisType: config.analysisType || 'full',
        },
      });
    }
  }

  return results;
}

/**
 * Get total cost for email analysis operations
 */
export async function getEmailAnalysisOperationsCost(_userId: string): Promise<{
  totalCost: number;
  operationCount: number;
  lastUpdated: string;
}> {
  try {
    // This would query the cost_budgets table for the user
    // Implementation depends on Supabase integration
    await Promise.resolve(); // Placeholder await
    return {
      totalCost: 0,
      operationCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get email analysis operations cost:', error);
    throw error;
  }
}
