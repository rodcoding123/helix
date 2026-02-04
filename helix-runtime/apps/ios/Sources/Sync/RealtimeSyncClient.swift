import Foundation
import Observation

/**
 * Real-Time Sync Client for iOS
 *
 * Handles cross-platform synchronization via Gateway WebSocket connection
 * Manages offline queue, conflict detection, and presence tracking
 */

@Observable
final class RealtimeSyncClient {
    enum ConnectionStatus {
        case disconnected
        case connecting
        case connected
        case error(String)
    }

    // MARK: - Properties

    private(set) var connectionStatus: ConnectionStatus = .disconnected
    private(set) var conflicts: [ConflictType] = []
    private(set) var isOffline: Bool = false

    private let gatewayURL: URL
    private let userId: String
    private let deviceId: String
    private var webSocketTask: URLSessionWebSocketTask?
    private let offlineQueue: OfflineSyncQueue
    private let logger = Logger(subsystem: "ai.openclaw.ios", category: "sync")

    private let receiveQueue = DispatchQueue(label: "com.openclaw.sync.receive", qos: .userInitiated)
    private let sendQueue = DispatchQueue(label: "com.openclaw.sync.send", qos: .userInitiated)

    // MARK: - Callbacks

    var onDelta: ((DeltaChange) -> Void)?
    var onConflict: ((ConflictType) -> Void)?
    var onConnectionChange: ((ConnectionStatus) -> Void)?

    // MARK: - Initialization

    init(
        gatewayURL: URL,
        userId: String,
        deviceId: String
    ) {
        self.gatewayURL = gatewayURL
        self.userId = userId
        self.deviceId = deviceId
        self.offlineQueue = OfflineSyncQueue(userId: userId, deviceId: deviceId)

        // Monitor network status
        startNetworkMonitoring()
    }

    // MARK: - Connection Management

    func connect() {
        updateConnectionStatus(.connecting)

        let request = URLRequest(url: gatewayURL)
        webSocketTask = URLSession.shared.webSocketTask(with: request)

        // Send auth message
        let authMessage = [
            "type": "auth",
            "userId": userId,
            "deviceId": deviceId,
            "platform": "ios",
        ] as [String: Any]

        sendMessage(authMessage)
        webSocketTask?.resume()

        // Start receiving messages
        receiveMessage()

        updateConnectionStatus(.connected)
        logger.info("Connected to sync gateway")
    }

    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        updateConnectionStatus(.disconnected)
        logger.info("Disconnected from sync gateway")
    }

    // MARK: - Message Handling

    private func receiveMessage() {
        receiveQueue.async { [weak self] in
            self?.webSocketTask?.receive { [weak self] result in
                guard let self = self else { return }

                switch result {
                case .success(let message):
                    switch message {
                    case .string(let text):
                        self.handleMessage(text)
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            self.handleMessage(text)
                        }
                    @unknown default:
                        break
                    }

                    // Continue receiving
                    self.receiveMessage()

                case .failure(let error):
                    self.logger.warning("WebSocket receive error: \(error.localizedDescription)")
                    self.updateConnectionStatus(.error(error.localizedDescription))
                    self.attemptReconnect()
                }
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let messageType = json["type"] as? String else {
            logger.warning("Invalid message format")
            return
        }

        switch messageType {
        case "sync.delta":
            handleDeltaMessage(json)
        case "sync.conflict":
            handleConflictMessage(json)
        case "sync.ack":
            handleAckMessage(json)
        case "error":
            handleErrorMessage(json)
        default:
            logger.debug("Unknown message type: \(messageType)")
        }
    }

    private func handleDeltaMessage(_ json: [String: Any]) {
        guard let payload = json["payload"] as? [String: Any] else { return }

        let delta = DeltaChange(
            entity_type: payload["entity_type"] as? String ?? "",
            entity_id: payload["entity_id"] as? String ?? "",
            operation: payload["operation"] as? String ?? "",
            changed_fields: payload["changed_fields"] as? [String: Any] ?? [:],
            vector_clock: payload["vector_clock"] as? [String: Any] ?? [:],
            timestamp: (payload["timestamp"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970
        )

        DispatchQueue.main.async {
            self.onDelta?(delta)
        }
    }

    private func handleConflictMessage(_ json: [String: Any]) {
        guard let payload = json["payload"] as? [String: Any] else { return }

        let conflict = ConflictType(
            id: payload["id"] as? String ?? "",
            entity_type: payload["entity_type"] as? String ?? "",
            entity_id: payload["entity_id"] as? String ?? "",
            local_version: payload["local_version"] as? [String: Any] ?? [:],
            remote_version: payload["remote_version"] as? [String: Any] ?? [:],
            timestamp: (payload["timestamp"] as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970
        )

        DispatchQueue.main.async {
            self.conflicts.append(conflict)
            self.onConflict?(conflict)
        }

        logger.warning("Conflict detected: \(conflict.entity_type):\(conflict.entity_id)")
    }

    private func handleAckMessage(_ json: [String: Any]) {
        guard let changeId = json["change_id"] as? String else { return }
        logger.debug("Change acknowledged: \(changeId)")
    }

    private func handleErrorMessage(_ json: [String: Any]) {
        let message = json["message"] as? String ?? "Unknown error"
        logger.error("Sync error: \(message)")
        updateConnectionStatus(.error(message))
    }

    // MARK: - Message Sending

    private func sendMessage(_ message: [String: Any]) {
        sendQueue.async { [weak self] in
            guard let self = self, let webSocketTask = self.webSocketTask else { return }

            do {
                let data = try JSONSerialization.data(withJSONObject: message)
                let text = String(data: data, encoding: .utf8) ?? ""

                webSocketTask.send(.string(text)) { [weak self] error in
                    if let error = error {
                        self?.logger.error("Failed to send message: \(error.localizedDescription)")
                    }
                }
            } catch {
                self.logger.error("Failed to serialize message: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Change Management

    func applyLocalChange(_ change: QueuedChange) async throws {
        // Update local state immediately
        await MainActor.run {
            SyncStore.shared.applyChange(change)
        }

        let message: [String: Any] = [
            "type": "sync.change",
            "entity_type": change.entity_type,
            "entity_id": change.entity_id,
            "operation": change.operation,
            "data": change.data,
            "timestamp": Date().timeIntervalSince1970,
        ]

        if isOffline {
            // Queue for later
            try await offlineQueue.enqueue(change)
            logger.debug("Queued change (offline): \(change.entity_type):\(change.entity_id)")
        } else {
            // Send immediately
            sendMessage(message)
            logger.debug("Sent change: \(change.entity_type):\(change.entity_id)")
        }
    }

    func resolveConflict(_ conflictId: String, resolution: [String: Any]) {
        let message: [String: Any] = [
            "type": "sync.resolve_conflict",
            "conflict_id": conflictId,
            "resolution": resolution,
        ]

        sendMessage(message)
        logger.info("Resolved conflict: \(conflictId)")
    }

    // MARK: - Offline Queue

    func syncOfflineQueue() async throws {
        let queued = try await offlineQueue.getAllQueued()

        for change in queued {
            do {
                let message: [String: Any] = [
                    "type": "sync.change",
                    "entity_type": change.entity_type,
                    "entity_id": change.entity_id,
                    "operation": change.operation,
                    "data": change.data,
                    "timestamp": change.timestamp,
                ]

                sendMessage(message)

                try await offlineQueue.markSynced(change.id)
                logger.debug("Synced queued change: \(change.id)")
            } catch {
                logger.warning("Failed to sync queued change: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Network Monitoring

    private func startNetworkMonitoring() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(networkStatusDidChange),
            name: NSNotification.Name("NetworkStatusDidChange"),
            object: nil
        )
    }

    @objc private func networkStatusDidChange() {
        let isOnline = NetworkMonitor.shared.isOnline

        DispatchQueue.main.async {
            self.isOffline = !isOnline

            if isOnline && self.connectionStatus == .disconnected {
                self.connect()
                Task {
                    try await self.syncOfflineQueue()
                }
            }
        }
    }

    private func attemptReconnect() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.connect()
        }
    }

    // MARK: - Status Management

    private func updateConnectionStatus(_ status: ConnectionStatus) {
        DispatchQueue.main.async {
            self.connectionStatus = status
            self.onConnectionChange?(status)
        }
    }

    deinit {
        disconnect()
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - Supporting Types

struct DeltaChange {
    let entity_type: String
    let entity_id: String
    let operation: String
    let changed_fields: [String: Any]
    let vector_clock: [String: Any]
    let timestamp: TimeInterval
}

struct QueuedChange {
    let id: String
    let entity_type: String
    let entity_id: String
    let operation: String
    let data: [String: Any]
    let timestamp: TimeInterval
}

struct ConflictType {
    let id: String
    let entity_type: String
    let entity_id: String
    let local_version: [String: Any]
    let remote_version: [String: Any]
    let timestamp: TimeInterval
}

// MARK: - Offline Queue Storage

final actor OfflineSyncQueue {
    private let userId: String
    private let deviceId: String
    private var queue: [QueuedChange] = []
    private let logger = Logger(subsystem: "ai.openclaw.ios", category: "sync.queue")

    init(userId: String, deviceId: String) {
        self.userId = userId
        self.deviceId = deviceId
    }

    func enqueue(_ change: QueuedChange) async throws {
        queue.append(change)
        logger.debug("Enqueued change: \(change.id)")
    }

    func getAllQueued() async -> [QueuedChange] {
        return queue
    }

    func markSynced(_ changeId: String) async throws {
        queue.removeAll { $0.id == changeId }
        logger.debug("Marked synced: \(changeId)")
    }

    func clear() async {
        queue.removeAll()
        logger.info("Offline queue cleared")
    }
}

// MARK: - Sync Store

final actor SyncStore {
    static let shared = SyncStore()

    func applyChange(_ change: QueuedChange) {
        // This is called from the main thread via MainActor.run
        // Update local state based on change type
    }
}

// MARK: - Network Monitor

class NetworkMonitor {
    static let shared = NetworkMonitor()

    @Published var isOnline: Bool = true

    private init() {
        // Initialize network monitoring
    }
}
