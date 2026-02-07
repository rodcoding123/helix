import { Type } from "@sinclair/typebox";

import { NonEmptyString } from "./primitives.js";

/**
 * Hooks Management Schemas
 *
 * Supports enabling, disabling, configuring, and managing gateway hooks.
 * Hooks are extensible callback functions for events like command logging,
 * session memory, and gateway startup/shutdown.
 */

export const HookStatusSchema = Type.Union([
  Type.Literal("enabled"),
  Type.Literal("disabled"),
  Type.Literal("error"),
]);

export const HookTypeSchema = Type.Union([
  Type.Literal("bundled"),
  Type.Literal("custom"),
]);

export const HookSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    type: HookTypeSchema,
    status: HookStatusSchema,
    description: Type.Optional(NonEmptyString),
    filePath: Type.Optional(NonEmptyString),
    priority: Type.Optional(Type.Integer({ minimum: 0, maximum: 999 })),
    config: Type.Optional(Type.Record(NonEmptyString, Type.Unknown())),
    error: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// ============================================================================
// Request Schemas
// ============================================================================

export const HooksListParamsSchema = Type.Object(
  {},
  { additionalProperties: false },
);

export const HooksGetConfigParamsSchema = Type.Object(
  {
    hookId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const HooksUpdateConfigParamsSchema = Type.Object(
  {
    hookId: NonEmptyString,
    config: Type.Record(NonEmptyString, Type.Unknown()),
  },
  { additionalProperties: false },
);

export const HooksEnableParamsSchema = Type.Object(
  {
    hookId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const HooksDisableParamsSchema = Type.Object(
  {
    hookId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const HooksInstallParamsSchema = Type.Object(
  {
    name: NonEmptyString,
    filePath: NonEmptyString,
    config: Type.Optional(Type.Record(NonEmptyString, Type.Unknown())),
  },
  { additionalProperties: false },
);

export const HooksUninstallParamsSchema = Type.Object(
  {
    hookId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const HooksValidateParamsSchema = Type.Object(
  {
    filePath: NonEmptyString,
  },
  { additionalProperties: false },
);

export const HooksPriorityParamsSchema = Type.Object(
  {
    hookIds: Type.Array(NonEmptyString, { minItems: 1 }),
  },
  { additionalProperties: false },
);

// ============================================================================
// Response Schemas
// ============================================================================

export const HooksListResultSchema = Type.Object(
  {
    hooks: Type.Array(HookSchema),
  },
  { additionalProperties: false },
);

export const HooksGetConfigResultSchema = Type.Object(
  {
    config: Type.Record(NonEmptyString, Type.Unknown()),
  },
  { additionalProperties: false },
);

export const HooksInstallResultSchema = Type.Object(
  {
    hook: HookSchema,
  },
  { additionalProperties: false },
);

export const HooksValidateResultSchema = Type.Object(
  {
    valid: Type.Boolean(),
    error: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);
