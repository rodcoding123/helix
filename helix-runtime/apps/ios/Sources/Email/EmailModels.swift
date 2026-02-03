import Foundation

/// Represents an email message
struct Email: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let userId: String
    let from: EmailAddress
    let to: [EmailAddress]
    let cc: [EmailAddress]?
    let bcc: [EmailAddress]?
    let subject: String
    let body: String
    let htmlBody: String?
    let isRead: Bool
    let isStarred: Bool
    let threadId: String
    let messageId: String?
    let inReplyTo: String?
    let labels: [String]
    let attachmentCount: Int
    let timestamp: Date
    let receivedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, userId, from, to, cc, bcc, subject, body, htmlBody
        case isRead = "is_read"
        case isStarred = "is_starred"
        case threadId = "thread_id"
        case messageId = "message_id"
        case inReplyTo = "in_reply_to"
        case labels
        case attachmentCount = "attachment_count"
        case timestamp
        case receivedAt = "received_at"
    }
}

/// Email address with name and email
struct EmailAddress: Codable, Equatable, Hashable {
    let name: String?
    let email: String

    var displayName: String {
        name ?? email
    }
}

/// Draft email being composed
struct EmailDraft: Identifiable, Codable, Equatable {
    var id: String = UUID().uuidString
    var to: [EmailAddress] = []
    var cc: [EmailAddress] = []
    var bcc: [EmailAddress] = []
    var subject: String = ""
    var body: String = ""
    var inReplyTo: String?
    var attachments: [EmailAttachment] = []
    var timestamp: Date = Date()
}

/// Email attachment
struct EmailAttachment: Identifiable, Codable, Equatable {
    let id: String
    let filename: String
    let mimeType: String
    let size: Int
    let url: URL?
}

/// Email search filter options
struct EmailSearchFilter: Codable, Equatable {
    var query: String = ""
    var from: String?
    var to: String?
    var subject: String?
    var label: String?
    var isRead: Bool?
    var isStarred: Bool?
    var startDate: Date?
    var endDate: Date?
    var hasAttachments: Bool?

    var isEmpty: Bool {
        query.isEmpty && from == nil && to == nil && subject == nil && label == nil &&
            isRead == nil && isStarred == nil && startDate == nil && endDate == nil && hasAttachments == nil
    }
}

/// Email analytics statistics
struct EmailAnalytics: Codable, Equatable {
    let totalEmails: Int
    let unreadCount: Int
    let starredCount: Int
    let spamCount: Int
    let draftCount: Int
    let storageUsedBytes: Int
    let storageQuotaBytes: Int
    let mostActiveSenders: [EmailSenderStats]
    let emailFrequencyByDay: [EmailFrequencyData]

    enum CodingKeys: String, CodingKey {
        case totalEmails = "total_emails"
        case unreadCount = "unread_count"
        case starredCount = "starred_count"
        case spamCount = "spam_count"
        case draftCount = "draft_count"
        case storageUsedBytes = "storage_used_bytes"
        case storageQuotaBytes = "storage_quota_bytes"
        case mostActiveSenders = "most_active_senders"
        case emailFrequencyByDay = "email_frequency_by_day"
    }
}

/// Statistics about email senders
struct EmailSenderStats: Codable, Equatable {
    let email: String
    let displayName: String?
    let messageCount: Int
    let lastMessageDate: Date

    enum CodingKeys: String, CodingKey {
        case email
        case displayName = "display_name"
        case messageCount = "message_count"
        case lastMessageDate = "last_message_date"
    }
}

/// Email frequency data point
struct EmailFrequencyData: Codable, Equatable {
    let date: Date
    let count: Int
}

/// Pagination info for email lists
struct EmailPaginationInfo: Codable, Equatable {
    let totalCount: Int
    let pageSize: Int
    let pageNumber: Int
    let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case totalCount = "total_count"
        case pageSize = "page_size"
        case pageNumber = "page_number"
        case hasMore = "has_more"
    }
}
