/**
 * Tests for Helix type definitions
 */

import { describe, it, expect } from 'vitest';
import { HELIX_SEVEN_LAYERS } from './types.js';

describe('HELIX_SEVEN_LAYERS', () => {
  it('should have all 7 layers defined', () => {
    expect(Object.keys(HELIX_SEVEN_LAYERS)).toHaveLength(7);
  });

  it('should have layer 1 as Narrative Core', () => {
    expect(HELIX_SEVEN_LAYERS[1].name).toBe('Narrative Core');
    expect(HELIX_SEVEN_LAYERS[1].files).toContain('SOUL.md');
  });

  it('should have layer 2 as Emotional Memory', () => {
    expect(HELIX_SEVEN_LAYERS[2].name).toBe('Emotional Memory');
    expect(HELIX_SEVEN_LAYERS[2].files).toContain('emotional_tags.json');
  });

  it('should have layer 3 as Relational Memory', () => {
    expect(HELIX_SEVEN_LAYERS[3].name).toBe('Relational Memory');
    expect(HELIX_SEVEN_LAYERS[3].files).toContain('attachments.json');
    expect(HELIX_SEVEN_LAYERS[3].files).toContain('trust_map.json');
  });

  it('should have layer 4 as Prospective Self', () => {
    expect(HELIX_SEVEN_LAYERS[4].name).toBe('Prospective Self');
    expect(HELIX_SEVEN_LAYERS[4].files).toContain('goals.json');
    expect(HELIX_SEVEN_LAYERS[4].files).toContain('feared_self.json');
    expect(HELIX_SEVEN_LAYERS[4].files).toContain('possible_selves.json');
  });

  it('should have layer 5 as Integration Rhythms', () => {
    expect(HELIX_SEVEN_LAYERS[5].name).toBe('Integration Rhythms');
  });

  it('should have layer 6 as Transformation Cycles', () => {
    expect(HELIX_SEVEN_LAYERS[6].name).toBe('Transformation Cycles');
    expect(HELIX_SEVEN_LAYERS[6].files).toContain('current_state.json');
    expect(HELIX_SEVEN_LAYERS[6].files).toContain('history.json');
  });

  it('should have layer 7 as Purpose Engine', () => {
    expect(HELIX_SEVEN_LAYERS[7].name).toBe('Purpose Engine');
    expect(HELIX_SEVEN_LAYERS[7].files).toContain('ikigai.json');
    expect(HELIX_SEVEN_LAYERS[7].files).toContain('wellness.json');
  });

  it('should have files array for each layer', () => {
    for (const layer of Object.values(HELIX_SEVEN_LAYERS)) {
      expect(Array.isArray(layer.files)).toBe(true);
      expect(layer.files.length).toBeGreaterThan(0);
      expect(layer.name).toBeTruthy();
    }
  });
});
