import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SecretType, SecretSourceType, CreateUserApiKeyRequest, UserApiKey } from '../src/lib/types/secrets';
import { encryptWithKey, generateNonce } from '../src/lib/encryption/symmetric';
import { deriveEncryptionKey } from '../src/lib/encryption/key-derivation';

interface SecretMetadata {
  id: string;
  secretType: SecretType;
  sourceType: SecretSourceType;
  isActive: boolean;
  createdAt: string;
  lastAccessedAt: string | null;
  lastRotatedAt: string | null;
  expiresAt: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
};

/**
 * Helper function to log to audit table with error handling
 */
async function logAudit(
  supabase: SupabaseClient,
  auditData: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('api_key_access_audit').insert(auditData);
  } catch (error) {
    console.error('Failed to log audit record:', error);
  }
}

export default async function handler(request: Request): Promise<Response> {
  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Extract user ID from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Route to appropriate handler
    if (request.method === 'GET' && pathname === '/api/secrets') {
      return await handleListSecrets(supabase, userId, corsHeaders);
    } else if (request.method === 'POST' && pathname === '/api/secrets') {
      return await handleCreateSecret(supabase, userId, request, corsHeaders);
    } else if (request.method === 'GET' && pathname.match(/^\/api\/secrets\/[^/]+$/)) {
      const secretType = pathname.split('/').pop() as SecretType;
      return await handleGetSecret(supabase, userId, secretType, corsHeaders);
    } else if (request.method === 'PATCH' && pathname.match(/^\/api\/secrets\/[^/]+$/)) {
      const secretType = pathname.split('/').pop() as SecretType;
      return await handleRotateSecret(supabase, userId, secretType, request, corsHeaders);
    } else if (request.method === 'DELETE' && pathname.match(/^\/api\/secrets\/[^/]+$/)) {
      const secretType = pathname.split('/').pop() as SecretType;
      return await handleDeleteSecret(supabase, userId, secretType, corsHeaders);
    } else {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Secrets API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/secrets
 * List all active secrets for the current user
 */
async function handleListSecrets(
  supabase: SupabaseClient,
  userId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { data: secrets, error } = await supabase
      .from('user_api_keys')
      .select('id, secret_type, source_type, is_active, created_at, last_accessed_at, last_rotated_at, expires_at')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to list secrets:', error);

      // Audit log failure
      await logAudit(supabase, {
        user_id: userId,
        action: 'list',
        context: 'REST API - list secrets',
        source: 'api',
        success: false,
        error_message: error.message,
      });

      return new Response(JSON.stringify({ error: 'Failed to retrieve secrets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretMetadata: SecretMetadata[] = (secrets || []).map((secret: any) => ({
      id: secret.id,
      secretType: secret.secret_type,
      sourceType: secret.source_type,
      isActive: secret.is_active,
      createdAt: secret.created_at,
      lastAccessedAt: secret.last_accessed_at,
      lastRotatedAt: secret.last_rotated_at,
      expiresAt: secret.expires_at,
    }));

    // Audit log successful list
    await logAudit(supabase, {
      user_id: userId,
      action: 'list',
      context: 'REST API - list secrets',
      source: 'api',
      success: true,
    });

    return new Response(JSON.stringify({ secrets: secretMetadata }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error listing secrets:', error);

    // Audit log unexpected error
    await logAudit(supabase, {
      user_id: userId,
      action: 'list',
      context: 'REST API - list secrets',
      source: 'api',
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(JSON.stringify({ error: 'Failed to retrieve secrets' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/secrets
 * Create a new encrypted secret
 */
async function handleCreateSecret(
  supabase: SupabaseClient,
  userId: string,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body: CreateUserApiKeyRequest = await request.json();

    // Validate required fields
    if (!body.key_name || !body.secret_type || !body.value) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: key_name, secret_type, value' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate secret type
    const validSecretTypes = [
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE',
      'DEEPSEEK_API_KEY',
      'GEMINI_API_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'DISCORD_WEBHOOK',
    ];
    if (!validSecretTypes.includes(body.secret_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid secret type: ${body.secret_type}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate source type
    const validSourceTypes = ['user-provided', 'system-managed', 'user-local', 'one-password'];
    if (!validSourceTypes.includes(body.source_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid source type: ${body.source_type}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate value is not empty
    if (body.value.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Secret value cannot be empty' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate expiration if provided
    let expiresAt: string | null = null;
    if (body.expires_at) {
      const expirationDate = new Date(body.expires_at);
      if (isNaN(expirationDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid expiration date format' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (expirationDate < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Expiration date must be in the future' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      expiresAt = expirationDate.toISOString();
    }

    // Generate nonce for this secret
    const nonce = await generateNonce();

    // Derive encryption key from userId and secret type
    const encryptionKey = await deriveEncryptionKey(
      `${userId}:${body.secret_type}`,
      nonce
    );

    // Encrypt the secret value
    const encryptedValue = await encryptWithKey(body.value, encryptionKey, nonce);

    // Insert secret into database
    const { data: newSecret, error } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: userId,
        key_name: body.key_name,
        secret_type: body.secret_type,
        encrypted_value: encryptedValue,
        derivation_salt: nonce.toString('hex'),
        encryption_method: 'aes-256-gcm',
        key_version: 1,
        source_type: body.source_type,
        is_active: true,
        created_by: userId,
        expires_at: expiresAt,
      })
      .select('id, secret_type, source_type, created_at')
      .single();

    if (error) {
      console.error('Failed to create secret:', error);

      // Audit log failure
      await logAudit(supabase, {
        user_id: userId,
        action: 'create',
        context: 'REST API - create secret',
        source: 'api',
        success: false,
        error_message: error.message,
      });

      return new Response(JSON.stringify({ error: 'Failed to create secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log successful creation
    await logAudit(supabase, {
      user_id: userId,
      secret_id: newSecret.id,
      action: 'create',
      context: 'REST API - create secret',
      source: 'api',
      success: true,
    });

    return new Response(
      JSON.stringify({
        id: newSecret.id,
        secretType: newSecret.secret_type,
        sourceType: newSecret.source_type,
        createdAt: newSecret.created_at,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating secret:', error);

    // Audit log unexpected error
    await logAudit(supabase, {
      user_id: userId,
      action: 'create',
      context: 'REST API - create secret',
      source: 'api',
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(JSON.stringify({ error: 'Failed to create secret' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/secrets/[id]
 * Retrieve metadata for a specific secret (not the value)
 */
async function handleGetSecret(
  supabase: SupabaseClient,
  userId: string,
  secretType: SecretType,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Validate secret type
    const validSecretTypes = [
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE',
      'DEEPSEEK_API_KEY',
      'GEMINI_API_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'DISCORD_WEBHOOK',
    ];
    if (!validSecretTypes.includes(secretType)) {
      return new Response(
        JSON.stringify({ error: `Invalid secret type: ${secretType}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: secret, error } = await supabase
      .from('user_api_keys')
      .select('id, secret_type, source_type, is_active, created_at, last_accessed_at, last_rotated_at, expires_at')
      .eq('user_id', userId)
      .eq('secret_type', secretType)
      .single();

    if (error || !secret) {
      // Audit log not found
      await logAudit(supabase, {
        user_id: userId,
        action: 'read',
        context: 'REST API - read secret',
        source: 'api',
        success: false,
        error_message: 'Secret not found',
      });

      return new Response(JSON.stringify({ error: 'Secret not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log successful read
    await logAudit(supabase, {
      user_id: userId,
      secret_id: secret.id,
      action: 'read',
      context: 'REST API - read secret',
      source: 'api',
      success: true,
    });

    return new Response(
      JSON.stringify({
        id: secret.id,
        secretType: secret.secret_type,
        sourceType: secret.source_type,
        isActive: secret.is_active,
        createdAt: secret.created_at,
        lastAccessedAt: secret.last_accessed_at,
        lastRotatedAt: secret.last_rotated_at,
        expiresAt: secret.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error getting secret:', error);

    // Audit log unexpected error
    await logAudit(supabase, {
      user_id: userId,
      action: 'read',
      context: 'REST API - read secret',
      source: 'api',
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(JSON.stringify({ error: 'Failed to retrieve secret' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * PATCH /api/secrets/[id]
 * Rotate/update a secret with a new value
 */
async function handleRotateSecret(
  supabase: SupabaseClient,
  userId: string,
  secretType: SecretType,
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Validate secret type
    const validSecretTypes = [
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE',
      'DEEPSEEK_API_KEY',
      'GEMINI_API_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'DISCORD_WEBHOOK',
    ];
    if (!validSecretTypes.includes(secretType)) {
      return new Response(
        JSON.stringify({ error: `Invalid secret type: ${secretType}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json();

    if (!body.new_value || body.new_value.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'new_value is required and cannot be empty' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate expiration if provided
    let expiresAt: string | null = null;
    if (body.expires_at) {
      const expirationDate = new Date(body.expires_at);
      if (isNaN(expirationDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'Invalid expiration date format' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      expiresAt = expirationDate.toISOString();
    }

    // Fetch current secret to get current version
    const { data: currentSecret, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('key_version, id')
      .eq('user_id', userId)
      .eq('secret_type', secretType)
      .eq('is_active', true)
      .single();

    if (fetchError || !currentSecret) {
      // Audit log fetch failure
      await logAudit(supabase, {
        user_id: userId,
        action: 'rotate',
        context: 'REST API - rotate secret',
        source: 'api',
        success: false,
        error_message: 'Secret not found',
      });

      return new Response(JSON.stringify({ error: 'Secret not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate new nonce for rotated secret
    const newNonce = await generateNonce();

    // Derive new encryption key
    const newEncryptionKey = await deriveEncryptionKey(
      `${userId}:${secretType}`,
      newNonce
    );

    // Encrypt new value
    const newEncryptedValue = await encryptWithKey(body.new_value, newEncryptionKey, newNonce);

    // Update secret with new value and incremented key_version
    const { data: updatedSecret, error } = await supabase
      .from('user_api_keys')
      .update({
        encrypted_value: newEncryptedValue,
        derivation_salt: newNonce.toString('hex'),
        key_version: currentSecret.key_version + 1,
        last_rotated_at: new Date().toISOString(),
        expires_at: expiresAt,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('secret_type', secretType)
      .select('id, secret_type, last_rotated_at')
      .single();

    if (error || !updatedSecret) {
      console.error('Failed to rotate secret:', error);

      // Audit log rotation failure
      await logAudit(supabase, {
        user_id: userId,
        secret_id: currentSecret?.id,
        action: 'rotate',
        context: 'REST API - rotate secret',
        source: 'api',
        success: false,
        error_message: error ? error.message : 'Failed to rotate secret',
      });

      return new Response(JSON.stringify({ error: 'Failed to rotate secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log successful rotation
    await logAudit(supabase, {
      user_id: userId,
      secret_id: updatedSecret.id,
      action: 'rotate',
      context: 'REST API - rotate secret',
      source: 'api',
      success: true,
    });

    return new Response(
      JSON.stringify({
        id: updatedSecret.id,
        secretType: updatedSecret.secret_type,
        lastRotatedAt: updatedSecret.last_rotated_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error rotating secret:', error);

    // Audit log unexpected error
    await logAudit(supabase, {
      user_id: userId,
      action: 'rotate',
      context: 'REST API - rotate secret',
      source: 'api',
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(JSON.stringify({ error: 'Failed to rotate secret' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /api/secrets/[id]
 * Delete a secret (soft delete via is_active flag)
 */
async function handleDeleteSecret(
  supabase: SupabaseClient,
  userId: string,
  secretType: SecretType,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    // Validate secret type
    const validSecretTypes = [
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE',
      'DEEPSEEK_API_KEY',
      'GEMINI_API_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'DISCORD_WEBHOOK',
    ];
    if (!validSecretTypes.includes(secretType)) {
      return new Response(
        JSON.stringify({ error: `Invalid secret type: ${secretType}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get secret ID before deletion for audit logging
    let secretIdToDelete: string | undefined;
    try {
      const { data } = await supabase
        .from('user_api_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('secret_type', secretType)
        .single();
      secretIdToDelete = data?.id;
    } catch {
      // Ignore error, we'll try to delete anyway
    }

    // Soft delete
    const { error } = await supabase
      .from('user_api_keys')
      .update({
        is_active: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('secret_type', secretType);

    if (error) {
      console.error('Failed to delete secret:', error);

      // Audit log deletion failure
      await logAudit(supabase, {
        user_id: userId,
        secret_id: secretIdToDelete,
        action: 'delete',
        context: 'REST API - delete secret',
        source: 'api',
        success: false,
        error_message: error.message,
      });

      return new Response(JSON.stringify({ error: 'Failed to delete secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log successful deletion
    await logAudit(supabase, {
      user_id: userId,
      secret_id: secretIdToDelete,
      action: 'delete',
      context: 'REST API - delete secret',
      source: 'api',
      success: true,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting secret:', error);

    // Audit log unexpected error
    await logAudit(supabase, {
      user_id: userId,
      action: 'delete',
      context: 'REST API - delete secret',
      source: 'api',
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(JSON.stringify({ error: 'Failed to delete secret' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
