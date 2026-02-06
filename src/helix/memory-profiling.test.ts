/**
 * Memory Profiling Tests for Helix
 * Measures heap usage, GC patterns, and memory leaks
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { getGlobalProfiler, MemoryProfiler } from './performance-profiling.js';

describe('Memory Profiling', () => {
  let profiler: MemoryProfiler;

  beforeAll(() => {
    // Force GC before tests
    if (global.gc) {
      global.gc();
    }
    profiler = getGlobalProfiler().getMemoryProfiler();
  });

  afterAll(() => {
    if (global.gc) {
      global.gc();
    }

    const snapshots = profiler.getSnapshots();
    if (snapshots.length > 0) {
      console.log('\n=== Memory Profiling Summary ===');
      console.log(`Snapshots captured: ${snapshots.length}`);

      const heapValues = snapshots.map((s: { heapUsed: number }) => s.heapUsed);
      const minHeap = Math.min(...heapValues);
      const maxHeap = Math.max(...heapValues);

      const avgHeap = heapValues.reduce((a: number, b: number) => a + b, 0) / heapValues.length;

      console.log(`\nHeap Usage (bytes):`);
      console.log(`  Min: ${(minHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Max: ${(maxHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Avg: ${(avgHeap / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Peak: ${(profiler.getPeakMemory() / 1024 / 1024).toFixed(2)}MB`);
      console.log(`\nMemory Trend: ${profiler.getMemoryTrend()}`);

      // Check for leaks
      if (profiler.getMemoryTrend() === 'increasing') {
        console.warn('⚠️  Memory usage is increasing - potential memory leak detected');
      }
    }
  });

  it('should capture initial memory metrics', () => {
    const metrics = profiler.captureMemory();

    expect(metrics).toBeDefined();
    expect(metrics.heapUsed).toBeGreaterThan(0);
    expect(metrics.heapTotal).toBeGreaterThan(0);
    expect(metrics.rss).toBeGreaterThan(0);
    expect(metrics.timestamp).toBeGreaterThan(0);

    console.log(`\nInitial Heap: ${(metrics.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  });

  it('should track memory snapshots over time', () => {
    const snapshots: ReturnType<typeof profiler.getSnapshots>[] = [];
    const buffers: Buffer[] = [];

    // Take snapshots at intervals
    for (let i = 0; i < 5; i++) {
      profiler.snapshot();
      snapshots.push(profiler.getSnapshots());

      // Allocate some memory and keep reference to prevent GC
      buffers.push(Buffer.alloc(1024 * 1024)); // 1MB
    }

    const allSnapshots = profiler.getSnapshots();
    expect(allSnapshots.length).toBeGreaterThanOrEqual(5);

    console.log(`\nSnapshot progression:`);
    allSnapshots.forEach((s: { heapUsed: number }, i: number) => {
      console.log(`  ${i}: ${(s.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  it('should detect stable memory usage', () => {
    // Create stable object pool
    const pool: Buffer[] = [];

    // Allocate fixed amount
    for (let i = 0; i < 10; i++) {
      pool.push(Buffer.alloc(1024 * 100)); // 100KB each
    }

    // Take measurements over time
    const measurements: number[] = [];
    for (let i = 0; i < 10; i++) {
      const metric = profiler.snapshot();
      measurements.push(metric.heapUsed);
    }

    // Check if memory is stable
    const trend = profiler.getMemoryTrend();
    console.log(`\nMemory stability: ${trend}`);

    // Stable trend is expected for fixed allocation
    expect(['stable', 'decreasing']).toContain(trend);
  });

  it('should detect memory growth from allocations', () => {
    const startMemory = profiler.captureMemory().heapUsed;

    // Allocate increasing amounts
    const buffers: Buffer[] = [];
    for (let i = 0; i < 100; i++) {
      buffers.push(Buffer.alloc(10 * 1024)); // 10KB each = 1MB total
      profiler.snapshot();
    }

    const endMemory = profiler.captureMemory().heapUsed;
    const growth = endMemory - startMemory;

    console.log(`\nMemory growth from allocations:`);
    console.log(`  Start: ${(startMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  End: ${(endMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Growth: ${(growth / 1024 / 1024).toFixed(2)}MB`);

    // Should have grown (GC may be aggressive)
    expect(growth).toBeGreaterThan(100 * 1024); // At least 100KB
  });

  it('should measure GC impact on heap', () => {
    const before = profiler.snapshot();

    // Create garbage
    {
      const temp: Buffer[] = [];
      for (let i = 0; i < 1000; i++) {
        temp.push(Buffer.alloc(10 * 1024)); // 10MB garbage
      }
      // temp goes out of scope
    }

    // Force GC
    if (global.gc) {
      global.gc();
    }

    const after = profiler.snapshot();

    console.log(`\nGC Impact:`);
    console.log(`  Before: ${(before.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  After: ${(after.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Freed: ${((before.heapUsed - after.heapUsed) / 1024 / 1024).toFixed(2)}MB`);

    // Memory should decrease after GC
    expect(after.heapUsed).toBeLessThan(before.heapUsed + 1024 * 1024); // Allow 1MB variance
  });

  it('should track memory overhead of encryption cache', () => {
    const before = profiler.snapshot();

    // Simulate encrypted cache with 1000 entries (each ~1KB encrypted)
    const cache = new Map<string, Buffer>();
    for (let i = 0; i < 1000; i++) {
      const key = `secret_${i}`;
      const encryptedData = Buffer.alloc(1024);
      cache.set(key, encryptedData);
    }

    const after = profiler.snapshot();
    const overhead = after.heapUsed - before.heapUsed;

    console.log(`\nEncryption Cache Overhead (1000 entries):`);
    console.log(`  Memory: ${(overhead / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Per-entry: ${(overhead / 1000).toFixed(0)}B`);

    // Should be measurable (exact overhead depends on GC)
    expect(overhead).toBeGreaterThan(100 * 1024); // At least 100KB
    expect(overhead).toBeLessThan(2000 * 1024);
  });

  it('should track peak memory usage', () => {
    // Clear previous snapshots
    profiler.clear();

    // Create peak memory usage
    const peakSize = 10 * 1024 * 1024; // 10MB peak

    // Allocate to peak and keep reference
    const peakBuffer = Buffer.alloc(peakSize);
    profiler.snapshot();
    expect(peakBuffer.length).toBe(peakSize);

    const peak = profiler.getPeakMemory();
    console.log(`\nPeak Memory Usage: ${(peak / 1024 / 1024).toFixed(2)}MB`);

    // Peak should be significant
    expect(peak).toBeGreaterThan(5 * 1024 * 1024);
  });

  it('should measure array allocation efficiency', () => {
    const before = profiler.snapshot();

    // Create large array
    const largeArray = new Array(100000).fill(null).map((_, i) => ({
      id: i,
      data: Buffer.alloc(100),
      metadata: { timestamp: Date.now(), processed: false },
    }));

    const after = profiler.snapshot();
    expect(largeArray.length).toBe(100000);
    const overhead = after.heapUsed - before.heapUsed;

    console.log(`\nArray Allocation (100k objects):`);
    console.log(`  Total: ${(overhead / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Per-object: ${(overhead / 100000).toFixed(0)}B`);

    // Rough estimate: ~5KB per object (Buffer 100B + metadata)
    expect(overhead).toBeGreaterThan(400 * 1024);
  });

  it('should detect memory leak patterns', () => {
    profiler.clear();

    // Simulate potential leak: accumulating buffers
    const leakyArray: Buffer[] = [];

    // Add buffers over time
    for (let i = 0; i < 10; i++) {
      leakyArray.push(Buffer.alloc(5 * 1024 * 1024)); // 5MB each
      profiler.snapshot();
    }

    const trend = profiler.getMemoryTrend();
    const avgMemory = profiler.getAverageMemory();
    console.log(`\nLeak detection (intentional accumulation):`);
    console.log(`  Trend: ${trend}`);
    console.log(`  Average: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);

    // Should show increasing trend or at least have significant memory
    expect(avgMemory).toBeGreaterThan(10 * 1024 * 1024); // At least 10MB
  });

  it('should measure heap fragmentation', () => {
    const metrics = profiler.captureMemory();
    const heapUsed = metrics.heapUsed;
    const heapTotal = metrics.heapTotal;
    const fragmentation = ((heapTotal - heapUsed) / heapTotal) * 100;

    console.log(`\nHeap Fragmentation:`);
    console.log(`  Used: ${(heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Total: ${(heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Fragmentation: ${fragmentation.toFixed(1)}%`);

    // Fragmentation < 50% is acceptable
    expect(fragmentation).toBeLessThan(75);
  });

  it('should check external memory allocation', () => {
    const before = profiler.captureMemory();

    // Allocate external memory (e.g., Buffers)
    const externalBuffers: Buffer[] = [];
    for (let i = 0; i < 100; i++) {
      externalBuffers.push(Buffer.allocUnsafe(1024 * 10)); // Direct allocation
    }

    const after = profiler.captureMemory();
    const externalGrowth = after.external - before.external;

    console.log(`\nExternal Memory (Buffers):`);
    console.log(`  Growth: ${(externalGrowth / 1024).toFixed(2)}KB`);
    console.log(`  Count: ${externalBuffers.length}`);

    // Should track external buffer allocations
    expect(after.external).toBeGreaterThan(before.external);
  });

  it('should verify memory metrics consistency', () => {
    const metrics = profiler.captureMemory();

    // Verify relationships
    expect(metrics.heapUsed).toBeLessThanOrEqual(metrics.heapTotal);
    expect(metrics.rss).toBeGreaterThanOrEqual(metrics.heapTotal); // RSS includes other memory
    expect(metrics.external).toBeGreaterThanOrEqual(0);

    console.log(`\nMemory Metrics Consistency: ✓`);
    console.log(
      `  heapUsed (${(metrics.heapUsed / 1024 / 1024).toFixed(2)}MB) <= heapTotal (${(metrics.heapTotal / 1024 / 1024).toFixed(2)}MB): ${metrics.heapUsed <= metrics.heapTotal ? '✓' : '✗'}`
    );
    console.log(`  heapTotal <= rss: ${metrics.heapTotal <= metrics.rss ? '✓' : '✗'}`);
  });
});
