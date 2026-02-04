/**
 * Phase 8: Analytics Intelligence Service
 * Integrates with Phase 0.5 AIOperationRouter for weekly summaries and anomaly detection
 *
 * Cost Tracking:
 * - analytics-summary: ~$0.0300/call × 1/week = $0.004/day
 * - analytics-anomaly: ~$0.0009/call × 1/week = $0.0013/day
 */

import { aiRouter } from './router-client';
import { getProviderClient } from '../../lib/ai-provider-client';
import type { AIOperationRouter } from '../../lib/ai-router';

interface UsageMetrics {
  emailsProcessed: number;
  emailsComposed: number;
  emailsResponded: number;
  averageResponseTime: number; // in minutes
  calendarEventsAttended: number;
  calendarTimeOptimized: number;
  tasksCompleted: number;
  taskBreakdownsGenerated: number;
  totalTimeSpent: number; // in hours
}

interface WeeklySummaryRequest {
  userId: string;
  startDate: Date;
  endDate: Date;
  metrics: UsageMetrics;
  previousWeeks?: Array<{ date: Date; metrics: UsageMetrics }>;
  goals?: string[];
}

interface WeeklySummaryResponse {
  keyHighlights: string[];
  performanceMetrics: {
    productivity: number; // 0-100
    emailEfficiency: number;
    calendarUtilization: number;
    taskCompletion: number;
  };
  insights: string[];
  recommendations: string[];
  topActivityTime: string;
  comparison: {
    vsLastWeek: string;
    vsFourWeekAverage: string;
  };
}

interface AnomalyDetectionRequest {
  userId: string;
  currentMetrics: UsageMetrics;
  historicalData: Array<{ date: Date; metrics: UsageMetrics }>;
  baselineWeeks?: number; // How many weeks to consider baseline
}

interface AnomalyResponse {
  anomaliesDetected: Array<{
    metric: string;
    value: number;
    expectedRange: [number, number];
    severity: 'low' | 'medium' | 'high';
    explanation: string;
  }>;
  patterns: Array<{
    pattern: string;
    occurrenceCount: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  recommendations: string[];
}

/**
 * Generate weekly analytics summary
 * Scheduled for Sunday 6pm, compares metrics to previous weeks
 */
export async function generateWeeklySummary(request: WeeklySummaryRequest): Promise<WeeklySummaryResponse> {
  // Estimate tokens from metrics content
  const metricsSize = Object.values(request.metrics).reduce((sum, v) => sum + String(v).length, 0);
  const estimatedTokens = Math.ceil((metricsSize + (request.goals?.join('').length || 0)) / 4);

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'analytics-summary',
    userId: request.userId,
    input: {
      period: {
        start: request.startDate.toISOString(),
        end: request.endDate.toISOString(),
      },
      metrics: request.metrics,
      previousWeeks: request.previousWeeks?.map((w) => ({
        date: w.date.toISOString(),
        metrics: w.metrics,
      })),
      goals: request.goals,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildWeeklySummaryPrompt(request),
    maxTokens: 1500,
  });

  // Parse response
  return parseWeeklySummaryResponse(response);
}

/**
 * Detect unusual patterns in user's work metrics
 * Identifies spikes, drops, or behavioral changes
 */
export async function detectAnomalies(request: AnomalyDetectionRequest): Promise<AnomalyResponse> {
  // Estimate tokens from historical data
  const dataSize = request.historicalData.reduce(
    (sum, h) => sum + Object.values(h.metrics).reduce((s, v) => s + String(v).length, 0),
    0
  );
  const estimatedTokens = Math.ceil((dataSize + String(request.currentMetrics).length) / 4);

  // Route through Phase 0.5
  const routing = await aiRouter.route({
    operationId: 'analytics-anomaly',
    userId: request.userId,
    input: {
      currentMetrics: request.currentMetrics,
      historicalData: request.historicalData.map((h) => ({
        date: h.date.toISOString(),
        metrics: h.metrics,
      })),
      baselineWeeks: request.baselineWeeks || 4,
    },
    estimatedInputTokens: estimatedTokens,
  });

  // Call the routed model
  const response = await callAIModel(routing, {
    prompt: buildAnomalyDetectionPrompt(request),
    maxTokens: 1000,
  });

  // Parse response
  return parseAnomalyResponse(response);
}

/**
 * Schedule weekly summary generation
 * Runs automatically every Sunday at 6pm user time
 */
export async function initializeWeeklyAnalyticsScheduler(userId: string): Promise<void> {
  // Calculate next Sunday 6pm
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setDate(nextSunday.getDate() + ((0 - nextSunday.getDay() + 7) % 7) || 7);
  nextSunday.setHours(18, 0, 0, 0);

  const timeUntilNext = nextSunday.getTime() - now.getTime();

  // Schedule the summary
  setTimeout(async () => {
    try {
      // Get previous week's metrics
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      const metrics = await getWeeklyMetrics(userId, startDate, endDate);
      const previousWeeks = await getPreviousWeeksMetrics(userId, 4);

      const summary = await generateWeeklySummary({
        userId,
        startDate,
        endDate,
        metrics,
        previousWeeks,
      });

      // Store and notify
      await storeWeeklySummary(userId, summary);
      notifyWeeklySummary(userId, summary);

      // Reschedule for next week
      initializeWeeklyAnalyticsScheduler(userId);
    } catch (error) {
      console.error('Weekly analytics scheduler error:', error);
    }
  }, timeUntilNext);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildWeeklySummaryPrompt(request: WeeklySummaryRequest): string {
  return `Generate a weekly analytics summary for the user's productivity.

Week: ${request.startDate.toDateString()} - ${request.endDate.toDateString()}

This Week's Metrics:
- Emails processed: ${request.metrics.emailsProcessed}
- Emails composed: ${request.metrics.emailsComposed}
- Avg email response time: ${request.metrics.averageResponseTime} minutes
- Calendar events attended: ${request.metrics.calendarEventsAttended}
- Tasks completed: ${request.metrics.tasksCompleted}
- Total time in system: ${request.metrics.totalTimeSpent} hours

${
  request.previousWeeks && request.previousWeeks.length > 0
    ? `Previous weeks: ${request.previousWeeks
        .map((w) => `${w.date.toDateString()}: ${w.metrics.tasksCompleted} tasks, ${w.metrics.emailsProcessed} emails`)
        .join('; ')}`
    : ''
}

${request.goals ? `User Goals: ${request.goals.join(', ')}` : ''}

Provide:
1. Key highlights (2-3 achievements)
2. Performance scores (0-100 for: productivity, email efficiency, calendar utilization, task completion)
3. Key insights (3-4 observations)
4. Recommendations (2-3 actionable suggestions)
5. Top activity time (when most productive)
6. Comparison to last week and 4-week average

Format as JSON.`;
}

function buildAnomalyDetectionPrompt(request: AnomalyDetectionRequest): string {
  const avgMetrics = calculateAverageMetrics(request.historicalData);

  return `Detect anomalies in this user's work patterns.

Current Week's Metrics:
- Emails processed: ${request.currentMetrics.emailsProcessed}
- Tasks completed: ${request.currentMetrics.tasksCompleted}
- Total time spent: ${request.currentMetrics.totalTimeSpent} hours
- Email response time: ${request.currentMetrics.averageResponseTime} minutes

Baseline (${request.baselineWeeks || 4} weeks average):
- Emails processed: ${avgMetrics.emailsProcessed}
- Tasks completed: ${avgMetrics.tasksCompleted}
- Total time spent: ${avgMetrics.totalTimeSpent} hours
- Email response time: ${avgMetrics.averageResponseTime} minutes

Identify:
1. Any metrics that deviate significantly (>20% from baseline)
2. New patterns or trends
3. Potential issues or opportunities
4. Recommendations

Format as JSON with fields: anomalies, patterns, recommendations.
For anomalies: metric, value, expectedRange, severity (low/medium/high), explanation.`;
}

function parseWeeklySummaryResponse(response: string): WeeklySummaryResponse {
  try {
    const parsed = JSON.parse(response);
    return {
      keyHighlights: parsed.keyHighlights || [],
      performanceMetrics: parsed.performanceMetrics || {
        productivity: 75,
        emailEfficiency: 70,
        calendarUtilization: 65,
        taskCompletion: 80,
      },
      insights: parsed.insights || [],
      recommendations: parsed.recommendations || [],
      topActivityTime: parsed.topActivityTime || 'morning',
      comparison: parsed.comparison || {
        vsLastWeek: 'Similar productivity',
        vsFourWeekAverage: 'Slight increase',
      },
    };
  } catch {
    return {
      keyHighlights: ['Week completed successfully'],
      performanceMetrics: { productivity: 75, emailEfficiency: 70, calendarUtilization: 65, taskCompletion: 80 },
      insights: ['Steady work patterns maintained'],
      recommendations: ['Continue current pace'],
      topActivityTime: 'morning',
      comparison: { vsLastWeek: 'Similar', vsFourWeekAverage: 'Average' },
    };
  }
}

function parseAnomalyResponse(response: string): AnomalyResponse {
  try {
    const parsed = JSON.parse(response);
    return {
      anomaliesDetected: parsed.anomalies || [],
      patterns: parsed.patterns || [],
      recommendations: parsed.recommendations || [],
    };
  } catch {
    return {
      anomaliesDetected: [],
      patterns: [],
      recommendations: [],
    };
  }
}

function calculateAverageMetrics(historicalData: Array<{ date: Date; metrics: UsageMetrics }>): UsageMetrics {
  const count = historicalData.length;
  if (count === 0) {
    return {
      emailsProcessed: 0,
      emailsComposed: 0,
      emailsResponded: 0,
      averageResponseTime: 0,
      calendarEventsAttended: 0,
      calendarTimeOptimized: 0,
      tasksCompleted: 0,
      taskBreakdownsGenerated: 0,
      totalTimeSpent: 0,
    };
  }

  const sum = historicalData.reduce(
    (acc, h) => ({
      emailsProcessed: acc.emailsProcessed + h.metrics.emailsProcessed,
      emailsComposed: acc.emailsComposed + h.metrics.emailsComposed,
      emailsResponded: acc.emailsResponded + h.metrics.emailsResponded,
      averageResponseTime: acc.averageResponseTime + h.metrics.averageResponseTime,
      calendarEventsAttended: acc.calendarEventsAttended + h.metrics.calendarEventsAttended,
      calendarTimeOptimized: acc.calendarTimeOptimized + h.metrics.calendarTimeOptimized,
      tasksCompleted: acc.tasksCompleted + h.metrics.tasksCompleted,
      taskBreakdownsGenerated: acc.taskBreakdownsGenerated + h.metrics.taskBreakdownsGenerated,
      totalTimeSpent: acc.totalTimeSpent + h.metrics.totalTimeSpent,
    }),
    {
      emailsProcessed: 0,
      emailsComposed: 0,
      emailsResponded: 0,
      averageResponseTime: 0,
      calendarEventsAttended: 0,
      calendarTimeOptimized: 0,
      tasksCompleted: 0,
      taskBreakdownsGenerated: 0,
      totalTimeSpent: 0,
    }
  );

  return {
    emailsProcessed: Math.round(sum.emailsProcessed / count),
    emailsComposed: Math.round(sum.emailsComposed / count),
    emailsResponded: Math.round(sum.emailsResponded / count),
    averageResponseTime: Math.round(sum.averageResponseTime / count),
    calendarEventsAttended: Math.round(sum.calendarEventsAttended / count),
    calendarTimeOptimized: Math.round(sum.calendarTimeOptimized / count),
    tasksCompleted: Math.round(sum.tasksCompleted / count),
    taskBreakdownsGenerated: Math.round(sum.taskBreakdownsGenerated / count),
    totalTimeSpent: Math.round((sum.totalTimeSpent / count) * 100) / 100,
  };
}

async function getWeeklyMetrics(userId: string, startDate: Date, endDate: Date): Promise<UsageMetrics> {
  // This would query the analytics database
  return {
    emailsProcessed: 0,
    emailsComposed: 0,
    emailsResponded: 0,
    averageResponseTime: 0,
    calendarEventsAttended: 0,
    calendarTimeOptimized: 0,
    tasksCompleted: 0,
    taskBreakdownsGenerated: 0,
    totalTimeSpent: 0,
  };
}

async function getPreviousWeeksMetrics(
  userId: string,
  weeks: number
): Promise<Array<{ date: Date; metrics: UsageMetrics }>> {
  // This would query historical analytics
  return [];
}

async function storeWeeklySummary(userId: string, summary: WeeklySummaryResponse): Promise<void> {
  // Store in database for persistence
}

function notifyWeeklySummary(userId: string, summary: WeeklySummaryResponse): void {
  console.log(`Weekly summary ready for ${userId}`);
  // Send notification to user
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
      temperature: 0.5,
      systemPrompt: 'You are a data analyst and productivity expert. Provide clear insights and actionable recommendations based on work metrics.',
    });

    return response.content;
  } catch (error) {
    console.error(`Analytics intelligence error with ${routing.model}:`, error);
    return 'Analytics assistance unavailable. Please try again.';
  }
}
