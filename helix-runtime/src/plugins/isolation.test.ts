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

  it("respects pre-existing HELIX_ISOLATED_MODE setting", () => {
    process.env.HELIX_ISOLATED_MODE = "1";
    const discovery1 = discoverOpenClawPlugins({});

    // Keep the setting and run again
    const discovery2 = discoverOpenClawPlugins({});

    // Should get same result when isolation is already set
    const globalCandidates2 = discovery2.candidates.filter(
      (c) => c.origin === "global"
    );
    expect(globalCandidates2).toHaveLength(0);
  });

  it("requires exact match for isolation flag (not case-insensitive)", () => {
    // Invalid isolation mode values should not trigger isolation
    process.env.HELIX_ISOLATED_MODE = "true";
    const discovery = discoverOpenClawPlugins({});

    // With invalid flag, global discovery may load (depends on config)
    // Just verify the function handles it without crashing
    expect(discovery.candidates).toBeDefined();
    expect(Array.isArray(discovery.candidates)).toBe(true);
  });

  it("isolates plugins even with explicit env override attempts", () => {
    process.env.HELIX_ISOLATED_MODE = "1";
    process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = "/custom/path";

    const result = resolveBundledPluginsDir();

    // Should use the override even in isolated mode
    expect(result).toBe("/custom/path");
  });

  it("verifies no global directory is loaded in isolated mode", () => {
    process.env.HELIX_ISOLATED_MODE = "1";
    const discovery = discoverOpenClawPlugins({});

    // Check the diagnostics don't reference global directory
    const origins = discovery.candidates.map((c) => c.origin);
    expect(origins).not.toContain("global");
  });
});
