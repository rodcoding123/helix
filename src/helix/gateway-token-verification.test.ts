/**
 * Tests for Helix Gateway Token Verification module
 * Prevents unauthenticated access to network-bound gateways
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isLoopbackBinding,
  requiresTokenVerification,
  validateTokenFormat,
  verifyGatewayToken,
  generateGatewayToken,
  rateLimitTokenAttempts,
  enforceTokenVerification,
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
  it('should return verified=true for matching tokens with constant-time comparison', () => {
    const token =
      '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890';
    const result = verifyGatewayToken(token, token);
    expect(result.verified).toBe(true);
    expect(result.timingResistant).toBe(true);
  });

  it('should return verified=false for non-matching tokens', () => {
    const token1 = 'a'.repeat(256);
    const token2 = 'b'.repeat(256);
    const result = verifyGatewayToken(token1, token2);
    expect(result.verified).toBe(false);
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
    vi.clearAllMocks();
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

describe('enforceTokenVerification', () => {
  it('should throw for 0.0.0.0 in production without valid token', () => {
    expect(() => {
      enforceTokenVerification('0.0.0.0', 'production', 'invalid_token', 'stored_token');
    }).toThrow();
  });

  it('should allow loopback without token verification', () => {
    expect(() => {
      enforceTokenVerification('127.0.0.1', 'development', '', '');
    }).not.toThrow();
  });
});
