/**
 * Performance Profiling Suite for Helix
 * Measures memory, CPU, latency, and resource consumption
 */

import { performance } from 'perf_hooks';
import v8 from 'v8';
import { EventEmitter } from 'events';

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number; // Resident Set Size
  arrayBuffers: number;
  timestamp: number;
}

export interface LatencyMetrics {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export interface PerformanceProfile {
  timestamp: number;
  memory: MemoryMetrics;
  latencies: LatencyMetrics[];
  uptime: number;
}

/**
 * Memory profiler for tracking heap usage and leaks
 */
export class MemoryProfiler {
  private snapshots: MemoryMetrics[] = [];
  private heapSnapshotPath = '.helix-state/heap-snapshots';

  /**
   * Capture current memory metrics
   */
  captureMemory(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: heapStats.total_heap_size,
      timestamp: Date.now(),
    };
  }

  /**
   * Record memory snapshot
   */
  snapshot(): MemoryMetrics {
    const metrics = this.captureMemory();
    this.snapshots.push(metrics);
    return metrics;
  }

  /**
   * Get memory trend (increasing/stable/decreasing)
   */
  getMemoryTrend(): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
    if (this.snapshots.length < 2) return 'unknown';

    const recent = this.snapshots.slice(-10);
    const heapValues = recent.map(s => s.heapUsed);
    const avg1 = heapValues.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const avg2 = heapValues.slice(5).reduce((a, b) => a + b, 0) / 5;

    const delta = avg2 - avg1;
    const deltaPercent = (delta / avg1) * 100;

    if (deltaPercent > 5) return 'increasing';
    if (deltaPercent < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Get peak memory usage
   */
  getPeakMemory(): number {
    return Math.max(...this.snapshots.map(s => s.heapUsed), 0);
  }

  /**
   * Get average memory usage
   */
  getAverageMemory(): number {
    if (this.snapshots.length === 0) return 0;
    const total = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0);
    return total / this.snapshots.length;
  }

  /**
   * Generate heap snapshot for analysis
   * @param filename Path to save snapshot
   */
  generateHeapSnapshot(filename: string): void {
    const snapshot = v8.writeHeapSnapshot(filename);
    console.log(`[Profiling] Heap snapshot written to ${snapshot}`);
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): MemoryMetrics[] {
    return [...this.snapshots];
  }

  /**
   * Clear snapshots
   */
  clear(): void {
    this.snapshots = [];
  }
}

/**
 * Latency profiler for measuring operation timings
 */
export class LatencyProfiler extends EventEmitter {
  private measurements: Map<string, LatencyMetrics[]> = new Map();
  private activeTimers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  start(name: string): string {
    const id = `${name}-${Date.now()}-${Math.random()}`;
    this.activeTimers.set(id, performance.now());
    return id;
  }

  /**
   * End timing and record result
   */
  end(id: string, customName?: string): LatencyMetrics | null {
    const startTime = this.activeTimers.get(id);
    if (!startTime) return null;

    const endTime = performance.now();
    const duration = endTime - startTime;
    const name = customName || id.split('-')[0];

    const metrics: LatencyMetrics = {
      name,
      duration,
      startTime,
      endTime,
    };

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(metrics);

    this.activeTimers.delete(id);
    this.emit('latency', metrics);

    return metrics;
  }

  /**
   * Get statistics for an operation
   */
  getStats(name: string): {
    count: number;
    mean: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) return null;

    const durations = measurements.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const mean = durations.reduce((a, b) => a + b, 0) / count;
    const min = durations[0];
    const max = durations[count - 1];

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return durations[Math.max(0, index)] ?? 0;
    };

    return {
      count,
      mean,
      min,
      max,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  /**
   * Get all measurements
   */
  getAllStats(): Record<
    string,
    {
      count: number;
      mean: number;
      min: number;
      max: number;
      p50: number;
      p95: number;
      p99: number;
    }
  > {
    const result: Record<
      string,
      {
        count: number;
        mean: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
      }
    > = {};

    for (const name of this.measurements.keys()) {
      const stats = this.getStats(name);
      if (stats) {
        result[name] = stats;
      }
    }

    return result;
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.measurements.clear();
    this.activeTimers.clear();
  }
}

/**
 * CPU profiler using sampling
 */
export class CPUProfiler {
  private samples: number[] = [];
  private startTime: number = 0;

  /**
   * Start CPU profiling
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * Record CPU sample
   */
  sample(): void {
    if (this.startTime === 0) return;
    const elapsed = performance.now() - this.startTime;
    this.samples.push(elapsed);
  }

  /**
   * Get CPU metrics
   */
  getMetrics(): {
    sampleCount: number;
    avgInterval: number;
    cpuTime: number;
  } {
    return {
      sampleCount: this.samples.length,
      avgInterval:
        this.samples.length > 0 ? this.samples.reduce((a, b) => a + b, 0) / this.samples.length : 0,
      cpuTime: performance.now() - this.startTime,
    };
  }

  /**
   * Clear samples
   */
  clear(): void {
    this.samples = [];
    this.startTime = 0;
  }
}

/**
 * Comprehensive performance profiler
 */
export class PerformanceProfiler {
  private memory = new MemoryProfiler();
  private latency = new LatencyProfiler();
  private cpu = new CPUProfiler();
  private profiles: PerformanceProfile[] = [];
  private startTime = Date.now();

  /**
   * Get memory profiler
   */
  getMemoryProfiler(): MemoryProfiler {
    return this.memory;
  }

  /**
   * Get latency profiler
   */
  getLatencyProfiler(): LatencyProfiler {
    return this.latency;
  }

  /**
   * Get CPU profiler
   */
  getCPUProfiler(): CPUProfiler {
    return this.cpu;
  }

  /**
   * Record current profile snapshot
   */
  recordProfile(): PerformanceProfile {
    const stats = this.latency.getAllStats();
    const latencies: LatencyMetrics[] = Object.entries(stats).map(([name]) => ({
      name,
      duration: 0,
      startTime: 0,
      endTime: 0,
    }));

    const profile: PerformanceProfile = {
      timestamp: Date.now(),
      memory: this.memory.captureMemory(),
      latencies,
      uptime: Date.now() - this.startTime,
    };

    this.profiles.push(profile);
    return profile;
  }

  /**
   * Get summary of all profiling data
   */
  getSummary(): {
    memory: {
      peak: number;
      average: number;
      trend: string;
    };
    latency: Record<
      string,
      {
        count: number;
        mean: number;
        min: number;
        max: number;
        p95: number;
        p99: number;
      }
    >;
    cpu: {
      sampleCount: number;
      avgInterval: number;
      cpuTime: number;
    };
    uptime: number;
  } {
    return {
      memory: {
        peak: this.memory.getPeakMemory(),
        average: this.memory.getAverageMemory(),
        trend: this.memory.getMemoryTrend(),
      },
      latency: this.latency.getAllStats(),
      cpu: this.cpu.getMetrics(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Clear all profiling data
   */
  clear(): void {
    this.memory.clear();
    this.latency.clear();
    this.cpu.clear();
    this.profiles = [];
  }
}

// Global profiler instance
let globalProfiler: PerformanceProfiler | null = null;

/**
 * Get or create global profiler
 */
export function getGlobalProfiler(): PerformanceProfiler {
  if (globalProfiler === null) {
    globalProfiler = new PerformanceProfiler();
  }
  return globalProfiler;
}
