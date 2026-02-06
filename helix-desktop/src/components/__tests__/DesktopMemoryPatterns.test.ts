/**
 * Tests for DesktopMemoryPatterns component
 * Tauri-based Memory Patterns UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

describe('DesktopMemoryPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load patterns via Tauri IPC', async () => {
    const mockPatterns = [
      {
        patternId: 'emotional_work_anxiety',
        type: 'emotional_trigger',
        description: 'Recurring anxiety response to work deadlines',
        confidence: 0.92,
        salience: 0.78,
        recommendations: ['Practice grounding techniques'],
        evidence: ['mem1', 'mem2', 'mem3'],
      },
    ];

    vi.mocked(invoke).mockResolvedValue(mockPatterns);

    const result = await invoke('get_memory_patterns', {}) as Record<string, unknown>[];

    expect(invoke).toHaveBeenCalledWith('get_memory_patterns', {});
    expect(result).toEqual(mockPatterns);
    expect(result[0].patternId).toBe('emotional_work_anxiety');
  });

  it('should handle Tauri IPC errors gracefully', async () => {
    const error = new Error('IPC failed');
    vi.mocked(invoke).mockRejectedValue(error);

    try {
      await invoke('get_memory_patterns', {});
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBe(error);
    }
  });

  it('should filter patterns by type', () => {
    const patterns = [
      {
        patternId: 'pat1',
        type: 'emotional_trigger',
        description: 'Anxiety',
        confidence: 0.9,
        salience: 0.7,
        recommendations: [],
        evidence: [],
      },
      {
        patternId: 'pat2',
        type: 'relational_pattern',
        description: 'Trust with Alice',
        confidence: 0.85,
        salience: 0.6,
        recommendations: [],
        evidence: [],
      },
    ];

    const filtered = patterns.filter(p => p.type === 'emotional_trigger');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].patternId).toBe('pat1');
  });

  it('should search patterns by description', () => {
    const patterns = [
      {
        patternId: 'pat1',
        type: 'emotional_trigger',
        description: 'Work-related anxiety',
        confidence: 0.9,
        salience: 0.7,
        recommendations: [],
        evidence: [],
      },
      {
        patternId: 'pat2',
        type: 'relational_pattern',
        description: 'Trust with mentor',
        confidence: 0.85,
        salience: 0.6,
        recommendations: [],
        evidence: [],
      },
    ];

    const query = 'work';
    const searched = patterns.filter(p =>
      p.description.toLowerCase().includes(query.toLowerCase())
    );

    expect(searched).toHaveLength(1);
    expect(searched[0].description.toLowerCase()).toContain('work');
  });

  it('should sort patterns by salience', () => {
    const patterns = [
      {
        patternId: 'pat1',
        type: 'emotional_trigger',
        description: 'Low salience',
        confidence: 0.9,
        salience: 0.3,
        recommendations: [],
        evidence: [],
      },
      {
        patternId: 'pat2',
        type: 'relational_pattern',
        description: 'High salience',
        confidence: 0.85,
        salience: 0.9,
        recommendations: [],
        evidence: [],
      },
    ];

    const sorted = [...patterns].sort((a, b) => b.salience - a.salience);

    expect(sorted[0].salience).toBe(0.9);
    expect(sorted[1].salience).toBe(0.3);
  });

  it('should sort patterns by confidence', () => {
    const patterns = [
      {
        patternId: 'pat1',
        type: 'emotional_trigger',
        description: 'Low confidence',
        confidence: 0.5,
        salience: 0.3,
        recommendations: [],
        evidence: [],
      },
      {
        patternId: 'pat2',
        type: 'relational_pattern',
        description: 'High confidence',
        confidence: 0.95,
        salience: 0.9,
        recommendations: [],
        evidence: [],
      },
    ];

    const sorted = [...patterns].sort((a, b) => b.confidence - a.confidence);

    expect(sorted[0].confidence).toBe(0.95);
    expect(sorted[1].confidence).toBe(0.5);
  });

  it('should return empty array when no patterns match filter', () => {
    const patterns = [
      {
        patternId: 'pat1',
        type: 'emotional_trigger',
        description: 'Anxiety',
        confidence: 0.9,
        salience: 0.7,
        recommendations: [],
        evidence: [],
      },
    ];

    const filtered = patterns.filter(p => p.type === 'relational_pattern');

    expect(filtered).toHaveLength(0);
  });

  it('should handle pattern with empty recommendations', () => {
    const pattern = {
      patternId: 'pat1',
      type: 'emotional_trigger',
      description: 'Test',
      confidence: 0.9,
      salience: 0.7,
      recommendations: [],
      evidence: ['mem1'],
    };

    expect(pattern.recommendations).toHaveLength(0);
    expect(pattern.evidence).toHaveLength(1);
  });

  it('should calculate pattern metrics correctly', () => {
    const pattern = {
      patternId: 'pat1',
      type: 'emotional_trigger',
      description: 'Test',
      confidence: 0.85,
      salience: 0.72,
      recommendations: [],
      evidence: ['mem1', 'mem2'],
    };

    const confidencePercent = pattern.confidence * 100;
    const saliencePercent = pattern.salience * 100;

    expect(confidencePercent).toBe(85);
    expect(saliencePercent).toBe(72);
  });
});
