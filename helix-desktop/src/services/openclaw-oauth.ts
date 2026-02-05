/**
 * OpenClaw OAuth Service Wrapper
 *
 * Wraps OpenClaw CLI OAuth commands for use in the Helix desktop application.
 * Handles both Anthropic setup-token flow and OpenAI Codex PKCE flow.
 *
 * **Helix Integration**:
 * - Wraps: OpenClaw's `openclaw models auth` CLI commands
 * - Uses: Tauri IPC invoke system (Module 2 provides Rust backend)
 * - Integrates with: AuthConfigStep (Module 3) for UI
 * - Pattern: Fail-closed (all errors caught as structured results)
 * - Model-Agnostic: Framework-ready for additional providers (DeepSeek, Gemini, etc.)
 *
 * **BYOK Principle**:
 * Credentials are stored locally in ~/.openclaw/agents/main/agent/auth-profiles.json
 * and never transmitted to Helix servers.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Supported OAuth providers for Helix
 * Model-agnostic: Users can add more providers via auth-profiles.json
 */
export type OAuthProvider = 'anthropic' | 'openai-codex';

/**
 * Result of OAuth flow attempt
 * Structured response for UI error handling
 */
export interface OAuthFlowResult {
  /** Whether the flow succeeded */
  success: boolean;

  /** Which provider was targeted */
  provider: OAuthProvider;

  /** Type of token obtained (setup-token, oauth, etc.) */
  tokenType: 'oauth' | 'setup-token';

  /** Where credentials were stored on disk */
  storedInPath: string;

  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Credentials check result
 * Used to verify if user has already authenticated with a provider
 */
export interface CredentialsCheckResult {
  /** Whether credentials are stored for this provider */
  stored: boolean;

  /** Error message if check failed */
  error?: string;
}

/**
 * Initiate Anthropic setup-token flow
 *
 * This is the recommended flow for Claude access via Claude MAX subscription.
 * User runs `claude setup-token` in terminal to get a temporary token,
 * then pastes it into the application.
 *
 * @returns OAuth flow result with success status
 *
 * @example
 * ```typescript
 * const result = await initiateAnthropicSetupToken();
 * if (result.success) {
 *   console.log('Claude authenticated via:', result.storedInPath);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 * ```
 */
export async function initiateAnthropicSetupToken(): Promise<OAuthFlowResult> {
  try {
    const result = await invoke<OAuthFlowResult>('run_openclaw_oauth', {
      provider: 'anthropic',
      flow: 'setup-token',
    });
    return result;
  } catch (error) {
    return {
      success: false,
      provider: 'anthropic',
      tokenType: 'setup-token',
      storedInPath: '',
      error: String(error),
    };
  }
}

/**
 * Initiate OpenAI Codex PKCE OAuth flow
 *
 * This is the standard OAuth flow for OpenAI services.
 * Opens browser for user to authenticate, then stores token locally.
 *
 * @returns OAuth flow result with success status
 *
 * @example
 * ```typescript
 * const result = await initiateOpenAIPkceOAuth();
 * if (result.success) {
 *   console.log('OpenAI authenticated via:', result.storedInPath);
 * }
 * ```
 */
export async function initiateOpenAIPkceOAuth(): Promise<OAuthFlowResult> {
  try {
    const result = await invoke<OAuthFlowResult>('run_openclaw_oauth', {
      provider: 'openai-codex',
      flow: 'pkce',
    });
    return result;
  } catch (error) {
    return {
      success: false,
      provider: 'openai-codex',
      tokenType: 'oauth',
      storedInPath: '',
      error: String(error),
    };
  }
}

/**
 * Check if credentials are already stored for a provider
 *
 * Used in onboarding to determine if user needs to re-authenticate.
 *
 * @param provider Which provider to check
 * @returns Whether credentials exist for this provider
 *
 * @example
 * ```typescript
 * const hasCredentials = await checkStoredCredentials('anthropic');
 * if (hasCredentials) {
 *   console.log('Already authenticated with Claude');
 * }
 * ```
 */
export async function checkStoredCredentials(provider: OAuthProvider): Promise<boolean> {
  try {
    const result = await invoke<CredentialsCheckResult>('check_oauth_credentials', {
      provider,
    });
    return result.stored;
  } catch (error) {
    // If check fails, assume no credentials (safer default)
    console.warn(`Failed to check credentials for ${provider}:`, error);
    return false;
  }
}

/**
 * Get list of all authenticated providers
 *
 * Queries the auth-profiles.json to see which providers user has set up.
 * Useful for displaying available execution options.
 *
 * @returns List of providers with stored credentials
 *
 * @example
 * ```typescript
 * const providers = await getAuthenticatedProviders();
 * // ['anthropic', 'openai-codex']
 * ```
 */
export async function getAuthenticatedProviders(): Promise<OAuthProvider[]> {
  try {
    const providers: OAuthProvider[] = [];

    for (const provider of ['anthropic', 'openai-codex'] as OAuthProvider[]) {
      const stored = await checkStoredCredentials(provider);
      if (stored) {
        providers.push(provider);
      }
    }

    return providers;
  } catch (error) {
    console.warn('Failed to get authenticated providers:', error);
    return [];
  }
}

/**
 * Generic provider authentication handler
 *
 * Route different providers to their appropriate flows.
 * Extensible for future providers (DeepSeek, Gemini, etc.)
 *
 * @param provider Which provider to authenticate with
 * @returns OAuth flow result
 *
 * @example
 * ```typescript
 * const result = await authenticateProvider('anthropic');
 * if (result.success) {
 *   // Credentials saved, ready to execute
 * }
 * ```
 */
export async function authenticateProvider(provider: OAuthProvider): Promise<OAuthFlowResult> {
  switch (provider) {
    case 'anthropic':
      return initiateAnthropicSetupToken();
    case 'openai-codex':
      return initiateOpenAIPkceOAuth();
    default:
      return {
        success: false,
        provider: provider as OAuthProvider,
        tokenType: 'oauth',
        storedInPath: '',
        error: `Unknown provider: ${provider}`,
      };
  }
}

/**
 * Model-agnostic provider registry
 *
 * Users can extend this with custom providers by modifying auth-profiles.json
 * Each provider in the registry maps to an OAuth flow strategy.
 *
 * **Future Enhancement**:
 * Load provider registry from auth-profiles.json to support arbitrary providers.
 */
export const PROVIDER_REGISTRY = {
  'anthropic': {
    name: 'Claude (Anthropic)',
    description: 'Access to Claude models via Claude MAX subscription',
    flow: 'setup-token' as const,
  },
  'openai-codex': {
    name: 'OpenAI Codex',
    description: 'Code execution via OpenAI API',
    flow: 'pkce' as const,
  },
  // Future providers can be added here:
  // 'deepseek': { name: 'DeepSeek', flow: 'pkce' },
  // 'google-gemini': { name: 'Google Gemini', flow: 'oauth2' },
  // 'together-ai': { name: 'Together AI', flow: 'api-key' },
} as const;
