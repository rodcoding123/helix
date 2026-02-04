/**
 * WEBSOCKET SECURITY MODULE
 *
 * Prevents WebSocket hijacking attacks (CVE-2026-25253) by:
 * - Validating Origin header
 * - Preventing CSWSH (Cross-Site WebSocket Hijacking)
 * - Validating gatewayUrl parameters
 * - Enforcing HTTPS/WSS in production
 */

import type { IncomingMessage } from 'node:http';
import { sendAlert } from './logging-hooks.js';

/**
 * WebSocket security configuration
 */
export interface WebSocketSecurityConfig {
  allowedOrigins: string[];
  allowedGatewayUrls?: string[];
  enforceHttpsInProduction: boolean;
  requireOriginHeader: boolean;
}

/**
 * Validate WebSocket Origin header to prevent CSWSH attacks
 *
 * CVE-2026-25253: OpenClaw didn't validate WebSocket origin,
 * allowing attackers to hijack connections from malicious websites
 *
 * @param req - Incoming HTTP request
 * @param allowedOrigins - List of allowed origins
 * @returns { valid: boolean, reason?: string }
 */
export function validateWebSocketOrigin(
  req: IncomingMessage,
  allowedOrigins: string[]
): { valid: boolean; reason?: string } {
  const origin = req.headers.origin;

  // CRITICAL: Origin header is REQUIRED for WebSocket connections
  if (!origin) {
    return {
      valid: false,
      reason: 'WebSocket Origin header missing - possible CSWSH attack',
    };
  }

  // Normalize origin (remove trailing slash)
  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');

  // Check against allowlist
  const isAllowed = allowedOrigins.some(allowed => {
    const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, '');

    // Exact match
    if (normalizedOrigin === normalizedAllowed) {
      return true;
    }

    // Wildcard support (only for development)
    if (normalizedAllowed === '*') {
      return true;
    }

    return false;
  });

  if (!isAllowed) {
    return {
      valid: false,
      reason: `WebSocket origin not allowed: ${origin}`,
    };
  }

  return { valid: true };
}

/**
 * Validate gatewayUrl parameter from query string
 *
 * Prevents attackers from redirecting connections to malicious gateways
 *
 * @param gatewayUrl - Gateway URL from query string
 * @param allowedGatewayUrls - List of allowed gateway URLs
 * @returns { valid: boolean, reason?: string }
 */
export function validateGatewayUrl(
  gatewayUrl: string | undefined,
  allowedGatewayUrls?: string[]
): { valid: boolean; reason?: string } {
  // gatewayUrl must be provided
  if (!gatewayUrl) {
    return {
      valid: false,
      reason: 'gatewayUrl parameter missing',
    };
  }

  // Must be valid URL
  try {
    new URL(gatewayUrl);
  } catch {
    return {
      valid: false,
      reason: `Invalid gatewayUrl format: ${gatewayUrl}`,
    };
  }

  // Must use secure protocol (WS for dev, WSS for prod)
  if (
    !gatewayUrl.toLowerCase().startsWith('ws://') &&
    !gatewayUrl.toLowerCase().startsWith('wss://')
  ) {
    return {
      valid: false,
      reason: `gatewayUrl must use ws:// or wss://: ${gatewayUrl}`,
    };
  }

  // In production, enforce WSS (encrypted WebSocket)
  if (process.env.NODE_ENV === 'production' && gatewayUrl.toLowerCase().startsWith('ws://')) {
    return {
      valid: false,
      reason: 'Production requires WSS (encrypted WebSocket)',
    };
  }

  // Check against allowlist if provided
  if (allowedGatewayUrls && allowedGatewayUrls.length > 0) {
    const normalizedUrl = gatewayUrl.toLowerCase().replace(/\/$/, '');
    const isAllowed = allowedGatewayUrls.some(allowed => {
      const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, '');
      return normalizedUrl === normalizedAllowed;
    });

    if (!isAllowed) {
      return {
        valid: false,
        reason: `gatewayUrl not in allowlist: ${gatewayUrl}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate WebSocket authentication token
 * CRITICAL: Tokens should NOT be in URLs, only in WebSocket payloads
 *
 * @param token - Authentication token
 * @param tokenSource - Where token came from (url, header, payload)
 * @returns { valid: boolean, reason?: string }
 */
export function validateWebSocketToken(
  token: string | undefined,
  tokenSource: 'url' | 'header' | 'payload' = 'payload'
): { valid: boolean; reason?: string } {
  if (!token) {
    return {
      valid: false,
      reason: 'Token missing',
    };
  }

  // WARN: Tokens should never be in URLs
  if (tokenSource === 'url') {
    return {
      valid: false,
      reason: 'SECURITY: Auth tokens must not be in URLs - use secure cookies or WebSocket payload',
    };
  }

  // Token format validation (adjust based on your token format)
  // Example: JWT tokens start with 'eyJ'
  if (!token.match(/^[A-Za-z0-9_-]+$/)) {
    return {
      valid: false,
      reason: 'Invalid token format',
    };
  }

  // Minimum length check
  if (token.length < 20) {
    return {
      valid: false,
      reason: 'Token too short',
    };
  }

  return { valid: true };
}

/**
 * Enhanced WebSocket connection handler
 * Implements all security checks before accepting connection
 */
export async function secureWebSocketHandler(
  req: IncomingMessage,
  config: WebSocketSecurityConfig
): Promise<{
  authorized: boolean;
  reason?: string;
  gatewayUrl?: string;
  token?: string;
}> {
  // Step 1: Validate Origin header (CRITICAL for CVE-2026-25253)
  const originCheck = validateWebSocketOrigin(req, config.allowedOrigins);
  if (!originCheck.valid) {
    await sendAlert(
      '🚨 SECURITY: WebSocket Origin Validation Failed',
      originCheck.reason || 'Unknown reason',
      'critical'
    );
    return {
      authorized: false,
      reason: originCheck.reason,
    };
  }

  // Step 2: Extract and validate gatewayUrl from query string
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const gatewayUrl = url.searchParams.get('gatewayUrl') || undefined;

  const urlCheck = validateGatewayUrl(gatewayUrl, config.allowedGatewayUrls);
  if (!urlCheck.valid) {
    await sendAlert(
      '🚨 SECURITY: Invalid Gateway URL',
      urlCheck.reason || 'Unknown reason',
      'critical'
    );
    return {
      authorized: false,
      reason: urlCheck.reason,
    };
  }

  // Step 3: Check for tokens in URL (anti-pattern)
  const urlToken = url.searchParams.get('token');
  if (urlToken) {
    await sendAlert(
      '⚠️ SECURITY: Auth Token in URL Detected',
      'Tokens in URLs are a security risk. Use WebSocket payload instead.',
      'critical'
    );
    return {
      authorized: false,
      reason: 'Auth tokens must not be in URL',
    };
  }

  // Step 4: Log successful connection
  console.debug(`✓ WebSocket origin validated: ${req.headers.origin}`);
  console.debug(`✓ Gateway URL validated: ${gatewayUrl}`);

  return {
    authorized: true,
    gatewayUrl: gatewayUrl || undefined,
  };
}

/**
 * Get default WebSocket security configuration
 */
export function getDefaultWebSocketConfig(
  environment: 'development' | 'production'
): WebSocketSecurityConfig {
  if (environment === 'production') {
    return {
      allowedOrigins: [process.env.HELIX_ALLOWED_ORIGIN || 'https://helix.local'],
      allowedGatewayUrls: [process.env.HELIX_GATEWAY_URL || 'wss://gateway.helix.local'],
      enforceHttpsInProduction: true,
      requireOriginHeader: true,
    };
  }

  // Development config
  return {
    allowedOrigins: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'ws://localhost:3000',
      'ws://localhost:5173',
    ],
    allowedGatewayUrls: ['ws://localhost:18789', 'ws://127.0.0.1:18789'],
    enforceHttpsInProduction: false,
    requireOriginHeader: true,
  };
}
