/**
 * OAuth Flow Manager
 *
 * Manages OAuth 2.0 authorization flows with provider-specific handlers.
 * Implements callback server, state management, and token exchange.
 *
 * Phase I: Advanced Configuration - OAuth Integration
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { loadConfig, writeConfigFile } from "../config/config.js";

export interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

export interface OAuthFlow {
  id: string;
  provider: string;
  state: string;
  pkce?: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "exchanging" | "complete" | "error" | "cancelled";
  error?: string;
  token?: OAuthToken;
}

export interface OAuthProvider {
  name: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  revokeEndpoint?: string;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  anthropic: {
    name: "Anthropic",
    authorizationEndpoint: "https://console.anthropic.com/oauth/authorize",
    tokenEndpoint: "https://console.anthropic.com/oauth/token",
    userInfoEndpoint: "https://console.anthropic.com/oauth/userinfo",
  },
  openai: {
    name: "OpenAI",
    authorizationEndpoint: "https://platform.openai.com/oauth/authorize",
    tokenEndpoint: "https://platform.openai.com/oauth/token",
  },
  github: {
    name: "GitHub",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userInfoEndpoint: "https://api.github.com/user",
  },
  google: {
    name: "Google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    userInfoEndpoint: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  microsoft: {
    name: "Microsoft",
    authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoEndpoint: "https://graph.microsoft.com/v1.0/me",
  },
};

export class OAuthFlowManager {
  private flows = new Map<string, OAuthFlow>();
  private configs = new Map<string, OAuthConfig>();
  private callbackServer?: ReturnType<typeof createServer>;
  private callbackPort = 3000;
  private callbackPath = "/oauth/callback";

  constructor(callbackPort?: number) {
    if (callbackPort) {
      this.callbackPort = callbackPort;
    }
    this.loadOAuthConfigs();
  }

  private async loadOAuthConfigs(): Promise<void> {
    try {
      const config = await loadConfig();
      if (config.auth?.oauth) {
        for (const [key, oauthConfig] of Object.entries(config.auth.oauth)) {
          if (oauthConfig && typeof oauthConfig === "object") {
            this.configs.set(key, oauthConfig as OAuthConfig);
          }
        }
      }
    } catch (err) {
      console.debug("[oauth-manager] Failed to load OAuth configs:", err);
    }
  }

  /**
   * Start the OAuth callback server
   */
  startCallbackServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.callbackServer) {
        resolve();
        return;
      }

      this.callbackServer = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          this.handleCallback(req, res);
        },
      );

      this.callbackServer.listen(this.callbackPort, () => {
        console.info(
          `[oauth-manager] Callback server listening on port ${this.callbackPort}`,
        );
        resolve();
      });

      this.callbackServer.on("error", reject);
    });
  }

  /**
   * Stop the OAuth callback server
   */
  stopCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = undefined;
    }
  }

  /**
   * Handle OAuth callback from provider
   */
  private async handleCallback(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://localhost:${this.callbackPort}`);

    if (url.pathname !== this.callbackPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const flow = Array.from(this.flows.values()).find((f) => f.state === state);
      if (flow) {
        flow.status = "error";
        flow.error = error;
      }

      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>Authentication Error</h1><p>${error}</p>`);
      return;
    }

    if (!code || !state) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing code or state");
      return;
    }

    const flow = Array.from(this.flows.values()).find((f) => f.state === state);
    if (!flow) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid state");
      return;
    }

    try {
      flow.status = "exchanging";

      // Exchange authorization code for tokens
      const token = await this.exchangeCodeForToken(flow.provider, code, flow.pkce);
      flow.token = token;
      flow.status = "complete";

      // Save token to config
      await this.saveToken(flow.provider, token);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <h1>Authentication Successful</h1>
        <p>You can close this window and return to Helix.</p>
        <script>window.close();</script>
      `);
    } catch (err) {
      flow.status = "error";
      flow.error = String(err);

      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`
        <h1>Authentication Error</h1>
        <p>${String(err)}</p>
      `);
    }
  }

  /**
   * Start a new OAuth flow
   */
  async startFlow(
    provider: string,
    scopes?: string[],
  ): Promise<{ flowId: string; authorizationUrl: string }> {
    const oauthConfig = this.configs.get(provider);
    if (!oauthConfig) {
      throw new Error(`OAuth config not found for provider: ${provider}`);
    }

    const providerInfo = OAUTH_PROVIDERS[provider];
    if (!providerInfo) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const flowId = randomUUID();
    const state = randomUUID();
    const pkce = randomUUID(); // Simplified PKCE (should use SHA256)

    const flow: OAuthFlow = {
      id: flowId,
      provider,
      state,
      pkce,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minute expiry
      status: "pending",
    };

    this.flows.set(flowId, flow);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      redirect_uri: oauthConfig.redirectUri,
      response_type: "code",
      state,
      scope: (scopes || oauthConfig.scopes || ["default"]).join(" "),
    });

    const authorizationUrl = `${providerInfo.authorizationEndpoint}?${params.toString()}`;

    // Cleanup expired flows
    this.cleanupExpiredFlows();

    return { flowId, authorizationUrl };
  }

  /**
   * Get OAuth flow status
   */
  getFlowStatus(flowId: string): OAuthFlow | undefined {
    const flow = this.flows.get(flowId);
    return flow;
  }

  /**
   * Cancel OAuth flow
   */
  cancelFlow(flowId: string): void {
    const flow = this.flows.get(flowId);
    if (flow) {
      flow.status = "cancelled";
    }
  }

  /**
   * Exchange authorization code for token
   */
  private async exchangeCodeForToken(
    provider: string,
    code: string,
    _pkce?: string,
  ): Promise<OAuthToken> {
    const oauthConfig = this.configs.get(provider);
    if (!oauthConfig) {
      throw new Error(`OAuth config not found for provider: ${provider}`);
    }

    const providerInfo = OAUTH_PROVIDERS[provider];
    if (!providerInfo) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    // Build token request
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: oauthConfig.redirectUri,
    });

    const response = await fetch(providerInfo.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: String(data.access_token || ""),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAt: Date.now() + ((data.expires_in as number) || 3600) * 1000,
      tokenType: String(data.token_type || "Bearer"),
      scope: String(data.scope || ""),
    };
  }

  /**
   * Save OAuth token to config
   */
  private async saveToken(provider: string, token: OAuthToken): Promise<void> {
    const config = await loadConfig();
    if (!config.auth) {
      config.auth = {};
    }
    if (!config.auth.oauth) {
      config.auth.oauth = {};
    }

    // Store token in profile if exists
    const profile = config.auth.profiles?.find(
      (p) => p.provider.toLowerCase() === provider.toLowerCase(),
    );
    if (profile) {
      profile.credentials = profile.credentials || {};
      (profile.credentials as Record<string, unknown>).accessToken = token.accessToken;
      if (token.refreshToken) {
        (profile.credentials as Record<string, unknown>).refreshToken = token.refreshToken;
      }
      (profile.credentials as Record<string, unknown>).tokenExpiresAt = token.expiresAt;
    }

    await writeConfigFile(config);
  }

  /**
   * Refresh OAuth token
   */
  async refreshToken(provider: string): Promise<OAuthToken> {
    const profile = (await loadConfig()).auth?.profiles?.find(
      (p) => p.provider.toLowerCase() === provider.toLowerCase(),
    );
    if (!profile?.credentials?.refreshToken) {
      throw new Error("No refresh token available");
    }

    const oauthConfig = this.configs.get(provider);
    if (!oauthConfig) {
      throw new Error(`OAuth config not found for provider: ${provider}`);
    }

    const providerInfo = OAUTH_PROVIDERS[provider];
    if (!providerInfo) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: profile.credentials.refreshToken as string,
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
    });

    const response = await fetch(providerInfo.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    const newToken: OAuthToken = {
      accessToken: String(data.access_token || ""),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      expiresAt: Date.now() + ((data.expires_in as number) || 3600) * 1000,
      tokenType: String(data.token_type || "Bearer"),
      scope: String(data.scope || ""),
    };

    await this.saveToken(provider, newToken);
    return newToken;
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(provider: string): Promise<void> {
    const profile = (await loadConfig()).auth?.profiles?.find(
      (p) => p.provider.toLowerCase() === provider.toLowerCase(),
    );
    if (!profile?.credentials?.accessToken) {
      throw new Error("No token to revoke");
    }

    const providerInfo = OAUTH_PROVIDERS[provider];
    if (!providerInfo?.revokeEndpoint) {
      throw new Error(`No revoke endpoint for provider: ${provider}`);
    }

    const params = new URLSearchParams({
      token: profile.credentials.accessToken as string,
    });

    try {
      await fetch(providerInfo.revokeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
    } catch (err) {
      console.debug("[oauth-manager] Token revocation error:", err);
      // Revocation errors are non-fatal
    }

    // Clear token from config
    const config = await loadConfig();
    if (profile.credentials) {
      delete (profile.credentials as Record<string, unknown>).accessToken;
      delete (profile.credentials as Record<string, unknown>).refreshToken;
      delete (profile.credentials as Record<string, unknown>).tokenExpiresAt;
    }
    await writeConfigFile(config);
  }

  /**
   * Cleanup expired OAuth flows
   */
  private cleanupExpiredFlows(): void {
    const now = Date.now();
    for (const [id, flow] of this.flows) {
      if (flow.expiresAt < now) {
        this.flows.delete(id);
      }
    }
  }

  /**
   * Get OAuth provider information
   */
  getProviderInfo(provider: string): OAuthProvider | undefined {
    return OAUTH_PROVIDERS[provider];
  }

  /**
   * List available OAuth providers
   */
  listProviders(): OAuthProvider[] {
    return Object.values(OAUTH_PROVIDERS);
  }
}

// Global singleton instance
let oauthManager: OAuthFlowManager | null = null;

export function getOAuthFlowManager(): OAuthFlowManager {
  if (!oauthManager) {
    oauthManager = new OAuthFlowManager();
  }
  return oauthManager;
}

export function createOAuthFlowManager(callbackPort?: number): OAuthFlowManager {
  return new OAuthFlowManager(callbackPort);
}
