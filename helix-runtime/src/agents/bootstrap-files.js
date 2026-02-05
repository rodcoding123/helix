import { applyBootstrapHookOverrides } from "./bootstrap-hooks.js";
import { filterBootstrapFilesForSession, loadWorkspaceBootstrapFiles, } from "./workspace.js";
import { buildBootstrapContextFiles, resolveBootstrapMaxChars } from "./pi-embedded-helpers.js";
// ============================================
// HELIX: Seven-layer context loading
// ============================================
import { loadHelixContextFiles, isHelixConfigured } from "../helix/context-loader.js";
export function makeBootstrapWarn(params) {
    if (!params.warn) {
        return undefined;
    }
    return (message) => params.warn?.(`${message} (sessionKey=${params.sessionLabel})`);
}
export async function resolveBootstrapFilesForRun(params) {
    const sessionKey = params.sessionKey ?? params.sessionId;
    const bootstrapFiles = filterBootstrapFilesForSession(await loadWorkspaceBootstrapFiles(params.workspaceDir), sessionKey);
    return applyBootstrapHookOverrides({
        files: bootstrapFiles,
        workspaceDir: params.workspaceDir,
        config: params.config,
        sessionKey: params.sessionKey,
        sessionId: params.sessionId,
        agentId: params.agentId,
    });
}
export async function resolveBootstrapContextForRun(params) {
    const bootstrapFiles = await resolveBootstrapFilesForRun(params);
    const baseContextFiles = buildBootstrapContextFiles(bootstrapFiles, {
        maxChars: resolveBootstrapMaxChars(params.config),
        warn: params.warn,
    });
    // ============================================
    // HELIX: Load seven-layer context files
    // These provide psychological profile, goals,
    // transformation state, and purpose to every
    // conversation
    // ============================================
    let helixContextFiles = [];
    try {
        if (await isHelixConfigured(params.workspaceDir)) {
            helixContextFiles = await loadHelixContextFiles(params.workspaceDir);
        }
    }
    catch {
        // Helix not configured - continue without it
    }
    const contextFiles = [...baseContextFiles, ...helixContextFiles];
    return { bootstrapFiles, contextFiles };
}
//# sourceMappingURL=bootstrap-files.js.map