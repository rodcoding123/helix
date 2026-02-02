/**
 * OAuth Flow Hook for Helix Desktop
 * Handles browser-based OAuth and device code flows
 *
 * IMPORTANT: Most AI providers don't have public OAuth for third-party apps.
 * Only GitHub Copilot has a proper device code flow we can use.
 * Others should use API keys with helpful "Get API Key" links.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';

// GitHub Device Code Flow - This is the only one that actually works
// without a registered OAuth app
const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98';
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Provider configurations
// Only github-copilot has real OAuth - others redirect to get API key
const OAUTH_PROVIDERS: Record<string, {
  name: string;
  type: 'device-code' | 'api-key-redirect';
  // For device-code flow
  authUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  scopes?: string[];
  // For api-key-redirect - opens the page to get API key
  keyUrl?: string;
}> = {
  'token': {
    name: 'Anthropic (Claude)',
    type: 'api-key-redirect',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  'openai-codex': {
    name: 'OpenAI',
    type: 'api-key-redirect',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  'github-copilot': {
    name: 'GitHub Copilot',
    type: 'device-code',
    authUrl: GITHUB_DEVICE_CODE_URL,
    tokenUrl: GITHUB_ACCESS_TOKEN_URL,
    clientId: GITHUB_CLIENT_ID,
    scopes: ['read:user'],
  },
  'google-gemini-cli': {
    name: 'Google (Gemini)',
    type: 'api-key-redirect',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  'google-antigravity': {
    name: 'Google (Antigravity)',
    type: 'api-key-redirect',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  'minimax-portal': {
    name: 'MiniMax',
    type: 'api-key-redirect',
    keyUrl: 'https://www.minimax.chat/user/basic',
  },
  'qwen-portal': {
    name: 'Qwen',
    type: 'api-key-redirect',
    keyUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
};

export type OAuthStatus =
  | 'idle'
  | 'initiating'
  | 'waiting-browser'
  | 'waiting-device-code'
  | 'polling'
  | 'success'
  | 'error'
  | 'cancelled';

interface DeviceCodeInfo {
  userCode: string;
  verificationUrl: string;
  expiresAt: number;
}

interface OAuthResult {
  success: boolean;
  token?: string;
  error?: string;
  provider?: string;
}

export function useOAuth() {
  const [status, setStatus] = useState<OAuthStatus>('idle');
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const pollIntervalRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  /**
   * Start GitHub Device Code Flow
   */
  const startGitHubDeviceFlow = useCallback(async (): Promise<OAuthResult> => {
    abortRef.current = false;
    setStatus('initiating');
    setError(null);

    try {
      // Request device code
      const body = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        scope: 'read:user',
      });

      const res = await fetch(GITHUB_DEVICE_CODE_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!res.ok) {
        throw new Error(`GitHub device code request failed: ${res.status}`);
      }

      const data = await res.json();

      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error('Invalid device code response');
      }

      const deviceInfo: DeviceCodeInfo = {
        userCode: data.user_code,
        verificationUrl: data.verification_uri,
        expiresAt: Date.now() + (data.expires_in || 900) * 1000,
      };

      setDeviceCode(deviceInfo);
      setStatus('waiting-device-code');

      // Open browser to verification URL
      await openUrl(data.verification_uri);

      // Poll for access token
      setStatus('polling');
      const intervalMs = Math.max(1000, (data.interval || 5) * 1000);

      return new Promise((resolve) => {
        const pollForToken = async () => {
          if (abortRef.current || Date.now() > deviceInfo.expiresAt) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setStatus(abortRef.current ? 'cancelled' : 'error');
            setError(abortRef.current ? 'Cancelled' : 'Device code expired');
            resolve({ success: false, error: 'Device code expired' });
            return;
          }

          try {
            const tokenRes = await fetch(GITHUB_ACCESS_TOKEN_URL, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: GITHUB_CLIENT_ID,
                device_code: data.device_code,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
              }),
            });

            const tokenData = await tokenRes.json();

            if ('access_token' in tokenData) {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setStatus('success');
              resolve({
                success: true,
                token: tokenData.access_token,
                provider: 'github-copilot'
              });
              return;
            }

            // Handle pending states
            if (tokenData.error === 'authorization_pending') {
              return; // Keep polling
            }
            if (tokenData.error === 'slow_down') {
              return; // Keep polling (interval will handle slowdown)
            }
            if (tokenData.error === 'expired_token') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setStatus('error');
              setError('Device code expired. Please try again.');
              resolve({ success: false, error: 'Device code expired' });
              return;
            }
            if (tokenData.error === 'access_denied') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setStatus('error');
              setError('Access denied. Please try again.');
              resolve({ success: false, error: 'Access denied' });
              return;
            }
          } catch (err) {
            console.error('Token poll error:', err);
          }
        };

        pollIntervalRef.current = window.setInterval(pollForToken, intervalMs);
        // Initial poll
        pollForToken();
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth failed';
      setStatus('error');
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  /**
   * Open API key page for providers without OAuth
   * Returns a special result indicating user should enter API key manually
   */
  const openApiKeyPage = useCallback(async (provider: string): Promise<OAuthResult> => {
    const config = OAUTH_PROVIDERS[provider];
    if (!config || !config.keyUrl) {
      return { success: false, error: `No API key URL for provider: ${provider}` };
    }

    try {
      await openUrl(config.keyUrl);
      // Return special result - the UI should show API key input
      return {
        success: false,
        error: 'SHOW_API_KEY_INPUT',
        provider,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open browser';
      return { success: false, error: message };
    }
  }, []);

  /**
   * Start OAuth flow for a provider
   * Only GitHub Copilot has real device code OAuth
   * Others will open the API key page
   */
  const startOAuth = useCallback(async (provider: string): Promise<OAuthResult> => {
    const config = OAUTH_PROVIDERS[provider];

    if (!config) {
      return { success: false, error: `Unknown provider: ${provider}` };
    }

    // Only GitHub Copilot has a real OAuth flow we can use
    if (config.type === 'device-code' && provider === 'github-copilot') {
      return startGitHubDeviceFlow();
    }

    // For all other providers, open their API key page
    return openApiKeyPage(provider);
  }, [startGitHubDeviceFlow, openApiKeyPage]);

  /**
   * Cancel ongoing OAuth flow
   */
  const cancel = useCallback(() => {
    abortRef.current = true;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setStatus('cancelled');
    setDeviceCode(null);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    abortRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setStatus('idle');
    setDeviceCode(null);
    setError(null);
  }, []);

  /**
   * Open URL in browser (for manual flows)
   */
  const openInBrowser = useCallback(async (url: string) => {
    await openUrl(url);
  }, []);

  return {
    status,
    deviceCode,
    error,
    startOAuth,
    startGitHubDeviceFlow,
    openApiKeyPage,
    cancel,
    reset,
    openInBrowser,
    isOAuthProvider: (provider: string) => provider in OAUTH_PROVIDERS,
    hasRealOAuth: (provider: string) => OAUTH_PROVIDERS[provider]?.type === 'device-code',
    getProviderConfig: (provider: string) => OAUTH_PROVIDERS[provider],
  };
}
