/**
 * Gateway Connection Tests - iOS
 * Unit tests for OpenClaw protocol implementation and WebSocket handling
 */

import XCTest
@testable import Helix

final class GatewayConnectionTests: XCTestCase {
    var sut: GatewayConnection!
    var mockWebSocket: MockURLSessionWebSocketTask!

    override func setUp() {
        super.setUp()
        sut = GatewayConnection()
        mockWebSocket = MockURLSessionWebSocketTask()
    }

    override func tearDown() {
        sut = nil
        mockWebSocket = nil
        super.tearDown()
    }

    // MARK: - Frame Parsing Tests

    func testRequestFrameParsing() throws {
        let json = """
        {
          "type": "req",
          "method": "connect",
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "params": {
            "minProtocol": 3,
            "maxProtocol": 3,
            "client": {
              "id": "test-client",
              "mode": "test",
              "version": "1.0.0"
            }
          }
        }
        """
        let data = json.data(using: .utf8)!
        let decoder = JSONDecoder()
        let frame = try decoder.decode(RequestFrame.self, from: data)

        XCTAssertEqual(frame.type, "req")
        XCTAssertEqual(frame.method, "connect")
        XCTAssertEqual(frame.id, "123e4567-e89b-12d3-a456-426614174000")
    }

    func testResponseFrameParsing() throws {
        let json = """
        {
          "type": "res",
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "result": {
            "status": "ok",
            "message": "Connected"
          }
        }
        """
        let data = json.data(using: .utf8)!
        let decoder = JSONDecoder()
        let frame = try decoder.decode(ResponseFrame.self, from: data)

        XCTAssertEqual(frame.type, "res")
        XCTAssertEqual(frame.id, "123e4567-e89b-12d3-a456-426614174000")
    }

    func testEventFrameParsing() throws {
        let json = """
        {
          "type": "event",
          "event": "chat",
          "data": {
            "content": "test message",
            "role": "assistant"
          }
        }
        """
        let data = json.data(using: .utf8)!
        let decoder = JSONDecoder()
        let frame = try decoder.decode(EventFrame.self, from: data)

        XCTAssertEqual(frame.type, "event")
        XCTAssertEqual(frame.event, "chat")
    }

    // MARK: - Protocol Handshake Tests

    func testHandshakeSequence() async throws {
        // Test: challenge → connect → hello-ok flow
        // This would require mocking the WebSocket connection
        // For now, we test the frame construction

        let connectFrame = RequestFrame(
            type: "req",
            method: "connect",
            id: UUID().uuidString,
            params: AnyCodable([
                "minProtocol": AnyCodable(3),
                "maxProtocol": AnyCodable(3),
                "client": AnyCodable([
                    "id": AnyCodable("test-client"),
                    "mode": AnyCodable("test"),
                    "version": AnyCodable("1.0.0")
                ])
            ])
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(connectFrame)
        let decoded = try JSONDecoder().decode(RequestFrame.self, from: data)

        XCTAssertEqual(decoded.method, "connect")
        XCTAssertEqual(decoded.type, "req")
    }

    // MARK: - Exponential Backoff Tests

    func testExponentialBackoffCalculation() {
        let intervals = [1000, 2000, 4000, 8000, 16000]

        for (attempt, expected) in intervals.enumerated() {
            let calculated = Int(pow(2.0, Double(attempt))) * 1000
            XCTAssertEqual(calculated, expected)
        }
    }

    func testMaxBackoffAttempts() {
        let maxAttempts = 5
        let attempts = (0..<maxAttempts).map { attempt in
            min(Int(pow(2.0, Double(attempt))) * 1000, 16000)
        }

        XCTAssertEqual(attempts.count, 5)
        XCTAssertEqual(attempts.last, 16000)
    }

    // MARK: - Error Handling Tests

    func testConnectionErrorCreation() {
        let error = GatewayConnectionError.connectionFailed(
            message: "WebSocket connection failed",
            code: 1006
        )

        XCTAssertEqual(error.localizedDescription, "WebSocket connection failed")
    }

    func testTimeoutErrorRetryability() {
        let error = GatewayConnectionError.timeout(
            message: "Request timed out",
            requestId: "test-id"
        )

        XCTAssertTrue(error.isRetryable)
    }

    func testProtocolMismatchErrorNonRetryable() {
        let error = GatewayConnectionError.protocolMismatch(
            message: "Unsupported protocol version",
            serverVersion: 2,
            clientVersion: 3
        )

        XCTAssertFalse(error.isRetryable)
    }

    // MARK: - UUID Generation Tests

    func testUUIDGeneration() {
        let uuid1 = UUID().uuidString
        let uuid2 = UUID().uuidString

        XCTAssertNotEqual(uuid1, uuid2)
        XCTAssertEqual(uuid1.split(separator: "-").count, 5) // Standard UUID format
    }

    // MARK: - Tick Interval Tests

    func testTickHeartbeatInterval() {
        let heartbeatInterval: TimeInterval = 30 // seconds
        let tickTimeoutMultiplier = 2.5
        let tickTimeout = heartbeatInterval * tickTimeoutMultiplier

        XCTAssertEqual(tickTimeout, 75.0)
    }

    // MARK: - Request Timeout Tests

    func testRequestTimeout() {
        let requestTimeoutMs = 60000 // 60 seconds
        let timeoutSeconds = TimeInterval(requestTimeoutMs) / 1000

        XCTAssertEqual(timeoutSeconds, 60.0)
    }

    // MARK: - Message Type Tests

    func testGatewayMessageTypes() {
        let thinkingMsg = GatewayMessage.thinking(content: "processing...")
        let toolCallMsg = GatewayMessage.toolCall(name: "test_tool", params: [:])
        let errorMsg = GatewayMessage.error(code: "TEST_ERROR", message: "Test error")

        switch thinkingMsg {
        case .thinking(let content):
            XCTAssertEqual(content, "processing...")
        default:
            XCTFail("Wrong message type")
        }

        switch toolCallMsg {
        case .toolCall(let name, _):
            XCTAssertEqual(name, "test_tool")
        default:
            XCTFail("Wrong message type")
        }

        switch errorMsg {
        case .error(let code, let message):
            XCTAssertEqual(code, "TEST_ERROR")
            XCTAssertEqual(message, "Test error")
        default:
            XCTFail("Wrong message type")
        }
    }
}

// MARK: - Mock WebSocket

class MockURLSessionWebSocketTask: URLSessionWebSocketTask {
    var sentMessages: [URLSessionWebSocketTask.Message] = []
    var shouldFail = false

    override func send(_ message: URLSessionWebSocketTask.Message) async throws {
        if shouldFail {
            throw NSError(domain: "MockError", code: 1, userInfo: nil)
        }
        sentMessages.append(message)
    }

    override func receive() async throws -> URLSessionWebSocketTask.Message {
        throw NSError(domain: "MockError", code: 1, userInfo: nil)
    }

    override func sendPing() async throws {
        // Mock implementation
    }

    override func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        // Mock implementation
    }
}
