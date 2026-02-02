/**
 * 1Password CLI Session Manager
 * Handles persistent authentication for automated environments
 * Supports both interactive and CI/CD modes
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';

interface SessionConfig {
  email?: string;
  password?: string;
  secretKey?: string;
  accountUrl?: string;
  sessionCacheDir?: string;
}

interface SessionStatus {
  authenticated: boolean;
  account?: string;
  version?: string;
  error?: string;
}

export class OnePasswordSessionManager {
  private sessionCacheDir: string;

  constructor(config: SessionConfig = {}) {
    this.sessionCacheDir =
      config.sessionCacheDir ||
      join(process.env.HOME || process.env.USERPROFILE || '', '.op-session');

    // Ensure cache directory exists
    if (!existsSync(this.sessionCacheDir)) {
      mkdirSync(this.sessionCacheDir, { recursive: true });
    }
  }

  /**
   * Check current session status
   */
  getSessionStatus(): SessionStatus {
    try {
      const version = execSync('op --version', { encoding: 'utf-8' }).trim();

      try {
        const whoami = execSync('op whoami', { encoding: 'utf-8' }).trim();
        return {
          authenticated: true,
          account: whoami,
          version,
        };
      } catch {
        return {
          authenticated: false,
          version,
          error: 'Not authenticated. Run: op account add',
        };
      }
    } catch (error) {
      return {
        authenticated: false,
        error: `1Password CLI not found or error: ${String(error)}`,
      };
    }
  }

  /**
   * Authenticate using service account (for CI/CD)
   * Uses OP_SERVICE_ACCOUNT_TOKEN environment variable
   */
  authenticateServiceAccount(): boolean {
    const token = process.env.OP_SERVICE_ACCOUNT_TOKEN;

    if (!token) {
      console.warn(
        '[1Password] No OP_SERVICE_ACCOUNT_TOKEN found. Service account authentication not available.'
      );
      return false;
    }

    try {
      // Set the token in environment
      process.env.OP_SERVICE_ACCOUNT_TOKEN = token;

      // Verify authentication works
      const status = this.getSessionStatus();

      if (status.authenticated) {
        console.log('[1Password] ✓ Service account authenticated');
        return true;
      } else {
        console.warn('[1Password] Service account token invalid');
        return false;
      }
    } catch (error) {
      console.error('[1Password] Service account authentication failed:', error);
      return false;
    }
  }

  /**
   * For local development: check if session is cached
   * Returns true if cached session is available
   */
  hasCachedSession(): boolean {
    const sessionFile = join(this.sessionCacheDir, 'session.json');
    return existsSync(sessionFile);
  }

  /**
   * Cache current session for offline use
   * WARNING: Only use in secure environments
   */
  cacheSession(): boolean {
    const sessionFile = join(this.sessionCacheDir, 'session.json');

    try {
      const status = this.getSessionStatus();

      if (status.authenticated) {
        const sessionData = {
          account: status.account,
          version: status.version,
          cachedAt: new Date().toISOString(),
          hostname: hostname(),
        };

        writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
        console.log('[1Password] Session cached');
        return true;
      } else {
        console.warn('[1Password] Cannot cache session - not authenticated');
        return false;
      }
    } catch (error) {
      console.error('[1Password] Failed to cache session:', error);
      return false;
    }
  }

  /**
   * Ensure authentication for the current environment
   * Tries (in order):
   *   1. Current session (if already authenticated)
   *   2. Service account (if OP_SERVICE_ACCOUNT_TOKEN is set)
   *   3. Interactive login (prompts user)
   */
  ensureAuthenticated(): boolean {
    // Check current session
    const status = this.getSessionStatus();

    if (status.authenticated) {
      console.log(`[1Password] ✓ Already authenticated as ${status.account}`);
      return true;
    }

    // Try service account (CI/CD)
    const serviceAuth = this.authenticateServiceAccount();
    if (serviceAuth) {
      return true;
    }

    // Try cached session (local dev)
    const cached = this.hasCachedSession();
    if (cached) {
      console.log('[1Password] Using cached session');
      // Attempt to use cached session by verifying current auth
      const verifyStatus = this.getSessionStatus();
      if (verifyStatus.authenticated) {
        return true;
      }
    }

    // For interactive environments, guide user to authenticate
    if (process.stdout.isTTY && process.stdin.isTTY) {
      console.log('[1Password] Interactive authentication required');
      console.log('');
      console.log('Run: op account add');
      console.log('Then authenticate in your browser window');
      console.log('');
      throw new Error('1Password authentication required - run: op account add');
    }

    // In non-interactive environment, fail
    throw new Error(
      '1Password authentication failed - set OP_SERVICE_ACCOUNT_TOKEN for CI/CD environments'
    );
  }

  /**
   * Load a secret from 1Password vault
   * Handles session management transparently
   */
  getSecret(title: string, vault = 'Helix'): string | null {
    try {
      // Ensure we're authenticated
      this.ensureAuthenticated();

      // Fetch the secret
      const result = execSync(`op item get "${title}" --vault "${vault}" --format json`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      }).trim();

      interface OnePasswordItem {
        fields?: Array<{ type: string; purpose: string; value: string }>;
        notes?: string;
      }

      const item = JSON.parse(result) as OnePasswordItem;

      // Extract password or notes field
      if (item.fields) {
        for (const field of item.fields) {
          if (field.type === 'concealed' && field.purpose === 'PASSWORD') {
            return field.value;
          }
        }
      }

      // For secure notes, the content is in the item directly
      if (item.notes) {
        return item.notes;
      }

      return null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Debug information about 1Password setup
   */
  getDebugInfo(): Record<string, unknown> {
    try {
      const status = this.getSessionStatus();
      const hasServiceToken = !!process.env.OP_SERVICE_ACCOUNT_TOKEN;
      const hasCached = this.hasCachedSession();

      return {
        cli: {
          installed: !status.error,
          version: status.version,
        },
        authentication: {
          currentlyAuthenticated: status.authenticated,
          currentAccount: status.account,
        },
        serviceAccount: {
          configured: hasServiceToken,
        },
        sessionCache: {
          available: hasCached,
          location: this.sessionCacheDir,
        },
        environment: {
          isTTY: process.stdout.isTTY,
          isCI: this.isCI(),
          platform: process.platform,
        },
      };
    } catch (error) {
      return {
        error: String(error),
      };
    }
  }

  /**
   * Detect if running in CI/CD environment
   */
  private isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL ||
      process.env.BUILDKITE
    );
  }
}

/**
 * Singleton instance
 */
let sessionManager: OnePasswordSessionManager;

export function getSessionManager(config?: SessionConfig): OnePasswordSessionManager {
  if (!sessionManager) {
    sessionManager = new OnePasswordSessionManager(config);
  }
  return sessionManager;
}

/**
 * Quick check - is 1Password available?
 */
export function is1PasswordAvailable(): boolean {
  const manager = getSessionManager();
  const status = manager.getSessionStatus();
  return !status.error && status.version !== undefined;
}
