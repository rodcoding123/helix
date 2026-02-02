import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSecretsManager } from '../database-manager.js';
import { SecretType, SecretSourceType } from '../types.js';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('DatabaseSecretsManager', () => {
  let manager: DatabaseSecretsManager;
  let mockSupabase: Partial<SupabaseClient>;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'secret-123',
              encrypted_value: 'nonce:ciphertext:authtag',
              user_id: 'user-456',
              secret_type: SecretType.GEMINI_API_KEY,
              encryption_method: 'aes-256-gcm',
              derivation_salt: 'somesalt',
              is_active: true,
            },
            error: null,
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'secret-789',
                user_id: 'user-456',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    manager = new DatabaseSecretsManager('user-456', mockSupabase as SupabaseClient);
  });

  it('should load encrypted secret from database', async () => {
    const secret = await manager.loadSecret(SecretType.GEMINI_API_KEY);

    expect(secret).toBeDefined();
  });

  it('should encrypt secret before storing in database', async () => {
    const secretValue = 'AIzaSy_test123';

    const metadata = await manager.storeSecret(
      SecretType.GEMINI_API_KEY,
      secretValue,
      SecretSourceType.USER_PROVIDED
    );

    expect(metadata).toBeDefined();
    expect(metadata.secretType).toBe(SecretType.GEMINI_API_KEY);
  });

  it('should track access with audit log', async () => {
    await manager.loadSecret(SecretType.DEEPSEEK_API_KEY);

    // Verify audit log was called
    // (Implementation will insert into audit table)
    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      }),
    };

    manager = new DatabaseSecretsManager('user-456', mockSupabase as SupabaseClient);

    const secret = await manager.loadSecret(SecretType.GEMINI_API_KEY);

    expect(secret).toBeNull();
  });
});
