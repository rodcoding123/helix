/**
 * OpenClaw Frame Type Definitions - Helix iOS
 * Implements the exact frame protocol from web/src/lib/gateway-connection.ts
 */

import Foundation

// MARK: - Request Frame

struct RequestFrame: Codable {
    let type: String = "req"
    let id: String
    let method: String
    let params: [String: AnyCodable]?

    enum CodingKeys: String, CodingKey {
        case type, id, method, params
    }
}

// MARK: - Response Frame

struct ResponseFrame: Codable {
    let type: String = "res"
    let id: String
    let ok: Bool
    let payload: [String: AnyCodable]?
    let error: FrameError?

    enum CodingKeys: String, CodingKey {
        case type, id, ok, payload, error
    }
}

struct FrameError: Codable {
    let code: String
    let message: String
    let details: AnyCodable?
    let retryable: Bool?
    let retryAfterMs: Int?
}

// MARK: - Event Frame

struct EventFrame: Codable {
    let type: String = "event"
    let event: String
    let payload: [String: AnyCodable]?
    let seq: Int?

    enum CodingKeys: String, CodingKey {
        case type, event, payload, seq
    }
}

// MARK: - Discriminated Union

enum GatewayFrame {
    case request(RequestFrame)
    case response(ResponseFrame)
    case event(EventFrame)
}

extension GatewayFrame: Codable {
    enum CodingKeys: String, CodingKey {
        case type
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "req":
            let frame = try RequestFrame(from: decoder)
            self = .request(frame)
        case "res":
            let frame = try ResponseFrame(from: decoder)
            self = .response(frame)
        case "event":
            let frame = try EventFrame(from: decoder)
            self = .event(frame)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown frame type: \(type)"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .request(let frame):
            try frame.encode(to: encoder)
        case .response(let frame):
            try frame.encode(to: encoder)
        case .event(let frame):
            try frame.encode(to: encoder)
        }
    }
}

// MARK: - Codable Helpers

/// Helper to encode/decode arbitrary JSON values
enum AnyCodable: Codable {
    case null
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)
    case array([AnyCodable])
    case object([String: AnyCodable])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let int = try? container.decode(Int.self) {
            self = .int(int)
        } else if let double = try? container.decode(Double.self) {
            self = .double(double)
        } else if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([AnyCodable].self) {
            self = .array(array)
        } else if let object = try? container.decode([String: AnyCodable].self) {
            self = .object(object)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode AnyCodable"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .null:
            try container.encodeNil()
        case .bool(let bool):
            try container.encode(bool)
        case .int(let int):
            try container.encode(int)
        case .double(let double):
            try container.encode(double)
        case .string(let string):
            try container.encode(string)
        case .array(let array):
            try container.encode(array)
        case .object(let object):
            try container.encode(object)
        }
    }
}

// MARK: - Connection Challenge

struct ConnectChallengePayload: Codable {
    let nonce: String?
}

// MARK: - Connect Request Client Info

struct ConnectRequestClient: Codable {
    let id: String
    let displayName: String
    let version: String
    let platform: String
    let mode: String
    let instanceId: String

    enum CodingKeys: String, CodingKey {
        case id, displayName, version, platform, mode
        case instanceId = "instanceId"
    }
}

// MARK: - Connect Request Auth

struct ConnectRequestAuth: Codable {
    let token: String
}

// MARK: - Hello OK Response

struct HelloOKPayload: Codable {
    let type: String
    let serverName: String?
    let protocol: Int
    let policy: GatewayPolicy?

    enum CodingKeys: String, CodingKey {
        case type, serverName
        case `protocol` = "protocol"
        case policy
    }
}

struct GatewayPolicy: Codable {
    let tickIntervalMs: Int?
    let maxIdleMs: Int?

    enum CodingKeys: String, CodingKey {
        case tickIntervalMs, maxIdleMs
    }
}

// MARK: - Tick Event

struct TickEventPayload: Codable {
    let ts: Int

    enum CodingKeys: String, CodingKey {
        case ts
    }
}

// MARK: - Constants

let PROTOCOL_VERSION = 3
let CONNECT_TIMEOUT_MS = 15000
let REQUEST_TIMEOUT_MS = 60000
let DEFAULT_TICK_INTERVAL_MS = 30000
