import { Type } from "@sinclair/typebox";

import { NonEmptyString } from "./primitives.js";

/**
 * Auth Profile Management Schemas
 *
 * Supports managing authentication profiles for LLMs, OAuth providers,
 * and other external services with automatic failover capabilities.
 */

// ============================================================================
// Auth Profile Types
// ============================================================================

export const AuthProviderSchema = Type.Union([
  Type.Literal("anthropic"),
  Type.Literal("openai"),
  Type.Literal("deepseek"),
  Type.Literal("gemini"),
  Type.Literal("ollama"),
  Type.Literal("custom"),
]);

export const AuthProfileSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    provider: AuthProviderSchema,
    priority: Type.Integer({ minimum: 0 }),
    enabled: Type.Boolean(),
    credentials: Type.Object(
      {
        apiKey: Type.Optional(NonEmptyString),
        bearerToken: Type.Optional(NonEmptyString),
        username: Type.Optional(NonEmptyString),
        password: Type.Optional(NonEmptyString),
        customHeaders: Type.Optional(Type.Record(NonEmptyString, NonEmptyString)),
      },
      { additionalProperties: false },
    ),
    metadata: Type.Optional(
      Type.Object(
        {
          createdAt: Type.Integer({ minimum: 0 }),
          lastUsed: Type.Optional(Type.Integer({ minimum: 0 })),
          usageCount: Type.Optional(Type.Integer({ minimum: 0 })),
          errorCount: Type.Optional(Type.Integer({ minimum: 0 })),
          lastError: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const AuthHealthStatusSchema = Type.Union([
  Type.Literal("healthy"),
  Type.Literal("warning"),
  Type.Literal("error"),
]);

export const AuthProfileHealthSchema = Type.Object(
  {
    profileId: NonEmptyString,
    status: AuthHealthStatusSchema,
    lastCheck: Type.Integer({ minimum: 0 }),
    message: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// ============================================================================
// OAuth Flow Types
// ============================================================================

export const OAuthFlowStateSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("authorizing"),
  Type.Literal("exchanging"),
  Type.Literal("complete"),
  Type.Literal("error"),
  Type.Literal("cancelled"),
]);

export const OAuthFlowSchema = Type.Object(
  {
    id: NonEmptyString,
    provider: NonEmptyString,
    state: OAuthFlowStateSchema,
    callbackUrl: NonEmptyString,
    expiresAt: Type.Integer({ minimum: 0 }),
    error: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// ============================================================================
// Request Schemas
// ============================================================================

export const AuthProfilesListParamsSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const AuthProfilesAddParamsSchema = Type.Object(
  {
    name: NonEmptyString,
    provider: AuthProviderSchema,
    credentials: Type.Object(
      {
        apiKey: Type.Optional(NonEmptyString),
        bearerToken: Type.Optional(NonEmptyString),
        username: Type.Optional(NonEmptyString),
        password: Type.Optional(NonEmptyString),
        customHeaders: Type.Optional(Type.Record(NonEmptyString, NonEmptyString)),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const AuthProfilesDeleteParamsSchema = Type.Object(
  {
    profileId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AuthProfilesCheckParamsSchema = Type.Object(
  {
    profileId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const AuthProfilesReorderParamsSchema = Type.Object(
  {
    profileIds: Type.Array(NonEmptyString, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const OAuthStartParamsSchema = Type.Object(
  {
    provider: NonEmptyString,
    scopes: Type.Optional(Type.Array(NonEmptyString)),
  },
  { additionalProperties: false },
);

export const OAuthStatusParamsSchema = Type.Object(
  {
    flowId: NonEmptyString,
  },
  { additionalProperties: false },
);

// ============================================================================
// Response Schemas
// ============================================================================

export const AuthProfilesListResultSchema = Type.Object(
  {
    profiles: Type.Array(AuthProfileSchema),
  },
  { additionalProperties: false },
);

export const AuthProfilesAddResultSchema = Type.Object(
  {
    profile: AuthProfileSchema,
  },
  { additionalProperties: false },
);

export const AuthProfilesCheckResultSchema = Type.Object(
  {
    health: Type.Array(AuthProfileHealthSchema),
  },
  { additionalProperties: false },
);

export const OAuthStartResultSchema = Type.Object(
  {
    flowId: NonEmptyString,
    authorizationUrl: NonEmptyString,
    expiresAt: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const OAuthStatusResultSchema = Type.Object(
  {
    flow: OAuthFlowSchema,
    profile: Type.Optional(AuthProfileSchema),
  },
  { additionalProperties: false },
);
