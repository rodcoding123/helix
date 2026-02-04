/**
 * HELIX GATEWAY TOKEN VERIFICATION
 * Prevents unauthenticated access to network-bound gateways
 *
 * Security Model:
 * - Loopback (127.0.0.1, ::1) exempt from authentication
 * - Network bindings (0.0.0.0, private IPs) require strong token auth
 * - Production builds reject 0.0.0.0 entirely
 * - Rate limit token verification with exponential backoff
 * - Constant-time comparison prevents timing attacks
 */

import crypto from 'node:crypto';
import { sendAlert } from './logging-hooks.js';

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  verified: boolean;
  timingResistant: boolean;
  errorMessage?: string;
}

/**
 * Rate limit status for token attempts
 */
export interface RateLimitStatus {
  allowed: boolean;
  attemptsRemaining: number;
  backoffDelayMs: number;
  resetAtMs: number;
}

// Rate limit tracking: Map<clientId, { attempts: number, resetTime: number, backoffLevel: number }>
const rateLimitState = new Map<
  string,
  {
    attempts: number;
    resetTime: number;
    backoffLevel: number;
    lastAttemptTime: number;
  }
>();

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const MAX_ATTEMPTS_PER_WINDOW = 5;
const INITIAL_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 30000;

/**
 * Check if a host binding is loopback (exempt from authentication)
 * Loopback: 127.0.0.1, localhost, ::1
 */
export function isLoopbackBinding(host: string): boolean {
  // IPv4 loopback
  if (host === '127.0.0.1' || host === 'localhost' || host === '::1') {
    return true;
  }

  // IPv6 loopback variations
  if (host === '[::1]' || host === '::1') {
    return true;
  }

  return false;
}

/**
 * Check if a host binding requires token verification
 * Network bindings (0.0.0.0, private IPs) require auth
 * Production rejects 0.0.0.0 entirely
 */
export function requiresTokenVerification(
  host: string,
  _environment: 'development' | 'production'
): boolean {
  // Loopback always exempt
  if (isLoopbackBinding(host)) {
    return false;
  }

  // Production rejects 0.0.0.0 entirely (handled by enforceTokenVerification)
  // But function reports it requires verification
  if (host === '0.0.0.0') {
    return true;
  }

  // Private IP ranges require verification
  const isPrivateIP =
    host.startsWith('10.') ||
    host.startsWith('172.16.') ||
    host.startsWith('192.168.') ||
    host.startsWith('fc00:') ||
    host.startsWith('fe80:');

  if (isPrivateIP) {
    return true;
  }

  return false;
}

/**
 * Validate token format
 * Expected: 256-character hex string (512 bits in hex)
 */
export function validateTokenFormat(token: string): boolean {
  // Must be exactly 256 hex characters (128 bytes in hex)
  if (token.length !== 256) {
    return false;
  }

  // Must be valid hex
  const hexRegex = /^[a-f0-9]+$/i;
  return hexRegex.test(token);
}

/**
 * Generate a cryptographically strong gateway token
 * Returns 256-character hex string (128 bytes = 1024 bits)
 */
export function generateGatewayToken(): string {
  // Generate 128 random bytes (1024 bits) and encode as hex
  const randomBytes = crypto.randomBytes(128);
  return randomBytes.toString('hex');
}

/**
 * Verify a gateway token using constant-time comparison
 * Prevents timing attacks that could leak information about token validity
 */
export function verifyGatewayToken(
  providedToken: string,
  storedToken: string
): TokenVerificationResult {
  try {
    // First, quick length check (non-critical, timing doesn't matter)
    if (providedToken.length !== storedToken.length) {
      return {
        verified: false,
        timingResistant: false,
        errorMessage: 'Token length mismatch',
      };
    }

    // Convert to buffers for constant-time comparison
    const providedBuffer = Buffer.from(providedToken, 'hex');
    const storedBuffer = Buffer.from(storedToken, 'hex');

    // Use timingSafeEqual for constant-time comparison
    // Throws if buffers are different lengths, but we checked above
    const isEqual = crypto.timingSafeEqual(providedBuffer, storedBuffer);

    return {
      verified: isEqual,
      timingResistant: true,
    };
  } catch (error) {
    // timingSafeEqual throws on invalid input - treat as verification failure
    return {
      verified: false,
      timingResistant: true, // Still timing-resistant (exception path is constant)
      errorMessage: error instanceof Error ? error.message : 'Token verification failed',
    };
  }
}

/**
 * Rate limit token verification attempts using exponential backoff
 * Prevents brute force attacks on gateway tokens
 */
export function rateLimitTokenAttempts(clientId: string): RateLimitStatus {
  const now = Date.now();
  const state = rateLimitState.get(clientId);

  // First attempt or window expired
  if (!state || now > state.resetTime) {
    rateLimitState.set(clientId, {
      attempts: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
      backoffLevel: 0,
      lastAttemptTime: now,
    });

    return {
      allowed: true,
      attemptsRemaining: MAX_ATTEMPTS_PER_WINDOW - 1,
      backoffDelayMs: 0,
      resetAtMs: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  // Within window - check attempt limit
  if (state.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    // Increase backoff level
    state.backoffLevel = Math.min(state.backoffLevel + 1, 10); // Cap at level 10
    state.lastAttemptTime = now;

    const backoffMs = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, state.backoffLevel),
      MAX_BACKOFF_MS
    );

    return {
      allowed: false,
      attemptsRemaining: 0,
      backoffDelayMs: backoffMs,
      resetAtMs: state.resetTime,
    };
  }

  // Increment attempt counter
  state.attempts++;
  state.lastAttemptTime = now;

  const backoffMs =
    state.backoffLevel > 0
      ? Math.min(INITIAL_BACKOFF_MS * Math.pow(2, state.backoffLevel - 1), MAX_BACKOFF_MS)
      : 0;

  return {
    allowed: true,
    attemptsRemaining: MAX_ATTEMPTS_PER_WINDOW - state.attempts,
    backoffDelayMs: backoffMs,
    resetAtMs: state.resetTime,
  };
}

/**
 * Enforce token verification for gateway access
 * Throws if access should be blocked
 */
export function enforceTokenVerification(
  host: string,
  environment: 'development' | 'production',
  providedToken: string,
  storedToken: string
): void {
  // Loopback always allowed
  if (isLoopbackBinding(host)) {
    return;
  }

  // Production rejects 0.0.0.0 entirely
  if (environment === 'production' && host === '0.0.0.0') {
    void sendAlert(
      'Gateway Security Violation',
      `Production rejected 0.0.0.0 binding attempt`,
      'critical'
    );
    throw new Error('Production environment rejects 0.0.0.0 gateway binding');
  }

  // Network bindings require token verification
  if (requiresTokenVerification(host, environment)) {
    // Validate token format first
    if (!validateTokenFormat(providedToken)) {
      void sendAlert('Gateway Token Error', `Invalid token format from ${host}`, 'warning');
      throw new Error('Invalid gateway token format');
    }

    // Verify token with constant-time comparison
    const result = verifyGatewayToken(providedToken, storedToken);
    if (!result.verified) {
      void sendAlert(
        'Gateway Authentication Failed',
        `Failed token verification from ${host}`,
        'critical'
      );
      throw new Error('Gateway token verification failed');
    }
  }
}

/**
 * Clear rate limit state for a client
 * Useful for testing and admin operations
 * @internal
 */
export function clearRateLimitState(clientId?: string): void {
  if (clientId) {
    rateLimitState.delete(clientId);
  } else {
    rateLimitState.clear();
  }
}
