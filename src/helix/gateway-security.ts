/**
 * Gateway Security Module
 * Validates and secures gateway binding configuration
 *
 * SECURITY: Prevents gateway exposure to untrusted networks
 */

export interface GatewayBindConfig {
  host: string;
  port: number;
  authRequired?: boolean;
}

export interface BindValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

/**
 * Validate gateway bind configuration
 * Checks for security risks in binding to network interfaces
 *
 * @param config - Gateway bind configuration
 * @returns Validation result with warnings and recommendations
 */
export function validateGatewayBind(config: GatewayBindConfig): BindValidationResult {
  const result: BindValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    recommendations: [],
  };

  // Check for 0.0.0.0 (bind to all interfaces)
  if (config.host === '0.0.0.0') {
    result.warnings.push('Gateway bound to 0.0.0.0 - exposed to all network interfaces');
    result.recommendations.push('Use 127.0.0.1 (localhost) for local development');
    result.recommendations.push(
      'Use private IP (192.168.*, 10.*, 172.16-31.*) for internal networks'
    );

    // Require authentication if binding to 0.0.0.0
    if (!config.authRequired) {
      result.errors.push('Authentication REQUIRED when binding to 0.0.0.0');
      result.valid = false;
    } else {
      result.warnings.push('Authentication enabled - verify tokens cannot be bypassed');
    }
  }

  // Check for localhost (safe)
  if (config.host === '127.0.0.1' || config.host === 'localhost') {
    // Safe binding - no warnings
  }

  // Check for private IPs (generally safe but warn)
  if (isPrivateIP(config.host)) {
    result.warnings.push(
      `Gateway bound to private IP ${config.host} - ensure firewall protects this network`
    );
  }

  // Check port
  if (config.port < 1024) {
    result.warnings.push(`Port ${config.port} requires elevated privileges (root/sudo)`);
  }

  if (config.port === 80 || config.port === 443) {
    result.warnings.push(
      `Port ${config.port} is standard HTTP/HTTPS - may conflict with other services`
    );
  }

  return result;
}

/**
 * Check if host is a private IP address
 */
function isPrivateIP(host: string): boolean {
  const privatePatterns = [
    /^127\./, // 127.0.0.0/8 (loopback)
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^169\.254\./, // 169.254.0.0/16 (link-local)
    /^fc/, // fc00::/7 (IPv6 private)
    /^fd/, // fd00::/8 (IPv6 private)
  ];

  return privatePatterns.some(pattern => pattern.test(host));
}

/**
 * Log gateway security status
 * Should be called during gateway initialization
 */
export function logGatewaySecurityStatus(config: GatewayBindConfig): void {
  const validation = validateGatewayBind(config);

  console.log('[Helix] Gateway Security Check:');
  console.log(`  Bind: ${config.host}:${config.port}`);
  console.log(`  Auth: ${config.authRequired ? 'Required' : 'Not enforced'}`);

  if (validation.errors.length > 0) {
    console.error('[Helix] ❌ SECURITY ERRORS:');
    for (const error of validation.errors) {
      console.error(`    - ${error}`);
    }
  }

  if (validation.warnings.length > 0) {
    console.warn('[Helix] ⚠️  SECURITY WARNINGS:');
    for (const warning of validation.warnings) {
      console.warn(`    - ${warning}`);
    }
  }

  if (validation.recommendations.length > 0) {
    console.warn('[Helix] 💡 RECOMMENDATIONS:');
    for (const rec of validation.recommendations) {
      console.warn(`    - ${rec}`);
    }
  }

  if (!validation.valid) {
    console.error('[Helix] ❌ Gateway configuration INVALID - security checks failed');
    process.exit(1);
  } else {
    console.log('[Helix] ✓ Gateway security check passed');
  }
}

/**
 * Enforce secure gateway configuration
 * Throws error if configuration is insecure
 */
export function enforceSecureGateway(config: GatewayBindConfig): void {
  const validation = validateGatewayBind(config);

  if (!validation.valid) {
    throw new Error(`Gateway configuration insecure: ${validation.errors.join('; ')}`);
  }

  // Warn about exposed binding
  if (config.host === '0.0.0.0' && !config.authRequired) {
    throw new Error(
      'Cannot bind to 0.0.0.0 without authentication - this would expose the gateway publicly'
    );
  }
}
