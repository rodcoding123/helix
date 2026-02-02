export type SecretType =
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE'
  | 'DEEPSEEK_API_KEY'
  | 'GEMINI_API_KEY'
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_PUBLISHABLE_KEY'
  | 'DISCORD_WEBHOOK';

export type SecretSourceType = 'manual' | 'imported' | 'generated' | 'inherited';

export type EncryptionMethod = 'aes-256-gcm';

export interface UserApiKey {
  id: string;
  user_id: string;
  name: string;
  secret_type: SecretType;
  source_type: SecretSourceType;
  created_at: Date;
  expires_at: Date | null;
  is_active: boolean;
  key_version: number;
  encryption_method: EncryptionMethod;
}
