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
/**
 * Result of command execution
 * Populated after execution, used in responses
 */
export declare const RemoteCommandResultSchema: import("@sinclair/typebox").TObject<{
    /** success or error status */
    status: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"success">, import("@sinclair/typebox").TLiteral<"error">]>;
    /** Command output or error message */
    output: import("@sinclair/typebox").TString;
    /** When this command executed (Unix timestamp ms) */
    executedAt: import("@sinclair/typebox").TInteger;
    /** Error details if status is error */
    error: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
}>;
/**
 * Remote Command Schema
 *
 * Sent from web/mobile clients to local device for execution.
 * Stored in Supabase `remote_commands` table with real-time subscriptions.
 */
export declare const RemoteCommandSchema: import("@sinclair/typebox").TObject<{
    /** Unique command execution ID (UUID) */
    commandId: import("@sinclair/typebox").TString;
    /** Source device ID (web, mobile, tablet, etc.) */
    sourceDeviceId: import("@sinclair/typebox").TString;
    /** User ID who initiated the command */
    sourceUserId: import("@sinclair/typebox").TString;
    /** Which agent to execute with (main, secondary, etc.) */
    agentId: import("@sinclair/typebox").TString;
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
    provider: import("@sinclair/typebox").TString;
    /**
     * The actual command/prompt to execute
     * String content sent to the AI model or system
     */
    content: import("@sinclair/typebox").TString;
    /** Which session this command belongs to */
    sessionId: import("@sinclair/typebox").TString;
    /** Optional: which channel/conversation in the session */
    channelId: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    /**
     * Command execution status
     * - pending: queued, waiting for local device
     * - executing: local device is processing
     * - completed: execution finished (check result)
     * - failed: execution error (check error field)
     */
    status: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"pending">, import("@sinclair/typebox").TLiteral<"executing">, import("@sinclair/typebox").TLiteral<"completed">, import("@sinclair/typebox").TLiteral<"failed">]>;
    /** When command was created (Unix timestamp ms) */
    createdAt: import("@sinclair/typebox").TInteger;
    /** Command expires after this time (Unix timestamp ms) */
    expiresAt: import("@sinclair/typebox").TInteger;
    /**
     * Execution result (populated after execution)
     * Contains output, error, and execution timestamp
     */
    result: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TObject<{
        /** success or error status */
        status: import("@sinclair/typebox").TUnion<[import("@sinclair/typebox").TLiteral<"success">, import("@sinclair/typebox").TLiteral<"error">]>;
        /** Command output or error message */
        output: import("@sinclair/typebox").TString;
        /** When this command executed (Unix timestamp ms) */
        executedAt: import("@sinclair/typebox").TInteger;
        /** Error details if status is error */
        error: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>>;
}>;
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
export declare function createRemoteCommand(data: typeof RemoteCommandSchema._type): RemoteCommand;
/**
 * Validate Remote Command
 *
 * Used by gateway to validate incoming commands from Supabase.
 * Ensures schema compliance before queueing for execution.
 */
export declare function validateRemoteCommand(data: unknown): {
    valid: boolean;
    errors?: string[];
};
//# sourceMappingURL=remote-command.d.ts.map