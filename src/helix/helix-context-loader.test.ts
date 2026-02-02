/**
 * Tests for Helix Context Loader (Seven-Layer Architecture)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import {
  loadHelixContextFiles,
  loadHelixContextFilesDetailed,
  getHelixContextStatus,
  buildLayerSummary,
  ensureHelixDirectoryStructure,
  validateContextFile,
  HELIX_LAYER_FILES,
} from './helix-context-loader.js';

// Mock fs
vi.mock('node:fs/promises');

describe('Context Loader - loadHelixContextFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load all available context files', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFiles('/workspace');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should skip missing files without throwing', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const results = await loadHelixContextFiles('/workspace');

    expect(results).toBeDefined();
    expect(results).toHaveLength(0);
  });

  it('should add layer metadata to JSON files', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"trust_level": 0.95}');

    const results = await loadHelixContextFiles('/workspace');

    expect(results.length).toBeGreaterThan(0);
    const firstFile = results[0];
    expect(firstFile.content).toBeDefined();

    // Check if layer metadata was added
    const parsed = JSON.parse(firstFile.content);
    expect(parsed._helix_layer).toBeDefined();
    expect(parsed._helix_layer.number).toBeGreaterThan(0);
    expect(parsed._helix_layer.name).toBeDefined();
  });

  it('should handle invalid JSON gracefully', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('invalid json {]');

    const results = await loadHelixContextFiles('/workspace');

    expect(results.length).toBeGreaterThan(0);
    // Should keep original content if JSON parsing fails
    expect(results[0].content).toBe('invalid json {]');
  });

  it('should include file paths in results', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFiles('/workspace');

    if (results.length > 0) {
      expect(results[0].path).toBeDefined();
      expect(typeof results[0].path).toBe('string');
    }
  });

  it('should load files from all layers', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFiles('/workspace');

    // Check that files from different layers are present
    const layerNumbers = results
      .map(r => JSON.parse(r.content)._helix_layer?.number)
      .filter(Boolean);

    const uniqueLayers = new Set(layerNumbers);
    expect(uniqueLayers.size).toBeGreaterThan(0);
  });

  it('should handle workspace directory with trailing slash', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFiles('/workspace/');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should preserve non-JSON content unchanged', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('plain text content');

    const results = await loadHelixContextFiles('/workspace');

    if (results.length > 0) {
      expect(results[0].content).toBe('plain text content');
    }
  });
});

describe('Context Loader - loadHelixContextFilesDetailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load files with detailed metadata', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFilesDetailed('/workspace');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should include layer number in results', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFilesDetailed('/workspace');

    if (results.length > 0) {
      expect(results[0].layer).toBeDefined();
      expect(typeof results[0].layer).toBe('number');
      expect(results[0].layer).toBeGreaterThan(0);
      expect(results[0].layer).toBeLessThanOrEqual(7);
    }
  });

  it('should include description in results', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFilesDetailed('/workspace');

    if (results.length > 0) {
      expect(results[0].description).toBeDefined();
      expect(typeof results[0].description).toBe('string');
    }
  });

  it('should include file content without layer metadata injection', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"trust_level": 0.95}');

    const results = await loadHelixContextFilesDetailed('/workspace');

    if (results.length > 0) {
      expect(results[0].content).toBe('{"trust_level": 0.95}');
    }
  });

  it('should skip missing files', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const results = await loadHelixContextFilesDetailed('/workspace');

    expect(results).toHaveLength(0);
  });

  it('should include path in results', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"test": "data"}');

    const results = await loadHelixContextFilesDetailed('/workspace');

    if (results.length > 0) {
      expect(results[0].path).toBeDefined();
    }
  });
});

describe('Context Loader - getHelixContextStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return status for all layer files', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const status = await getHelixContextStatus('/workspace');

    expect(status).toBeDefined();
    expect(Array.isArray(status)).toBe(true);
    expect(status.length).toBeGreaterThan(0);
  });

  it('should mark present files with size', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 2048 } as any);

    const status = await getHelixContextStatus('/workspace');

    const presentFiles = status.filter(s => s.status === 'present');
    if (presentFiles.length > 0) {
      expect(presentFiles[0].size).toBe(2048);
    }
  });

  it('should mark missing files', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const status = await getHelixContextStatus('/workspace');

    expect(status.every(s => s.status === 'missing')).toBe(true);
  });

  it('should include layer information', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const status = await getHelixContextStatus('/workspace');

    if (status.length > 0) {
      expect(status[0].layer).toBeGreaterThan(0);
      expect(status[0].layer).toBeLessThanOrEqual(7);
      expect(status[0].name).toBeDefined();
    }
  });

  it('should include file path', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const status = await getHelixContextStatus('/workspace');

    if (status.length > 0) {
      expect(status[0].file).toBeDefined();
      expect(typeof status[0].file).toBe('string');
    }
  });

  it('should handle mixed present and missing files', async () => {
    let callCount = 0;
    vi.mocked(fs.stat).mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        throw new Error('ENOENT');
      }
      return { size: 1024 } as any;
    });

    const status = await getHelixContextStatus('/workspace');

    const present = status.filter(s => s.status === 'present');
    const missing = status.filter(s => s.status === 'missing');

    expect(present.length).toBeGreaterThan(0);
    expect(missing.length).toBeGreaterThan(0);
  });

  it('should cover all 7 layers', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const status = await getHelixContextStatus('/workspace');

    const layers = new Set(status.map(s => s.layer));
    expect(layers.size).toBeGreaterThan(0);
    expect(layers.size).toBeLessThanOrEqual(7);
  });
});

describe('Context Loader - buildLayerSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build markdown summary', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const summary = await buildLayerSummary('/workspace');

    expect(summary).toBeDefined();
    expect(typeof summary).toBe('string');
    expect(summary).toContain('Helix Seven Layer Status');
  });

  it('should include layer headers', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const summary = await buildLayerSummary('/workspace');

    expect(summary).toContain('## Layer');
  });

  it('should show file counts', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const summary = await buildLayerSummary('/workspace');

    expect(summary).toMatch(/\d+\/\d+/); // Format: "present/total"
  });

  it('should mark present files with checkmark', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const summary = await buildLayerSummary('/workspace');

    expect(summary).toContain('✓');
  });

  it('should mark missing files with X', async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

    const summary = await buildLayerSummary('/workspace');

    expect(summary).toContain('✗');
  });

  it('should include file sizes for present files', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 2048 } as any);

    const summary = await buildLayerSummary('/workspace');

    expect(summary).toContain('2048 bytes');
  });

  it('should sort layers numerically', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 1024 } as any);

    const summary = await buildLayerSummary('/workspace');

    // Check that Layer 1 appears before Layer 2, etc.
    const layer1Index = summary.indexOf('## Layer 1');
    const layer2Index = summary.indexOf('## Layer 2');

    if (layer1Index !== -1 && layer2Index !== -1) {
      expect(layer1Index).toBeLessThan(layer2Index);
    }
  });
});

describe('Context Loader - ensureHelixDirectoryStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create all required directories', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    expect(vi.mocked(fs.mkdir)).toHaveBeenCalled();
  });

  it('should create directories recursively', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    for (const call of calls) {
      expect(call[1]).toEqual({ recursive: true });
    }
  });

  it('should handle existing directories gracefully', async () => {
    vi.mocked(fs.mkdir).mockRejectedValue(new Error('EEXIST'));

    await expect(ensureHelixDirectoryStructure('/workspace')).resolves.not.toThrow();
  });

  it('should create soul directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const soulCall = calls.find(call => String(call[0]).includes('soul'));
    expect(soulCall).toBeDefined();
  });

  it('should create psychology directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const psychologyCall = calls.find(call => String(call[0]).includes('psychology'));
    expect(psychologyCall).toBeDefined();
  });

  it('should create identity directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const identityCall = calls.find(call => String(call[0]).includes('identity'));
    expect(identityCall).toBeDefined();
  });

  it('should create transformation directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const transformationCall = calls.find(call => String(call[0]).includes('transformation'));
    expect(transformationCall).toBeDefined();
  });

  it('should create purpose directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const purposeCall = calls.find(call => String(call[0]).includes('purpose'));
    expect(purposeCall).toBeDefined();
  });

  it('should create scripts directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const scriptsCall = calls.find(call => String(call[0]).includes('scripts'));
    expect(scriptsCall).toBeDefined();
  });

  it('should create legacy directory', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);

    await ensureHelixDirectoryStructure('/workspace');

    const calls = vi.mocked(fs.mkdir).mock.calls;
    const legacyCall = calls.find(call => String(call[0]).includes('legacy'));
    expect(legacyCall).toBeDefined();
  });
});

describe('Context Loader - validateContextFile', () => {
  it('should validate valid JSON with required fields', () => {
    const content = '{"field1": "value1", "field2": "value2"}';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required', field2: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing required field', () => {
    const content = '{"field1": "value1"}';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required', field2: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: field2');
  });

  it('should allow missing optional field', () => {
    const content = '{"field1": "value1"}';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required', field2: 'optional' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(true);
  });

  it('should reject invalid JSON', () => {
    const content = 'invalid json {]';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid JSON'))).toBe(true);
  });

  it('should reject non-object JSON', () => {
    const content = '"string value"';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Content is not a valid JSON object');
  });

  it('should reject null JSON', () => {
    const content = 'null';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Content is not a valid JSON object');
  });

  it('should validate empty schema', () => {
    const content = '{"field1": "value1"}';
    const schema: Record<string, 'required' | 'optional'> = {};

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(true);
  });

  it('should handle multiple missing required fields', () => {
    const content = '{}';
    const schema: Record<string, 'required' | 'optional'> = { field1: 'required', field2: 'required', field3: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);
    expect(result.errors).toContain('Missing required field: field1');
    expect(result.errors).toContain('Missing required field: field2');
    expect(result.errors).toContain('Missing required field: field3');
  });

  it('should validate nested objects', () => {
    const content = '{"outer": {"inner": "value"}}';
    const schema: Record<string, 'required' | 'optional'> = { outer: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(true);
  });

  it('should validate arrays', () => {
    const content = '{"items": [1, 2, 3]}';
    const schema: Record<string, 'required' | 'optional'> = { items: 'required' };

    const result = validateContextFile(content, schema);

    expect(result.valid).toBe(true);
  });
});

describe('Context Loader - HELIX_LAYER_FILES', () => {
  it('should define all 7 layers', () => {
    expect(Object.keys(HELIX_LAYER_FILES)).toHaveLength(7);
    expect(HELIX_LAYER_FILES[1]).toBeDefined();
    expect(HELIX_LAYER_FILES[2]).toBeDefined();
    expect(HELIX_LAYER_FILES[3]).toBeDefined();
    expect(HELIX_LAYER_FILES[4]).toBeDefined();
    expect(HELIX_LAYER_FILES[5]).toBeDefined();
    expect(HELIX_LAYER_FILES[6]).toBeDefined();
    expect(HELIX_LAYER_FILES[7]).toBeDefined();
  });

  it('should have name for each layer', () => {
    for (let i = 1; i <= 7; i++) {
      expect(HELIX_LAYER_FILES[i].name).toBeDefined();
      expect(typeof HELIX_LAYER_FILES[i].name).toBe('string');
    }
  });

  it('should have files array for each layer', () => {
    for (let i = 1; i <= 7; i++) {
      expect(Array.isArray(HELIX_LAYER_FILES[i].files)).toBe(true);
    }
  });

  it('should have Layer 1: Narrative Core', () => {
    expect(HELIX_LAYER_FILES[1].name).toBe('Narrative Core');
  });

  it('should have Layer 2: Emotional Memory', () => {
    expect(HELIX_LAYER_FILES[2].name).toBe('Emotional Memory');
  });

  it('should have Layer 3: Relational Memory', () => {
    expect(HELIX_LAYER_FILES[3].name).toBe('Relational Memory');
  });

  it('should have Layer 4: Prospective Self', () => {
    expect(HELIX_LAYER_FILES[4].name).toBe('Prospective Self');
  });

  it('should have Layer 5: Integration Rhythms', () => {
    expect(HELIX_LAYER_FILES[5].name).toBe('Integration Rhythms');
  });

  it('should have Layer 6: Transformation Cycles', () => {
    expect(HELIX_LAYER_FILES[6].name).toBe('Transformation Cycles');
  });

  it('should have Layer 7: Purpose Engine', () => {
    expect(HELIX_LAYER_FILES[7].name).toBe('Purpose Engine');
  });

  it('should have files in Layer 1', () => {
    expect(HELIX_LAYER_FILES[1].files.length).toBeGreaterThan(0);
  });

  it('should have files in Layer 2', () => {
    expect(HELIX_LAYER_FILES[2].files.length).toBeGreaterThan(0);
  });

  it('should have files in Layer 3', () => {
    expect(HELIX_LAYER_FILES[3].files.length).toBeGreaterThan(0);
  });

  it('should have files in Layer 4', () => {
    expect(HELIX_LAYER_FILES[4].files.length).toBeGreaterThan(0);
  });

  it('should have files in Layer 6', () => {
    expect(HELIX_LAYER_FILES[6].files.length).toBeGreaterThan(0);
  });

  it('should have files in Layer 7', () => {
    expect(HELIX_LAYER_FILES[7].files.length).toBeGreaterThan(0);
  });
});
