/**
 * Channel Filter Types
 *
 * Message filtering system with support for regex, keywords, sender, and time-based filtering.
 * Filters are evaluated BEFORE messages are routed to agents.
 */

export type FilterType = 'regex' | 'keyword' | 'sender' | 'time' | 'frequency';
export type FilterAction = 'block' | 'allow' | 'route' | 'flag';
export type TimeRange = {
  startHour: number; // 0-23
  endHour: number; // 0-23
  daysOfWeek?: number[]; // 0-6 (Sun-Sat)
};

/**
 * Single message filter
 */
export interface MessageFilter {
  id: string;
  name: string;
  enabled: boolean;
  type: FilterType;
  pattern: string; // Regex pattern, keyword, sender ID, etc.
  action: FilterAction;
  routeToAgent?: string; // If action is 'route'
  priority: number; // Higher = evaluated first
  caseSensitive?: boolean;
  wholeWordsOnly?: boolean;
  maxMatches?: number; // For keyword filter, stop after N matches
  timeWindow?: TimeRange;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Filter evaluation result
 */
export interface FilterEvaluationResult {
  matched: boolean;
  action: FilterAction;
  matchedFilter?: MessageFilter;
  reason: string;
  confidence: number; // 0.0-1.0
  metadata?: Record<string, unknown>;
}

/**
 * Filter decision log entry
 */
export interface FilterDecision {
  id: string;
  timestamp: number;
  channelId: string;
  messageId: string;
  sender: string;
  content: string; // First 500 chars
  result: FilterEvaluationResult;
  responseTimeMs: number;
}

/**
 * Filter statistics
 */
export interface FilterStats {
  totalEvaluated: number;
  totalBlocked: number;
  totalAllowed: number;
  totalRouted: number;
  totalFlagged: number;
  avgResponseTimeMs: number;
  mostCommonFilters: Array<{
    filterId: string;
    name: string;
    matchCount: number;
  }>;
}

/**
 * Regex timeout configuration
 */
export const REGEX_TIMEOUT_MS = 100;

/**
 * Common filter presets
 */
export const FILTER_PRESETS = {
  spam: {
    name: 'Spam Filter',
    type: 'regex' as const,
    pattern: '/(casino|lottery|prize|winner|claim|urgent|verify|confirm|update)/gi',
    action: 'block' as const,
    caseSensitive: false,
  },
  profanity: {
    name: 'Profanity Filter',
    type: 'keyword' as const,
    pattern: 'profanity_list', // References predefined list
    action: 'flag' as const,
  },
  marketing: {
    name: 'Marketing Filter',
    type: 'regex' as const,
    pattern: '/(buy now|click here|limited time|exclusive offer)/gi',
    action: 'flag' as const,
  },
  urgent: {
    name: 'Urgent Flag',
    type: 'keyword' as const,
    pattern: 'urgent,emergency,critical',
    action: 'flag' as const,
  },
} as const;
