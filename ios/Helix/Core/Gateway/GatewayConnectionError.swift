/**
 * Gateway Connection Error Types - Helix iOS
 */

import Foundation

enum GatewayErrorCode: String {
    case connectionFailed = "CONNECTION_FAILED"
    case authRejected = "AUTH_REJECTED"
    case protocolMismatch = "PROTOCOL_MISMATCH"
    case timeout = "TIMEOUT"
    case networkError = "NETWORK_ERROR"
    case invalidFrame = "INVALID_FRAME"
    case requestFailed = "REQUEST_FAILED"
}

class GatewayConnectionError: LocalizedError {
    let code: GatewayErrorCode
    let message: String
    let retryable: Bool
    let retryAfterMs: Int?
    let underlyingError: Error?

    init(
        code: GatewayErrorCode,
        message: String,
        retryable: Bool = true,
        retryAfterMs: Int? = nil,
        underlyingError: Error? = nil
    ) {
        self.code = code
        self.message = message
        self.retryable = retryable
        self.retryAfterMs = retryAfterMs
        self.underlyingError = underlyingError
    }

    var errorDescription: String? {
        return message
    }

    var recoverySuggestion: String? {
        switch code {
        case .connectionFailed:
            return "Failed to connect to gateway. Check your network and try again."
        case .authRejected:
            return "Authentication failed. Check your instance key and auth token."
        case .protocolMismatch:
            return "Protocol version mismatch. Update your app."
        case .timeout:
            return "Connection timed out. Check your network and try again."
        case .networkError:
            return "Network error. Check your internet connection."
        case .invalidFrame:
            return "Received invalid frame from gateway."
        case .requestFailed:
            return "Request failed. Try again."
        }
    }

    var debugDescription: String {
        var desc = "[\(code.rawValue)] \(message)"
        if let underlying = underlyingError {
            desc += "\n  Caused by: \(underlying)"
        }
        if let retryAfter = retryAfterMs {
            desc += "\n  Retry after: \(retryAfter)ms"
        }
        return desc
    }
}

// MARK: - Equatable

extension GatewayConnectionError: Equatable {
    static func == (lhs: GatewayConnectionError, rhs: GatewayConnectionError) -> Bool {
        return lhs.code == rhs.code && lhs.message == rhs.message
    }
}

// MARK: - Hashable

extension GatewayConnectionError: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(code.rawValue)
        hasher.combine(message)
    }
}
