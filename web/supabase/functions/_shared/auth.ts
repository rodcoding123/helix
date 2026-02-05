/**
 * Shared Authentication Utilities for Supabase Edge Functions
 *
 * Provides token validation, user extraction, and refresh token rotation
 * with proper security practices.
 */

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// MARK: - Types

export interface AuthResult {
  user: User | null
  error: string | null
  statusCode: number
}

export interface TokenInfo {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  isExpired: boolean
  isExpiringSoon: boolean
}

export interface RefreshResult {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  error: string | null
}

// MARK: - Token Extraction

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * Parse JWT token to extract expiration (without verification)
 * WARNING: This does NOT verify the token - use validateToken for that
 */
export function parseTokenExpiration(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Decode payload (base64url)
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    )

    return payload.exp || null
  } catch {
    return null
  }
}

/**
 * Get token info including expiration status
 */
export function getTokenInfo(accessToken: string, refreshToken: string | null = null): TokenInfo {
  const expiresAt = parseTokenExpiration(accessToken)
  const now = Math.floor(Date.now() / 1000)

  return {
    accessToken,
    refreshToken,
    expiresAt,
    isExpired: expiresAt !== null && expiresAt < now,
    isExpiringSoon: expiresAt !== null && expiresAt < now + 300, // 5 minutes
  }
}

// MARK: - Token Validation

/**
 * Create a Supabase client for authentication
 */
export function createAuthClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
}

/**
 * Validate token and get user
 * This verifies the token signature and expiration through Supabase
 */
export async function validateToken(token: string): Promise<AuthResult> {
  const supabase = createAuthClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error) {
      // Token invalid or expired
      return {
        user: null,
        error: error.message || 'Invalid token',
        statusCode: 401,
      }
    }

    if (!user) {
      return {
        user: null,
        error: 'User not found',
        statusCode: 401,
      }
    }

    return {
      user,
      error: null,
      statusCode: 200,
    }
  } catch (err) {
    console.error('Token validation error:', err)
    return {
      user: null,
      error: 'Token validation failed',
      statusCode: 500,
    }
  }
}

/**
 * Validate token from request
 * Convenience function that extracts and validates token from Authorization header
 */
export async function validateRequestToken(req: Request): Promise<AuthResult> {
  const token = extractBearerToken(req)

  if (!token) {
    return {
      user: null,
      error: 'Authorization header missing or invalid',
      statusCode: 401,
    }
  }

  return validateToken(token)
}

// MARK: - Refresh Token Rotation

/**
 * Refresh an access token using the refresh token
 *
 * IMPORTANT: Supabase implements refresh token rotation by default.
 * Each time a refresh token is used, a new refresh token is issued
 * and the old one is invalidated.
 *
 * Clients should:
 * 1. Store the new refresh token from the response
 * 2. Use the new access token for subsequent requests
 * 3. Never reuse old refresh tokens
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const supabase = createAuthClient()

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      return {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        error: error?.message || 'Failed to refresh session',
      }
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at || null,
      error: null,
    }
  } catch (err) {
    console.error('Token refresh error:', err)
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      error: 'Token refresh failed',
    }
  }
}

// MARK: - Session Helpers

/**
 * Check if a token is expired or expiring soon and needs refresh
 */
export function needsRefresh(token: string): boolean {
  const info = getTokenInfo(token)
  return info.isExpired || info.isExpiringSoon
}

/**
 * Validate token with automatic refresh attempt
 * Returns the user and optionally new tokens if refresh was performed
 */
export async function validateWithRefresh(
  accessToken: string,
  refreshToken: string | null
): Promise<{
  authResult: AuthResult
  newTokens: RefreshResult | null
}> {
  // First, try to validate the access token
  let authResult = await validateToken(accessToken)

  // If token is valid, return immediately
  if (!authResult.error && authResult.user) {
    // Check if we should proactively refresh
    if (refreshToken && needsRefresh(accessToken)) {
      const newTokens = await refreshAccessToken(refreshToken)
      return { authResult, newTokens }
    }
    return { authResult, newTokens: null }
  }

  // Token invalid - try refresh if we have a refresh token
  if (refreshToken) {
    const newTokens = await refreshAccessToken(refreshToken)

    if (newTokens.accessToken) {
      // Validate the new access token
      authResult = await validateToken(newTokens.accessToken)
      return { authResult, newTokens }
    }
  }

  // Both validation and refresh failed
  return { authResult, newTokens: null }
}

// MARK: - Response Helpers

/**
 * Create an unauthorized error response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Create a response with new tokens in headers
 * Use this when tokens were refreshed during request processing
 */
export function responseWithNewTokens(
  body: unknown,
  tokens: RefreshResult,
  status: number = 200
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Include new tokens in response headers for client to update
  if (tokens.accessToken) {
    headers['X-New-Access-Token'] = tokens.accessToken
  }
  if (tokens.refreshToken) {
    headers['X-New-Refresh-Token'] = tokens.refreshToken
  }
  if (tokens.expiresAt) {
    headers['X-Token-Expires-At'] = tokens.expiresAt.toString()
  }

  return new Response(JSON.stringify(body), { status, headers })
}
