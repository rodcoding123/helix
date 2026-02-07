/**
 * Auth Profile Management Gateway Methods
 *
 * Implements authentication profile CRUD operations and OAuth flow management
 * for multi-provider authentication with automatic failover capabilities.
 *
 * Phase I: Advanced Configuration
 */

import { randomUUID } from "node:crypto";
import { loadConfig, writeConfigFile } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAuthProfilesAddParams,
  validateAuthProfilesCheckParams,
  validateAuthProfilesDeleteParams,
  validateAuthProfilesListParams,
  validateAuthProfilesReorderParams,
  validateOAuthStartParams,
  validateOAuthStatusParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// In-memory OAuth flow storage (per-session)
const oauthFlows = new Map<string, {
  id: string;
  provider: string;
  state: string;
  callbackUrl: string;
  expiresAt: number;
  error?: string;
  createdAt: number;
}>();

// Cleanup expired OAuth flows every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, flow] of oauthFlows) {
    if (flow.expiresAt < now) {
      oauthFlows.delete(id);
    }
  }
}, 60000);

export const authProfilesHandlers: GatewayRequestHandlers = {
  "auth.profiles.list": async ({ params, respond }) => {
    if (!validateAuthProfilesListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.profiles.list params: ${formatValidationErrors(
            validateAuthProfilesListParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const profiles = config.auth?.profiles || [];

      // Sort by priority (lower number = higher priority)
      const sorted = profiles.sort((a, b) => (a.priority || 999) - (b.priority || 999));

      respond(true, { profiles: sorted }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "auth.profiles.add": async ({ params, respond }) => {
    if (!validateAuthProfilesAddParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.profiles.add params: ${formatValidationErrors(
            validateAuthProfilesAddParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      if (!config.auth) {
        config.auth = {};
      }
      if (!config.auth.profiles) {
        config.auth.profiles = [];
      }

      const profile = {
        id: randomUUID(),
        name: params.name,
        provider: params.provider,
        priority: config.auth.profiles.length, // Add at end
        enabled: true,
        credentials: params.credentials,
        metadata: {
          createdAt: Date.now(),
          usageCount: 0,
          errorCount: 0,
        },
      };

      config.auth.profiles.push(profile);
      await writeConfigFile(config);

      respond(true, { profile }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "auth.profiles.delete": async ({ params, respond }) => {
    if (!validateAuthProfilesDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.profiles.delete params: ${formatValidationErrors(
            validateAuthProfilesDeleteParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      if (!config.auth?.profiles) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Profile not found"));
        return;
      }

      const index = config.auth.profiles.findIndex((p) => p.id === params.profileId);
      if (index === -1) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Profile not found"));
        return;
      }

      config.auth.profiles.splice(index, 1);
      await writeConfigFile(config);

      respond(true, {}, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "auth.profiles.check": async ({ params, respond }) => {
    if (!validateAuthProfilesCheckParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.profiles.check params: ${formatValidationErrors(
            validateAuthProfilesCheckParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      const profiles = config.auth?.profiles || [];

      const health = profiles
        .filter((p) => !params.profileId || p.id === params.profileId)
        .map((profile) => {
          let status: "healthy" | "warning" | "error" = "healthy";
          let message = "Profile is operational";

          // Check for credentials
          if (!profile.credentials?.apiKey && !profile.credentials?.bearerToken) {
            status = "warning";
            message = "No credentials configured";
          }

          // Check for recent errors
          if ((profile.metadata?.errorCount || 0) > 5) {
            status = "error";
            message = `Recent errors detected (${profile.metadata.errorCount})`;
          }

          // Check if recently used
          if (profile.metadata?.lastError) {
            status = "error";
            message = profile.metadata.lastError;
          }

          return {
            profileId: profile.id,
            status,
            lastCheck: Date.now(),
            message,
          };
        });

      respond(true, { health }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "auth.profiles.reorder": async ({ params, respond }) => {
    if (!validateAuthProfilesReorderParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.profiles.reorder params: ${formatValidationErrors(
            validateAuthProfilesReorderParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const config = await loadConfig();
      if (!config.auth?.profiles) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "No profiles configured"));
        return;
      }

      // Reorder profiles according to provided IDs
      const profileMap = new Map(config.auth.profiles.map((p) => [p.id, p]));
      const reordered = params.profileIds
        .map((id) => profileMap.get(id))
        .filter((p) => p !== undefined) as typeof config.auth.profiles;

      if (reordered.length !== config.auth.profiles.length) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "Invalid profile IDs in reorder"),
        );
        return;
      }

      // Update priorities
      reordered.forEach((profile, index) => {
        profile.priority = index;
      });

      config.auth.profiles = reordered;
      await writeConfigFile(config);

      respond(true, { profiles: reordered }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "auth.oauth.start": async ({ params, respond }) => {
    if (!validateOAuthStartParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.oauth.start params: ${formatValidationErrors(
            validateOAuthStartParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const flowId = randomUUID();
      const state = randomUUID();
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minute expiry

      // Store flow state
      oauthFlows.set(flowId, {
        id: flowId,
        provider: params.provider,
        state,
        callbackUrl: `http://localhost:3000/oauth/callback`,
        expiresAt,
        createdAt: Date.now(),
      });

      // Build authorization URL based on provider
      let authorizationUrl = "";
      const scopes = params.scopes || ["default"];

      switch (params.provider) {
        case "anthropic":
          authorizationUrl = `https://console.anthropic.com/oauth/authorize?client_id=YOUR_CLIENT_ID&state=${state}&scope=${scopes.join(
            "%20",
          )}`;
          break;
        case "openai":
          authorizationUrl = `https://platform.openai.com/oauth/authorize?client_id=YOUR_CLIENT_ID&state=${state}&scope=${scopes.join(
            "%20",
          )}`;
          break;
        case "github":
          authorizationUrl = `https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&state=${state}&scope=${scopes.join(
            "%20",
          )}`;
          break;
        default:
          // Generic OAuth
          authorizationUrl = `${params.provider}/oauth/authorize?client_id=YOUR_CLIENT_ID&state=${state}&scope=${scopes.join(
            "%20",
          )}`;
      }

      respond(true, { flowId, authorizationUrl, expiresAt }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },

  "auth.oauth.status": async ({ params, respond }) => {
    if (!validateOAuthStatusParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid auth.oauth.status params: ${formatValidationErrors(
            validateOAuthStatusParams.errors,
          )}`,
        ),
      );
      return;
    }

    try {
      const flow = oauthFlows.get(params.flowId);

      if (!flow) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "OAuth flow not found"));
        return;
      }

      const now = Date.now();
      let status: "pending" | "authorizing" | "exchanging" | "complete" | "error" | "cancelled" =
        "pending";

      if (flow.error) {
        status = "error";
      } else if (now > flow.expiresAt) {
        status = "cancelled";
      }

      respond(true, { flow: { ...flow } }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
