/**
 * Port Discovery - Simple, robust port allocation
 *
 * Features:
 * - Try primary port, fall back to next available
 * - Works across platforms (no lsof dependency)
 * - Non-invasive, minimal overhead
 * - Outputs actual port for client discovery
 *
 * Usage:
 *   const port = await findAvailablePort(3000);  // Try 3000, then 3001, 3002...
 *   server.listen(port);
 *   console.log(`Ready at http://localhost:${port}`);
 */

import { createServer } from 'net';

/**
 * Find an available port starting from primaryPort
 * Tries up to 10 ports by default (primaryPort -> primaryPort+9)
 */
export async function findAvailablePort(
  primaryPort: number,
  maxAttempts: number = 10
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = primaryPort + attempt;

    try {
      const available = await isPortAvailable(port);
      if (available) {
        return port;
      }
    } catch {
      // Port check failed, try next
      continue;
    }
  }

  throw new Error(`No available ports between ${primaryPort} and ${primaryPort + maxAttempts - 1}`);
}

/**
 * Check if a specific port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = createServer();

    server.once('error', () => {
      // Port is in use
      resolve(false);
    });

    server.once('listening', () => {
      // Port is available
      server.close();
      resolve(true);
    });

    // Try to listen on the port
    server.listen(port, '127.0.0.1');

    // Timeout fallback (shouldn't happen, but safety)
    setTimeout(() => {
      server.close();
      resolve(false);
    }, 100);
  });
}

/**
 * Format port message for console output
 */
export function formatPortMessage(serviceName: string, port: number, primaryPort: number): string {
  if (port === primaryPort) {
    return `✅ ${serviceName} ready at http://localhost:${port}`;
  }

  return `✅ ${serviceName} ready at http://localhost:${port} (${primaryPort} was in use)`;
}
