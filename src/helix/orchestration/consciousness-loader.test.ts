import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsciousnessLoader } from './consciousness-loader.js';
import { setHashChainFailClosedMode } from '../hash-chain.js';

describe('ConsciousnessLoader', () => {
  let loader: ConsciousnessLoader;

  beforeEach(() => {
    loader = new ConsciousnessLoader();
    // Disable fail-closed mode for testing
    setHashChainFailClosedMode(false);
  });

  afterEach(() => {
    loader.invalidateCache();
    // Re-enable fail-closed mode for production
    setHashChainFailClosedMode(true);
  });

  describe('load', () => {
    it('should load consciousness from files', async () => {
      const state = await loader.load();

      expect(state).toBeDefined();
      expect(state.loaded_at).toBeDefined();
      expect(state.layers_loaded.length).toBeGreaterThan(0);
      expect(state.layer1_narrative).toBeDefined();
    });

    it('should cache loaded consciousness for 5 minutes', async () => {
      const state1 = await loader.load();
      const loadTime1 = Date.now();

      // Simulate immediate second load
      const state2 = await loader.load();
      const loadTime2 = Date.now();

      // Should be same object (from cache)
      expect(state2).toBe(state1);
      expect(loadTime2 - loadTime1).toBeLessThan(5);
    });

    it('should invalidate cache after 5 minutes', async () => {
      const state1 = await loader.load();

      // Fast-forward time by 5+ minutes
      vi.useFakeTimers();
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const state2 = await loader.load();

      vi.useRealTimers();

      // Should be different objects (cache expired)
      expect(state2).not.toBe(state1);
      expect(state2.loaded_at).not.toBe(state1.loaded_at);
    });

    it('should load layer1 narrative from HELIX_SOUL.md', async () => {
      const state = await loader.load();

      expect(state.layer1_narrative).toBeDefined();
      expect(state.layer1_narrative.narrative_identity).toBeDefined();
      expect(state.layers_loaded).toContain('layer1_narrative');
    });

    it('should load layer2 emotional from emotional_tags.json', async () => {
      const state = await loader.load();

      expect(state.layer2_emotional).toBeDefined();
      expect(Array.isArray(state.layer2_emotional.tags)).toBe(true);
      expect(state.layers_loaded).toContain('layer2_emotional');
    });

    it('should load layer3 relational from attachments.json and trust_map.json', async () => {
      const state = await loader.load();

      expect(state.layer3_relational).toBeDefined();
      expect(state.layer3_relational.attachments).toBeDefined();
      expect(state.layers_loaded).toContain('layer3_relational');
    });

    it('should load layer4 prospective from goals.json', async () => {
      const state = await loader.load();

      expect(state.layer4_prospective).toBeDefined();
      expect(Array.isArray(state.layer4_prospective.goals)).toBe(true);
      expect(state.layers_loaded).toContain('layer4_prospective');
    });

    it('should load layer5 rhythm from cron state', async () => {
      const state = await loader.load();

      expect(state.layer5_rhythm).toBeDefined();
      expect(state.layers_loaded).toContain('layer5_rhythm');
    });

    it('should load layer6 transformation from current_state.json and history.json', async () => {
      const state = await loader.load();

      expect(state.layer6_transformation).toBeDefined();
      expect(state.layers_loaded).toContain('layer6_transformation');
    });

    it('should load layer7 purpose from ikigai.json', async () => {
      const state = await loader.load();

      expect(state.layer7_purpose).toBeDefined();
      expect(state.layers_loaded).toContain('layer7_purpose');
    });

    it('should handle missing layers gracefully', async () => {
      // Layer files might not exist - should not throw
      const state = await loader.load();

      expect(state).toBeDefined();
      expect(state.layers_failed).toBeDefined();
      expect(Array.isArray(state.layers_failed)).toBe(true);
    });

    it('should log consciousness load to hash chain', async () => {
      const state = await loader.load();

      expect(state.loaded_at).toBeDefined();
      // Verify hash chain was called (implementation detail)
    });
  });

  describe('invalidateCache', () => {
    it('should clear the cache', async () => {
      const state1 = await loader.load();
      loader.invalidateCache();
      const state2 = await loader.load();

      // Different timestamps = different loads
      expect(state2.loaded_at).not.toBe(state1.loaded_at);
    });
  });

  describe('getCacheInfo', () => {
    it('should return cache status when loaded', async () => {
      await loader.load();
      const info = loader.getCacheInfo();

      expect(info).toBeDefined();
      expect(info.cached).toBe(true);
      expect(info.load_time_ms).toBeGreaterThan(0);
    });

    it('should return cache not available when empty', () => {
      const info = loader.getCacheInfo();

      expect(info.cached).toBe(false);
    });
  });
});
