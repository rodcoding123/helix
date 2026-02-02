import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveBundledPluginsDir } from "./bundled-dir.js";
import { discoverOpenClawPlugins } from "./discovery.js";

describe("Plugin Isolation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENCLAW_BUNDLED_PLUGINS_DIR;
    delete process.env.HELIX_ISOLATED_MODE;
    delete process.env.OPENCLAW_STATE_DIR;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("stops directory walking in HELIX_ISOLATED_MODE", () => {
    process.env.HELIX_ISOLATED_MODE = "1";
    const result = resolveBundledPluginsDir();

    if (result) {
      expect(result).toContain("helix-runtime");
      expect(result).not.toContain("AppData");
      expect(result).not.toContain("npm");
    }
  });

  it("skips global directory in isolated mode", () => {
    process.env.HELIX_ISOLATED_MODE = "1";
    const discovery = discoverOpenClawPlugins({});

    const globalCandidates = discovery.candidates.filter(
      (c) => c.origin === "global"
    );

    expect(globalCandidates).toHaveLength(0);
  });

  it("discovers bundled plugins in isolated mode", () => {
    process.env.HELIX_ISOLATED_MODE = "1";
    const discovery = discoverOpenClawPlugins({});

    const bundledCandidates = discovery.candidates.filter(
      (c) => c.origin === "bundled"
    );

    expect(bundledCandidates.length).toBeGreaterThan(0);
  });
});
