import { ErrorCodes, errorShape, formatValidationErrors, validateTalkModeParams, } from "../protocol/index.js";
import { OperationContext, executeWithCostTracking } from "../ai-operation-integration.js";
export const talkHandlers = {
    "talk.mode": ({ params, respond, context, client, isWebchatConnect }) => {
        if (client && isWebchatConnect(client.connect) && !context.hasConnectedMobileNode()) {
            respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "talk disabled: no connected iOS/Android nodes"));
            return;
        }
        if (!validateTalkModeParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, `invalid talk.mode params: ${formatValidationErrors(validateTalkModeParams.errors)}`));
            return;
        }
        // Create operation context for cost tracking (LOW cost operation)
        const opContext = new OperationContext("talk.mode", "talk_mode_update", client?.connect?.client?.id);
        // Execute with cost tracking
        executeWithCostTracking(opContext, async () => {
            const payload = {
                enabled: params.enabled,
                phase: params.phase ?? null,
                ts: Date.now(),
            };
            // Track cost (MINIMAL cost operation)
            opContext.costUsd = 0.0;
            context.broadcast("talk.mode", payload, { dropIfSlow: true });
            respond(true, payload, undefined);
            return payload;
        }).catch((err) => {
            // Log error but still respond to avoid breaking the client
            respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Failed to update talk mode: " + (err instanceof Error ? err.message : String(err))));
        });
    },
};
//# sourceMappingURL=talk.js.map