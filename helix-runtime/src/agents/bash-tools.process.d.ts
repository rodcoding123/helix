import type { AgentTool } from "@mariozechner/pi-agent-core";
export type ProcessToolDefaults = {
    cleanupMs?: number;
    scopeKey?: string;
};
export declare function createProcessTool(defaults?: ProcessToolDefaults): AgentTool<any>;
export declare const processTool: AgentTool<any, any>;
//# sourceMappingURL=bash-tools.process.d.ts.map