import type { UserApiKey } from '../../types/secrets';
import type { SecretType } from '../../types/secrets';

export interface CreateSecretInput {
  name: string;
  secret_type: SecretType;
  expires_at?: Date;
}

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

function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    return true;
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  // Retry on 5xx errors
  if (status >= 500) {
    return true;
  }
  // Don't retry on 4xx client errors
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SecretsClient {
  private token: string;
  private retryConfig: RetryConfig;

  constructor(token: string, retryConfig: Partial<RetryConfig> = {}) {
    this.token = token;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

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

  async listSecrets(): Promise<UserApiKey[]> {
    const data = await this.request<{ secrets: UserApiKey[] }>('/api/secrets');
    return data.secrets;
  }

  async createSecret(input: CreateSecretInput): Promise<UserApiKey> {
    return this.request<UserApiKey>('/api/secrets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async rotateSecret(secretId: string): Promise<UserApiKey> {
    return this.request<UserApiKey>(`/api/secrets/${secretId}/rotate`, {
      method: 'POST',
    });
  }

  async deleteSecret(secretId: string): Promise<void> {
    await this.request(`/api/secrets/${secretId}`, {
      method: 'DELETE',
    });
  }
}
