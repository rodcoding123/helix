import Foundation
import Observation

/// Main state store for email functionality
@Observable
final class EmailStore {
    // MARK: - Main Properties

    var emails: [Email] = []
    var selectedEmail: Email?
    var isLoading = false
    var error: EmailError?
    var searchQuery = ""
    var currentFilter: EmailSearchFilter = EmailSearchFilter()

    // MARK: - Composition State

    var draft: EmailDraft?
    var isComposing = false

    // MARK: - Pagination

    var currentPage = 0
    var pageSize = 20
    var hasMoreEmails = true
    var pagination: EmailPaginationInfo?

    // MARK: - Analytics

    var analytics: EmailAnalytics?
    var isLoadingAnalytics = false

    // MARK: - Search State

    var searchResults: [Email] = []
    var isSearching = false
    var savedSearches: [String] = []

    // MARK: - Service

    private let service: EmailService

    // MARK: - Initialization

    init(service: EmailService) {
        self.service = service
    }

    // MARK: - Email Loading

    func loadEmails(page: Int = 0) async {
        isLoading = true
        error = nil

        do {
            let result = try await service.fetchEmails(limit: pageSize, skip: page * pageSize)
            emails = result.emails
            pagination = result.pagination
            currentPage = page
            hasMoreEmails = result.pagination.hasMore
        } catch {
            self.error = EmailError.loadFailed(error.localizedDescription)
        }

        isLoading = false
    }

    func loadMoreEmails() async {
        guard hasMoreEmails, !isLoading else { return }

        do {
            let result = try await service.fetchEmails(
                limit: pageSize,
                skip: (currentPage + 1) * pageSize
            )
            emails.append(contentsOf: result.emails)
            pagination = result.pagination
            currentPage += 1
            hasMoreEmails = result.pagination.hasMore
        } catch {
            self.error = EmailError.loadFailed(error.localizedDescription)
        }
    }

    // MARK: - Email Actions

    func selectEmail(_ email: Email) {
        selectedEmail = email
        Task {
            await markAsRead(email)
        }
    }

    func markAsRead(_ email: Email) async {
        do {
            try await service.markAsRead(email.id, isRead: true)
            if let index = emails.firstIndex(where: { $0.id == email.id }) {
                emails[index] = Email(
                    id: email.id,
                    userId: email.userId,
                    from: email.from,
                    to: email.to,
                    cc: email.cc,
                    bcc: email.bcc,
                    subject: email.subject,
                    body: email.body,
                    htmlBody: email.htmlBody,
                    isRead: true,
                    isStarred: email.isStarred,
                    threadId: email.threadId,
                    messageId: email.messageId,
                    inReplyTo: email.inReplyTo,
                    labels: email.labels,
                    attachmentCount: email.attachmentCount,
                    timestamp: email.timestamp,
                    receivedAt: email.receivedAt
                )
            }
        } catch {
            self.error = EmailError.markFailed(error.localizedDescription)
        }
    }

    func toggleStar(_ email: Email) async {
        do {
            try await service.markAsStarred(email.id, isStarred: !email.isStarred)
            if let index = emails.firstIndex(where: { $0.id == email.id }) {
                emails[index] = Email(
                    id: email.id,
                    userId: email.userId,
                    from: email.from,
                    to: email.to,
                    cc: email.cc,
                    bcc: email.bcc,
                    subject: email.subject,
                    body: email.body,
                    htmlBody: email.htmlBody,
                    isRead: email.isRead,
                    isStarred: !email.isStarred,
                    threadId: email.threadId,
                    messageId: email.messageId,
                    inReplyTo: email.inReplyTo,
                    labels: email.labels,
                    attachmentCount: email.attachmentCount,
                    timestamp: email.timestamp,
                    receivedAt: email.receivedAt
                )
            }
        } catch {
            self.error = EmailError.updateFailed(error.localizedDescription)
        }
    }

    func deleteEmail(_ email: Email) async {
        do {
            try await service.deleteEmail(email.id)
            emails.removeAll { $0.id == email.id }
            if selectedEmail?.id == email.id {
                selectedEmail = nil
            }
        } catch {
            self.error = EmailError.deleteFailed(error.localizedDescription)
        }
    }

    // MARK: - Search

    func search(filter: EmailSearchFilter) async {
        guard !filter.isEmpty else {
            searchResults = []
            return
        }

        isSearching = true
        error = nil

        do {
            let results = try await service.searchEmails(filter: filter, limit: pageSize)
            searchResults = results
        } catch {
            self.error = EmailError.searchFailed(error.localizedDescription)
        }

        isSearching = false
    }

    func saveSearch(_ query: String) {
        guard !query.isEmpty && !savedSearches.contains(query) else { return }
        savedSearches.insert(query, at: 0)
        if savedSearches.count > 10 {
            savedSearches.removeLast()
        }
    }

    // MARK: - Compose

    func startComposing(replyTo email: Email? = nil) {
        var newDraft = EmailDraft()
        if let email = email {
            newDraft.inReplyTo = email.id
            newDraft.to = [email.from]
            newDraft.subject = email.subject.hasPrefix("Re: ") ? email.subject : "Re: \(email.subject)"
        }
        draft = newDraft
        isComposing = true
    }

    func cancelComposing() {
        draft = nil
        isComposing = false
    }

    func sendEmail(_ draft: EmailDraft) async {
        do {
            _ = try await service.sendEmail(draft)
            self.draft = nil
            isComposing = false
            await loadEmails()
        } catch {
            self.error = EmailError.sendFailed(error.localizedDescription)
        }
    }

    // MARK: - Analytics

    func loadAnalytics() async {
        isLoadingAnalytics = true
        error = nil

        do {
            analytics = try await service.getAnalytics()
        } catch {
            self.error = EmailError.analyticsFailed(error.localizedDescription)
        }

        isLoadingAnalytics = false
    }

    // MARK: - Refresh

    func refresh() async {
        currentPage = 0
        hasMoreEmails = true
        await loadEmails()
    }
}

// MARK: - Error Types

enum EmailError: LocalizedError {
    case loadFailed(String)
    case markFailed(String)
    case updateFailed(String)
    case deleteFailed(String)
    case searchFailed(String)
    case sendFailed(String)
    case analyticsFailed(String)
    case networkError(String)
    case decodingError(String)

    var errorDescription: String? {
        switch self {
        case .loadFailed(let msg):
            return "Failed to load emails: \(msg)"
        case .markFailed(let msg):
            return "Failed to update email: \(msg)"
        case .updateFailed(let msg):
            return "Failed to update email: \(msg)"
        case .deleteFailed(let msg):
            return "Failed to delete email: \(msg)"
        case .searchFailed(let msg):
            return "Search failed: \(msg)"
        case .sendFailed(let msg):
            return "Failed to send email: \(msg)"
        case .analyticsFailed(let msg):
            return "Failed to load analytics: \(msg)"
        case .networkError(let msg):
            return "Network error: \(msg)"
        case .decodingError(let msg):
            return "Decoding error: \(msg)"
        }
    }
}
