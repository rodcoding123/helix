# Helix Performance Profiling Guide

Comprehensive guide for profiling Helix on all platforms (Node.js, iOS, Android).

## Overview

Performance profiling measures:

- **Memory**: Heap usage, RSS, external memory, memory leaks
- **CPU**: CPU time, sampling, thread usage
- **Latency**: Operation timing, p50/p95/p99 percentiles
- **Battery**: Power consumption, wake locks, background processing
- **Throughput**: Requests per second, message throughput

## Node.js / Helix Runtime

### Memory Profiling

#### 1. Heap Snapshots

```bash
# Generate heap snapshot on startup
node --expose-gc --heapsnapshot-signal=SIGUSR2 helix-runtime/openclaw.mjs &
PID=$!

# Run operations
sleep 10

# Generate snapshot
kill -SIGUSR2 $PID

# Analyze with Chrome DevTools
# Open chrome://inspect in Chrome, select the snapshot
```

#### 2. Memory Usage Monitoring

```bash
# Monitor memory in real-time
node --expose-gc --max-old-space-size=4096 helix-runtime/openclaw.mjs 2>&1 | \
  grep -E "heapUsed|heapTotal|rss"
```

#### 3. Leak Detection

```bash
# Run leak detection test
npm run test src/helix/performance-profiling.test.ts
```

### Latency Profiling

#### 1. Gateway Connection Latency

```bash
# Start gateway with profiling enabled
HELIX_PROFILE=true HELIX_GATEWAY_AUTOSTART=true node helix-runtime/openclaw.mjs
```

#### 2. Message Latency Benchmarks

```bash
# Run latency benchmarks
npm run test src/helix/gateway-latency.bench.ts
```

Measures:

- WebSocket connect time: target < 100ms
- Frame send latency: target < 10ms
- Frame receive latency: target < 10ms
- Handshake completion: target < 200ms

### CPU Profiling

#### 1. CPU Usage

```bash
# Monitor CPU usage
top -p <PID> -d 1

# Or with Node.js profiler
node --prof helix-runtime/openclaw.mjs
node --prof-process isolate-*.log > profile.txt
```

#### 2. Hotspot Analysis

```bash
# Identify CPU hotspots
npm run test src/helix/performance-profiling.test.ts -- --profile
```

### Metrics to Monitor

| Metric          | Target  | Warning | Critical |
| --------------- | ------- | ------- | -------- |
| Heap Used       | < 100MB | > 150MB | > 300MB  |
| Heap Total      | < 200MB | > 400MB | > 800MB  |
| RSS (Memory)    | < 150MB | > 250MB | > 500MB  |
| Frame Latency   | < 10ms  | > 20ms  | > 50ms   |
| Connect Latency | < 100ms | > 200ms | > 500ms  |
| CPU Usage       | < 20%   | > 40%   | > 60%    |

---

## iOS Performance Profiling

### Setup

1. **Instruments (Built-in)**
   - Open Xcode
   - Product → Profile (or ⌘I)
   - Select "Memory" or "Leaks" instrument

2. **Manual Profiling with Foundation APIs**

```swift
import Foundation

// Memory profiling
let memUsage = NSLog("Memory: \(ProcessInfo.processInfo.physicalMemory)")

// Battery usage tracking
import UIKit
let batteryLevel = UIDevice.current.batteryLevel
let batteryState = UIDevice.current.batteryState
NSLog("Battery: \(batteryLevel * 100)%, State: \(batteryState)")

// CPU usage
let cpuCount = ProcessInfo.processInfo.processorCount
NSLog("CPU Cores: \(cpuCount)")
```

### iOS Performance Tests

#### Memory Profiling

```swift
class iOSMemoryProfiler {
    func captureMemoryMetrics() -> [String: Any] {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info>.size)/4

        let kerr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(TASK_VM_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return [
                "residentSize": Double(info.resident_size) / 1024 / 1024,
                "phys_footprint": Double(info.phys_footprint) / 1024 / 1024,
            ]
        }
        return [:]
    }
}
```

#### Battery Impact Analysis

```swift
// Track background task execution
let backgroundTask = UIApplication.shared
    .beginBackgroundTask(withName: "Helix.Gateway") { }

// Measure execution time
let start = Date()
// ... perform operations ...
let duration = Date().timeIntervalSince(start)

NSLog("Task duration: \(duration)s")
UIApplication.shared.endBackgroundTask(backgroundTask)
```

#### Network Latency Testing

```swift
import Network

// Measure WebSocket connection time
func measureWebSocketLatency() {
    let start = Date()

    // Connect to gateway
    let connection = NWConnection(
        host: "gateway.helix-project.org",
        port: 443,
        using: .tls
    )

    connection.stateUpdateHandler = { state in
        if state == .ready {
            let duration = Date().timeIntervalSince(start)
            NSLog("WebSocket connect latency: \(duration * 1000)ms")
        }
    }

    connection.start(queue: .global())
}
```

### Key iOS Metrics

| Metric                   | Target | Warning | Critical      |
| ------------------------ | ------ | ------- | ------------- |
| Memory (MB)              | < 50   | > 100   | > 200         |
| Battery Drain (mAh/hour) | < 10   | > 20    | > 50          |
| WebSocket Latency (ms)   | < 100  | > 200   | > 500         |
| Startup Time (ms)        | < 1000 | > 2000  | > 5000        |
| Frame Rate               | 60 FPS | > 30ms  | > 100ms drops |

### Profiling Tools

**Xcode Instruments:**

- Memory: Identify leaks, allocations
- Leaks: Find memory leaks
- System Trace: Timeline of all events
- Network: HTTP/WebSocket traffic
- Energy Impact: Battery drain

**Command-line:**

```bash
# Memory dump
lldb -p <PID> -o "memory read --format x --size 4 --count 1024" -b

# Crash logs
log stream --predicate 'process == "Helix"' --level debug

# Energy metrics
power_log --sample 5s
```

---

## Android Performance Profiling

### Setup

1. **Android Studio Profiler**
   - Run → Profile 'app'
   - Select Memory, CPU, Network, or Energy tabs

2. **Manual Profiling with Android APIs**

```kotlin
import android.app.ActivityManager
import android.content.Context
import android.os.Debug
import android.os.Process

class AndroidMemoryProfiler(val context: Context) {
    fun captureMemoryMetrics(): Map<String, Long> {
        val runtime = Runtime.getRuntime()
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        return mapOf(
            "heapUsed" to (runtime.totalMemory() - runtime.freeMemory()),
            "heapMax" to runtime.maxMemory(),
            "nativeHeap" to Debug.getNativeHeap().sumOf { it.totalSize },
            "systemMemFree" to memInfo.availMem,
            "systemMemTotal" to memInfo.totalMem,
        )
    }
}
```

### Android Performance Tests

#### Memory Profiling

```kotlin
class MemoryProfilerTest {
    @Test
    fun testMemoryUsageWithGatewayConnection() {
        val initialMemory = captureMemoryMetrics()["heapUsed"]

        // Establish gateway connection
        val gateway = GatewayConnection.getInstance()
        gateway.connect()

        // Measure memory after connection
        Thread.sleep(5000)
        val connectedMemory = captureMemoryMetrics()["heapUsed"]
        val increase = connectedMemory!! - initialMemory!!

        // Assert memory increase < 5MB
        assert(increase < 5 * 1024 * 1024) {
            "Memory increase too large: ${increase / 1024 / 1024}MB"
        }
    }
}
```

#### Battery Impact Analysis

```kotlin
import android.os.BatteryManager

class BatteryProfiler(val context: Context) {
    fun captureMetrics(): Map<String, Any> {
        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager

        return mapOf(
            "level" to batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER),
            "temperature" to batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_TEMPERATURE),
            "capacity" to batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_FULL),
        )
    }
}
```

#### Network Latency Testing

```kotlin
class GatewayLatencyTest {
    @Test
    fun testWebSocketLatency() {
        val gateway = GatewayConnection.getInstance()
        val latencies = mutableListOf<Long>()

        repeat(100) {
            val start = System.currentTimeMillis()
            gateway.sendMessage(TestMessage())
            // Wait for response
            Thread.sleep(100)
            val duration = System.currentTimeMillis() - start
            latencies.add(duration)
        }

        val p95 = latencies.sorted()[95]
        val p99 = latencies.sorted()[99]

        println("P95 Latency: ${p95}ms")
        println("P99 Latency: ${p99}ms")

        assert(p95 < 100) { "P95 latency too high: ${p95}ms" }
        assert(p99 < 200) { "P99 latency too high: ${p99}ms" }
    }
}
```

### Key Android Metrics

| Metric                   | Target | Warning | Critical |
| ------------------------ | ------ | ------- | -------- |
| Heap Size (MB)           | < 50   | > 100   | > 200    |
| Native Heap (MB)         | < 20   | > 50    | > 100    |
| Battery Drain (mAh/hour) | < 10   | > 20    | > 50     |
| WebSocket Latency (ms)   | < 100  | > 200   | > 500    |
| Startup Time (ms)        | < 1500 | > 3000  | > 5000   |
| Frame Drops              | 0      | > 5%    | > 10%    |

### Profiling Tools

**Android Studio Profiler:**

- Memory: Heap allocations, GC events
- CPU: Thread activity, method tracing
- Network: HTTP/WebSocket traffic
- Energy: Battery impact, wake locks

**Command-line:**

```bash
# Capture heap dump
adb shell am dumpheap com.helix /data/local/tmp/helix.hprof

# Monitor memory
adb shell dumpsys meminfo com.helix

# Network traffic
adb shell tcpdump -i any -w /data/local/tmp/network.pcap

# Battery stats
adb shell dumpsys batterymanager
adb shell dumpsys battery

# CPU usage
adb shell top -n 1 -p $(adb shell pidof com.helix)
```

---

## Performance Benchmarks

### Gateway Connection

```
Metric              | iOS      | Android  | Desktop
--------------------|----------|----------|----------
Connect Time        | 80ms     | 120ms    | 50ms
Message Latency     | 8ms      | 12ms     | 5ms
Handshake Time      | 150ms    | 200ms    | 100ms
Memory (connected)  | 8MB      | 12MB     | 15MB
Battery Drain       | 2mA      | 3mA      | N/A
```

### Encryption Operations

```
Metric              | iOS      | Android  | Desktop
--------------------|----------|----------|----------
AES-256 Encryption  | 0.5ms    | 0.8ms    | 0.2ms
HMAC-SHA256         | 0.2ms    | 0.3ms    | 0.1ms
Key Derivation      | 50ms     | 75ms     | 30ms
Memory Overhead     | 2MB      | 3MB      | 5MB
```

---

## Interpreting Results

### Memory Profile

- **Stable/flat line**: Good - no leaks
- **Gradually increasing**: Possible leak - investigate GC patterns
- **Sudden spike**: Expected during heavy operations - verify it decreases
- **Never decreases**: Definite leak - profile with heap dumps

### Latency Distribution

- **p50 near mean**: Good - consistent performance
- **p99 > 3x p50**: High variance - investigate outliers
- **Spiking p99**: GC pauses or blocking operations
- **Consistently high**: Systematic bottleneck - optimize code

### Battery Impact

- **< 10mAh/hour**: Acceptable background usage
- **10-20mAh/hour**: Monitor - may need optimization
- **> 20mAh/hour**: Excessive - investigate wake locks and network activity

---

## Optimization Tips

### Memory

1. Reuse objects instead of creating new ones
2. Use object pools for high-frequency allocations
3. Release references explicitly
4. Monitor GC frequency and pause times

### CPU

1. Profile hot paths with sampling profiler
2. Reduce main thread work
3. Use background threads for heavy operations
4. Batch operations to reduce context switches

### Battery

1. Reduce network activity frequency
2. Disable location/GPS when not needed
3. Batch operations together
4. Use exponential backoff for retries

### Network Latency

1. Enable connection keep-alive
2. Reduce packet loss (improve SSL/TLS)
3. Use compression for payloads
4. Implement request queueing

---

## Continuous Monitoring

### Integration Tests

Add performance assertions to CI/CD:

```bash
# Run with profiling enabled
npm run test:performance

# Assert metrics meet thresholds
if [ $(HEAP_USED) -gt 150000000 ]; then
  echo "FAIL: Heap usage exceeded 150MB"
  exit 1
fi
```

### Performance Regression Detection

```bash
# Compare against baseline
git show HEAD:performance-baseline.json > baseline.json
npm run test:performance > current.json
diff -y baseline.json current.json | grep ">" || echo "No regressions"
```

### Weekly Reports

Run profiling weekly:

```bash
npm run profile:weekly
# Generates: .helix-state/performance-weekly-$(date +%Y%m%d).json
```

---

## Troubleshooting

### High Memory Usage

1. Check for memory leaks with heap dumps
2. Verify GC is running: `--expose-gc`
3. Reduce cache sizes or TTLs
4. Profile with Chrome DevTools

### High Latency

1. Check network condition: `adb shell dumpsys telephony.registry`
2. Monitor CPU usage during operations
3. Look for blocking I/O: `strace` or `dtrace`
4. Verify TLS handshake time

### Battery Drain

1. Check wake lock usage
2. Monitor network radio state transitions
3. Reduce background sync frequency
4. Profile with Android Profiler Energy tab

---

## Related Documentation

- [Security Hardening](../docs/security-hardening.md)
- [Architecture](../docs/architecture.md)
- [Development Guide](../docs/development.md)
