/**
 * Helix CLI Login - OAuth PKCE Browser Flow
 *
 * Implements `helix login` command:
 * 1. Starts temporary HTTP server on random port
 * 2. Opens browser to Supabase OAuth URL
 * 3. Receives callback with auth code
 * 4. Exchanges code for session
 * 5. Stores credentials locally
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// Types
interface HelixCredentials {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  expiresAt: number;
  storedAt: string;
}

interface LoginResult {
  success: boolean;
  email?: string;
  userId?: string;
  error?: string;
}

const CREDENTIALS_DIR = join(homedir(), '.helix');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

/**
 * Start the CLI login flow
 * Opens browser for OAuth, waits for callback, stores credentials
 */
export async function cliLogin(supabaseUrl: string, supabaseAnonKey: string): Promise<LoginResult> {
  try {
    // 1. Start temporary HTTP server on random port
    const { port, waitForCallback, close } = await startCallbackServer();

    const redirectUri = `http://127.0.0.1:${port}/auth/callback`;

    // 2. Build Supabase OAuth URL with PKCE
    const authUrl = buildAuthUrl(supabaseUrl, supabaseAnonKey, redirectUri);

    console.log('Opening browser for authentication...');
    console.log(`If browser doesn't open, visit: ${authUrl}`);

    // Try to open browser
    await openBrowser(authUrl);

    // 3. Wait for callback
    console.log('Waiting for authentication...');
    const callbackResult = await waitForCallback();

    // 4. Close the server
    close();

    if (callbackResult.error) {
      return { success: false, error: callbackResult.error };
    }

    if (!callbackResult.accessToken || !callbackResult.refreshToken) {
      return { success: false, error: 'No tokens received from OAuth callback' };
    }

    // 5. Decode user info from access token
    const userInfo = decodeJwtPayload(callbackResult.accessToken);

    // 6. Store credentials
    const credentials: HelixCredentials = {
      accessToken: callbackResult.accessToken,
      refreshToken: callbackResult.refreshToken,
      userId: userInfo?.sub || '',
      email: userInfo?.email || '',
      expiresAt: userInfo?.exp || 0,
      storedAt: new Date().toISOString(),
    };

    await storeCredentials(credentials);

    console.log(`\nLogged in as ${credentials.email}`);
    return {
      success: true,
      email: credentials.email,
      userId: credentials.userId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return { success: false, error: message };
  }
}

/**
 * Log out - clear stored credentials
 */
export async function cliLogout(): Promise<void> {
  try {
    await writeFile(CREDENTIALS_FILE, '{}', 'utf-8');
    console.log('Logged out successfully');
  } catch {
    // File might not exist - that's fine
    console.log('Already logged out');
  }
}

/**
 * Show current user info
 */
export async function cliWhoami(): Promise<void> {
  try {
    const credentials = await loadCredentials();
    if (!credentials?.email) {
      console.log('Not logged in. Run `helix login` to authenticate.');
      return;
    }

    const isExpired = credentials.expiresAt < Math.floor(Date.now() / 1000);
    console.log(`Email: ${credentials.email}`);
    console.log(`User ID: ${credentials.userId}`);
    console.log(`Session: ${isExpired ? 'Expired (run helix login)' : 'Active'}`);
  } catch {
    console.log('Not logged in. Run `helix login` to authenticate.');
  }
}

/**
 * Load stored credentials
 */
export async function loadCredentials(): Promise<HelixCredentials | null> {
  try {
    const data = await readFile(CREDENTIALS_FILE, 'utf-8');
    const credentials = JSON.parse(data) as HelixCredentials;
    if (!credentials.accessToken) return null;
    return credentials;
  } catch {
    return null;
  }
}

// Internal helpers

function startCallbackServer(): Promise<{
  port: number;
  waitForCallback: () => Promise<{ accessToken?: string; refreshToken?: string; error?: string }>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    let callbackResolve: (result: {
      accessToken?: string;
      refreshToken?: string;
      error?: string;
    }) => void;
    const callbackPromise = new Promise<{
      accessToken?: string;
      refreshToken?: string;
      error?: string;
    }>(res => {
      callbackResolve = res;
    });

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://127.0.0.1`);

      if (url.pathname === '/auth/callback') {
        // Extract tokens from hash fragment - serve a page that reads them
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Helix - Authentication</title></head>
          <body style="background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="text-align:center">
              <h1>Authenticating...</h1>
              <p id="status">Processing login...</p>
            </div>
            <script>
              // Supabase puts tokens in the hash fragment
              const hash = window.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              const error = params.get('error_description') || params.get('error');

              // Also check query params for code flow
              const urlParams = new URLSearchParams(window.location.search);
              const code = urlParams.get('code');

              fetch('/auth/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken, refreshToken, error, code }),
              }).then(() => {
                document.getElementById('status').textContent = 'Login successful! You can close this tab.';
              });
            </script>
          </body>
          </html>
        `);
      } else if (url.pathname === '/auth/complete' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as {
              accessToken?: string;
              refreshToken?: string;
              error?: string;
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            callbackResolve(data);
          } catch {
            res.writeHead(400);
            res.end('Bad request');
            callbackResolve({ error: 'Invalid callback data' });
          }
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        port,
        waitForCallback: () => callbackPromise,
        close: () => server.close(),
      });
    });

    server.on('error', reject);
  });
}

function buildAuthUrl(supabaseUrl: string, anonKey: string, redirectUri: string): string {
  const params = new URLSearchParams({
    provider: 'github',
    redirect_to: redirectUri,
  });
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}

function decodeJwtPayload(token: string): { sub?: string; email?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString();
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function storeCredentials(credentials: HelixCredentials): Promise<void> {
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      await execAsync(`open "${url}"`);
    } else if (platform === 'win32') {
      await execAsync(`start "" "${url}"`);
    } else {
      await execAsync(`xdg-open "${url}"`);
    }
  } catch {
    // Browser open failed - user will need to manually visit the URL
  }
}
