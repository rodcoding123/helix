/**
 * WebSocket Security Tests
 * Tests origin validation, gateway URL validation, and token security
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  validateWebSocketOrigin,
  validateGatewayUrl,
  validateWebSocketToken,
  secureWebSocketHandler,
  getDefaultWebSocketConfig,
} from './websocket-security.js';
import * as loggingHooks from './logging-hooks.js';

// Mock logging hooks
vi.mock('./logging-hooks.js', () => ({
  sendAlert: vi.fn().mockResolvedValue(undefined),
}));

describe('WebSocket Security', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.HELIX_ALLOWED_ORIGIN;
    delete process.env.HELIX_GATEWAY_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateWebSocketOrigin', () => {
    const mockRequest = (origin?: string): IncomingMessage =>
      ({
        headers: { origin },
      }) as IncomingMessage;

    it('should accept valid origin', () => {
      const req = mockRequest('http://localhost:3000');
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject missing origin header', () => {
      const req = mockRequest(undefined);
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('missing');
    });

    it('should be case-insensitive', () => {
      const req = mockRequest('HTTP://LOCALHOST:3000');
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.valid).toBe(true);
    });

    it('should normalize trailing slashes', () => {
      const req = mockRequest('http://localhost:3000/');
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.valid).toBe(true);
    });

    it('should support wildcard origin', () => {
      const req = mockRequest('http://any-domain.example.com');
      const result = validateWebSocketOrigin(req, ['*']);

      expect(result.valid).toBe(true);
    });

    it('should reject origin not in allowlist', () => {
      const req = mockRequest('http://attacker.com');
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('should handle multiple allowed origins', () => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
      ];

      const req1 = mockRequest('http://localhost:3000');
      expect(validateWebSocketOrigin(req1, allowedOrigins).valid).toBe(true);

      const req2 = mockRequest('http://localhost:5173');
      expect(validateWebSocketOrigin(req2, allowedOrigins).valid).toBe(true);

      const req3 = mockRequest('http://evil.com');
      expect(validateWebSocketOrigin(req3, allowedOrigins).valid).toBe(false);
    });

    it('should be case-insensitive for allowlist', () => {
      const req = mockRequest('http://LOCALHOST:3000');
      const result = validateWebSocketOrigin(req, ['HTTP://localhost:3000']);

      expect(result.valid).toBe(true);
    });

    it('should handle https origins', () => {
      const req = mockRequest('https://example.com');
      const result = validateWebSocketOrigin(req, ['https://example.com']);

      expect(result.valid).toBe(true);
    });

    it('should detect CSWSH attacks (missing origin)', () => {
      const req = mockRequest(undefined);
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.reason).toContain('CSWSH');
    });
  });

  describe('validateGatewayUrl', () => {
    it('should accept valid ws:// URL', () => {
      const result = validateGatewayUrl('ws://localhost:18789');

      expect(result.valid).toBe(true);
    });

    it('should accept valid wss:// URL', () => {
      const result = validateGatewayUrl('wss://gateway.helix.local');

      expect(result.valid).toBe(true);
    });

    it('should reject missing gatewayUrl', () => {
      const result = validateGatewayUrl(undefined);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('missing');
    });

    it('should reject invalid URL format', () => {
      const result = validateGatewayUrl('not-a-valid-url');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid');
    });

    it('should reject non-WebSocket protocols', () => {
      const result = validateGatewayUrl('http://localhost:3000');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('ws:// or wss://');
    });

    it('should reject https URLs (must be ws/wss)', () => {
      const result = validateGatewayUrl('https://gateway.helix.local');

      expect(result.valid).toBe(false);
    });

    it('should enforce WSS in production', () => {
      process.env.NODE_ENV = 'production';

      const result = validateGatewayUrl('ws://localhost:18789');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('WSS');
    });

    it('should allow WS in development', () => {
      process.env.NODE_ENV = 'development';

      const result = validateGatewayUrl('ws://localhost:18789');

      expect(result.valid).toBe(true);
    });

    it('should normalize trailing slash', () => {
      const result = validateGatewayUrl('ws://localhost:18789/');

      expect(result.valid).toBe(true);
    });

    it('should check against allowlist', () => {
      const allowedUrls = ['wss://gateway1.helix.local', 'wss://gateway2.helix.local'];

      expect(validateGatewayUrl('wss://gateway1.helix.local', allowedUrls).valid).toBe(true);
      expect(validateGatewayUrl('wss://gateway.evil.com', allowedUrls).valid).toBe(false);
    });

    it('should handle port numbers in URL', () => {
      const result = validateGatewayUrl('wss://gateway.helix.local:8443');

      expect(result.valid).toBe(true);
    });

    it('should be case-insensitive', () => {
      const result = validateGatewayUrl('WSS://GATEWAY.HELIX.LOCAL');

      expect(result.valid).toBe(true);
    });
  });

  describe('validateWebSocketToken', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9-eyJzdWIiOiIxMjM0NTY3ODkwIn0-dGhpcw';

    it('should accept valid token in payload', () => {
      const result = validateWebSocketToken(validToken, 'payload');

      expect(result.valid).toBe(true);
    });

    it('should accept valid token in header', () => {
      const result = validateWebSocketToken(validToken, 'header');

      expect(result.valid).toBe(true);
    });

    it('should reject token in URL', () => {
      const result = validateWebSocketToken(validToken, 'url');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must not be in URLs');
    });

    it('should reject missing token', () => {
      const result = validateWebSocketToken(undefined);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('missing');
    });

    it('should reject invalid token format', () => {
      const result = validateWebSocketToken('invalid!@#$%^');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid token format');
    });

    it('should reject token too short', () => {
      const result = validateWebSocketToken('short');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should accept token with hyphens and underscores', () => {
      const result = validateWebSocketToken('eyJ-_ABC123xyz-_DEF456uvw-_GHI789');

      expect(result.valid).toBe(true);
    });

    it('should enforce minimum length of 20 chars', () => {
      const tooShort = 'ABC123xyz_-DEF456uvw'; // 20 chars exactly
      const result = validateWebSocketToken(tooShort);

      expect(result.valid).toBe(true);
    });

    it('should reject 19 char token', () => {
      const result = validateWebSocketToken('ABC123xyz_-DEF456u'); // 19 chars

      expect(result.valid).toBe(false);
    });

    it('should handle JWT tokens', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      expect(validateWebSocketToken(jwtToken).valid).toBe(true);
    });
  });

  describe('secureWebSocketHandler', () => {
    const mockRequest = (origin?: string, gatewayUrl?: string, token?: string): IncomingMessage => {
      const url = new URL('http://localhost:3000');
      if (gatewayUrl) url.searchParams.set('gatewayUrl', gatewayUrl);
      if (token) url.searchParams.set('token', token);

      return {
        headers: { origin, host: 'localhost:3000' },
        url: url.pathname + url.search,
      } as IncomingMessage;
    };

    const config = {
      allowedOrigins: ['http://localhost:3000'],
      allowedGatewayUrls: ['ws://localhost:18789'],
      enforceHttpsInProduction: false,
      requireOriginHeader: true,
    };

    it('should authorize valid request', async () => {
      const req = mockRequest('http://localhost:3000', 'ws://localhost:18789');

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject invalid origin', async () => {
      const req = mockRequest('http://attacker.com', 'ws://localhost:18789');

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('should reject invalid gateway URL', async () => {
      const req = mockRequest('http://localhost:3000', 'http://localhost:3000');

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(false);
    });

    it('should reject token in URL', async () => {
      const req = mockRequest(
        'http://localhost:3000',
        'ws://localhost:18789',
        'secret_token_12345'
      );

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('tokens must not be in URL');
    });

    it('should return authorized with gatewayUrl', async () => {
      const req = mockRequest('http://localhost:3000', 'ws://localhost:18789');

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(true);
      expect(result.gatewayUrl).toBe('ws://localhost:18789');
    });

    it('should send alert on origin failure', async () => {
      const req = mockRequest('http://attacker.com', 'ws://localhost:18789');
      const sendAlertSpy = vi.spyOn(loggingHooks, 'sendAlert');

      await secureWebSocketHandler(req, config);

      expect(sendAlertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Origin Validation Failed'),
        expect.any(String),
        'critical'
      );
    });

    it('should send alert on invalid gateway URL', async () => {
      const req = mockRequest('http://localhost:3000', 'http://invalid.com');
      const sendAlertSpy = vi.spyOn(loggingHooks, 'sendAlert');

      await secureWebSocketHandler(req, config);

      expect(sendAlertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid Gateway URL'),
        expect.any(String),
        'critical'
      );
    });

    it('should send alert on token in URL', async () => {
      const req = mockRequest('http://localhost:3000', 'ws://localhost:18789', 'token_value');
      const sendAlertSpy = vi.spyOn(loggingHooks, 'sendAlert');

      await secureWebSocketHandler(req, config);

      expect(sendAlertSpy).toHaveBeenCalledWith(
        expect.stringContaining('Token in URL'),
        expect.any(String),
        'critical'
      );
    });

    it('should handle missing gatewayUrl', async () => {
      const req = mockRequest('http://localhost:3000', undefined);

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(false);
    });

    it('should complete all validation steps', async () => {
      const req = mockRequest('http://localhost:3000', 'ws://localhost:18789');

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(true);
      expect(result.gatewayUrl).toBeDefined();
    });
  });

  describe('getDefaultWebSocketConfig', () => {
    it('should return development config', () => {
      const config = getDefaultWebSocketConfig('development');

      expect(config.enforceHttpsInProduction).toBe(false);
      expect(config.allowedOrigins.length).toBeGreaterThan(0);
      expect(config.allowedGatewayUrls).toContain('ws://localhost:18789');
    });

    it('should include localhost origins in dev', () => {
      const config = getDefaultWebSocketConfig('development');

      expect(config.allowedOrigins.some(origin => origin.includes('localhost'))).toBe(true);
    });

    it('should include 127.0.0.1 origins in dev', () => {
      const config = getDefaultWebSocketConfig('development');

      expect(config.allowedOrigins.some(origin => origin.includes('127.0.0.1'))).toBe(true);
    });

    it('should return production config', () => {
      const config = getDefaultWebSocketConfig('production');

      expect(config.enforceHttpsInProduction).toBe(true);
      expect(config.requireOriginHeader).toBe(true);
    });

    it('should use environment variables in production', () => {
      process.env.HELIX_ALLOWED_ORIGIN = 'https://helix.example.com';
      process.env.HELIX_GATEWAY_URL = 'wss://gateway.example.com';

      const config = getDefaultWebSocketConfig('production');

      expect(config.allowedOrigins).toContain('https://helix.example.com');
      expect(config.allowedGatewayUrls).toContain('wss://gateway.example.com');
    });

    it('should have sensible defaults for production', () => {
      const config = getDefaultWebSocketConfig('production');

      expect(config.allowedOrigins.length).toBeGreaterThan(0);
      expect(config.allowedGatewayUrls).toBeDefined();
    });

    it('should require origin header in both environments', () => {
      const devConfig = getDefaultWebSocketConfig('development');
      const prodConfig = getDefaultWebSocketConfig('production');

      expect(devConfig.requireOriginHeader).toBe(true);
      expect(prodConfig.requireOriginHeader).toBe(true);
    });

    it('should include port 5173 (Vite default) in dev', () => {
      const config = getDefaultWebSocketConfig('development');

      expect(config.allowedOrigins.some(origin => origin.includes('5173'))).toBe(true);
    });

    it('should include port 3000 (common) in dev', () => {
      const config = getDefaultWebSocketConfig('development');

      expect(config.allowedOrigins.some(origin => origin.includes('3000'))).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should prevent CSWSH attacks', () => {
      const req = { headers: { host: 'localhost' } } as IncomingMessage;
      const result = validateWebSocketOrigin(req, ['http://localhost:3000']);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('missing');
    });

    it('should enforce protocol security', () => {
      process.env.NODE_ENV = 'production';

      const result = validateGatewayUrl('ws://localhost:18789');

      expect(result.valid).toBe(false);
    });

    it('should prevent token leakage via URL', () => {
      const result = validateWebSocketToken('token123456789abc', 'url');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must not be in URLs');
    });

    it('should validate all fields in secure handler', async () => {
      const config = {
        allowedOrigins: ['http://localhost:3000'],
        allowedGatewayUrls: ['ws://localhost:18789'],
        enforceHttpsInProduction: false,
        requireOriginHeader: true,
      };

      const req = {
        headers: { origin: undefined, host: 'localhost' },
        url: '/?gatewayUrl=ws://localhost:18789',
      } as IncomingMessage;

      const result = await secureWebSocketHandler(req, config);

      expect(result.authorized).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should validate origin quickly', () => {
      const req = { headers: { origin: 'http://localhost:3000' } } as IncomingMessage;

      const start = performance.now();
      validateWebSocketOrigin(req, ['http://localhost:3000']);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should validate gateway URL quickly', () => {
      const start = performance.now();
      validateGatewayUrl('ws://localhost:18789');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should validate token quickly', () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';

      const start = performance.now();
      validateWebSocketToken(token);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should handle secure handler quickly', async () => {
      const config = {
        allowedOrigins: ['http://localhost:3000'],
        allowedGatewayUrls: ['ws://localhost:18789'],
        enforceHttpsInProduction: false,
        requireOriginHeader: true,
      };

      const req = {
        headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
        url: '/?gatewayUrl=ws://localhost:18789',
      } as IncomingMessage;

      const start = performance.now();
      await secureWebSocketHandler(req, config);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
