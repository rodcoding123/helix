/**
 * Retry Manager - Phase 5
 *
 * Implements exponential backoff with jitter for transient failures.
 * Classifies errors as transient (retriable) or terminal (not retriable).
 */

export type ErrorType = 'transient' | 'terminal';

export interface RetryHistory {
  operationId: string;
  attempts: number;
  lastErrorType: ErrorType;
  totalDelayMs: number;
}

const BASE_DELAY_MS = 100;
const MAX_DELAY_MS = 10000;
const MAX_RETRIES_TRANSIENT = 5;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_RETRIES_TERMINAL = 0;
const JITTER_PERCENT = 0.2; // ±20%

// Error keywords that indicate transient errors (retriable)
const TRANSIENT_KEYWORDS = ['timeout', 'rate_limit', 'temporarily unavailable', 'connection reset'];

// Error keywords that indicate terminal errors (not retriable)
const TERMINAL_KEYWORDS = [
  'unauthorized',
  'forbidden',
  'not_found',
  'invalid',
  'authentication failed',
];

export class RetryManager {
  private retryHistory: Map<string, RetryHistory> = new Map();

  /**
   * Classify error as transient or terminal
   */
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    // Check terminal first (higher priority)
    for (const keyword of TERMINAL_KEYWORDS) {
      if (message.includes(keyword)) {
        return 'terminal';
      }
    }

    // Check transient
    for (const keyword of TRANSIENT_KEYWORDS) {
      if (message.includes(keyword)) {
        return 'transient';
      }
    }

    // Default to transient (safe to retry unknown errors)
    return 'transient';
  }

  /**
   * Calculate backoff delay with exponential backoff and jitter
   * Formula: min(base * 2^attempt, max) + jitter
   */
  calculateBackoffMs(attemptNumber: number): number {
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, ...
    const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attemptNumber);
    const cappedDelay = Math.min(exponentialDelay, MAX_DELAY_MS);

    // Add jitter (±20%)
    const jitterAmount = cappedDelay * JITTER_PERCENT;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;

    // Ensure result stays within bounds (0 to MAX_DELAY_MS)
    return Math.min(MAX_DELAY_MS, Math.max(0, cappedDelay + jitter));
  }

  /**
   * Determine if operation should be retried
   */
  canRetry(errorType: ErrorType, attemptNumber: number): boolean {
    if (errorType === 'terminal') {
      return false; // Never retry terminal errors
    }

    // Transient: allow up to MAX_RETRIES_TRANSIENT attempts
    return attemptNumber < MAX_RETRIES_TRANSIENT;
  }

  /**
   * Record a retry attempt
   */
  recordAttempt(operationId: string, errorType: ErrorType, delayMs: number): void {
    if (!this.retryHistory.has(operationId)) {
      this.retryHistory.set(operationId, {
        operationId,
        attempts: 0,
        lastErrorType: errorType,
        totalDelayMs: 0,
      });
    }

    const history = this.retryHistory.get(operationId)!;
    history.attempts++;
    history.lastErrorType = errorType;
    history.totalDelayMs += delayMs;
  }

  /**
   * Get retry history for operation
   */
  getRetryHistory(operationId: string): RetryHistory | null {
    return this.retryHistory.get(operationId) || null;
  }

  /**
   * Clear all retry history
   */
  clear(): void {
    this.retryHistory.clear();
  }
}
