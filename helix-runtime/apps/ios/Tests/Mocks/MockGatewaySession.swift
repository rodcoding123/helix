import Foundation

/// Mock implementation of GatewaySession for testing
class MockGatewaySession {
    /// Dictionary of method names to mock responses
    var mockResponses: [String: Any] = [:]

    /// Dictionary of method names to errors to throw
    var mockErrors: [String: Error] = [:]

    /// History of all requests made
    private(set) var requestHistory: [(method: String, params: [String: Any])] = []

    /// Request a method from the gateway
    /// - Parameters:
    ///   - method: The RPC method name
    ///   - params: The parameters to send
    /// - Returns: The mocked response
    /// - Throws: Any mocked error if one is set for this method
    func request(_ method: String, params: [String: Any]) async throws -> Any {
        requestHistory.append((method, params))

        // Check if this method has a mocked error
        if let error = mockErrors[method] {
            throw error
        }

        // Return the mocked response
        guard let response = mockResponses[method] else {
            throw MockGatewayError.methodNotFound(method)
        }

        return response
    }

    /// Clear all request history
    func clearHistory() {
        requestHistory.removeAll()
    }

    /// Clear all mocked responses and errors
    func clearMocks() {
        mockResponses.removeAll()
        mockErrors.removeAll()
    }

    /// Get requests made for a specific method
    /// - Parameter method: The method name to filter by
    /// - Returns: Array of request tuples for that method
    func requestsFor(_ method: String) -> [(method: String, params: [String: Any])] {
        return requestHistory.filter { $0.method == method }
    }

    /// Verify a method was called with specific parameters
    /// - Parameters:
    ///   - method: The method name
    ///   - params: The expected parameters
    /// - Returns: True if the method was called with those parameters
    func wasCalledWith(_ method: String, params: [String: Any]) -> Bool {
        return requestHistory.contains { req in
            req.method == method && req.params == params
        }
    }

    /// Verify a method was called at least once
    /// - Parameter method: The method name
    /// - Returns: True if the method was called
    func wasCalled(_ method: String) -> Bool {
        return requestHistory.contains { $0.method == method }
    }
}

// MARK: - Mock Errors

enum MockGatewayError: Error {
    case methodNotFound(String)
    case networkUnavailable
    case invalidResponse
    case timeout
    case unauthorized
    case rateLimited
}

// MARK: - Equatable for params comparison

extension Dictionary where Key == String, Value == Any {
    static func == (lhs: [String: Any], rhs: [String: Any]) -> Bool {
        if lhs.count != rhs.count {
            return false
        }
        for (key, lhsValue) in lhs {
            guard let rhsValue = rhs[key] else {
                return false
            }
            // Simple comparison for common types
            if let lhsInt = lhsValue as? Int, let rhsInt = rhsValue as? Int {
                if lhsInt != rhsInt { return false }
            } else if let lhsStr = lhsValue as? String, let rhsStr = rhsValue as? String {
                if lhsStr != rhsStr { return false }
            } else if let lhsBool = lhsValue as? Bool, let rhsBool = rhsValue as? Bool {
                if lhsBool != rhsBool { return false }
            } else {
                // For other types, do string comparison as fallback
                if "\(lhsValue)" != "\(rhsValue)" { return false }
            }
        }
        return true
    }
}
