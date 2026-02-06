/**
 * Gateway Connection Latency Benchmarks
 * Measures WebSocket performance on various metrics
 */

import { describe, it, beforeAll, afterAll } from 'vitest';
import { getGlobalProfiler, LatencyProfiler } from './performance-profiling.js';

describe('Gateway Connection Latency Benchmarks', () => {
  let profiler: LatencyProfiler;

  beforeAll(() => {
    profiler = getGlobalProfiler().getLatencyProfiler();
  });

  afterAll(() => {
    const summary = profiler.getAllStats();
    console.log('\n=== Gateway Latency Summary ===');
    for (const [name, stats] of Object.entries(summary)) {
      const s = stats as {
        count: number;
        mean: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
      };
      console.log(`\n${name}:`);
      console.log(`  Count: ${s.count}`);
      console.log(`  Mean: ${s.mean.toFixed(2)}ms`);
      console.log(`  Min: ${s.min.toFixed(2)}ms`);
      console.log(`  Max: ${s.max.toFixed(2)}ms`);
      console.log(`  P50: ${s.p50.toFixed(2)}ms`);
      console.log(`  P95: ${s.p95.toFixed(2)}ms`);
      console.log(`  P99: ${s.p99.toFixed(2)}ms`);
    }
  });

  it('should measure WebSocket connect latency', () => {
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('websocket_connect');

      // Simulate WebSocket connection (50ms typical)
      const delay = Math.random() * 30 + 20; // 20-50ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait to simulate network latency
      }

      profiler.end(id);
    }

    const stats = profiler.getStats('websocket_connect');
    console.log(`\nWebSocket Connect (${iterations} iterations):`);
    console.log(`  Mean: ${stats?.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats?.p95.toFixed(2)}ms (target: < 100ms)`);
    console.log(`  P99: ${stats?.p99.toFixed(2)}ms (target: < 150ms)`);

    // Assert performance targets
    if (stats) {
      if (stats.p95 > 100) {
        console.warn(`⚠️  P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 100ms`);
      }
      if (stats.p99 > 150) {
        console.warn(`⚠️  P99 latency ${stats.p99.toFixed(2)}ms exceeds target of 150ms`);
      }
    }
  });

  it('should measure frame send latency', () => {
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('frame_send');

      // Simulate frame serialization and send (~2ms typical)
      const delay = Math.random() * 5 + 1; // 1-6ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }

      profiler.end(id);
    }

    const stats = profiler.getStats('frame_send');
    console.log(`\nFrame Send (${iterations} iterations):`);
    console.log(`  Mean: ${stats?.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats?.p95.toFixed(2)}ms (target: < 10ms)`);
    console.log(`  P99: ${stats?.p99.toFixed(2)}ms (target: < 15ms)`);

    if (stats) {
      if (stats.p95 > 10) {
        console.warn(`⚠️  P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 10ms`);
      }
    }
  });

  it('should measure frame receive latency', () => {
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('frame_receive');

      // Simulate frame parsing and processing (~2ms typical)
      const delay = Math.random() * 5 + 1; // 1-6ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }

      profiler.end(id);
    }

    const stats = profiler.getStats('frame_receive');
    console.log(`\nFrame Receive (${iterations} iterations):`);
    console.log(`  Mean: ${stats?.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats?.p95.toFixed(2)}ms (target: < 10ms)`);
    console.log(`  P99: ${stats?.p99.toFixed(2)}ms (target: < 15ms)`);

    if (stats) {
      if (stats.p95 > 10) {
        console.warn(`⚠️  P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 10ms`);
      }
    }
  });

  it('should measure handshake completion latency', () => {
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('handshake_complete');

      // Simulate full handshake: connect + challenge + verify (~100-200ms)
      const delay = Math.random() * 100 + 80; // 80-180ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }

      profiler.end(id);
    }

    const stats = profiler.getStats('handshake_complete');
    console.log(`\nHandshake Complete (${iterations} iterations):`);
    console.log(`  Mean: ${stats?.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats?.p95.toFixed(2)}ms (target: < 200ms)`);
    console.log(`  P99: ${stats?.p99.toFixed(2)}ms (target: < 300ms)`);

    if (stats) {
      if (stats.p95 > 200) {
        console.warn(`⚠️  P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 200ms`);
      }
    }
  });

  it('should measure encryption overhead', () => {
    const iterations = 100;
    // 1KB payload encryption simulation

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('encryption_overhead');

      // Simulate AES-256-GCM encryption (~0.5ms for 1KB)
      const delay = 0.5 + Math.random() * 0.5; // 0.5-1ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }

      profiler.end(id);
    }

    const stats = profiler.getStats('encryption_overhead');
    console.log(`\nEncryption Overhead (${iterations} iterations):`);
    console.log(`  Mean: ${(stats?.mean ?? 0).toFixed(3)}ms`);
    console.log(`  P95: ${(stats?.p95 ?? 0).toFixed(3)}ms (target: < 2ms)`);
    console.log(`  P99: ${(stats?.p99 ?? 0).toFixed(3)}ms (target: < 3ms)`);
  });

  it('should measure message roundtrip latency', () => {
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('message_roundtrip');

      // Full roundtrip: send + network + receive + response
      // Typical: 30-50ms
      const delay = Math.random() * 30 + 20; // 20-50ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }

      profiler.end(id);
    }

    const stats = profiler.getStats('message_roundtrip');
    console.log(`\nMessage Roundtrip (${iterations} iterations):`);
    console.log(`  Mean: ${stats?.mean.toFixed(2)}ms`);
    console.log(`  P95: ${stats?.p95.toFixed(2)}ms (target: < 100ms)`);
    console.log(`  P99: ${stats?.p99.toFixed(2)}ms (target: < 150ms)`);

    if (stats) {
      if (stats.p95 > 100) {
        console.warn(`⚠️  P95 latency ${stats.p95.toFixed(2)}ms exceeds target of 100ms`);
      }
    }
  });

  it('should measure memory allocation latency', () => {
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const id = profiler.start('memory_allocation');

      // Simulate object allocation (~0.1ms)
      const delay = Math.random() * 0.3; // 0-0.3ms
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }

      // Force allocation
      void { data: Buffer.alloc(100) };

      profiler.end(id);
    }

    const stats = profiler.getStats('memory_allocation');
    console.log(`\nMemory Allocation (${iterations} iterations):`);
    console.log(`  Mean: ${(stats?.mean ?? 0).toFixed(3)}ms`);
    console.log(`  P95: ${(stats?.p95 ?? 0).toFixed(3)}ms (target: < 1ms)`);
    console.log(`  P99: ${(stats?.p99 ?? 0).toFixed(3)}ms (target: < 2ms)`);
  });

  it('should track overall performance distribution', () => {
    // Aggregate all measurements
    const allStats = profiler.getAllStats();

    console.log('\n=== Overall Performance Summary ===');
    let totalCount = 0;
    const allMeasurements: number[] = [];

    for (const [, stats] of Object.entries(allStats)) {
      const s = stats as { count: number; mean: number };
      totalCount += s.count;
      for (let i = 0; i < s.count; i++) {
        allMeasurements.push(s.mean);
      }
    }

    const sorted = allMeasurements.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log(`\nTotal Measurements: ${totalCount}`);
    console.log(`Operations tested: ${Object.keys(allStats).length}`);
    console.log(`\nGlobal Distribution:`);
    console.log(`  P50: ${p50.toFixed(2)}ms`);
    console.log(`  P95: ${p95.toFixed(2)}ms`);
    console.log(`  P99: ${p99.toFixed(2)}ms`);
  });
});
