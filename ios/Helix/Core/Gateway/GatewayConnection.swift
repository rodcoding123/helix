/**
 * Gateway WebSocket Connection Service - Helix iOS
 * Implements OpenClaw frame-based protocol with challenge → connect → hello-ok handshake
 * Reference: web/src/lib/gateway-connection.ts
 */

import Foundation

enum ConnectionStatus: Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting(attempt: Int)
    case error(GatewayConnectionError)

    var isConnected: Bool {
        switch self {
        case .connected:
            return true
        default:
            return false
        }
    }

    var description: String {
        switch self {
        case .disconnected:
            return "Disconnected"
        case .connecting:
            return "Connecting..."
        case .connected:
            return "Connected"
        case .reconnecting(let attempt):
            return "Reconnecting (attempt \(attempt))"
        case .error(let error):
            return "Error: \(error.message)"
        }
    }
}

@MainActor
final class GatewayConnection: ObservableObject {
    static let shared = GatewayConnection()

    // MARK: - Published State

    @Published private(set) var connectionStatus: ConnectionStatus = .disconnected
    @Published private(set) var lastMessage: GatewayMessage?
    @Published private(set) var isConnected: Bool = false
    @Published private(set) var lastError: GatewayConnectionError?

    // MARK: - Private Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private let session: URLSession

    private var instanceKey: String?
    private var authTokenProvider: (() async -> String?)?
    private var gatewayUrl: String?

    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var reconnectDelay: TimeInterval = 1.0

    private var tickWatchTimer: Timer?
    private var lastTickTime: Int = 0
    private var tickIntervalMs: Int = DEFAULT_TICK_INTERVAL_MS

    private var pendingRequests: [String: PendingRequest] = [:]
    private var connectContinuation: CheckedContinuation<Void, Error>?

    private var messageSubscribers: [UUID: (GatewayMessage) -> Void] = [:]
    private let subscriberQueue = DispatchQueue(label: "ai.helix.gateway.subscribers", attributes: .concurrent)

    private var shouldReconnectOnForeground = false

    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    // MARK: - Initialization

    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)

        observeLifecycle()
    }

    deinit {
        disconnect()
    }

    // MARK: - Connection Management

    func initialize(instanceKey: String, authTokenProvider: @escaping () async -> String?, gatewayUrl: String? = nil) async throws {
        self.instanceKey = instanceKey
        self.authTokenProvider = authTokenProvider
        self.gatewayUrl = gatewayUrl

        // Try to load saved config
        let config = await GatewayConfigStorage.shared.loadConfig()
        if self.gatewayUrl == nil {
            self.gatewayUrl = config?.gatewayUrl
        }
    }

    func connect() async throws {
        guard let instanceKey = instanceKey, let authTokenProvider = authTokenProvider else {
            throw GatewayConnectionError(
                code: .connectionFailed,
                message: "Gateway not initialized. Call initialize() first.",
                retryable: false
            )
        }

        let url = buildGatewayUrl(instanceKey: instanceKey)

        guard let wsUrl = URL(string: url) else {
            throw GatewayConnectionError(
                code: .connectionFailed,
                message: "Invalid gateway URL: \(url)",
                retryable: false
            )
        }

        updateStatus(.connecting)
        shouldReconnectOnForeground = true

        return try await withCheckedThrowingContinuation { continuation in
            self.connectContinuation = continuation

            let request = URLRequest(url: wsUrl, timeoutInterval: TimeInterval(CONNECT_TIMEOUT_MS / 1000))
            self.webSocketTask = session.webSocketTask(with: request)

            self.webSocketTask?.resume()
            self.startReceiving()

            // Timeout handler
            Task {
                try? await Task.sleep(nanoseconds: UInt64(CONNECT_TIMEOUT_MS) * 1_000_000)
                if case .connecting = self.connectionStatus {
                    let error = GatewayConnectionError(
                        code: .timeout,
                        message: "Connection handshake timeout",
                        retryable: true
                    )
                    self.updateStatus(.error(error))
                    self.connectContinuation?.resume(throwing: error)
                    self.connectContinuation = nil
                }
            }
        }
    }

    func disconnect() {
        shouldReconnectOnForeground = false
        stopTickWatch()
        rejectPendingRequests(reason: "Disconnected")
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        updateStatus(.disconnected)
    }

    func reconnect() async {
        if reconnectAttempts >= maxReconnectAttempts {
            let error = GatewayConnectionError(
                code: .connectionFailed,
                message: "Max reconnection attempts reached",
                retryable: false
            )
            updateStatus(.error(error))
            lastError = error
            return
        }

        reconnectAttempts += 1
        let delay = reconnectDelay * pow(2.0, Double(reconnectAttempts - 1))

        updateStatus(.reconnecting(attempt: reconnectAttempts))

        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))

        do {
            try await connect()
        } catch {
            await reconnect()
        }
    }

    // MARK: - Message Publishing

    func sendMessage(_ content: String) async throws {
        guard isConnected else {
            throw GatewayConnectionError(
                code: .connectionFailed,
                message: "Not connected to gateway",
                retryable: true
            )
        }

        let frame = RequestFrame(
            id: UUID().uuidString,
            method: "chat.send",
            params: ["message": .string(content)]
        )

        sendFrame(.request(frame))
    }

    func sendRequest(method: String, params: [String: AnyCodable]? = nil) async throws -> [String: AnyCodable] {
        guard isConnected else {
            throw GatewayConnectionError(
                code: .connectionFailed,
                message: "Not connected to gateway",
                retryable: true
            )
        }

        return try await withCheckedThrowingContinuation { continuation in
            let id = UUID().uuidString

            let timer = Timer.scheduledTimer(withTimeInterval: TimeInterval(REQUEST_TIMEOUT_MS / 1000), repeats: false) { _ in
                self.pendingRequests.removeValue(forKey: id)
                let error = GatewayConnectionError(
                    code: .timeout,
                    message: "Request timeout: \(method)",
                    retryable: true
                )
                continuation.resume(throwing: error)
            }

            let pending = PendingRequest(
                resolve: { payload in
                    continuation.resume(returning: payload)
                },
                reject: { error in
                    continuation.resume(throwing: error)
                },
                timer: timer,
                createdAt: Date()
            )

            self.pendingRequests[id] = pending

            let frame = RequestFrame(id: id, method: method, params: params)
            self.sendFrame(.request(frame))
        }
    }

    func interrupt() throws {
        let frame = RequestFrame(
            id: UUID().uuidString,
            method: "chat.abort",
            params: nil
        )
        sendFrame(.request(frame))
    }

    // MARK: - Message Subscription

    func subscribe(handler: @escaping (GatewayMessage) -> Void) -> UUID {
        let id = UUID()
        subscriberQueue.async(flags: .barrier) {
            self.messageSubscribers[id] = handler
        }
        return id
    }

    func unsubscribe(_ id: UUID) {
        subscriberQueue.async(flags: .barrier) {
            self.messageSubscribers.removeValue(forKey: id)
        }
    }

    private func publishMessage(_ message: GatewayMessage) {
        lastMessage = message

        subscriberQueue.async {
            for handler in self.messageSubscribers.values {
                DispatchQueue.main.async {
                    handler(message)
                }
            }
        }
    }

    // MARK: - WebSocket Frame Handling

    private func startReceiving() {
        webSocketTask?.receive { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(.string(let text)):
                    guard let data = text.data(using: .utf8) else {
                        self?.startReceiving()
                        return
                    }
                    self?.handleFrameData(data)
                    self?.startReceiving()

                case .success(.data(let data)):
                    self?.handleFrameData(data)
                    self?.startReceiving()

                case .failure(let error):
                    self?.handleWebSocketError(error)

                @unknown default:
                    self?.startReceiving()
                }
            }
        }
    }

    private func handleFrameData(_ data: Data) {
        do {
            let frame = try decoder.decode(GatewayFrame.self, from: data)
            handleFrame(frame)
        } catch {
            print("[Gateway] Failed to parse frame: \(error)")
            lastError = GatewayConnectionError(
                code: .invalidFrame,
                message: "Failed to parse frame: \(error.localizedDescription)"
            )
        }
    }

    private func handleFrame(_ frame: GatewayFrame) {
        switch frame {
        case .event(let eventFrame):
            handleEvent(eventFrame)

        case .response(let responseFrame):
            handleResponse(responseFrame)

        case .request(let requestFrame):
            // Server-initiated requests (rare) - acknowledge
            let response = ResponseFrame(
                id: requestFrame.id,
                ok: true,
                payload: ["status": .string("acknowledged")],
                error: nil
            )
            sendFrame(.response(response))
        }
    }

    private func handleEvent(_ frame: EventFrame) {
        switch frame.event {
        case "connect.challenge":
            let nonce = extractString(from: frame.payload, key: "nonce")
            sendConnectRequest(nonce: nonce)

        case "tick":
            if let ts = extractInt(from: frame.payload, key: "ts") {
                lastTickTime = ts
                publishMessage(.heartbeat(timestamp: ts))
            }

        case "chat.event":
            mapChatEvent(frame.payload ?? [:])

        case "agent.event":
            mapAgentEvent(frame.payload ?? [:])

        case "shutdown":
            let error = GatewayConnectionError(
                code: .connectionFailed,
                message: "Server shutting down",
                retryable: true,
                retryAfterMs: 5000
            )
            updateStatus(.error(error))

        default:
            // Forward unknown events as complete messages
            if let payload = frame.payload {
                let content = try? encoder.encode(payload)
                if let content = content, let jsonString = String(data: content, encoding: .utf8) {
                    publishMessage(.complete(content: jsonString))
                }
            }
        }
    }

    private func handleResponse(_ frame: ResponseFrame) {
        let pending = pendingRequests.removeValue(forKey: frame.id)

        if let pending = pending {
            pending.timer.invalidate()

            if frame.ok {
                pending.resolve(frame.payload ?? [:])
            } else {
                let errorMsg = frame.error?.message ?? "Request failed"
                let code = mapErrorCode(frame.error?.code)
                let error = GatewayConnectionError(
                    code: code,
                    message: errorMsg,
                    retryable: frame.error?.retryable ?? false,
                    retryAfterMs: frame.error?.retryAfterMs
                )
                pending.reject(error)
            }
            return
        }

        // Handle hello-ok response (connection handshake completion)
        if frame.ok {
            if let helloOk = parseHelloOk(frame.payload) {
                onConnected(payload: helloOk)
                return
            }
        }

        // Handle connection rejection
        if !frame.ok {
            let errorMsg = frame.error?.message ?? "Connection rejected"
            let code = mapErrorCode(frame.error?.code)
            let error = GatewayConnectionError(
                code: code,
                message: errorMsg,
                retryable: false
            )
            updateStatus(.error(error))
            connectContinuation?.resume(throwing: error)
            connectContinuation = nil
        }
    }

    private func sendConnectRequest(nonce: String?) {
        guard let authTokenProvider = authTokenProvider, let instanceKey = instanceKey else {
            return
        }

        Task {
            let authToken = await authTokenProvider() ?? ""

            let params: [String: AnyCodable] = [
                "minProtocol": .int(PROTOCOL_VERSION),
                "maxProtocol": .int(PROTOCOL_VERSION),
                "client": .object([
                    "id": .string("helix.ios.app"),
                    "displayName": .string("Helix iOS"),
                    "version": .string(appVersion()),
                    "platform": .string("ios"),
                    "mode": .string("mobile"),
                    "instanceId": .string(instanceKey)
                ]),
                "role": .string("operator"),
                "scopes": .array([.string("operator.admin")]),
                "auth": .object([
                    "token": .string(authToken)
                ]),
                "userAgent": .string(userAgent())
            ]

            let frame = RequestFrame(
                id: UUID().uuidString,
                method: "connect",
                params: params
            )

            let timer = Timer.scheduledTimer(withTimeInterval: TimeInterval(CONNECT_TIMEOUT_MS / 1000), repeats: false) { [weak self] _ in
                self?.pendingRequests.removeValue(forKey: frame.id)
                let error = GatewayConnectionError(
                    code: .timeout,
                    message: "Connect handshake timeout",
                    retryable: true
                )
                self?.updateStatus(.error(error))
                self?.connectContinuation?.resume(throwing: error)
                self?.connectContinuation = nil
            }

            let pending = PendingRequest(
                resolve: { [weak self] payload in
                    if let helloOk = self?.parseHelloOk(payload as? [String: AnyCodable]) {
                        self?.onConnected(payload: helloOk)
                    }
                },
                reject: { [weak self] error in
                    self?.updateStatus(.error(error as! GatewayConnectionError))
                    self?.connectContinuation?.resume(throwing: error)
                    self?.connectContinuation = nil
                },
                timer: timer,
                createdAt: Date()
            )

            self.pendingRequests[frame.id] = pending
            self.sendFrame(.request(frame))
        }
    }

    private func onConnected(payload: [String: AnyCodable]) {
        // Extract policy
        if let policy = extractObject(from: payload, key: "policy") {
            if let tickIntervalMs = extractInt(from: policy, key: "tickIntervalMs") {
                self.tickIntervalMs = tickIntervalMs
            }
        }

        lastTickTime = Int(Date().timeIntervalSince1970 * 1000)
        startTickWatch()
        updateStatus(.connected)
        reconnectAttempts = 0

        connectContinuation?.resume()
        connectContinuation = nil
    }

    private func sendFrame(_ frame: GatewayFrame) {
        guard webSocketTask?.state == .running else {
            return
        }

        do {
            let data = try encoder.encode(frame)
            if let jsonString = String(data: data, encoding: .utf8) {
                let message = URLSessionWebSocketTask.Message.string(jsonString)
                webSocketTask?.send(message) { error in
                    if let error = error {
                        print("[Gateway] Send error: \(error)")
                    }
                }
            }
        } catch {
            print("[Gateway] Encode error: \(error)")
        }
    }

    // MARK: - Heartbeat Management

    private func startTickWatch() {
        stopTickWatch()

        let interval = max(Double(tickIntervalMs) / 1000.0, 1.0)

        tickWatchTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self = self else { return }

            let now = Int(Date().timeIntervalSince1970 * 1000)
            let gap = now - self.lastTickTime

            if gap > (self.tickIntervalMs * 25 / 10) { // 2.5x interval
                print("[Gateway] Tick timeout: \(gap)ms since last tick")
                Task { @MainActor in
                    self.disconnect()
                    await self.reconnect()
                }
            }
        }
    }

    private func stopTickWatch() {
        tickWatchTimer?.invalidate()
        tickWatchTimer = nil
    }

    // MARK: - Event Mapping

    private func mapChatEvent(_ payload: [String: AnyCodable]) {
        if let message = GatewayMessage.fromChatEvent(event: extractString(from: payload, key: "event") ?? extractString(from: payload, key: "type") ?? "", payload: payload) {
            publishMessage(message)
        }
    }

    private func mapAgentEvent(_ payload: [String: AnyCodable]) {
        mapChatEvent(payload)
    }

    // MARK: - Error Handling

    private func handleWebSocketError(_ error: Error) {
        let gatewayError = GatewayConnectionError(
            code: .networkError,
            message: error.localizedDescription,
            retryable: true,
            underlyingError: error
        )
        updateStatus(.error(gatewayError))
        lastError = gatewayError

        Task { @MainActor in
            await reconnect()
        }
    }

    private func rejectPendingRequests(reason: String) {
        for (_, pending) in pendingRequests {
            pending.timer.invalidate()
            let error = GatewayConnectionError(
                code: .connectionFailed,
                message: reason,
                retryable: true
            )
            pending.reject(error)
        }
        pendingRequests.removeAll()
    }

    // MARK: - URL Building

    private func buildGatewayUrl(instanceKey: String) -> String {
        if let customUrl = gatewayUrl {
            return customUrl.contains("?")
                ? "\(customUrl)&instanceKey=\(instanceKey)"
                : "\(customUrl)?instanceKey=\(instanceKey)"
        }

        // Default cloud gateway
        return "wss://gateway.helix-project.org/v1/connect?instanceKey=\(instanceKey)"
    }

    // MARK: - Helpers

    private func updateStatus(_ status: ConnectionStatus) {
        self.connectionStatus = status
        self.isConnected = status.isConnected

        if case .error(let error) = status {
            self.lastError = error
        }
    }

    private func appVersion() -> String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0.0"
    }

    private func userAgent() -> String {
        let device = UIDevice.current.model
        let osVersion = UIDevice.current.systemVersion
        return "Helix/\(appVersion()) iOS \(osVersion) (\(device))"
    }

    private func parseHelloOk(_ payload: [String: AnyCodable]?) -> [String: AnyCodable]? {
        guard let payload = payload else { return nil }
        guard extractString(from: payload, key: "type") == "hello-ok" else { return nil }
        return payload
    }

    private func mapErrorCode(_ code: String?) -> GatewayErrorCode {
        switch code {
        case "UNAUTHORIZED", "AUTH_FAILED":
            return .authRejected
        case "PROTOCOL_MISMATCH", "INVALID_PROTOCOL":
            return .protocolMismatch
        case "TIMEOUT":
            return .timeout
        default:
            return .connectionFailed
        }
    }

    private func extractString(from dict: [String: AnyCodable]?, key: String) -> String? {
        guard let dict = dict, let value = dict[key] else { return nil }
        if case .string(let s) = value { return s }
        return nil
    }

    private func extractInt(from dict: [String: AnyCodable]?, key: String) -> Int? {
        guard let dict = dict, let value = dict[key] else { return nil }
        if case .int(let i) = value { return i }
        return nil
    }

    private func extractObject(from dict: [String: AnyCodable]?, key: String) -> [String: AnyCodable]? {
        guard let dict = dict, let value = dict[key] else { return nil }
        if case .object(let obj) = value { return obj }
        return nil
    }

    // MARK: - Lifecycle Observation

    private func observeLifecycle() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.shouldReconnectOnForeground = self?.isConnected ?? false
                self?.disconnect()
            }
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                if self?.shouldReconnectOnForeground ?? false {
                    try? await self?.connect()
                }
            }
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.willTerminateNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.disconnect()
            }
        }
    }
}

// MARK: - Pending Request

private struct PendingRequest {
    let resolve: ([String: AnyCodable]) -> Void
    let reject: (Error) -> Void
    let timer: Timer
    let createdAt: Date
}
