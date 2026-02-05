/**
 * High-level Gateway Messages - Helix iOS
 * Maps from low-level frame events to semantic message types
 */

import Foundation

enum GatewayMessage: Equatable {
    case thinking(content: String)
    case toolCall(name: String, input: [String: AnyCodable])
    case toolResult(output: String)
    case error(message: String)
    case complete(content: String?)
    case heartbeat(timestamp: Int)

    var timestamp: Date {
        Date()
    }

    var description: String {
        switch self {
        case .thinking(let content):
            return "💭 Thinking: \(content.prefix(50))"
        case .toolCall(let name, _):
            return "🔧 Tool: \(name)"
        case .toolResult(let output):
            return "✓ Result: \(output.prefix(50))"
        case .error(let message):
            return "❌ Error: \(message)"
        case .complete(let content):
            return "✅ Complete: \(content?.prefix(50) ?? "no content")"
        case .heartbeat:
            return "💓 Heartbeat"
        }
    }
}

extension GatewayMessage {
    /// Map from chat event payload to GatewayMessage
    static func fromChatEvent(event: String, payload: [String: AnyCodable]) -> GatewayMessage? {
        switch event {
        case "thinking":
            if let content = extractString(from: payload, key: "content") ?? extractString(from: payload, key: "text") {
                return .thinking(content: content)
            }
            return nil

        case "tool_use", "tool_call":
            let toolName = extractString(from: payload, key: "toolName") ?? extractString(from: payload, key: "name") ?? "unknown"
            let toolInput = extractObject(from: payload, key: "toolInput") ?? extractObject(from: payload, key: "input") ?? [:]
            return .toolCall(name: toolName, input: toolInput)

        case "tool_result":
            if let output = extractString(from: payload, key: "toolOutput") ?? extractString(from: payload, key: "output") {
                return .toolResult(output: output)
            }
            return nil

        case "complete", "done":
            let content = extractString(from: payload, key: "content") ?? extractString(from: payload, key: "text")
            return .complete(content: content)

        case "error":
            let message = extractString(from: payload, key: "content") ?? extractString(from: payload, key: "error") ?? "Unknown error"
            return .error(message: message)

        default:
            return nil
        }
    }

    private static func extractString(from dict: [String: AnyCodable], key: String) -> String? {
        guard let value = dict[key] else { return nil }
        switch value {
        case .string(let s):
            return s
        default:
            return nil
        }
    }

    private static func extractObject(from dict: [String: AnyCodable], key: String) -> [String: AnyCodable]? {
        guard let value = dict[key] else { return nil }
        switch value {
        case .object(let obj):
            return obj
        default:
            return nil
        }
    }
}
