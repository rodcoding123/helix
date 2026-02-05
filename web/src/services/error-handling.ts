/**
 * Error Handling Service for Phase 8
 * Implements graceful error recovery and provider failover
 */

import { logToDiscord, logToHashChain } from './logging.js';

// MARK: - Error Types
export enum ErrorType {
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  OPERATION_DISABLED = 'OPERATION_DISABLED',
  UNKNOWN = 'UNKNOWN',
}

export interface OperationError {
  type: ErrorType;
  message: string;
  operation: string;
  provider?: string;
  statusCode?: number;
  retryable: boolean;
  timestamp: Date;
}

// MARK: - Error Detector
export class ErrorDetector {
  static detectErrorType(error: any): ErrorType {
    const message = error?.message?.toLowerCase() || '';
    const statusCode = error?.statusCode || error?.status;

    if (statusCode === 503 || statusCode === 502) {
      return ErrorType.PROVIDER_UNAVAILABLE;
    }

    if (statusCode === 429 || message.includes('rate limit')) {
      return ErrorType.RATE_LIMITED;
    }

    if (statusCode === 400 || message.includes('invalid')) {
      return ErrorType.INVALID_REQUEST;
    }

    if (message.includes('timeout') || message.includes('aborted')) {
      return ErrorType.TIMEOUT;
    }

    if (message.includes('budget') || message.includes('cost')) {
      return ErrorType.BUDGET_EXCEEDED;
    }

    if (message.includes('disabled') || message.includes('not enabled')) {
      return ErrorType.OPERATION_DISABLED;
    }

    return ErrorType.UNKNOWN;
  }

  static isRetryable(error: OperationError): boolean {
    return (
      error.type === ErrorType.PROVIDER_UNAVAILABLE ||
      error.type === ErrorType.TIMEOUT ||
      error.type === ErrorType.RATE_LIMITED
    );
  }
}

// MARK: - Error Logger
export class ErrorLogger {
  static async logError(error: OperationError): Promise<void> {
    // Discord logging
    await logToDiscord({
      type: 'operation_error',
      content: `${error.operation} failed: ${error.message}`,
      metadata: {
        errorType: error.type,
        provider: error.provider,
        statusCode: error.statusCode,
        retryable: error.retryable,
      },
      status: 'error',
    });

    // Hash chain logging for audit trail
    await logToHashChain({
      type: 'operation_error',
      data: error.message,
      metadata: {
        operation: error.operation,
        errorType: error.type,
        provider: error.provider,
        timestamp: error.timestamp.toISOString(),
      },
    });
  }

  static async logRecovery(
    operation: string,
    fallbackProvider: string
  ): Promise<void> {
    await logToDiscord({
      type: 'provider_failover',
      content: `${operation} failed, switched to ${fallbackProvider}`,
      status: 'pending',
    });
  }

  static async logSuccess(
    operation: string,
    provider: string,
    durationMs: number
  ): Promise<void> {
    await logToHashChain({
      type: 'operation_success',
      data: `${operation} completed`,
      metadata: {
        provider,
        durationMs,
      },
    });
  }
}

// MARK: - Provider Failover Handler
export interface ProviderConfig {
  name: string;
  priority: number;
  available: boolean;
  lastError?: OperationError;
  consecutiveFailures: number;
}

export class ProviderFailoverHandler {
  private providers: Map<string, ProviderConfig> = new Map();
  private readonly failureThreshold = 3;
  private readonly recoveryDelayMs = 60000; // 1 minute

  registerProvider(
    name: string,
    priority: number
  ): void {
    this.providers.set(name, {
      name,
      priority,
      available: true,
      consecutiveFailures: 0,
    });
  }

  recordSuccess(provider: string): void {
    const config = this.providers.get(provider);
    if (config) {
      config.consecutiveFailures = 0;
      config.available = true;
    }
  }

  recordFailure(provider: string, error: OperationError): void {
    const config = this.providers.get(provider);
    if (config) {
      config.lastError = error;
      config.consecutiveFailures++;

      if (config.consecutiveFailures >= this.failureThreshold) {
        config.available = false;

        // Schedule recovery attempt
        setTimeout(() => {
          config.consecutiveFailures = 0;
          config.available = true;
        }, this.recoveryDelayMs);
      }
    }
  }

  getNextAvailableProvider(): string | null {
    const available = Array.from(this.providers.values())
      .filter((p) => p.available)
      .sort((a, b) => a.priority - b.priority);

    return available.length > 0 ? available[0].name : null;
  }

  getProviderStatus(): Record<string, { available: boolean; failures: number }> {
    const status: Record<string, any> = {};

    for (const [name, config] of this.providers.entries()) {
      status[name] = {
        available: config.available,
        failures: config.consecutiveFailures,
      };
    }

    return status;
  }
}

// MARK: - Error Recovery Strategy
export class ErrorRecoveryStrategy {
  async handleProviderError(
    operation: string,
    error: any,
    primaryProvider: string,
    fallbackProvider: string,
    fallbackExecutor: () => Promise<any>
  ): Promise<any> {
    const operationError: OperationError = {
      type: ErrorDetector.detectErrorType(error),
      message: error?.message || 'Unknown error',
      operation,
      provider: primaryProvider,
      statusCode: error?.statusCode || error?.status,
      retryable: false,
      timestamp: new Date(),
    };

    operationError.retryable = ErrorDetector.isRetryable(operationError);

    // Log the error
    await ErrorLogger.logError(operationError);

    // Try fallback provider if available
    if (fallbackProvider) {
      try {
        await ErrorLogger.logRecovery(operation, fallbackProvider);
        return await fallbackExecutor();
      } catch (fallbackError) {
        const fallbackOpError: OperationError = {
          type: ErrorDetector.detectErrorType(fallbackError),
          message: fallbackError?.message || 'Fallback provider failed',
          operation,
          provider: fallbackProvider,
          statusCode: fallbackError?.statusCode || fallbackError?.status,
          retryable: false,
          timestamp: new Date(),
        };

        await ErrorLogger.logError(fallbackOpError);
        throw fallbackError;
      }
    }

    throw error;
  }

  async handlePartialFailure(
    operation: string,
    results: Array<{ item: any; success: boolean; error?: any }>
  ): Promise<any> {
    const failedItems = results.filter((r) => !r.success);

    if (failedItems.length > 0) {
      await logToDiscord({
        type: 'partial_failure',
        content: `${operation} partially failed: ${failedItems.length}/${results.length} items failed`,
        metadata: {
          totalItems: results.length,
          failedItems: failedItems.length,
          successRate: ((results.length - failedItems.length) / results.length * 100).toFixed(1),
        },
        status: 'error',
      });
    }

    return {
      success: failedItems.length === 0,
      successCount: results.length - failedItems.length,
      failureCount: failedItems.length,
      successRate: (results.length - failedItems.length) / results.length,
    };
  }

  async handleDegradedMode(
    operation: string,
    reason: string
  ): Promise<void> {
    await logToDiscord({
      type: 'degraded_mode',
      content: `${operation} running in degraded mode: ${reason}`,
      status: 'pending',
    });
  }
}

// MARK: - User-Friendly Error Messages
export class ErrorMessenger {
  static getErrorMessage(error: OperationError): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.PROVIDER_UNAVAILABLE]:
        'Service temporarily unavailable. Please try again in a moment.',
      [ErrorType.TIMEOUT]:
        'Request took too long. Please try again.',
      [ErrorType.RATE_LIMITED]:
        'Too many requests. Please wait a moment before trying again.',
      [ErrorType.INVALID_REQUEST]:
        'Invalid request. Please check your input and try again.',
      [ErrorType.BUDGET_EXCEEDED]:
        'Operation cost exceeds your budget. Please increase your limit in settings.',
      [ErrorType.OPERATION_DISABLED]:
        'This operation is currently disabled. Enable it in settings to use.',
      [ErrorType.UNKNOWN]:
        'An unexpected error occurred. Please try again.',
    };

    return messages[error.type] || messages[ErrorType.UNKNOWN];
  }

  static getSuggestion(error: OperationError): string {
    if (!ErrorDetector.isRetryable(error)) {
      return 'Please check your input and try again.';
    }

    return 'The system will automatically retry this operation.';
  }
}

// MARK: - Error Threshold Monitor
export class ErrorThresholdMonitor {
  private errorCounts = new Map<string, number>();
  private readonly threshold = 5;
  private readonly windowMs = 60000; // 1 minute
  private readonly checkIntervalMs = 5000; // 5 seconds

  recordError(operation: string): void {
    const count = (this.errorCounts.get(operation) || 0) + 1;
    this.errorCounts.set(operation, count);

    if (count >= this.threshold) {
      void this.alertHighErrorRate(operation, count);
    }
  }

  getErrorCount(operation: string): number {
    return this.errorCounts.get(operation) || 0;
  }

  resetCounts(): void {
    this.errorCounts.clear();
  }

  private async alertHighErrorRate(
    operation: string,
    count: number
  ): Promise<void> {
    await logToDiscord({
      type: 'high_error_rate',
      content: `${operation} has failed ${count} times in the last minute`,
      status: 'error',
    });
  }
}

// MARK: - Global Instances
export const errorDetector = new ErrorDetector();
export const errorLogger = new ErrorLogger();
export const failoverHandler = new ProviderFailoverHandler();
export const recoveryStrategy = new ErrorRecoveryStrategy();
export const errorMessenger = new ErrorMessenger();
export const errorThresholdMonitor = new ErrorThresholdMonitor();
