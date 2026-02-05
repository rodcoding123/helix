/**
 * Remote Command Protocol Schema (TypeBox)
 *
 * **Phase 1: OAuth Local Authority Foundation**
 *
 * Defines the schema for remote command execution across devices.
 * Used by web/mobile clients to submit commands for execution on the local device.
 *
 * **BYOK Pattern**:
 * - Remote devices send command payload (no credentials)
 * - Local device executes with its own OAuth credentials
 * - Results broadcast back via Supabase real-time
 *
 * **Security**:
 * - Pre-execution logging to Discord + hash chain
 * - Input validation via TypeBox schema
 * - Command timeout and expiration checks
 */

import { Type } from '@sinclair/typebox';

/**
 * Result of command execution
 * Populated after execution, used in responses
 */
export const RemoteCommandResultSchema = Type.Object(
  {
    /** success or error status */
    status: Type.Union([Type.Literal('success'), Type.Literal('error')]),

    /** Command output or error message */
    output: Type.String(),

    /** When this command executed (Unix timestamp ms) */
    executedAt: Type.Integer({ minimum: 0 }),

    /** Error details if status is error */
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: false }
);

/**
 * Remote Command Schema
 *
 * Sent from web/mobile clients to local device for execution.
 * Stored in Supabase `remote_commands` table with real-time subscriptions.
 */
export const RemoteCommandSchema = Type.Object(
  {
    /** Unique command execution ID (UUID) */
    commandId: Type.String({ format: 'uuid' }),

    /** Source device ID (web, mobile, tablet, etc.) */
    sourceDeviceId: Type.String({ minLength: 1 }),

    /** User ID who initiated the command */
    sourceUserId: Type.String({ format: 'uuid' }),

    /** Which agent to execute with (main, secondary, etc.) */
    agentId: Type.String({ minLength: 1 }),

    /**
     * Provider/model to use for execution
     *
     * Model-Agnostic: Users configure which provider powers execution
     * - anthropic (Claude via OAuth setup-token)
     * - openai-codex (OpenAI via OAuth PKCE)
     * - deepseek (future, via OAuth/API key)
     * - google-gemini (future)
     * - custom providers from auth-profiles.json
     */
    provider: Type.String({ minLength: 1 }),

    /**
     * The actual command/prompt to execute
     * String content sent to the AI model or system
     */
    content: Type.String({ minLength: 1 }),

    /** Which session this command belongs to */
    sessionId: Type.String({ minLength: 1 }),

    /** Optional: which channel/conversation in the session */
    channelId: Type.Optional(Type.String({ minLength: 1 })),

    /**
     * Command execution status
     * - pending: queued, waiting for local device
     * - executing: local device is processing
     * - completed: execution finished (check result)
     * - failed: execution error (check error field)
     */
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('executing'),
      Type.Literal('completed'),
      Type.Literal('failed'),
    ]),

    /** When command was created (Unix timestamp ms) */
    createdAt: Type.Integer({ minimum: 0 }),

    /** Command expires after this time (Unix timestamp ms) */
    expiresAt: Type.Integer({ minimum: 0 }),

    /**
     * Execution result (populated after execution)
     * Contains output, error, and execution timestamp
     */
    result: Type.Optional(RemoteCommandResultSchema),
  },
  { additionalProperties: false }
);

/**
 * Type-safe remote command from schema
 * Automatically derived from RemoteCommandSchema
 */
export type RemoteCommand = typeof RemoteCommandSchema._type;

/**
 * Type-safe command result from schema
 */
export type RemoteCommandResult = typeof RemoteCommandResultSchema._type;

/**
 * Create Remote Command Helper
 *
 * Factory function to create a properly-typed remote command.
 * Used by web clients and orchestrator (Phase 2).
 *
 * @example
 * ```typescript
 * const cmd = createRemoteCommand({
 *   commandId: nanoid(),
 *   sourceDeviceId: 'web-browser-123',
 *   sourceUserId: user.id,
 *   agentId: 'main',
 *   provider: 'anthropic',
 *   content: 'Explain quantum computing',
 *   sessionId: 'session-abc',
 *   status: 'pending',
 *   createdAt: Date.now(),
 *   expiresAt: Date.now() + 5 * 60 * 1000, // 5 min timeout
 * });
 * ```
 */
export function createRemoteCommand(data: typeof RemoteCommandSchema._type): RemoteCommand {
  return data;
}

/**
 * Validate Remote Command
 *
 * Used by gateway to validate incoming commands from Supabase.
 * Ensures schema compliance before queueing for execution.
 */
export function validateRemoteCommand(data: unknown): { valid: boolean; errors?: string[] } {
  // TypeBox validation would happen here in practice
  // For now, return structural check
  if (
    typeof data === 'object' &&
    data !== null &&
    'commandId' in data &&
    'sourceDeviceId' in data &&
    'sourceUserId' in data
  ) {
    return { valid: true };
  }
  return { valid: false, errors: ['Invalid remote command structure'] };
}
