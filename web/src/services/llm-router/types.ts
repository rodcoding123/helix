/**
 * LLM Router Types
 * Type definitions for Phase 8 intelligence operations routing
 */

export interface LLMModel {
  id: 'claude-opus-4.5' | 'deepseek-v3.2' | 'gemini-2.0-flash';
  name: string;
  provider: 'anthropic' | 'deepseek' | 'google';
  costPerMTokenInput: number;
  costPerMTokenOutput: number;
  maxContextWindow: number;
  maxOutputTokens: number;
}

export interface Operation {
  id: string;
  name: string;
  description: string;
  primaryModel: LLMModel['id'];
  fallbackModel?: LLMModel['id'];
  costCriticality: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCostUsd: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  enabled: boolean;
}

export interface RoutingRequest {
  userId: string;
  operationId: string;
  input?: unknown;
  estimatedInputTokens?: number;
  requestMetadata?: Record<string, unknown>;
}

export interface RoutingDecision {
  operationId: string;
  selectedModel: LLMModel['id'];
  estimatedCostUsd: number;
  requiresApproval: boolean;
  approvalReason?: string;
  budgetStatus: 'ok' | 'warning' | 'exceeded';
  isFeatureEnabled: boolean;
  timestamp: string;
}

export interface CostEstimate {
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  estimatedLatencyMs: number;
}

export interface ExecutionResult {
  operationLogId: string;
  success: boolean;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  result?: unknown;
  error?: string;
}

export interface BudgetInfo {
  userId: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  currentSpendToday: number;
  currentSpendMonth: number;
  operationsToday: number;
  operationsMonth: number;
  warningThresholdPercentage: number;
  budgetStatus: 'ok' | 'warning' | 'exceeded';
}

export interface OperationMetrics {
  operationId: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgCostUsd: number;
  avgLatencyMs: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  successRate: number;
}

export interface ProviderConfig {
  name: 'anthropic' | 'deepseek' | 'google';
  apiKey: string;
  baseUrl?: string;
  timeout: number;
  maxRetries: number;
}

// Intelligence Operation Specific Types

export interface EmailComposeRequest {
  userId: string;
  context: string;
  tone: 'professional' | 'casual' | 'formal';
  maxLength: number;
}

export interface EmailClassifyRequest {
  userId: string;
  emailContent: string;
  emailFrom: string;
  emailSubject: string;
}

export interface EmailClassifyResult {
  category: string;
  importance: 'high' | 'medium' | 'low';
  suggestedAction: string;
  metadata: Record<string, unknown>;
}

export interface EmailRespondRequest {
  userId: string;
  emailContent: string;
  senderEmail: string;
  senderName: string;
  userContext?: string;
}

export interface CalendarPrepRequest {
  userId: string;
  eventId: string;
  eventTitle: string;
  attendees: string[];
  eventStartTime: Date;
  recentEmails?: string[];
  relatedTasks?: string[];
}

export interface CalendarTimeRequest {
  userId: string;
  attendeeEmails: string[];
  duration: number; // minutes
  dateRange: { start: Date; end: Date };
  preferences?: {
    preferredTimes?: string[];
    avoidTimeBlocks?: Array<{ start: string; end: string }>;
    timezone?: string;
  };
}

export interface TaskPrioritizeRequest {
  userId: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    dueDate?: Date;
    estimatedHours?: number;
  }>;
  context?: string;
}

export interface TaskBreakdownRequest {
  userId: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  timeline?: string;
}

export interface TaskBreakdownResult {
  subtasks: Array<{
    title: string;
    description: string;
    estimatedHours: number;
    successCriteria: string[];
  }>;
}

export interface AnalyticsSummaryRequest {
  userId: string;
  weekStartDate: Date;
  emailCount: number;
  tasksCompleted: number;
  meetingsAttended: number;
  focusTimeHours: number;
  recentActivities: string[];
}

export interface AnalyticsAnomalyRequest {
  userId: string;
  currentWeekMetrics: {
    emailCount: number;
    tasksCompleted: number;
    meetingHours: number;
    focusTimeHours: number;
  };
  baselineMetrics: {
    avgEmailCount: number;
    avgTasksCompleted: number;
    avgMeetingHours: number;
    avgFocusTimeHours: number;
  };
}

export interface AnomalyResult {
  hasAnomaly: boolean;
  anomalies: Array<{
    metric: string;
    currentValue: number;
    baselineValue: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}
