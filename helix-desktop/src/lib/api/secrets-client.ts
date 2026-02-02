import type { UserApiKey } from '../../types/secrets';
import type { SecretType } from '../../types/secrets';

export interface CreateSecretInput {
  name: string;
  secret_type: SecretType;
  expires_at?: Date;
}

export class SecretsClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
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
