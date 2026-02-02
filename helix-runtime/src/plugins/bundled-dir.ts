import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveBundledPluginsDir(): string | undefined {
  const override = process.env.OPENCLAW_BUNDLED_PLUGINS_DIR?.trim();
  if (override) {
    return override;
  }

  // HELIX: In isolated mode, stop directory tree walking
  if (process.env.HELIX_ISOLATED_MODE === "1") {
    const thisModuleDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(thisModuleDir, "..", "..");
    const candidate = path.join(projectRoot, "extensions");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    return undefined; // Don't walk up to find global npm installation
  }

  // bun --compile: ship a sibling `extensions/` next to the executable.
  try {
    const execDir = path.dirname(process.execPath);
    const sibling = path.join(execDir, "extensions");
    if (fs.existsSync(sibling)) {
      return sibling;
    }
  } catch {
    // ignore
  }

  // npm/dev: walk up from this module to find `extensions/` at the package root.
  try {
    let cursor = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i += 1) {
      const candidate = path.join(cursor, "extensions");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) {
        break;
      }
      cursor = parent;
    }
  } catch {
    // ignore
  }

  return undefined;
}
