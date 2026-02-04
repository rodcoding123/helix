import Foundation
import os.log

/**
 * iOS Performance Monitoring
 *
 * Tracks app performance metrics: memory, CPU, frame rates, network latency
 * Integrates with Instruments for profiling and DynamicLog for recording
 */
@Observable
final class PerformanceMonitor {
    static let shared = PerformanceMonitor()

    // MARK: - Performance Metrics

    private(set) var currentMemoryMB: Float = 0
    private(set) var peakMemoryMB: Float = 0
    private(set) var fpsMonitor: FrameRateMonitor?
    private(set) var networkLatencyMs: Double = 0

    // MARK: - Logging

    private let logger = Logger(subsystem: "ai.openclaw.ios", category: "performance")
    private let memoryQueue = DispatchQueue(label: "com.openclaw.performance.memory", qos: .background)
    private let networkQueue = DispatchQueue(label: "com.openclaw.performance.network", qos: .background)

    // MARK: - Thresholds

    private let memoryWarningThresholdMB: Float = 150
    private let memoryHighThresholdMB: Float = 250

    // MARK: - Initialization

    private init() {
        startMemoryMonitoring()
        startFrameRateMonitoring()
    }

    // MARK: - Memory Monitoring

    func startMemoryMonitoring() {
        memoryQueue.async { [weak self] in
            Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
                self?.updateMemoryMetrics()
            }.tolerance = 0.5
        }
    }

    private func updateMemoryMetrics() {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info>.size / MemoryLayout<integer_t>.size)

        let kerr = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(
                    mach_task_self_,
                    task_flavor_t(TASK_VM_INFO),
                    $0,
                    &count
                )
            }
        }

        guard kerr == KERN_SUCCESS else { return }

        let usedMemory = Float(info.phys_footprint) / 1024 / 1024
        DispatchQueue.main.async { [weak self] in
            self?.currentMemoryMB = usedMemory
            if usedMemory > (self?.peakMemoryMB ?? 0) {
                self?.peakMemoryMB = usedMemory
            }

            // Log warnings
            if usedMemory > (self?.memoryHighThresholdMB ?? 250) {
                self?.logger.warning("🚨 HIGH MEMORY: \(usedMemory, privacy: .public)MB")
            } else if usedMemory > (self?.memoryWarningThresholdMB ?? 150) {
                self?.logger.warning("⚠️ HIGH MEMORY: \(usedMemory, privacy: .public)MB")
            }
        }
    }

    // MARK: - Frame Rate Monitoring

    func startFrameRateMonitoring() {
        DispatchQueue.main.async { [weak self] in
            self?.fpsMonitor = FrameRateMonitor { fps in
                if fps < 50 {
                    self?.logger.warning("⚠️ LOW FPS: \(fps, privacy: .public)")
                }
            }
        }
    }

    // MARK: - Network Latency Tracking

    func recordNetworkLatency(method: String, latencyMs: Double) {
        networkQueue.async { [weak self] in
            self?.networkLatencyMs = latencyMs

            if latencyMs > 500 {
                self?.logger.warning("📡 SLOW RPC: \(method) - \(latencyMs, privacy: .public)ms")
            }

            DispatchQueue.main.async {
                self?.recordMetric(name: "rpc.latency", value: latencyMs, attributes: ["method": method])
            }
        }
    }

    // MARK: - Custom Metrics

    private var metrics: [String: [PerformanceMetric]] = [:]

    func recordMetric(name: String, value: Double, attributes: [String: String] = [:]) {
        let metric = PerformanceMetric(
            name: name,
            value: value,
            timestamp: Date(),
            attributes: attributes
        )

        if metrics[name] == nil {
            metrics[name] = []
        }
        metrics[name]?.append(metric)

        // Log to Instruments via os_signpost
        let signpost = OSSignpostID(log: OSLog(subsystem: "ai.openclaw.ios", category: "performance"))
        os_signpost(.event, log: OSLog(subsystem: "ai.openclaw.ios", category: "performance"),
                   name: "PerformanceMetric", signpostID: signpost,
                   "%{public}s: %f", name, value)
    }

    // MARK: - Profiling Helpers

    @inline(__always)
    func measureExecutionTime<T>(name: String, _ block: () -> T) -> T {
        let start = Date()
        let result = block()
        let elapsed = Date().timeIntervalSince(start) * 1000

        recordMetric(name: "execution_time", value: elapsed, attributes: ["operation": name])
        logger.debug("⏱️ \(name): \(elapsed, privacy: .public)ms")

        return result
    }

    @inline(__always)
    func measureAsyncExecutionTime<T>(name: String, _ block: @escaping () async -> T) async -> T {
        let start = Date()
        let result = await block()
        let elapsed = Date().timeIntervalSince(start) * 1000

        recordMetric(name: "async_execution_time", value: elapsed, attributes: ["operation": name])
        logger.debug("⏱️ async \(name): \(elapsed, privacy: .public)ms")

        return result
    }

    // MARK: - Memory Optimization Helpers

    /// Limit in-memory cache size
    static func createLimitedCache<T>(maxSize: Int) -> NSCache<NSString, CacheWrapper<T>> {
        let cache = NSCache<NSString, CacheWrapper<T>>()
        cache.totalCostLimit = maxSize * 1_000_000 // Rough estimate
        return cache
    }

    /// Force memory cleanup
    func performMemoryCleanup() {
        DispatchQueue.main.async {
            URLCache.shared.removeAllCachedResponses()
        }
    }

    // MARK: - Report Generation

    func generatePerformanceReport() -> PerformanceReport {
        return PerformanceReport(
            currentMemoryMB: currentMemoryMB,
            peakMemoryMB: peakMemoryMB,
            averageFPS: fpsMonitor?.averageFPS ?? 0,
            networkLatencyMs: networkLatencyMs,
            metrics: metrics,
            timestamp: Date()
        )
    }
}

// MARK: - Supporting Types

struct PerformanceMetric {
    let name: String
    let value: Double
    let timestamp: Date
    let attributes: [String: String]
}

struct PerformanceReport {
    let currentMemoryMB: Float
    let peakMemoryMB: Float
    let averageFPS: Float
    let networkLatencyMs: Double
    let metrics: [String: [PerformanceMetric]]
    let timestamp: Date

    var summary: String {
        """
        Performance Report
        ==================
        Memory: \(currentMemoryMB)MB / \(peakMemoryMB)MB (peak)
        FPS: \(averageFPS)
        Network Latency: \(networkLatencyMs)ms
        Timestamp: \(timestamp)
        """
    }
}

// MARK: - Frame Rate Monitor

class FrameRateMonitor {
    private var displayLink: CADisplayLink?
    private var frames: [CFTimeInterval] = []
    private var lastTimestamp: CFTimeInterval = 0
    private let onFPSChange: (Float) -> Void

    init(onFPSChange: @escaping (Float) -> Void) {
        self.onFPSChange = onFPSChange

        DispatchQueue.main.async { [weak self] in
            let displayLink = CADisplayLink(
                target: self as Any,
                selector: #selector(Self.tick)
            )
            displayLink.preferredFramesPerSecond = 60
            displayLink.add(to: .main, forMode: .common)
            self?.displayLink = displayLink
        }
    }

    @objc func tick(displayLink: CADisplayLink) {
        let currentTimestamp = displayLink.timestamp

        if lastTimestamp > 0 {
            let frameDuration = currentTimestamp - lastTimestamp
            frames.append(frameDuration)

            // Keep last 60 frames for averaging
            if frames.count > 60 {
                frames.removeFirst()
            }

            let avgFrameDuration = frames.reduce(0, +) / Double(frames.count)
            let fps = Float(1.0 / avgFrameDuration)
            onFPSChange(fps)
        }

        lastTimestamp = currentTimestamp
    }

    var averageFPS: Float {
        guard !frames.isEmpty else { return 60 }
        let avgFrameDuration = frames.reduce(0, +) / Double(frames.count)
        return Float(1.0 / avgFrameDuration)
    }

    deinit {
        DispatchQueue.main.async { [weak self] in
            self?.displayLink?.invalidate()
        }
    }
}

// MARK: - Cache Wrapper

class CacheWrapper<T> {
    let value: T

    init(_ value: T) {
        self.value = value
    }
}

// MARK: - Task VM Info (for memory calculation)

private struct task_vm_info_data_t {
    var resident_size: UInt32 = 0
    var reserved1: UInt32 = 0
    var reserved2: UInt32 = 0
    var reserved3: UInt32 = 0
    var reserved4: UInt32 = 0
    var reserved5: UInt32 = 0
    var reserved6: UInt32 = 0
    var reserved7: UInt32 = 0
    var reserved8: UInt32 = 0
    var reserved9: UInt32 = 0
    var reserved10: UInt32 = 0
    var phys_footprint: UInt64 = 0
}
