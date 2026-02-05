import AjvPkg, { type ErrorObject } from "ajv";
import { type AgentEvent, AgentEventSchema, type AgentIdentityParams, AgentIdentityParamsSchema, type AgentIdentityResult, AgentIdentityResultSchema, AgentParamsSchema, type AgentSummary, AgentSummarySchema, type AgentsListParams, AgentsListParamsSchema, type AgentsListResult, AgentsListResultSchema, type AgentWaitParams, type ChannelsLogoutParams, ChannelsLogoutParamsSchema, type ChannelsStatusParams, ChannelsStatusParamsSchema, type ChannelsStatusResult, ChannelsStatusResultSchema, type ChatEvent, ChatEventSchema, ChatHistoryParamsSchema, type ChatInjectParams, ChatInjectParamsSchema, ChatSendParamsSchema, type ConfigApplyParams, ConfigApplyParamsSchema, type ConfigGetParams, ConfigGetParamsSchema, type ConfigPatchParams, ConfigPatchParamsSchema, type ConfigSchemaParams, ConfigSchemaParamsSchema, type ConfigSchemaResponse, ConfigSchemaResponseSchema, type ConfigSetParams, ConfigSetParamsSchema, type ConnectParams, ConnectParamsSchema, type CronAddParams, CronAddParamsSchema, type CronJob, CronJobSchema, type CronListParams, CronListParamsSchema, type CronRemoveParams, CronRemoveParamsSchema, type CronRunLogEntry, type CronRunParams, CronRunParamsSchema, type CronRunsParams, CronRunsParamsSchema, type CronStatusParams, CronStatusParamsSchema, type CronUpdateParams, CronUpdateParamsSchema, type DevicePairApproveParams, type DevicePairListParams, type DevicePairRejectParams, type ExecApprovalsGetParams, type ExecApprovalsSetParams, type ExecApprovalsSnapshot, ErrorCodes, type ErrorShape, ErrorShapeSchema, type EventFrame, EventFrameSchema, errorShape, type GatewayFrame, GatewayFrameSchema, type HelloOk, HelloOkSchema, type LogsTailParams, LogsTailParamsSchema, type LogsTailResult, LogsTailResultSchema, ModelsListParamsSchema, type NodeEventParams, type NodeInvokeParams, NodeInvokeParamsSchema, type NodeInvokeResultParams, type NodeListParams, NodeListParamsSchema, type NodePairApproveParams, NodePairApproveParamsSchema, type NodePairListParams, NodePairListParamsSchema, type NodePairRejectParams, NodePairRejectParamsSchema, type NodePairRequestParams, NodePairRequestParamsSchema, type NodePairVerifyParams, NodePairVerifyParamsSchema, type PollParams, PollParamsSchema, PROTOCOL_VERSION, type PresenceEntry, PresenceEntrySchema, ProtocolSchemas, type RequestFrame, RequestFrameSchema, type ResponseFrame, ResponseFrameSchema, SendParamsSchema, type SessionsCompactParams, SessionsCompactParamsSchema, type SessionsDeleteParams, SessionsDeleteParamsSchema, type SessionsListParams, SessionsListParamsSchema, type SessionsPatchParams, SessionsPatchParamsSchema, type SessionsPreviewParams, SessionsPreviewParamsSchema, type SessionsResetParams, SessionsResetParamsSchema, type SessionsResolveParams, type ShutdownEvent, ShutdownEventSchema, type SkillsBinsParams, type SkillsBinsResult, type SkillsInstallParams, SkillsInstallParamsSchema, type SkillsStatusParams, SkillsStatusParamsSchema, type SkillsUpdateParams, SkillsUpdateParamsSchema, type Snapshot, SnapshotSchema, type StateVersion, StateVersionSchema, type TalkModeParams, type TickEvent, TickEventSchema, type UpdateRunParams, UpdateRunParamsSchema, type WakeParams, WakeParamsSchema, type WebLoginStartParams, WebLoginStartParamsSchema, type WebLoginWaitParams, WebLoginWaitParamsSchema, type WizardCancelParams, WizardCancelParamsSchema, type WizardNextParams, WizardNextParamsSchema, type WizardNextResult, WizardNextResultSchema, type WizardStartParams, WizardStartParamsSchema, type WizardStartResult, WizardStartResultSchema, type WizardStatusParams, WizardStatusParamsSchema, type WizardStatusResult, WizardStatusResultSchema, type WizardStep, WizardStepSchema } from "./schema.js";
export declare const validateConnectParams: AjvPkg.ValidateFunction<{
    commands?: string[] | undefined;
    role?: string | undefined;
    permissions?: {
        [x: string]: boolean;
    } | undefined;
    auth?: {
        password?: string | undefined;
        token?: string | undefined;
    } | undefined;
    scopes?: string[] | undefined;
    caps?: string[] | undefined;
    pathEnv?: string | undefined;
    device?: {
        nonce?: string | undefined;
        id: string;
        signature: string;
        signedAt: number;
        publicKey: string;
    } | undefined;
    locale?: string | undefined;
    userAgent?: string | undefined;
    minProtocol: number;
    maxProtocol: number;
    client: {
        displayName?: string | undefined;
        deviceFamily?: string | undefined;
        modelIdentifier?: string | undefined;
        instanceId?: string | undefined;
        mode: "test" | "node" | "cli" | "webchat" | "ui" | "backend" | "probe";
        id: "test" | "cli" | "webchat-ui" | "openclaw-control-ui" | "webchat" | "gateway-client" | "openclaw-macos" | "openclaw-ios" | "openclaw-android" | "node-host" | "fingerprint" | "openclaw-probe";
        version: string;
        platform: string;
    };
}>;
export declare const validateRequestFrame: AjvPkg.ValidateFunction<{
    params?: unknown;
    method: string;
    id: string;
    type: "req";
}>;
export declare const validateResponseFrame: AjvPkg.ValidateFunction<{
    error?: {
        details?: unknown;
        retryable?: boolean | undefined;
        retryAfterMs?: number | undefined;
        message: string;
        code: string;
    } | undefined;
    payload?: unknown;
    ok: boolean;
    id: string;
    type: "res";
}>;
export declare const validateEventFrame: AjvPkg.ValidateFunction<{
    payload?: unknown;
    seq?: number | undefined;
    stateVersion?: {
        presence: number;
        health: number;
    } | undefined;
    type: "event";
    event: string;
}>;
export declare const validateSendParams: AjvPkg.ValidateFunction<{
    to: any;
    message: any;
    idempotencyKey: any;
} & {
    to: any;
} & {
    message: any;
} & {
    idempotencyKey: any;
}>;
export declare const validatePollParams: AjvPkg.ValidateFunction<{
    channel?: string | undefined;
    accountId?: string | undefined;
    maxSelections?: number | undefined;
    durationHours?: number | undefined;
    to: string;
    options: string[];
    idempotencyKey: string;
    question: string;
}>;
export declare const validateAgentParams: AjvPkg.ValidateFunction<{
    message: any;
    idempotencyKey: any;
} & {
    message: any;
} & {
    idempotencyKey: any;
}>;
export declare const validateAgentIdentityParams: AjvPkg.ValidateFunction<{
    sessionKey?: string | undefined;
    agentId?: string | undefined;
}>;
export declare const validateAgentWaitParams: AjvPkg.ValidateFunction<{
    timeoutMs?: number | undefined;
    runId: string;
}>;
export declare const validateWakeParams: AjvPkg.ValidateFunction<{
    mode: "now" | "next-heartbeat";
    text: string;
}>;
export declare const validateAgentsListParams: AjvPkg.ValidateFunction<{}>;
export declare const validateNodePairRequestParams: AjvPkg.ValidateFunction<{
    commands?: string[] | undefined;
    version?: string | undefined;
    platform?: string | undefined;
    silent?: boolean | undefined;
    displayName?: string | undefined;
    remoteIp?: string | undefined;
    deviceFamily?: string | undefined;
    modelIdentifier?: string | undefined;
    caps?: string[] | undefined;
    coreVersion?: string | undefined;
    uiVersion?: string | undefined;
    nodeId: string;
}>;
export declare const validateNodePairListParams: AjvPkg.ValidateFunction<{}>;
export declare const validateNodePairApproveParams: AjvPkg.ValidateFunction<{
    requestId: string;
}>;
export declare const validateNodePairRejectParams: AjvPkg.ValidateFunction<{
    requestId: string;
}>;
export declare const validateNodePairVerifyParams: AjvPkg.ValidateFunction<{
    token: string;
    nodeId: string;
}>;
export declare const validateNodeRenameParams: AjvPkg.ValidateFunction<{
    displayName: string;
    nodeId: string;
}>;
export declare const validateNodeListParams: AjvPkg.ValidateFunction<{}>;
export declare const validateNodeDescribeParams: AjvPkg.ValidateFunction<{
    nodeId: string;
}>;
export declare const validateNodeInvokeParams: AjvPkg.ValidateFunction<{
    timeoutMs?: number | undefined;
    params?: unknown;
    command: string;
    idempotencyKey: string;
    nodeId: string;
}>;
export declare const validateNodeInvokeResultParams: AjvPkg.ValidateFunction<{
    error?: {
        message?: string | undefined;
        code?: string | undefined;
    } | undefined;
    payload?: unknown;
    payloadJSON?: string | undefined;
    ok: boolean;
    id: string;
    nodeId: string;
}>;
export declare const validateNodeEventParams: AjvPkg.ValidateFunction<{
    payload?: unknown;
    payloadJSON?: string | undefined;
    event: string;
}>;
export declare const validateSessionsListParams: AjvPkg.ValidateFunction<{
    search?: string | undefined;
    limit?: number | undefined;
    agentId?: string | undefined;
    label?: string | undefined;
    spawnedBy?: string | undefined;
    activeMinutes?: number | undefined;
    includeGlobal?: boolean | undefined;
    includeUnknown?: boolean | undefined;
    includeDerivedTitles?: boolean | undefined;
    includeLastMessage?: boolean | undefined;
}>;
export declare const validateSessionsPreviewParams: AjvPkg.ValidateFunction<{
    limit?: number | undefined;
    maxChars?: number | undefined;
    keys: string[];
}>;
export declare const validateSessionsResolveParams: AjvPkg.ValidateFunction<{
    sessionId?: string | undefined;
    key?: string | undefined;
    agentId?: string | undefined;
    label?: string | undefined;
    spawnedBy?: string | undefined;
    includeGlobal?: boolean | undefined;
    includeUnknown?: boolean | undefined;
}>;
export declare const validateSessionsPatchParams: AjvPkg.ValidateFunction<{
    model?: string | null | undefined;
    label?: string | null | undefined;
    execHost?: string | null | undefined;
    execSecurity?: string | null | undefined;
    execAsk?: string | null | undefined;
    execNode?: string | null | undefined;
    spawnedBy?: string | null | undefined;
    thinkingLevel?: string | null | undefined;
    verboseLevel?: string | null | undefined;
    reasoningLevel?: string | null | undefined;
    elevatedLevel?: string | null | undefined;
    responseUsage?: "off" | "on" | "tokens" | "full" | null | undefined;
    groupActivation?: "always" | "mention" | null | undefined;
    sendPolicy?: "allow" | "deny" | null | undefined;
    key: string;
}>;
export declare const validateSessionsResetParams: AjvPkg.ValidateFunction<{
    key: string;
}>;
export declare const validateSessionsDeleteParams: AjvPkg.ValidateFunction<{
    deleteTranscript?: boolean | undefined;
    key: string;
}>;
export declare const validateSessionsCompactParams: AjvPkg.ValidateFunction<{
    maxLines?: number | undefined;
    key: string;
}>;
export declare const validateConfigGetParams: AjvPkg.ValidateFunction<{}>;
export declare const validateConfigSetParams: AjvPkg.ValidateFunction<{
    baseHash?: string | undefined;
    raw: string;
}>;
export declare const validateConfigApplyParams: AjvPkg.ValidateFunction<{
    sessionKey?: string | undefined;
    baseHash?: string | undefined;
    note?: string | undefined;
    restartDelayMs?: number | undefined;
    raw: string;
}>;
export declare const validateConfigPatchParams: AjvPkg.ValidateFunction<{
    sessionKey?: string | undefined;
    baseHash?: string | undefined;
    note?: string | undefined;
    restartDelayMs?: number | undefined;
    raw: string;
}>;
export declare const validateConfigSchemaParams: AjvPkg.ValidateFunction<{}>;
export declare const validateWizardStartParams: AjvPkg.ValidateFunction<{
    mode?: "remote" | "local" | undefined;
    workspace?: string | undefined;
}>;
export declare const validateWizardNextParams: AjvPkg.ValidateFunction<{
    answer?: {
        value?: unknown;
        stepId: string;
    } | undefined;
    sessionId: string;
}>;
export declare const validateWizardCancelParams: AjvPkg.ValidateFunction<{
    sessionId: string;
}>;
export declare const validateWizardStatusParams: AjvPkg.ValidateFunction<{
    sessionId: string;
}>;
export declare const validateTalkModeParams: AjvPkg.ValidateFunction<{
    phase?: string | undefined;
    enabled: boolean;
}>;
export declare const validateChannelsStatusParams: AjvPkg.ValidateFunction<{
    timeoutMs?: number | undefined;
    probe?: boolean | undefined;
}>;
export declare const validateChannelsLogoutParams: AjvPkg.ValidateFunction<{
    accountId?: string | undefined;
    channel: string;
}>;
export declare const validateModelsListParams: AjvPkg.ValidateFunction<{}>;
export declare const validateSkillsStatusParams: AjvPkg.ValidateFunction<{}>;
export declare const validateSkillsBinsParams: AjvPkg.ValidateFunction<{}>;
export declare const validateSkillsInstallParams: AjvPkg.ValidateFunction<{
    timeoutMs?: number | undefined;
    name: string;
    installId: string;
}>;
export declare const validateSkillsUpdateParams: AjvPkg.ValidateFunction<{
    env?: {
        [x: string]: string;
    } | undefined;
    apiKey?: string | undefined;
    enabled?: boolean | undefined;
    skillKey: string;
}>;
export declare const validateCronListParams: AjvPkg.ValidateFunction<{
    includeDisabled?: boolean | undefined;
}>;
export declare const validateCronStatusParams: AjvPkg.ValidateFunction<{}>;
export declare const validateCronAddParams: AjvPkg.ValidateFunction<{
    description?: string | undefined;
    enabled?: boolean | undefined;
    agentId?: string | null | undefined;
    deleteAfterRun?: boolean | undefined;
    isolation?: {
        postToMainPrefix?: string | undefined;
        postToMainMode?: "full" | "summary" | undefined;
        postToMainMaxChars?: number | undefined;
    } | undefined;
    name: string;
    payload: {
        text: string;
        kind: "systemEvent";
    } | {
        model?: string | undefined;
        to?: string | undefined;
        channel?: string | undefined;
        thinking?: string | undefined;
        timeoutSeconds?: number | undefined;
        deliver?: boolean | undefined;
        bestEffortDeliver?: boolean | undefined;
        message: string;
        kind: "agentTurn";
    };
    schedule: {
        kind: "at";
        atMs: number;
    } | {
        anchorMs?: number | undefined;
        kind: "every";
        everyMs: number;
    } | {
        tz?: string | undefined;
        kind: "cron";
        expr: string;
    };
    sessionTarget: "main" | "isolated";
    wakeMode: "now" | "next-heartbeat";
}>;
export declare const validateCronUpdateParams: AjvPkg.ValidateFunction<{
    id: string;
    patch: {
        name?: string | undefined;
        payload?: {
            text?: string | undefined;
            kind: "systemEvent";
        } | {
            model?: string | undefined;
            to?: string | undefined;
            message?: string | undefined;
            channel?: string | undefined;
            thinking?: string | undefined;
            timeoutSeconds?: number | undefined;
            deliver?: boolean | undefined;
            bestEffortDeliver?: boolean | undefined;
            kind: "agentTurn";
        } | undefined;
        state?: {
            lastError?: string | undefined;
            nextRunAtMs?: number | undefined;
            runningAtMs?: number | undefined;
            lastRunAtMs?: number | undefined;
            lastStatus?: "error" | "ok" | "skipped" | undefined;
            lastDurationMs?: number | undefined;
        } | undefined;
        description?: string | undefined;
        schedule?: {
            kind: "at";
            atMs: number;
        } | {
            anchorMs?: number | undefined;
            kind: "every";
            everyMs: number;
        } | {
            tz?: string | undefined;
            kind: "cron";
            expr: string;
        } | undefined;
        enabled?: boolean | undefined;
        agentId?: string | null | undefined;
        deleteAfterRun?: boolean | undefined;
        sessionTarget?: "main" | "isolated" | undefined;
        wakeMode?: "now" | "next-heartbeat" | undefined;
        isolation?: {
            postToMainPrefix?: string | undefined;
            postToMainMode?: "full" | "summary" | undefined;
            postToMainMaxChars?: number | undefined;
        } | undefined;
    };
} | {
    patch: {
        name?: string | undefined;
        payload?: {
            text?: string | undefined;
            kind: "systemEvent";
        } | {
            model?: string | undefined;
            to?: string | undefined;
            message?: string | undefined;
            channel?: string | undefined;
            thinking?: string | undefined;
            timeoutSeconds?: number | undefined;
            deliver?: boolean | undefined;
            bestEffortDeliver?: boolean | undefined;
            kind: "agentTurn";
        } | undefined;
        state?: {
            lastError?: string | undefined;
            nextRunAtMs?: number | undefined;
            runningAtMs?: number | undefined;
            lastRunAtMs?: number | undefined;
            lastStatus?: "error" | "ok" | "skipped" | undefined;
            lastDurationMs?: number | undefined;
        } | undefined;
        description?: string | undefined;
        schedule?: {
            kind: "at";
            atMs: number;
        } | {
            anchorMs?: number | undefined;
            kind: "every";
            everyMs: number;
        } | {
            tz?: string | undefined;
            kind: "cron";
            expr: string;
        } | undefined;
        enabled?: boolean | undefined;
        agentId?: string | null | undefined;
        deleteAfterRun?: boolean | undefined;
        sessionTarget?: "main" | "isolated" | undefined;
        wakeMode?: "now" | "next-heartbeat" | undefined;
        isolation?: {
            postToMainPrefix?: string | undefined;
            postToMainMode?: "full" | "summary" | undefined;
            postToMainMaxChars?: number | undefined;
        } | undefined;
    };
    jobId: string;
}>;
export declare const validateCronRemoveParams: AjvPkg.ValidateFunction<{
    id: string;
} | {
    jobId: string;
}>;
export declare const validateCronRunParams: AjvPkg.ValidateFunction<{
    mode?: "force" | "due" | undefined;
    id: string;
} | {
    mode?: "force" | "due" | undefined;
    jobId: string;
}>;
export declare const validateCronRunsParams: AjvPkg.ValidateFunction<{
    limit?: number | undefined;
    id: string;
} | {
    limit?: number | undefined;
    jobId: string;
}>;
export declare const validateDevicePairListParams: AjvPkg.ValidateFunction<{}>;
export declare const validateDevicePairApproveParams: AjvPkg.ValidateFunction<{
    requestId: string;
}>;
export declare const validateDevicePairRejectParams: AjvPkg.ValidateFunction<{
    requestId: string;
}>;
export declare const validateDeviceTokenRotateParams: AjvPkg.ValidateFunction<{
    scopes?: string[] | undefined;
    role: string;
    deviceId: string;
}>;
export declare const validateDeviceTokenRevokeParams: AjvPkg.ValidateFunction<{
    role: string;
    deviceId: string;
}>;
export declare const validateExecApprovalsGetParams: AjvPkg.ValidateFunction<{}>;
export declare const validateExecApprovalsSetParams: AjvPkg.ValidateFunction<{
    baseHash?: string | undefined;
    file: {
        socket?: {
            path?: string | undefined;
            token?: string | undefined;
        } | undefined;
        defaults?: {
            ask?: string | undefined;
            security?: string | undefined;
            askFallback?: string | undefined;
            autoAllowSkills?: boolean | undefined;
        } | undefined;
        agents?: {
            [x: string]: {
                allowlist?: {
                    id?: string | undefined;
                    lastUsedAt?: number | undefined;
                    lastUsedCommand?: string | undefined;
                    lastResolvedPath?: string | undefined;
                    pattern: string;
                }[] | undefined;
                ask?: string | undefined;
                security?: string | undefined;
                askFallback?: string | undefined;
                autoAllowSkills?: boolean | undefined;
            };
        } | undefined;
        version: 1;
    };
}>;
export declare const validateExecApprovalRequestParams: AjvPkg.ValidateFunction<{
    id?: string | undefined;
    cwd?: string | null | undefined;
    sessionKey?: string | null | undefined;
    timeoutMs?: number | undefined;
    agentId?: string | null | undefined;
    ask?: string | null | undefined;
    security?: string | null | undefined;
    resolvedPath?: string | null | undefined;
    host?: string | null | undefined;
    command: string;
}>;
export declare const validateExecApprovalResolveParams: AjvPkg.ValidateFunction<{
    id: string;
    decision: string;
}>;
export declare const validateExecApprovalsNodeGetParams: AjvPkg.ValidateFunction<{
    nodeId: string;
}>;
export declare const validateExecApprovalsNodeSetParams: AjvPkg.ValidateFunction<{
    baseHash?: string | undefined;
    file: {
        socket?: {
            path?: string | undefined;
            token?: string | undefined;
        } | undefined;
        defaults?: {
            ask?: string | undefined;
            security?: string | undefined;
            askFallback?: string | undefined;
            autoAllowSkills?: boolean | undefined;
        } | undefined;
        agents?: {
            [x: string]: {
                allowlist?: {
                    id?: string | undefined;
                    lastUsedAt?: number | undefined;
                    lastUsedCommand?: string | undefined;
                    lastResolvedPath?: string | undefined;
                    pattern: string;
                }[] | undefined;
                ask?: string | undefined;
                security?: string | undefined;
                askFallback?: string | undefined;
                autoAllowSkills?: boolean | undefined;
            };
        } | undefined;
        version: 1;
    };
    nodeId: string;
}>;
export declare const validateLogsTailParams: AjvPkg.ValidateFunction<{
    limit?: number | undefined;
    maxBytes?: number | undefined;
    cursor?: number | undefined;
}>;
export declare const validateChatHistoryParams: AjvPkg.ValidateFunction<{
    sessionKey: any;
}>;
export declare const validateChatSendParams: AjvPkg.ValidateFunction<{
    message: any;
    sessionKey: any;
    idempotencyKey: any;
} & {
    message: any;
} & {
    sessionKey: any;
} & {
    idempotencyKey: any;
}>;
export declare const validateChatAbortParams: AjvPkg.ValidateFunction<{
    runId?: string | undefined;
    sessionKey: string;
}>;
export declare const validateChatInjectParams: AjvPkg.ValidateFunction<{
    label?: string | undefined;
    message: string;
    sessionKey: string;
}>;
export declare const validateChatEvent: AjvPkg.ValidateFunction<{
    state: any;
    sessionKey: any;
    seq: any;
    runId: any;
} & {
    state: any;
} & {
    sessionKey: any;
} & {
    seq: any;
} & {
    runId: any;
}>;
export declare const validateUpdateRunParams: AjvPkg.ValidateFunction<{
    sessionKey?: string | undefined;
    timeoutMs?: number | undefined;
    note?: string | undefined;
    restartDelayMs?: number | undefined;
}>;
export declare const validateWebLoginStartParams: AjvPkg.ValidateFunction<{
    timeoutMs?: number | undefined;
    force?: boolean | undefined;
    verbose?: boolean | undefined;
    accountId?: string | undefined;
}>;
export declare const validateWebLoginWaitParams: AjvPkg.ValidateFunction<{
    timeoutMs?: number | undefined;
    accountId?: string | undefined;
}>;
export declare function formatValidationErrors(errors: ErrorObject[] | null | undefined): string;
export { ConnectParamsSchema, HelloOkSchema, RequestFrameSchema, ResponseFrameSchema, EventFrameSchema, GatewayFrameSchema, PresenceEntrySchema, SnapshotSchema, ErrorShapeSchema, StateVersionSchema, AgentEventSchema, ChatEventSchema, SendParamsSchema, PollParamsSchema, AgentParamsSchema, AgentIdentityParamsSchema, AgentIdentityResultSchema, WakeParamsSchema, NodePairRequestParamsSchema, NodePairListParamsSchema, NodePairApproveParamsSchema, NodePairRejectParamsSchema, NodePairVerifyParamsSchema, NodeListParamsSchema, NodeInvokeParamsSchema, SessionsListParamsSchema, SessionsPreviewParamsSchema, SessionsPatchParamsSchema, SessionsResetParamsSchema, SessionsDeleteParamsSchema, SessionsCompactParamsSchema, ConfigGetParamsSchema, ConfigSetParamsSchema, ConfigApplyParamsSchema, ConfigPatchParamsSchema, ConfigSchemaParamsSchema, ConfigSchemaResponseSchema, WizardStartParamsSchema, WizardNextParamsSchema, WizardCancelParamsSchema, WizardStatusParamsSchema, WizardStepSchema, WizardNextResultSchema, WizardStartResultSchema, WizardStatusResultSchema, ChannelsStatusParamsSchema, ChannelsStatusResultSchema, ChannelsLogoutParamsSchema, WebLoginStartParamsSchema, WebLoginWaitParamsSchema, AgentSummarySchema, AgentsListParamsSchema, AgentsListResultSchema, ModelsListParamsSchema, SkillsStatusParamsSchema, SkillsInstallParamsSchema, SkillsUpdateParamsSchema, CronJobSchema, CronListParamsSchema, CronStatusParamsSchema, CronAddParamsSchema, CronUpdateParamsSchema, CronRemoveParamsSchema, CronRunParamsSchema, CronRunsParamsSchema, LogsTailParamsSchema, LogsTailResultSchema, ChatHistoryParamsSchema, ChatSendParamsSchema, ChatInjectParamsSchema, UpdateRunParamsSchema, TickEventSchema, ShutdownEventSchema, ProtocolSchemas, PROTOCOL_VERSION, ErrorCodes, errorShape, };
export type { GatewayFrame, ConnectParams, HelloOk, RequestFrame, ResponseFrame, EventFrame, PresenceEntry, Snapshot, ErrorShape, StateVersion, AgentEvent, AgentIdentityParams, AgentIdentityResult, AgentWaitParams, ChatEvent, TickEvent, ShutdownEvent, WakeParams, NodePairRequestParams, NodePairListParams, NodePairApproveParams, DevicePairListParams, DevicePairApproveParams, DevicePairRejectParams, ConfigGetParams, ConfigSetParams, ConfigApplyParams, ConfigPatchParams, ConfigSchemaParams, ConfigSchemaResponse, WizardStartParams, WizardNextParams, WizardCancelParams, WizardStatusParams, WizardStep, WizardNextResult, WizardStartResult, WizardStatusResult, TalkModeParams, ChannelsStatusParams, ChannelsStatusResult, ChannelsLogoutParams, WebLoginStartParams, WebLoginWaitParams, AgentSummary, AgentsListParams, AgentsListResult, SkillsStatusParams, SkillsBinsParams, SkillsBinsResult, SkillsInstallParams, SkillsUpdateParams, NodePairRejectParams, NodePairVerifyParams, NodeListParams, NodeInvokeParams, NodeInvokeResultParams, NodeEventParams, SessionsListParams, SessionsPreviewParams, SessionsResolveParams, SessionsPatchParams, SessionsResetParams, SessionsDeleteParams, SessionsCompactParams, CronJob, CronListParams, CronStatusParams, CronAddParams, CronUpdateParams, CronRemoveParams, CronRunParams, CronRunsParams, CronRunLogEntry, ExecApprovalsGetParams, ExecApprovalsSetParams, ExecApprovalsSnapshot, LogsTailParams, LogsTailResult, PollParams, UpdateRunParams, ChatInjectParams, };
//# sourceMappingURL=index.d.ts.map