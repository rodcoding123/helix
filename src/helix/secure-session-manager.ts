/**
 * SECURE SESSION MANAGEMENT
 *
 * Implements secure session handling by:
 * - Storing tokens in secure HTTPOnly cookies (not URLs)
 * - Using SameSite cookie attributes
 * - Implementing session token rotation
 * - Tracking session lifecycle
 * - Preventing session fixation attacks
 */

import * as crypto from 'node:crypto';
import { sendAlert } from './logging-hooks.js';

/**
 * Session token configuration
 */
export interface SessionTokenConfig {
  algorithm: 'sha256' | 'sha512';
  tokenLengthBytes: number;
  expirationMs: number;
  rotationIntervalMs: number;
}

/**
 * Session token
 */
export interface SessionToken {
  token: string;
  hash: string;
  createdAt: number;
  expiresAt: number;
  rotatedAt?: number;
  lastActivity: number;
  isActive: boolean;
}

/**
 * HTTP Cookie options for secure token storage
 */
export interface SecureCookieOptions {
  name: string;
  httpOnly: true; // CRITICAL: Prevent JavaScript access
  secure: boolean; // HTTPS only in production
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number; // Seconds
  path: string;
  domain?: string;
}

/**
 * Generate cryptographically secure random token
 *
 * @param lengthBytes - Token length in bytes
 * @returns Random token as hex string
 */
export function generateSecureToken(lengthBytes: number = 32): string {
  return crypto.randomBytes(lengthBytes).toString('hex');
}

/**
 * Hash session token using SHA-256/512
 *
 * CRITICAL: Never store plaintext tokens in database,
 * always store hashes. This prevents token leakage from DB dumps.
 */
export function hashSessionToken(token: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  return crypto.createHash(algorithm).update(token).digest('hex');
}

/**
 * Create new session token
 *
 * @param config - Token configuration
 * @returns Session token object
 */
export function createSessionToken(config: SessionTokenConfig): SessionToken {
  const token = generateSecureToken(config.tokenLengthBytes);
  const now = Date.now();

  return {
    token,
    hash: hashSessionToken(token, config.algorithm),
    createdAt: now,
    expiresAt: now + config.expirationMs,
    lastActivity: now,
    isActive: true,
  };
}

/**
 * Verify session token is valid
 *
 * @param sessionToken - Stored session token
 * @param providedToken - Token from request
 * @returns { valid: boolean, reason?: string }
 */
export function verifySessionToken(
  sessionToken: SessionToken,
  providedToken: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): { valid: boolean; reason?: string } {
  // Check if token is active
  if (!sessionToken.isActive) {
    return { valid: false, reason: 'Session token is not active' };
  }

  // Check expiration
  if (Date.now() > sessionToken.expiresAt) {
    return { valid: false, reason: 'Session token expired' };
  }

  // Verify hash (constant-time comparison to prevent timing attacks)
  const providedHash = hashSessionToken(providedToken, algorithm);

  if (!constantTimeCompare(providedHash, sessionToken.hash)) {
    return { valid: false, reason: 'Invalid session token' };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Rotate session token (issue new token, invalidate old)
 *
 * Prevents token fixation attacks by rotating tokens periodically
 *
 * @param oldToken - Current session token
 * @param config - Token configuration
 * @returns New session token
 */
export function rotateSessionToken(
  oldToken: SessionToken,
  config: SessionTokenConfig
): { oldToken: SessionToken; newToken: SessionToken } {
  // Invalidate old token
  oldToken.isActive = false;

  // Create new token
  const newToken = createSessionToken(config);
  newToken.rotatedAt = Date.now();

  return { oldToken, newToken };
}

/**
 * Update session activity timestamp
 *
 * Used for idle session detection
 */
export function updateSessionActivity(token: SessionToken): void {
  token.lastActivity = Date.now();
}

/**
 * Check if session is idle
 *
 * @param token - Session token
 * @param maxIdleMs - Maximum idle time in milliseconds
 * @returns true if session is idle
 */
export function isSessionIdle(token: SessionToken, maxIdleMs: number = 30 * 60 * 1000): boolean {
  return Date.now() - token.lastActivity > maxIdleMs;
}

/**
 * Generate secure HTTPOnly cookie header
 *
 * CRITICAL: Prevents JavaScript from accessing token
 */
export function generateSecureCookieHeader(token: string, options: SecureCookieOptions): string {
  const parts = [
    `${options.name}=${token}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    'HttpOnly', // Prevent JS access
    `SameSite=${options.sameSite}`,
  ];

  if (options.secure) {
    parts.push('Secure'); // HTTPS only
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  return parts.join('; ');
}

/**
 * Get default secure cookie options for production
 */
export function getDefaultSecureCookieOptions(
  environment: 'development' | 'production'
): SecureCookieOptions {
  return {
    name: 'helix_session',
    httpOnly: true, // CRITICAL
    secure: environment === 'production', // HTTPS only in prod
    sameSite: environment === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60, // 24 hours
    path: '/',
    domain: environment === 'production' ? 'helix.local' : undefined,
  };
}

/**
 * Get default session token configuration
 */
export function getDefaultSessionTokenConfig(): SessionTokenConfig {
  return {
    algorithm: 'sha256',
    tokenLengthBytes: 32, // 256 bits
    expirationMs: 24 * 60 * 60 * 1000, // 24 hours
    rotationIntervalMs: 60 * 60 * 1000, // Rotate every hour
  };
}

/**
 * Session store (in-memory for now, use DB in production)
 */
export class SessionStore {
  private sessions: Map<string, SessionToken> = new Map();
  private config: SessionTokenConfig;

  constructor(config?: SessionTokenConfig) {
    this.config = config || getDefaultSessionTokenConfig();
  }

  /**
   * Create and store new session
   */
  createSession(userId: string): { token: string; sessionId: string } {
    const sessionToken = createSessionToken(this.config);
    const sessionId = `session-${Date.now()}-${userId}`;

    this.sessions.set(sessionId, sessionToken);

    return {
      token: sessionToken.token,
      sessionId,
    };
  }

  /**
   * Verify session token
   */
  verifySession(
    sessionId: string,
    token: string
  ): {
    valid: boolean;
    reason?: string;
  } {
    const sessionToken = this.sessions.get(sessionId);

    if (!sessionToken) {
      return { valid: false, reason: 'Session not found' };
    }

    return verifySessionToken(sessionToken, token, this.config.algorithm);
  }

  /**
   * Rotate session token
   */
  rotateSession(sessionId: string): { token: string; reason?: string } | null {
    const oldToken = this.sessions.get(sessionId);

    if (!oldToken) {
      return null;
    }

    const { newToken } = rotateSessionToken(oldToken, this.config);
    this.sessions.set(sessionId, newToken);

    return { token: newToken.token };
  }

  /**
   * Invalidate session
   */
  invalidateSession(sessionId: string): boolean {
    const token = this.sessions.get(sessionId);

    if (!token) {
      return false;
    }

    token.isActive = false;
    return true;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): number {
    let count = 0;
    const now = Date.now();

    for (const [sessionId, token] of this.sessions.entries()) {
      if (now > token.expiresAt) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    return count;
  }

  /**
   * Update session activity
   */
  updateActivity(sessionId: string): boolean {
    const token = this.sessions.get(sessionId);

    if (!token) {
      return false;
    }

    updateSessionActivity(token);
    return true;
  }

  /**
   * Get session info (for debugging)
   */
  getSessionInfo(sessionId: string): {
    active: boolean;
    expiresIn: number;
    isIdle: boolean;
  } | null {
    const token = this.sessions.get(sessionId);

    if (!token) {
      return null;
    }

    return {
      active: token.isActive,
      expiresIn: token.expiresAt - Date.now(),
      isIdle: isSessionIdle(token),
    };
  }
}

/**
 * Alert on session security event
 */
export async function alertSessionSecurityEvent(
  event: 'token_mismatch' | 'token_expired' | 'session_fixation' | 'token_in_url',
  sessionId: string,
  details?: string
): Promise<void> {
  const eventNames: Record<string, string> = {
    token_mismatch: 'Session Token Mismatch',
    token_expired: 'Session Token Expired',
    session_fixation: 'Possible Session Fixation Attack',
    token_in_url: 'Auth Token in URL (Security Risk)',
  };

  await sendAlert(
    `⚠️ SECURITY: ${eventNames[event]}`,
    `Session: ${sessionId}\nDetails: ${details || 'None'}`,
    'critical'
  );
}
