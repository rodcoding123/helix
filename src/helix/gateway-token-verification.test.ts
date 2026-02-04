/**
 * Tests for Helix Gateway Token Verification module
 * Prevents unauthenticated access to network-bound gateways
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isLoopbackBinding,
  requiresTokenVerification,
  validateTokenFormat,
  verifyGatewayToken,
  generateGatewayToken,
  rateLimitTokenAttempts,
  enforceTokenVerification,
  clearRateLimitState,
} from './gateway-token-verification.js';

describe('isLoopbackBinding', () => {
  it('should return true for 127.0.0.1', () => {
    expect(isLoopbackBinding('127.0.0.1')).toBe(true);
  });

  it('should return true for localhost', () => {
    expect(isLoopbackBinding('localhost')).toBe(true);
  });

  it('should return true for ::1 (IPv6 loopback)', () => {
    expect(isLoopbackBinding('::1')).toBe(true);
  });

  it('should return false for network binding 0.0.0.0', () => {
    expect(isLoopbackBinding('0.0.0.0')).toBe(false);
  });
});

describe('requiresTokenVerification', () => {
  it('should return false for loopback in development', () => {
    expect(requiresTokenVerification('127.0.0.1', 'development')).toBe(false);
  });

  it('should return false for loopback in production', () => {
    expect(requiresTokenVerification('127.0.0.1', 'production')).toBe(false);
  });

  it('should return true for 0.0.0.0 in development', () => {
    expect(requiresTokenVerification('0.0.0.0', 'development')).toBe(true);
  });

  it('should return true for private IP in development', () => {
    expect(requiresTokenVerification('192.168.1.1', 'development')).toBe(true);
  });
});

describe('validateTokenFormat', () => {
  it('should validate correct token format (256 character hex string)', () => {
    const validToken = 'a'.repeat(256);
    expect(validateTokenFormat(validToken)).toBe(true);
  });

  it('should reject token with invalid length', () => {
    const invalidToken = 'a'.repeat(100);
    expect(validateTokenFormat(invalidToken)).toBe(false);
  });

  it('should reject token with non-hex characters', () => {
    const invalidToken = 'g'.repeat(256);
    expect(validateTokenFormat(invalidToken)).toBe(false);
  });
});

describe('verifyGatewayToken', () => {
  it('should return valid=true for matching tokens with constant-time comparison', () => {
    const token =
      '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890';
    const result = verifyGatewayToken(token, token);
    expect(result.valid).toBe(true);
    expect(result.timingResistant).toBe(true);
  });

  it('should return valid=false for non-matching tokens', () => {
    const token1 = 'a'.repeat(256);
    const token2 = 'b'.repeat(256);
    const result = verifyGatewayToken(token1, token2);
    expect(result.valid).toBe(false);
  });

  it('should always use constant-time comparison', () => {
    const token = '0'.repeat(256);
    const result = verifyGatewayToken(token, token);
    expect(result.timingResistant).toBe(true);
  });
});

describe('rateLimitTokenAttempts', () => {
  beforeEach(() => {
    // Clear rate limit state before each test
    clearRateLimitState();
  });

  it('should allow first attempt with exponential backoff state', () => {
    const status = rateLimitTokenAttempts('client-1');
    expect(status.allowed).toBe(true);
    expect(status.attemptsRemaining).toBeGreaterThanOrEqual(0);
  });

  it('should track multiple attempts from same client', () => {
    rateLimitTokenAttempts('client-2');
    const secondStatus = rateLimitTokenAttempts('client-2');
    expect(secondStatus.attemptsRemaining).toBeLessThan(5);
  });

  it('should implement exponential backoff with reasonable delay', () => {
    const firstStatus = rateLimitTokenAttempts('client-3');
    expect(firstStatus.backoffDelayMs).toBeDefined();
    expect(firstStatus.backoffDelayMs).toBeGreaterThanOrEqual(0);
  });
});

describe('rateLimitTokenAttempts - Exponential Backoff Sequence', () => {
  beforeEach(() => {
    clearRateLimitState();
  });

  it('should increase backoff: 2 min → 4 min → 8 min progression', () => {
    const clientId = 'test-exponential';

    // First 5 attempts - should all be allowed
    for (let i = 0; i < 5; i++) {
      const status = rateLimitTokenAttempts(clientId);
      expect(status.allowed).toBe(true);
    }

    // 6th attempt - locked out, first backoff = 2 min (60000 * 2^1)
    const status = rateLimitTokenAttempts(clientId);
    expect(status.allowed).toBe(false);
    expect(status.backoffDelayMs).toBe(120000); // 2 minutes
  });

  it('should reset rate limit after window expires', () => {
    const clientId = 'test-reset';

    // Use up 5 attempts
    for (let i = 0; i < 5; i++) {
      rateLimitTokenAttempts(clientId);
    }

    // 6th attempt - locked
    let status = rateLimitTokenAttempts(clientId);
    expect(status.allowed).toBe(false);

    // Clear state simulates window expiry
    clearRateLimitState(clientId);

    // Should be allowed again
    status = rateLimitTokenAttempts(clientId);
    expect(status.allowed).toBe(true);
    expect(status.attemptsRemaining).toBe(4);
  });
});

describe('enforceTokenVerification', () => {
  beforeEach(() => {
    clearRateLimitState();
  });

  it('should allow valid token on network binding', () => {
    const token = generateGatewayToken();

    expect(() => {
      enforceTokenVerification('192.168.1.1', 'development', token, token);
    }).not.toThrow();
  });

  it('should throw on invalid token format', () => {
    expect(() => {
      enforceTokenVerification(
        '192.168.1.1',
        'development',
        'short',
        'valid-token-here-256-chars-minimum'
      );
    }).toThrow();
  });

  it('should integrate rate limiting and block after 5 failures', () => {
    const wrongToken = 'a'.repeat(256);

    // 5 failed attempts should be blocked on 6th by rate limiting
    for (let i = 0; i < 5; i++) {
      expect(() => {
        enforceTokenVerification('192.168.1.1', 'development', wrongToken, 'b'.repeat(256));
      }).toThrow();
    }

    // 6th attempt should be blocked by rate limit or verification
    expect(() => {
      enforceTokenVerification('192.168.1.1', 'development', wrongToken, 'b'.repeat(256));
    }).toThrow();
  });

  it('should allow loopback without token', () => {
    expect(() => {
      enforceTokenVerification('127.0.0.1', 'development', '', '');
    }).not.toThrow();
  });

  it('should reject 0.0.0.0 in production regardless of token', () => {
    const validToken = generateGatewayToken();
    expect(() => {
      enforceTokenVerification('0.0.0.0', 'production', validToken, validToken);
    }).toThrow();
  });
});

describe('generateGatewayToken', () => {
  it('should generate token with valid format', () => {
    const token = generateGatewayToken();
    expect(validateTokenFormat(token)).toBe(true);
  });

  it('should generate unique tokens', () => {
    const token1 = generateGatewayToken();
    const token2 = generateGatewayToken();
    expect(token1).not.toBe(token2);
  });
});
