import { type OpenClawPackageManifest } from "./manifest.js";
import type { PluginDiagnostic, PluginOrigin } from "./types.js";
export type PluginCandidate = {
    idHint: string;
    source: string;
    rootDir: string;
    origin: PluginOrigin;
    workspaceDir?: string;
    packageName?: string;
    packageVersion?: string;
    packageDescription?: string;
    packageDir?: string;
    packageManifest?: OpenClawPackageManifest;
};
export type PluginDiscoveryResult = {
    candidates: PluginCandidate[];
    diagnostics: PluginDiagnostic[];
};
export declare function discoverOpenClawPlugins(params: {
    workspaceDir?: string;
    extraPaths?: string[];
}): PluginDiscoveryResult;
/**
 * Async plugin discovery with parallel directory scanning
 * Performance optimization: Scans multiple plugin directories in parallel
 * instead of sequentially, reducing startup time by 30-50%
 *
 * Use this instead of discoverOpenClawPlugins for async contexts
 */
export declare function discoverOpenClawPluginsAsync(params: {
    workspaceDir?: string;
    extraPaths?: string[];
}): Promise<PluginDiscoveryResult>;
//# sourceMappingURL=discovery.d.ts.map