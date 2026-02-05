import axios from 'axios';
import { performance } from 'perf_hooks';

interface LatencyResult {
  operation: string;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
  avg: number;
}

async function measureRPCLatency(): Promise<LatencyResult[]> {
  const results: LatencyResult[] = [];

  // Test email operations
  const emailOps = ['email.list', 'email.get', 'email.send'];

  for (const op of emailOps) {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();

      try {
        // Make RPC call
        await axios.post('http://localhost:8080/rpc', {
          method: op,
          params: { limit: 50 }
        });
      } catch (err) {
        // Error still counts for latency
      }

      const duration = performance.now() - start;
      latencies.push(duration);
    }

    // Calculate percentiles
    latencies.sort((a, b) => a - b);

    results.push({
      operation: op,
      p50: latencies[50],
      p90: latencies[90],
      p95: latencies[95],
      p99: latencies[99],
      max: Math.max(...latencies),
      min: Math.min(...latencies),
      avg: latencies.reduce((a, b) => a + b) / latencies.length,
    });
  }

  return results;
}

// Run measurement
measureRPCLatency()
  .then(results => {
    console.table(results);

    // Compare against targets
    results.forEach(result => {
      const target =
        result.operation === 'email.send' ? 300 :
        result.operation === 'calendar.create' ? 250 :
        result.operation === 'task.create' ? 200 : 50;

      const status = result.p95 < target ? '✅' : '⚠️';
      console.log(`${status} ${result.operation}: P95=${result.p95.toFixed(1)}ms (target: ${target}ms)`);
    });
  })
  .catch(err => console.error('Measurement failed:', err));
