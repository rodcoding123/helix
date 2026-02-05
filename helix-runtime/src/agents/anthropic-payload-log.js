import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { parseBooleanValue } from "../utils/boolean.js";
import { resolveUserPath } from "../utils.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
// ============================================
// HELIX: Pre-flight API logging
// Logs fire BEFORE API calls - unhackable
// ============================================
import { logApiPreFlight } from "../helix/api-logger.js";
const writers = new Map();
const log = createSubsystemLogger("agent/anthropic-payload");
function resolvePayloadLogConfig(env) {
    const enabled = parseBooleanValue(env.OPENCLAW_ANTHROPIC_PAYLOAD_LOG) ?? false;
    const fileOverride = env.OPENCLAW_ANTHROPIC_PAYLOAD_LOG_FILE?.trim();
    const filePath = fileOverride
        ? resolveUserPath(fileOverride)
        : path.join(resolveStateDir(env), "logs", "anthropic-payload.jsonl");
    return { enabled, filePath };
}
function getWriter(filePath) {
    const existing = writers.get(filePath);
    if (existing) {
        return existing;
    }
    const dir = path.dirname(filePath);
    const ready = fs.mkdir(dir, { recursive: true }).catch(() => undefined);
    let queue = Promise.resolve();
    const writer = {
        filePath,
        write: (line) => {
            queue = queue
                .then(() => ready)
                .then(() => fs.appendFile(filePath, line, "utf8"))
                .catch(() => undefined);
        },
    };
    writers.set(filePath, writer);
    return writer;
}
function safeJsonStringify(value) {
    try {
        return JSON.stringify(value, (_key, val) => {
            if (typeof val === "bigint") {
                return val.toString();
            }
            if (typeof val === "function") {
                return "[Function]";
            }
            if (val instanceof Error) {
                return { name: val.name, message: val.message, stack: val.stack };
            }
            if (val instanceof Uint8Array) {
                return { type: "Uint8Array", data: Buffer.from(val).toString("base64") };
            }
            return val;
        });
    }
    catch {
        return null;
    }
}
function formatError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
        return String(error);
    }
    if (error && typeof error === "object") {
        return safeJsonStringify(error) ?? "unknown error";
    }
    return undefined;
}
function digest(value) {
    const serialized = safeJsonStringify(value);
    if (!serialized) {
        return undefined;
    }
    return crypto.createHash("sha256").update(serialized).digest("hex");
}
function isAnthropicModel(model) {
    return model?.api === "anthropic-messages";
}
function findLastAssistantUsage(messages) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg?.role === "assistant" && msg.usage && typeof msg.usage === "object") {
            return msg.usage;
        }
    }
    return null;
}
/**
 * Extract a preview from the prompt context for Helix logging
 */
function extractPromptPreview(context, maxLength = 500) {
    if (!context) {
        return undefined;
    }
    if (typeof context === "string") {
        return context.slice(0, maxLength);
    }
    if (Array.isArray(context)) {
        // Handle message array format - find last user message
        const lastUserMsg = [...context]
            .toReversed()
            .find((msg) => msg?.role === "user");
        if (lastUserMsg?.content) {
            const content = typeof lastUserMsg.content === "string"
                ? lastUserMsg.content
                : safeJsonStringify(lastUserMsg.content);
            return content?.slice(0, maxLength);
        }
    }
    if (typeof context === "object" && context !== null) {
        const obj = context;
        if (typeof obj.prompt === "string") {
            return obj.prompt.slice(0, maxLength);
        }
        if (obj.messages) {
            return extractPromptPreview(obj.messages, maxLength);
        }
        if (typeof obj.content === "string") {
            return obj.content.slice(0, maxLength);
        }
    }
    return undefined;
}
export function createAnthropicPayloadLogger(params) {
    const env = params.env ?? process.env;
    const cfg = resolvePayloadLogConfig(env);
    if (!cfg.enabled) {
        return null;
    }
    const writer = getWriter(cfg.filePath);
    const base = {
        runId: params.runId,
        sessionId: params.sessionId,
        sessionKey: params.sessionKey,
        provider: params.provider,
        modelId: params.modelId,
        modelApi: params.modelApi,
        workspaceDir: params.workspaceDir,
    };
    const record = (event) => {
        const line = safeJsonStringify(event);
        if (!line) {
            return;
        }
        writer.write(`${line}\n`);
    };
    const wrapStreamFn = (streamFn) => {
        const wrapped = (model, context, options) => {
            if (!isAnthropicModel(model)) {
                return streamFn(model, context, options);
            }
            // ============================================
            // HELIX: PRE-FLIGHT LOGGING (UNHACKABLE)
            // This log is sent to Discord BEFORE the API
            // call is made. The evidence exists externally
            // before Claude receives the prompt.
            // ============================================
            const helixRequestId = crypto.randomUUID();
            logApiPreFlight({
                requestId: helixRequestId,
                model: params.modelId,
                provider: params.provider,
                sessionKey: params.sessionKey,
                timestamp: new Date().toISOString(),
                promptPreview: extractPromptPreview(context),
            }).catch(() => {
                // Logging failure must not block API call
            });
            // ============================================
            const nextOnPayload = (payload) => {
                record({
                    ...base,
                    ts: new Date().toISOString(),
                    stage: "request",
                    payload,
                    payloadDigest: digest(payload),
                });
                options?.onPayload?.(payload);
            };
            return streamFn(model, context, {
                ...options,
                onPayload: nextOnPayload,
            });
        };
        return wrapped;
    };
    const recordUsage = (messages, error) => {
        const usage = findLastAssistantUsage(messages);
        const errorMessage = formatError(error);
        if (!usage) {
            if (errorMessage) {
                record({
                    ...base,
                    ts: new Date().toISOString(),
                    stage: "usage",
                    error: errorMessage,
                });
            }
            return;
        }
        record({
            ...base,
            ts: new Date().toISOString(),
            stage: "usage",
            usage,
            error: errorMessage,
        });
        log.info("anthropic usage", {
            runId: params.runId,
            sessionId: params.sessionId,
            usage,
        });
    };
    log.info("anthropic payload logger enabled", { filePath: writer.filePath });
    return { enabled: true, wrapStreamFn, recordUsage };
}
//# sourceMappingURL=anthropic-payload-log.js.map