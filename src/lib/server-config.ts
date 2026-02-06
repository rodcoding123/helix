/**
 * Server Configuration - Centralized service discovery
 *
 * Pattern: Each service reads/writes its actual port to environment
 * This allows cross-platform clients to discover where services are running
 *
 * For Supabase real-time sync: Ports don't matter since we use HTTP/WebSocket
 * abstracted through API clients (no hardcoded URLs in queries)
 */

export interface ServerConfig {
  gateway: {
    primaryPort: number;
    maxAttempts: number;
  };
  web: {
    primaryPort: number;
    maxAttempts: number;
  };
  cli: {
    primaryPort: number;
    maxAttempts: number;
  };
}

/**
 * Default configuration - can be overridden by environment variables
 */
export const DEFAULT_CONFIG: ServerConfig = {
  gateway: {
    primaryPort: parseInt(process.env.GATEWAY_PORT || '3000'),
    maxAttempts: 10,
  },
  web: {
    primaryPort: parseInt(process.env.WEB_PORT || '5173'),
    maxAttempts: 10,
  },
  cli: {
    primaryPort: parseInt(process.env.CLI_PORT || '3100'),
    maxAttempts: 10,
  },
};

/**
 * Store actual port after discovery (for client discovery)
 * Environment variables are the standard way to pass config across processes
 */
export function setActualPort(service: 'gateway' | 'web' | 'cli', port: number): void {
  const envVar = `${service.toUpperCase()}_ACTUAL_PORT`;
  process.env[envVar] = port.toString();

  // Also write to a simple .env.local file for CLI tools to read
  // (This is optional - mainly useful for cross-process discovery)
  try {
    const fs = require('fs');
    const path = require('path');
    const envFile = path.join(process.cwd(), '.env.local');

    // Simple append (not ideal but works for dev)
    fs.appendFileSync(envFile, `\n${envVar}=${port}\n`);
  } catch {
    // Fail silently - env var is sufficient
  }
}

/**
 * Get actual port of a service
 */
export function getActualPort(service: 'gateway' | 'web' | 'cli'): number | undefined {
  const envVar = `${service.toUpperCase()}_ACTUAL_PORT`;
  const port = process.env[envVar];
  return port ? parseInt(port) : undefined;
}

/**
 * Get full URL for a service (useful for API clients)
 */
export function getServiceUrl(service: 'gateway' | 'web' | 'cli', path: string = ''): string {
  const port = getActualPort(service);
  if (!port) {
    throw new Error(
      `Service ${service} port not discovered. Is it running? Check ${service.toUpperCase()}_ACTUAL_PORT`
    );
  }

  const protocol = service === 'web' ? 'http' : 'http';
  return `${protocol}://localhost:${port}${path}`;
}
