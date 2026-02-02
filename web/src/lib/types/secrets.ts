export type SecretType =
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE'
  | 'DEEPSEEK_API_KEY'
  | 'GEMINI_API_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_PUBLISHABLE_KEY'
  | 'DISCORD_WEBHOOK';

export type SecretSourceType =
  | 'user-provided'
  | 'system-managed'
  | 'user-local'
  | 'one-password';

export type EncryptionMethod = 'aes-256-gcm' | 'plaintext';

export interface UserApiKey {
  id: string;
  user_id: string;
  key_name: string;
  secret_type: SecretType;
  encrypted_value: string;
  derivation_salt: string | null;
  encryption_method: EncryptionMethod;
  key_version: number;
  source_type: SecretSourceType;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
  last_rotated_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface CreateUserApiKeyRequest {
  key_name: string;
  secret_type: SecretType;
  value: string; // Plaintext - will be encrypted server-side
  source_type: SecretSourceType;
  expires_at?: string; // ISO 8601
}

export interface RotateApiKeyRequest {
  new_value: string; // Plaintext
  expires_at?: string; // ISO 8601
}
