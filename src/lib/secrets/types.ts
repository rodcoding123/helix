export enum SecretType {
  SUPABASE_ANON_KEY = 'SUPABASE_ANON_KEY',
  SUPABASE_SERVICE_ROLE = 'SUPABASE_SERVICE_ROLE',
  DEEPSEEK_API_KEY = 'DEEPSEEK_API_KEY',
  GEMINI_API_KEY = 'GEMINI_API_KEY',
  STRIPE_SECRET_KEY = 'STRIPE_SECRET_KEY',
  STRIPE_PUBLISHABLE_KEY = 'STRIPE_PUBLISHABLE_KEY',
  DISCORD_WEBHOOK = 'DISCORD_WEBHOOK',
}

export enum SecretSourceType {
  SYSTEM_MANAGED = 'system-managed',
  USER_PROVIDED = 'user-provided',
  USER_LOCAL = 'user-local',
  ONE_PASSWORD = 'one-password',
}

export interface SecretMetadata {
  id: string;
  userId: string;
  secretType: SecretType;
  sourceType: SecretSourceType;
  createdAt: Date;
  lastAccessedAt: Date | null;
  lastRotatedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}

export interface StoredSecretData {
  metadata: SecretMetadata;
  encryptedValue: string;
  derivationSalt: string;
}

export interface SecretLoadOptions {
  userId?: string;
  forceRefresh?: boolean;
  includeMetadata?: boolean;
}

export interface SecretsManager {
  loadSecret(type: SecretType, options?: SecretLoadOptions): Promise<string | null>;

  loadAllSecrets(options?: SecretLoadOptions): Promise<Map<SecretType, string>>;

  storeSecret(
    type: SecretType,
    value: string,
    sourceType: SecretSourceType,
    expiresAt?: Date
  ): Promise<SecretMetadata>;

  deleteSecret(type: SecretType): Promise<void>;

  rotateSecret(type: SecretType, newValue: string, expiresAt?: Date): Promise<SecretMetadata>;

  getMetadata(type: SecretType): Promise<SecretMetadata | null>;

  validateSecret(type: SecretType): Promise<boolean>;
}
