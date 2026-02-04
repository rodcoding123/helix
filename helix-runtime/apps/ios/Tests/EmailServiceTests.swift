import XCTest
@testable import OpenClaw

final class EmailServiceTests: XCTestCase {
    var mockGateway: MockGatewaySession!
    var emailService: EmailService!

    override func setUp() {
        super.setUp()
        mockGateway = MockGatewaySession()
        emailService = EmailService(gateway: mockGateway)
    }

    override func tearDown() {
        mockGateway.clearMocks()
        mockGateway.clearHistory()
        super.tearDown()
    }

    // MARK: - Fetch Emails Tests

    func testFetchEmailsSuccess() async throws {
        // Given: Mock response with valid email data
        let mockEmails: [[String: Any]] = [
            [
                "id": "email1",
                "userId": "user1",
                "from": ["email": "sender@example.com", "name": "Sender"],
                "to": [["email": "recipient@example.com", "name": "Recipient"]],
                "cc": [],
                "bcc": [],
                "subject": "Test Subject",
                "body": "Test Body",
                "htmlBody": nil,
                "is_read": false,
                "is_starred": false,
                "thread_id": "thread1",
                "message_id": nil,
                "in_reply_to": nil,
                "labels": [],
                "attachment_count": 0,
                "timestamp": "2024-02-03T10:00:00Z",
                "received_at": "2024-02-03T10:00:00Z"
            ]
        ]

        mockGateway.mockResponses["email.list"] = [
            "emails": mockEmails,
            "pagination": [
                "total_count": 1,
                "page_size": 20,
                "page_number": 0,
                "has_more": false
            ]
        ]

        // When: Fetch emails
        let (emails, pagination) = try await emailService.fetchEmails(limit: 20, skip: 0)

        // Then: Verify results
        XCTAssertEqual(emails.count, 1)
        XCTAssertEqual(emails[0].id, "email1")
        XCTAssertEqual(emails[0].subject, "Test Subject")
        XCTAssertFalse(pagination.hasMore)
        XCTAssertEqual(pagination.totalCount, 1)
    }

    func testFetchEmailsWithPagination() async throws {
        // Given: Mock response with pagination
        mockGateway.mockResponses["email.list"] = [
            "emails": [],
            "pagination": [
                "total_count": 100,
                "page_size": 20,
                "page_number": 1,
                "has_more": true
            ]
        ]

        // When: Fetch emails with pagination parameters
        let (_, pagination) = try await emailService.fetchEmails(limit: 20, skip: 20)

        // Then: Verify pagination info
        XCTAssertTrue(pagination.hasMore)
        XCTAssertEqual(pagination.totalCount, 100)
        XCTAssertEqual(pagination.pageSize, 20)
    }

    func testFetchEmailsNetworkError() async throws {
        // Given: Mock network error
        mockGateway.mockErrors["email.list"] = MockGatewayError.networkUnavailable

        // When/Then: Expect error to be thrown
        do {
            _ = try await emailService.fetchEmails()
            XCTFail("Expected networkUnavailable error")
        } catch {
            // Expected
        }
    }

    func testFetchEmailsMethodCalled() async throws {
        // Given: Valid mock response
        mockGateway.mockResponses["email.list"] = [
            "emails": [],
            "pagination": [
                "total_count": 0,
                "page_size": 20,
                "page_number": 0,
                "has_more": false
            ]
        ]

        // When: Fetch emails
        _ = try await emailService.fetchEmails(limit: 30, skip: 10)

        // Then: Verify method was called with correct parameters
        XCTAssertTrue(mockGateway.wasCalled("email.list"))
        let requests = mockGateway.requestsFor("email.list")
        XCTAssertEqual(requests.count, 1)
    }

    // MARK: - Get Email Tests

    func testGetEmailSuccess() async throws {
        // Given: Mock single email response
        mockGateway.mockResponses["email.get"] = [
            "id": "email1",
            "userId": "user1",
            "from": ["email": "sender@example.com", "name": "Sender"],
            "to": [["email": "recipient@example.com"]],
            "cc": [],
            "bcc": [],
            "subject": "Test Subject",
            "body": "Full Email Body",
            "htmlBody": "<p>Full Email Body</p>",
            "is_read": true,
            "is_starred": false,
            "thread_id": "thread1",
            "message_id": "msg1",
            "in_reply_to": nil,
            "labels": ["important"],
            "attachment_count": 2,
            "timestamp": "2024-02-03T10:00:00Z",
            "received_at": "2024-02-03T10:00:00Z"
        ]

        // When: Get specific email
        let email = try await emailService.getEmail("email1")

        // Then: Verify email details
        XCTAssertEqual(email.id, "email1")
        XCTAssertEqual(email.subject, "Test Subject")
        XCTAssertEqual(email.body, "Full Email Body")
        XCTAssertTrue(email.isRead)
        XCTAssertEqual(email.attachmentCount, 2)
    }

    // MARK: - Search Emails Tests

    func testSearchEmailsByQuery() async throws {
        // Given: Mock search response
        mockGateway.mockResponses["email.search"] = [
            "results": [
                [
                    "id": "email1",
                    "userId": "user1",
                    "from": ["email": "sender@example.com"],
                    "to": [],
                    "cc": [],
                    "bcc": [],
                    "subject": "Important Meeting",
                    "body": "Let's discuss the quarterly results",
                    "htmlBody": nil,
                    "is_read": false,
                    "is_starred": false,
                    "thread_id": "thread1",
                    "message_id": nil,
                    "in_reply_to": nil,
                    "labels": [],
                    "attachment_count": 1,
                    "timestamp": "2024-02-03T10:00:00Z",
                    "received_at": "2024-02-03T10:00:00Z"
                ]
            ]
        ]

        // When: Search emails
        let filter = EmailSearchFilter(query: "quarterly")
        let results = try await emailService.searchEmails(filter: filter)

        // Then: Verify search results
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results[0].subject, "Important Meeting")
    }

    // MARK: - Mark As Read Tests

    func testMarkEmailAsRead() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.mark_read"] = ["success": true]

        // When: Mark email as read
        try await emailService.markAsRead("email1", isRead: true)

        // Then: Verify method was called
        XCTAssertTrue(mockGateway.wasCalled("email.mark_read"))
    }

    func testMarkEmailAsUnread() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.mark_read"] = ["success": true]

        // When: Mark email as unread
        try await emailService.markAsRead("email1", isRead: false)

        // Then: Verify method was called with correct parameters
        let requests = mockGateway.requestsFor("email.mark_read")
        XCTAssertEqual(requests.count, 1)
    }

    // MARK: - Mark As Starred Tests

    func testMarkEmailAsStarred() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.mark_starred"] = ["success": true]

        // When: Mark email as starred
        try await emailService.markAsStarred("email1", isStarred: true)

        // Then: Verify method was called
        XCTAssertTrue(mockGateway.wasCalled("email.mark_starred"))
    }

    // MARK: - Label Operations Tests

    func testAddLabelToEmail() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.add_label"] = ["success": true]

        // When: Add label
        try await emailService.addLabel("email1", label: "important")

        // Then: Verify method was called
        XCTAssertTrue(mockGateway.wasCalled("email.add_label"))
    }

    func testRemoveLabelFromEmail() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.remove_label"] = ["success": true]

        // When: Remove label
        try await emailService.removeLabel("email1", label: "important")

        // Then: Verify method was called
        XCTAssertTrue(mockGateway.wasCalled("email.remove_label"))
    }

    // MARK: - Delete Email Tests

    func testSoftDeleteEmail() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.delete"] = ["success": true]

        // When: Soft delete email
        try await emailService.deleteEmail("email1")

        // Then: Verify method was called
        XCTAssertTrue(mockGateway.wasCalled("email.delete"))
    }

    func testPermanentlyDeleteEmail() async throws {
        // Given: Mock success response
        mockGateway.mockResponses["email.delete_permanent"] = ["success": true]

        // When: Permanently delete email
        try await emailService.deleteEmailPermanently("email1")

        // Then: Verify method was called
        XCTAssertTrue(mockGateway.wasCalled("email.delete_permanent"))
    }

    // MARK: - Send Email Tests

    func testSendEmailSuccess() async throws {
        // Given: Mock email response
        mockGateway.mockResponses["email.send"] = [
            "id": "email1",
            "userId": "user1",
            "from": ["email": "me@example.com"],
            "to": [["email": "recipient@example.com"]],
            "cc": [],
            "bcc": [],
            "subject": "Test",
            "body": "Body",
            "htmlBody": nil,
            "is_read": false,
            "is_starred": false,
            "thread_id": "thread1",
            "message_id": nil,
            "in_reply_to": nil,
            "labels": [],
            "attachment_count": 0,
            "timestamp": "2024-02-03T10:00:00Z",
            "received_at": "2024-02-03T10:00:00Z"
        ]

        // When: Send email
        let draft = EmailDraft(
            to: [EmailAddress(name: "Recipient", email: "recipient@example.com")],
            subject: "Test",
            body: "Body"
        )
        let sentEmail = try await emailService.sendEmail(draft)

        // Then: Verify email was sent
        XCTAssertEqual(sentEmail.id, "email1")
        XCTAssertTrue(mockGateway.wasCalled("email.send"))
    }

    func testSendEmailNetworkError() async throws {
        // Given: Mock network error
        mockGateway.mockErrors["email.send"] = MockGatewayError.networkUnavailable

        // When/Then: Expect error
        let draft = EmailDraft(
            to: [EmailAddress(name: "Recipient", email: "recipient@example.com")],
            subject: "Test",
            body: "Body"
        )

        do {
            _ = try await emailService.sendEmail(draft)
            XCTFail("Expected error")
        } catch {
            // Expected
        }
    }

    // MARK: - Save Draft Tests

    func testSaveDraftSuccess() async throws {
        // Given: Mock draft ID response
        mockGateway.mockResponses["email.save_draft"] = "draft123"

        // When: Save draft
        let draft = EmailDraft(
            to: [EmailAddress(email: "recipient@example.com")],
            subject: "Draft",
            body: "Draft body"
        )
        let draftId = try await emailService.saveDraft(draft)

        // Then: Verify draft was saved
        XCTAssertEqual(draftId, "draft123")
        XCTAssertTrue(mockGateway.wasCalled("email.save_draft"))
    }

    // MARK: - Analytics Tests

    func testGetAnalyticsSuccess() async throws {
        // Given: Mock analytics response
        mockGateway.mockResponses["email.analytics"] = [
            "total_emails": 150,
            "unread_count": 5,
            "starred_count": 10,
            "spam_count": 2,
            "draft_count": 3,
            "storage_used_bytes": 1000000,
            "storage_quota_bytes": 5000000,
            "most_active_senders": [],
            "email_frequency_by_day": []
        ]

        // When: Get analytics
        let analytics = try await emailService.getAnalytics()

        // Then: Verify analytics data
        XCTAssertEqual(analytics.totalEmails, 150)
        XCTAssertEqual(analytics.unreadCount, 5)
        XCTAssertEqual(analytics.starredCount, 10)
    }

    // MARK: - Thread Operations Tests

    func testGetThreadSuccess() async throws {
        // Given: Mock thread response
        mockGateway.mockResponses["email.thread"] = [
            "emails": [
                [
                    "id": "email1",
                    "userId": "user1",
                    "from": ["email": "sender@example.com"],
                    "to": [],
                    "cc": [],
                    "bcc": [],
                    "subject": "RE: Discussion",
                    "body": "Response",
                    "htmlBody": nil,
                    "is_read": false,
                    "is_starred": false,
                    "thread_id": "thread1",
                    "message_id": nil,
                    "in_reply_to": "msg0",
                    "labels": [],
                    "attachment_count": 0,
                    "timestamp": "2024-02-03T11:00:00Z",
                    "received_at": "2024-02-03T11:00:00Z"
                ]
            ]
        ]

        // When: Get thread
        let threadEmails = try await emailService.getThread("thread1")

        // Then: Verify thread emails
        XCTAssertEqual(threadEmails.count, 1)
        XCTAssertEqual(threadEmails[0].inReplyTo, "msg0")
    }

    // MARK: - Concurrent Request Tests

    func testConcurrentEmailRequests() async throws {
        // Given: Mock responses for multiple concurrent requests
        mockGateway.mockResponses["email.list"] = [
            "emails": [],
            "pagination": [
                "total_count": 0,
                "page_size": 20,
                "page_number": 0,
                "has_more": false
            ]
        ]
        mockGateway.mockResponses["email.analytics"] = [
            "total_emails": 0,
            "unread_count": 0,
            "starred_count": 0,
            "spam_count": 0,
            "draft_count": 0,
            "storage_used_bytes": 0,
            "storage_quota_bytes": 0,
            "most_active_senders": [],
            "email_frequency_by_day": []
        ]

        // When: Make concurrent requests
        async let emailsResult = emailService.fetchEmails()
        async let analyticsResult = emailService.getAnalytics()

        let (emails, _) = try await emailsResult
        let analytics = try await analyticsResult

        // Then: Verify both completed successfully
        XCTAssertEqual(emails.count, 0)
        XCTAssertEqual(analytics.totalEmails, 0)
    }
}
