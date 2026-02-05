export const ErrorCodes = {
    NOT_LINKED: "NOT_LINKED",
    NOT_PAIRED: "NOT_PAIRED",
    AGENT_TIMEOUT: "AGENT_TIMEOUT",
    INVALID_REQUEST: "INVALID_REQUEST",
    UNAVAILABLE: "UNAVAILABLE",
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
};
export function errorShape(code, message, opts) {
    return {
        code,
        message,
        ...opts,
    };
}
//# sourceMappingURL=error-codes.js.map