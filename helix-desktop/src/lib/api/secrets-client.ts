import type { UserApiKey } from '../../types/secrets';
import type { SecretType } from '../../types/secrets';

/**
 * Input data for creating a new secret
 */
export interface CreateSecretInput {
  name: string;
  secret_type: SecretType;
  expires_at?: Date;
}

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 100,
};

/**
 * Check if an error is retryable (network errors)
 * @param {unknown} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

/**
 * Check if HTTP status code is retryable (5xx errors)
 * @param {number} status - HTTP status code
 * @returns {boolean} True if status is retryable
 */
function isRetryableStatus(status: number): boolean {
  // Retry on 5xx errors
  if (status >= 500) {
    return true;
  }
  // Don't retry on 4xx client errors
  return false;
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>} Resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * API Client for secrets management
 *
 * Handles all communication with the /api/secrets backend endpoints.
 * Implements Bearer token authentication and automatic retry with exponential backoff.
 *
 * @example
 * ```typescript
 * const client = new SecretsClient('auth-token');
 * const secrets = await client.listSecrets();
 *
 * const newSecret = await client.createSecret({
 *   name: 'My Key',
 *   secret_type: 'STRIPE_SECRET_KEY',
 * });
 * ```
 */
export class SecretsClient {
  private token: string;
  private retryConfig: RetryConfig;

  /**
   * Create a new secrets API client
   * @param {string} token - Bearer authentication token
   * @param {Partial<RetryConfig>} retryConfig - Optional retry configuration
   */
  constructor(token: string, retryConfig: Partial<RetryConfig> = {}) {
    this.token = token;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Make HTTP request with automatic retry logic
   * @template T - Response data type
   * @param {string} endpoint - API endpoint path
   * @param {RequestInit} options - Fetch options
   * @returns {Promise<T>} Response data
   * @private
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));

          // Don't retry on client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            if (response.status === 401) {
              throw new Error('Unauthorized');
            }
            throw new Error(error.error || `HTTP ${response.status}`);
          }

          // Retry on server errors (5xx)
          if (isRetryableStatus(response.status) && attempt < this.retryConfig.maxRetries - 1) {
            const backoffDelay = this.retryConfig.initialDelay *
              Math.pow(this.retryConfig.backoffMultiplier, attempt);
            await delay(backoffDelay);
            continue;
          }

          throw new Error(error.error || `HTTP ${response.status}`);
        }

        return response.json();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (isRetryableError(error) && attempt < this.retryConfig.maxRetries - 1) {
          const backoffDelay = this.retryConfig.initialDelay *
            Math.pow(this.retryConfig.backoffMultiplier, attempt);
          await delay(backoffDelay);
          continue;
        }

        // Not retryable or max retries exceeded
        throw error;
      }
    }

    throw lastError || new Error('Failed after maximum retries');
  }

  /**
   * Get all secrets for the authenticated user
   * @returns {Promise<UserApiKey[]>} Array of secrets
   */
  async listSecrets(): Promise<UserApiKey[]> {
    const data = await this.request<{ secrets: UserApiKey[] }>('/api/secrets');
    return data.secrets;
  }

  /**
   * Create a new secret
   * @param {CreateSecretInput} input - Secret creation data
   * @returns {Promise<UserApiKey>} Created secret
   */
  async createSecret(input: CreateSecretInput): Promise<UserApiKey> {
    return this.request<UserApiKey>('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * Rotate a secret (generate new version)
   * @param {string} secretId - ID of secret to rotate
   * @returns {Promise<UserApiKey>} Updated secret with new version
   */
  async rotateSecret(secretId: string): Promise<UserApiKey> {
    return this.request<UserApiKey>(`/api/secrets/${secretId}/rotate`, {
      method: 'POST',
    });
  }

  /**
   * Delete a secret
   * @param {string} secretId - ID of secret to delete
   * @returns {Promise<void>}
   */
  async deleteSecret(secretId: string): Promise<void> {
    await this.request(`/api/secrets/${secretId}`, {
      method: 'DELETE',
    });
  }
}
