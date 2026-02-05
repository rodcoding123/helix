import fs from "node:fs";
import fs_promises from "node:fs/promises";
import path from "node:path";
import { resolveUserPath } from "../utils.js";
import { resolveAgentWorkspaceDir } from "./agent-scope.js";
import { loadAgentIdentityFromWorkspace } from "./identity-file.js";
import { resolveAgentIdentity } from "./identity.js";
const ALLOWED_AVATAR_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
function normalizeAvatarValue(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
function resolveAvatarSource(cfg, agentId) {
    const fromConfig = normalizeAvatarValue(resolveAgentIdentity(cfg, agentId)?.avatar);
    if (fromConfig) {
        return fromConfig;
    }
    const workspace = resolveAgentWorkspaceDir(cfg, agentId);
    const fromIdentity = normalizeAvatarValue(loadAgentIdentityFromWorkspace(workspace)?.avatar);
    return fromIdentity;
}
function isRemoteAvatar(value) {
    const lower = value.toLowerCase();
    return lower.startsWith("http://") || lower.startsWith("https://");
}
function isDataAvatar(value) {
    return value.toLowerCase().startsWith("data:");
}
function resolveExistingPath(value) {
    try {
        return fs.realpathSync(value);
    }
    catch {
        return path.resolve(value);
    }
}
function isPathWithin(root, target) {
    const relative = path.relative(root, target);
    if (!relative) {
        return true;
    }
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}
function resolveLocalAvatarPath(params) {
    const workspaceRoot = resolveExistingPath(params.workspaceDir);
    const raw = params.raw;
    const resolved = raw.startsWith("~") || path.isAbsolute(raw)
        ? resolveUserPath(raw)
        : path.resolve(workspaceRoot, raw);
    const realPath = resolveExistingPath(resolved);
    if (!isPathWithin(workspaceRoot, realPath)) {
        return { ok: false, reason: "outside_workspace" };
    }
    const ext = path.extname(realPath).toLowerCase();
    if (!ALLOWED_AVATAR_EXTS.has(ext)) {
        return { ok: false, reason: "unsupported_extension" };
    }
    try {
        if (!fs.statSync(realPath).isFile()) {
            return { ok: false, reason: "missing" };
        }
    }
    catch {
        return { ok: false, reason: "missing" };
    }
    return { ok: true, filePath: realPath };
}
export function resolveAgentAvatar(cfg, agentId) {
    const source = resolveAvatarSource(cfg, agentId);
    if (!source) {
        return { kind: "none", reason: "missing" };
    }
    if (isRemoteAvatar(source)) {
        return { kind: "remote", url: source };
    }
    if (isDataAvatar(source)) {
        return { kind: "data", url: source };
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const resolved = resolveLocalAvatarPath({ raw: source, workspaceDir });
    if (!resolved.ok) {
        return { kind: "none", reason: resolved.reason };
    }
    return { kind: "local", filePath: resolved.filePath };
}
const avatarCache = new Map();
/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExt(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    };
    return mimeTypes[ext] || "image/png";
}
/**
 * Async avatar loading with caching
 * Loads local avatars and converts to data URLs for fast access
 * Returns cached data URL on subsequent calls (within same process)
 *
 * Performance optimization:
 * - First load: ~50-100ms (file I/O + base64 encoding)
 * - Cached load: <1ms (memory lookup)
 * - Reduces repeated file system access for commonly used avatars
 */
export async function resolveAgentAvatarAsync(cfg, agentId) {
    const source = resolveAvatarSource(cfg, agentId);
    if (!source) {
        return { kind: "none", reason: "missing" };
    }
    if (isRemoteAvatar(source)) {
        return { kind: "remote", url: source };
    }
    if (isDataAvatar(source)) {
        return { kind: "data", url: source };
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const resolved = resolveLocalAvatarPath({ raw: source, workspaceDir });
    if (!resolved.ok) {
        return { kind: "none", reason: resolved.reason };
    }
    const filePath = resolved.filePath;
    // Check cache first
    try {
        const stats = await fs_promises.stat(filePath);
        const cacheEntry = avatarCache.get(filePath);
        // Return cached entry if file hasn't been modified
        if (cacheEntry && cacheEntry.mtime === stats.mtime.getTime()) {
            return { kind: "data", url: cacheEntry.dataUrl };
        }
        // Load file and convert to data URL
        const fileBuffer = await fs_promises.readFile(filePath);
        const base64 = fileBuffer.toString("base64");
        const mimeType = getMimeTypeFromExt(filePath);
        const dataUrl = `data:${mimeType};base64,${base64}`;
        // Cache the data URL with file mtime
        avatarCache.set(filePath, {
            dataUrl,
            mtime: stats.mtime.getTime(),
        });
        return { kind: "data", url: dataUrl };
    }
    catch {
        return { kind: "none", reason: "missing" };
    }
}
/**
 * Clear avatar cache
 * Useful for testing or when avatars are updated
 */
export function clearAvatarCache() {
    avatarCache.clear();
}
//# sourceMappingURL=identity-avatar.js.map