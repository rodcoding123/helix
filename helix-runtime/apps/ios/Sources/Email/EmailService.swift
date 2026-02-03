import Foundation

/// Service for communicating with email functionality via gateway
class EmailService {
    private let gateway: GatewaySession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(gateway: GatewaySession) {
        self.gateway = gateway
        decoder.dateDecodingStrategy = .iso8601
        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Email Fetching

    /// Fetch paginated list of emails
    func fetchEmails(limit: Int = 20, skip: Int = 0) async throws -> (emails: [Email], pagination: EmailPaginationInfo) {
        let response = try await gateway.request(
            "email.list",
            params: [
                "limit": limit,
                "skip": skip
            ]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(EmailListResponse.self, from: data)

        return (result.emails, result.pagination)
    }

    /// Get a specific email with full content
    func getEmail(_ id: String) async throws -> Email {
        let response = try await gateway.request(
            "email.get",
            params: ["id": id]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(Email.self, from: data)
    }

    // MARK: - Email Search

    /// Search emails with filters
    func searchEmails(filter: EmailSearchFilter, limit: Int = 20) async throws -> [Email] {
        var params: [String: Any] = ["limit": limit]

        if !filter.query.isEmpty {
            params["query"] = filter.query
        }
        if let from = filter.from {
            params["from"] = from
        }
        if let to = filter.to {
            params["to"] = to
        }
        if let subject = filter.subject {
            params["subject"] = subject
        }
        if let label = filter.label {
            params["label"] = label
        }
        if let isRead = filter.isRead {
            params["is_read"] = isRead
        }
        if let isStarred = filter.isStarred {
            params["is_starred"] = isStarred
        }
        if let startDate = filter.startDate {
            params["start_date"] = ISO8601DateFormatter().string(from: startDate)
        }
        if let endDate = filter.endDate {
            params["end_date"] = ISO8601DateFormatter().string(from: endDate)
        }
        if let hasAttachments = filter.hasAttachments {
            params["has_attachments"] = hasAttachments
        }

        let response = try await gateway.request("email.search", params: params)

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(EmailSearchResponse.self, from: data)

        return result.results
    }

    // MARK: - Email Actions

    /// Mark email as read or unread
    func markAsRead(_ id: String, isRead: Bool) async throws {
        _ = try await gateway.request(
            "email.mark_read",
            params: [
                "id": id,
                "is_read": isRead
            ]
        )
    }

    /// Mark email as starred or unstarred
    func markAsStarred(_ id: String, isStarred: Bool) async throws {
        _ = try await gateway.request(
            "email.mark_starred",
            params: [
                "id": id,
                "is_starred": isStarred
            ]
        )
    }

    /// Add label to email
    func addLabel(_ emailId: String, label: String) async throws {
        _ = try await gateway.request(
            "email.add_label",
            params: [
                "email_id": emailId,
                "label": label
            ]
        )
    }

    /// Remove label from email
    func removeLabel(_ emailId: String, label: String) async throws {
        _ = try await gateway.request(
            "email.remove_label",
            params: [
                "email_id": emailId,
                "label": label
            ]
        )
    }

    /// Delete email (soft delete)
    func deleteEmail(_ id: String) async throws {
        _ = try await gateway.request(
            "email.delete",
            params: ["id": id]
        )
    }

    /// Permanently delete email
    func deleteEmailPermanently(_ id: String) async throws {
        _ = try await gateway.request(
            "email.delete_permanent",
            params: ["id": id]
        )
    }

    // MARK: - Compose & Send

    /// Send a new email
    func sendEmail(_ draft: EmailDraft) async throws -> Email {
        var params: [String: Any] = [
            "to": draft.to.map { ["email": $0.email, "name": $0.name as Any] },
            "subject": draft.subject,
            "body": draft.body
        ]

        if !draft.cc.isEmpty {
            params["cc"] = draft.cc.map { ["email": $0.email, "name": $0.name as Any] }
        }

        if !draft.bcc.isEmpty {
            params["bcc"] = draft.bcc.map { ["email": $0.email, "name": $0.name as Any] }
        }

        if let inReplyTo = draft.inReplyTo {
            params["in_reply_to"] = inReplyTo
        }

        let response = try await gateway.request("email.send", params: params)

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(Email.self, from: data)
    }

    /// Save draft
    func saveDraft(_ draft: EmailDraft) async throws -> String {
        var params: [String: Any] = [
            "to": draft.to.map { ["email": $0.email, "name": $0.name as Any] },
            "subject": draft.subject,
            "body": draft.body
        ]

        if !draft.cc.isEmpty {
            params["cc"] = draft.cc.map { ["email": $0.email, "name": $0.name as Any] }
        }

        if !draft.bcc.isEmpty {
            params["bcc"] = draft.bcc.map { ["email": $0.email, "name": $0.name as Any] }
        }

        let response = try await gateway.request("email.save_draft", params: params)

        guard let draftId = response as? String else {
            throw EmailError.decodingError("Invalid draft ID response")
        }

        return draftId
    }

    // MARK: - Analytics

    /// Get email analytics
    func getAnalytics() async throws -> EmailAnalytics {
        let response = try await gateway.request("email.analytics", params: [:])

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        return try decoder.decode(EmailAnalytics.self, from: data)
    }

    /// Get email statistics for date range
    func getStatistics(startDate: Date, endDate: Date) async throws -> [EmailFrequencyData] {
        let formatter = ISO8601DateFormatter()
        let response = try await gateway.request(
            "email.statistics",
            params: [
                "start_date": formatter.string(from: startDate),
                "end_date": formatter.string(from: endDate)
            ]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(EmailStatisticsResponse.self, from: data)

        return result.data
    }

    // MARK: - Attachments

    /// Get attachment download URL
    func getAttachmentUrl(_ emailId: String, attachmentId: String) async throws -> URL {
        let response = try await gateway.request(
            "email.attachment_url",
            params: [
                "email_id": emailId,
                "attachment_id": attachmentId
            ]
        )

        guard let urlString = response as? String, let url = URL(string: urlString) else {
            throw EmailError.decodingError("Invalid attachment URL")
        }

        return url
    }

    // MARK: - Thread Operations

    /// Get all emails in a thread
    func getThread(_ threadId: String) async throws -> [Email] {
        let response = try await gateway.request(
            "email.thread",
            params: ["thread_id": threadId]
        )

        let data = try JSONSerialization.data(withJSONObject: response, options: [])
        let result = try decoder.decode(EmailThreadResponse.self, from: data)

        return result.emails
    }
}

// MARK: - Response Types

private struct EmailListResponse: Codable {
    let emails: [Email]
    let pagination: EmailPaginationInfo
}

private struct EmailSearchResponse: Codable {
    let results: [Email]
}

private struct EmailStatisticsResponse: Codable {
    let data: [EmailFrequencyData]
}

private struct EmailThreadResponse: Codable {
    let emails: [Email]
}
