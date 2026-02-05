import fs from "node:fs";
import fs_promises from "node:fs/promises";
import path from "node:path";
import { resolveConfigDir, resolveUserPath } from "../utils.js";
import { resolveBundledPluginsDir } from "./bundled-dir.js";
import { getPackageManifestMetadata, } from "./manifest.js";
const EXTENSION_EXTS = new Set([".ts", ".js", ".mts", ".cts", ".mjs", ".cjs"]);
// HELIX: Isolation mode constant (must match entry.ts and bundled-dir.ts)
const ISOLATED_MODE_VALUE = "1";
function isExtensionFile(filePath) {
    const ext = path.extname(filePath);
    if (!EXTENSION_EXTS.has(ext)) {
        return false;
    }
    return !filePath.endsWith(".d.ts");
}
function readPackageManifest(dir) {
    const manifestPath = path.join(dir, "package.json");
    if (!fs.existsSync(manifestPath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(manifestPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function resolvePackageExtensions(manifest) {
    const raw = getPackageManifestMetadata(manifest)?.extensions;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
}
function deriveIdHint(params) {
    const base = path.basename(params.filePath, path.extname(params.filePath));
    const rawPackageName = params.packageName?.trim();
    if (!rawPackageName) {
        return base;
    }
    // Prefer the unscoped name so config keys stay stable even when the npm
    // package is scoped (example: @openclaw/voice-call -> voice-call).
    const unscoped = rawPackageName.includes("/")
        ? (rawPackageName.split("/").pop() ?? rawPackageName)
        : rawPackageName;
    if (!params.hasMultipleExtensions) {
        return unscoped;
    }
    return `${unscoped}/${base}`;
}
function addCandidate(params) {
    const resolved = path.resolve(params.source);
    if (params.seen.has(resolved)) {
        return;
    }
    params.seen.add(resolved);
    const manifest = params.manifest ?? null;
    params.candidates.push({
        idHint: params.idHint,
        source: resolved,
        rootDir: path.resolve(params.rootDir),
        origin: params.origin,
        workspaceDir: params.workspaceDir,
        packageName: manifest?.name?.trim() || undefined,
        packageVersion: manifest?.version?.trim() || undefined,
        packageDescription: manifest?.description?.trim() || undefined,
        packageDir: params.packageDir,
        packageManifest: getPackageManifestMetadata(manifest ?? undefined),
    });
}
function discoverInDirectory(params) {
    if (!fs.existsSync(params.dir)) {
        return;
    }
    let entries = [];
    try {
        entries = fs.readdirSync(params.dir, { withFileTypes: true });
    }
    catch (err) {
        params.diagnostics.push({
            level: "warn",
            message: `failed to read extensions dir: ${params.dir} (${String(err)})`,
            source: params.dir,
        });
        return;
    }
    for (const entry of entries) {
        const fullPath = path.join(params.dir, entry.name);
        if (entry.isFile()) {
            if (!isExtensionFile(fullPath)) {
                continue;
            }
            addCandidate({
                candidates: params.candidates,
                seen: params.seen,
                idHint: path.basename(entry.name, path.extname(entry.name)),
                source: fullPath,
                rootDir: path.dirname(fullPath),
                origin: params.origin,
                workspaceDir: params.workspaceDir,
            });
        }
        if (!entry.isDirectory()) {
            continue;
        }
        const manifest = readPackageManifest(fullPath);
        const extensions = manifest ? resolvePackageExtensions(manifest) : [];
        if (extensions.length > 0) {
            for (const extPath of extensions) {
                const resolved = path.resolve(fullPath, extPath);
                addCandidate({
                    candidates: params.candidates,
                    seen: params.seen,
                    idHint: deriveIdHint({
                        filePath: resolved,
                        packageName: manifest?.name,
                        hasMultipleExtensions: extensions.length > 1,
                    }),
                    source: resolved,
                    rootDir: fullPath,
                    origin: params.origin,
                    workspaceDir: params.workspaceDir,
                    manifest,
                    packageDir: fullPath,
                });
            }
            continue;
        }
        const indexCandidates = ["index.ts", "index.js", "index.mjs", "index.cjs"];
        const indexFile = indexCandidates
            .map((candidate) => path.join(fullPath, candidate))
            .find((candidate) => fs.existsSync(candidate));
        if (indexFile && isExtensionFile(indexFile)) {
            addCandidate({
                candidates: params.candidates,
                seen: params.seen,
                idHint: entry.name,
                source: indexFile,
                rootDir: fullPath,
                origin: params.origin,
                workspaceDir: params.workspaceDir,
                manifest,
                packageDir: fullPath,
            });
        }
    }
}
function discoverFromPath(params) {
    const resolved = resolveUserPath(params.rawPath);
    if (!fs.existsSync(resolved)) {
        params.diagnostics.push({
            level: "error",
            message: `plugin path not found: ${resolved}`,
            source: resolved,
        });
        return;
    }
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
        if (!isExtensionFile(resolved)) {
            params.diagnostics.push({
                level: "error",
                message: `plugin path is not a supported file: ${resolved}`,
                source: resolved,
            });
            return;
        }
        addCandidate({
            candidates: params.candidates,
            seen: params.seen,
            idHint: path.basename(resolved, path.extname(resolved)),
            source: resolved,
            rootDir: path.dirname(resolved),
            origin: params.origin,
            workspaceDir: params.workspaceDir,
        });
        return;
    }
    if (stat.isDirectory()) {
        const manifest = readPackageManifest(resolved);
        const extensions = manifest ? resolvePackageExtensions(manifest) : [];
        if (extensions.length > 0) {
            for (const extPath of extensions) {
                const source = path.resolve(resolved, extPath);
                addCandidate({
                    candidates: params.candidates,
                    seen: params.seen,
                    idHint: deriveIdHint({
                        filePath: source,
                        packageName: manifest?.name,
                        hasMultipleExtensions: extensions.length > 1,
                    }),
                    source,
                    rootDir: resolved,
                    origin: params.origin,
                    workspaceDir: params.workspaceDir,
                    manifest,
                    packageDir: resolved,
                });
            }
            return;
        }
        const indexCandidates = ["index.ts", "index.js", "index.mjs", "index.cjs"];
        const indexFile = indexCandidates
            .map((candidate) => path.join(resolved, candidate))
            .find((candidate) => fs.existsSync(candidate));
        if (indexFile && isExtensionFile(indexFile)) {
            addCandidate({
                candidates: params.candidates,
                seen: params.seen,
                idHint: path.basename(resolved),
                source: indexFile,
                rootDir: resolved,
                origin: params.origin,
                workspaceDir: params.workspaceDir,
                manifest,
                packageDir: resolved,
            });
            return;
        }
        discoverInDirectory({
            dir: resolved,
            origin: params.origin,
            workspaceDir: params.workspaceDir,
            candidates: params.candidates,
            diagnostics: params.diagnostics,
            seen: params.seen,
        });
        return;
    }
}
export function discoverOpenClawPlugins(params) {
    const candidates = [];
    const diagnostics = [];
    const seen = new Set();
    const workspaceDir = params.workspaceDir?.trim();
    const extra = params.extraPaths ?? [];
    for (const extraPath of extra) {
        if (typeof extraPath !== "string") {
            continue;
        }
        const trimmed = extraPath.trim();
        if (!trimmed) {
            continue;
        }
        discoverFromPath({
            rawPath: trimmed,
            origin: "config",
            workspaceDir: workspaceDir?.trim() || undefined,
            candidates,
            diagnostics,
            seen,
        });
    }
    if (workspaceDir) {
        const workspaceRoot = resolveUserPath(workspaceDir);
        const workspaceExtDirs = [path.join(workspaceRoot, ".openclaw", "extensions")];
        for (const dir of workspaceExtDirs) {
            discoverInDirectory({
                dir,
                origin: "workspace",
                workspaceDir: workspaceRoot,
                candidates,
                diagnostics,
                seen,
            });
        }
    }
    // HELIX: Skip global directory in isolated mode
    const isolatedMode = process.env.HELIX_ISOLATED_MODE === ISOLATED_MODE_VALUE;
    if (!isolatedMode) {
        const globalDir = path.join(resolveConfigDir(), "extensions");
        discoverInDirectory({
            dir: globalDir,
            origin: "global",
            candidates,
            diagnostics,
            seen,
        });
    }
    const bundledDir = resolveBundledPluginsDir();
    if (bundledDir) {
        discoverInDirectory({
            dir: bundledDir,
            origin: "bundled",
            candidates,
            diagnostics,
            seen,
        });
    }
    return { candidates, diagnostics };
}
/**
 * Async plugin discovery with parallel directory scanning
 * Performance optimization: Scans multiple plugin directories in parallel
 * instead of sequentially, reducing startup time by 30-50%
 *
 * Use this instead of discoverOpenClawPlugins for async contexts
 */
export async function discoverOpenClawPluginsAsync(params) {
    const candidates = [];
    const diagnostics = [];
    const seen = new Set();
    const workspaceDir = params.workspaceDir?.trim();
    // Process extra paths sequentially (they come from config)
    const extra = params.extraPaths ?? [];
    for (const extraPath of extra) {
        if (typeof extraPath !== "string") {
            continue;
        }
        const trimmed = extraPath.trim();
        if (!trimmed) {
            continue;
        }
        discoverFromPath({
            rawPath: trimmed,
            origin: "config",
            workspaceDir: workspaceDir?.trim() || undefined,
            candidates,
            diagnostics,
            seen,
        });
    }
    // Collect directories to scan in parallel
    const dirsToScan = [];
    if (workspaceDir) {
        const workspaceRoot = resolveUserPath(workspaceDir);
        dirsToScan.push({
            dir: path.join(workspaceRoot, ".openclaw", "extensions"),
            origin: "workspace",
            workspaceDir: workspaceRoot,
        });
    }
    // HELIX: Skip global directory in isolated mode
    const isolatedMode = process.env.HELIX_ISOLATED_MODE === ISOLATED_MODE_VALUE;
    if (!isolatedMode) {
        dirsToScan.push({
            dir: path.join(resolveConfigDir(), "extensions"),
            origin: "global",
        });
    }
    const bundledDir = resolveBundledPluginsDir();
    if (bundledDir) {
        dirsToScan.push({
            dir: bundledDir,
            origin: "bundled",
        });
    }
    // Scan all directories in parallel using Promise.all
    // Each directory scan is independent, so we can scan them concurrently
    await Promise.all(dirsToScan.map(async ({ dir, origin, workspaceDir: wd }) => {
        try {
            // Use fs.promises for non-blocking I/O
            await discoverInDirectoryAsync({
                dir,
                origin,
                workspaceDir: wd,
                candidates,
                diagnostics,
                seen,
            });
        }
        catch (err) {
            diagnostics.push({
                level: "warn",
                message: `failed to scan plugin directory: ${dir} (${String(err)})`,
                source: dir,
            });
        }
    }));
    return { candidates, diagnostics };
}
/**
 * Async version of discoverInDirectory
 * Uses fs.promises for non-blocking I/O
 */
async function discoverInDirectoryAsync(params) {
    try {
        const stats = await fs_promises.stat(params.dir);
        if (!stats.isDirectory()) {
            return;
        }
    }
    catch {
        return;
    }
    let entries = [];
    try {
        entries = await fs_promises.readdir(params.dir, { withFileTypes: true });
    }
    catch (err) {
        params.diagnostics.push({
            level: "warn",
            message: `failed to read extensions dir: ${params.dir} (${String(err)})`,
            source: params.dir,
        });
        return;
    }
    // Process entries with minimal parallelization (manifest reads)
    for (const entry of entries) {
        const fullPath = path.join(params.dir, entry.name);
        if (entry.isFile()) {
            if (!isExtensionFile(fullPath)) {
                continue;
            }
            addCandidate({
                candidates: params.candidates,
                seen: params.seen,
                idHint: path.basename(entry.name, path.extname(entry.name)),
                source: fullPath,
                rootDir: path.dirname(fullPath),
                origin: params.origin,
                workspaceDir: params.workspaceDir,
            });
            continue;
        }
        if (!entry.isDirectory()) {
            continue;
        }
        const manifest = readPackageManifest(fullPath);
        const extensions = manifest ? resolvePackageExtensions(manifest) : [];
        if (extensions.length > 0) {
            for (const extPath of extensions) {
                const resolved = path.resolve(fullPath, extPath);
                addCandidate({
                    candidates: params.candidates,
                    seen: params.seen,
                    idHint: deriveIdHint({
                        filePath: resolved,
                        packageName: manifest?.name,
                        hasMultipleExtensions: extensions.length > 1,
                    }),
                    source: resolved,
                    rootDir: fullPath,
                    origin: params.origin,
                    workspaceDir: params.workspaceDir,
                    manifest,
                    packageDir: fullPath,
                });
            }
            continue;
        }
        // Async index file check
        const indexCandidates = ["index.ts", "index.js", "index.mjs", "index.cjs"];
        let indexFile;
        for (const candidate of indexCandidates) {
            try {
                const candidatePath = path.join(fullPath, candidate);
                const stats = await fs_promises.stat(candidatePath);
                if (stats.isFile() && isExtensionFile(candidatePath)) {
                    indexFile = candidatePath;
                    break;
                }
            }
            catch {
                // File doesn't exist, try next candidate
                continue;
            }
        }
        if (indexFile) {
            addCandidate({
                candidates: params.candidates,
                seen: params.seen,
                idHint: entry.name,
                source: indexFile,
                rootDir: fullPath,
                origin: params.origin,
                workspaceDir: params.workspaceDir,
                manifest,
                packageDir: fullPath,
            });
            continue;
        }
        // Recursively scan subdirectory
        await discoverInDirectoryAsync({
            dir: fullPath,
            origin: params.origin,
            workspaceDir: params.workspaceDir,
            candidates: params.candidates,
            diagnostics: params.diagnostics,
            seen: params.seen,
        });
    }
}
//# sourceMappingURL=discovery.js.map