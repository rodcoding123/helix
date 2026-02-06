/**
 * Log Sanitizer - Redact sensitive data from logs
 * HIGH FIX 6.1: Sanitizes logs to prevent credential leakage
 * Removes tokens, keys, passwords, and other sensitive information
 */

import Foundation

struct LogSanitizer {
    // MARK: - Regex Patterns for Sensitive Data

    private static let patterns: [String: NSRegularExpression] = [
        // JWT tokens (eyJ... format)
        "jwt": try! NSRegularExpression(pattern: "eyJ[A-Za-z0-9_-]+", options: []),

        // Bearer tokens
        "bearer": try! NSRegularExpression(pattern: "Bearer\\s+([A-Za-z0-9_-]+)", options: [.caseInsensitive]),

        // API Keys (generic)
        "apikey": try! NSRegularExpression(pattern: "api[_-]?key['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", options: [.caseInsensitive]),

        // Supabase keys
        "supabase": try! NSRegularExpression(pattern: "supabase[._-]?(anon|service)[._-]?key['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", options: [.caseInsensitive]),

        // Database URLs with credentials
        "database_url": try! NSRegularExpression(pattern: "postgres://[^:]+:[^@]+@", options: [.caseInsensitive]),

        // Instance keys (UUIDs in certain contexts)
        "instance_key": try! NSRegularExpression(pattern: "instance[._-]?key['\"]?\\s*[:=]\\s*['\"]?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", options: [.caseInsensitive]),

        // Password assignments
        "password": try! NSRegularExpression(pattern: "password['\"]?\\s*[:=]\\s*['\"]?([^'\"\\s,}\\]]+)", options: [.caseInsensitive]),

        // Authorization headers
        "auth_header": try! NSRegularExpression(pattern: "Authorization['\"]?\\s*[:=]\\s*['\"]?([^'\"\\s,}\\]]+)", options: [.caseInsensitive]),

        // Session tokens
        "session": try! NSRegularExpression(pattern: "session[._-]?token['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", options: [.caseInsensitive]),

        // Refresh tokens
        "refresh": try! NSRegularExpression(pattern: "refresh[._-]?token['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", options: [.caseInsensitive]),

        // Access tokens
        "access": try! NSRegularExpression(pattern: "access[._-]?token['\"]?\\s*[:=]\\s*['\"]?([a-zA-Z0-9_-]+)", options: [.caseInsensitive]),
    ]

    /**
     * Sanitize a log message by redacting sensitive information
     * - Parameter message: Log message to sanitize
     * - Returns: Sanitized message with sensitive data redacted
     */
    static func sanitize(_ message: String) -> String {
        var sanitized = message

        for (category, regex) in patterns {
            let range = NSRange(location: 0, length: sanitized.utf16.count)
            let matches = regex.matches(in: sanitized, options: [], range: range)

            // Process matches in reverse order to maintain string indices
            for match in matches.reversed() {
                if let range = Range(match.range, in: sanitized) {
                    let redacted = "[REDACTED:\(category.uppercased())]"
                    sanitized.replaceSubrange(range, with: redacted)
                }
            }
        }

        return sanitized
    }

    /**
     * Sanitize dictionary values (useful for error descriptions)
     * - Parameter dict: Dictionary with potentially sensitive values
     * - Returns: Dictionary with sensitive values redacted
     */
    static func sanitize(_ dict: [String: Any]) -> [String: Any] {
        var sanitized = dict

        for (key, value) in dict {
            if let stringValue = value as? String {
                sanitized[key] = sanitize(stringValue)
            } else if let dictValue = value as? [String: Any] {
                sanitized[key] = sanitize(dictValue)
            } else if let arrayValue = value as? [Any] {
                sanitized[key] = arrayValue.map { item -> Any in
                    if let stringItem = item as? String {
                        return sanitize(stringItem)
                    }
                    return item
                }
            }
        }

        return sanitized
    }

    /**
     * Sanitize an Error for logging
     * - Parameter error: Error to sanitize
     * - Returns: Error description with sensitive data redacted
     */
    static func sanitize(_ error: Error) -> String {
        let description = error.localizedDescription
        return sanitize(description)
    }
}

// MARK: - Safe Console Logging Extension

extension NSLog {
    /**
     * Safe logging that automatically sanitizes messages
     * - Parameters:
     *   - format: Format string
     *   - args: Format arguments
     */
    static func safeLog(_ format: String, _ args: CVarArg...) {
        let sanitized = LogSanitizer.sanitize(format)
        // Use standard NSLog with sanitized format
        var mutableArgs = args
        withVaList(mutableArgs) { NSLogv(sanitized, $0) }
    }
}
