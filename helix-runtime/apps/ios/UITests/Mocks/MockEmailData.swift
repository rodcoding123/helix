import Foundation

/**
 * Mock email data for UI testing
 * Provides sample emails for testing email tab functionality
 */
struct MockEmailData {
    // MARK: - Mock Email Model

    struct Email {
        let id: String
        let subject: String
        let from: String
        let senderName: String
        let preview: String
        let body: String
        let date: Date
        let isRead: Bool
        let hasAttachments: Bool
        let isStarred: Bool
        let threadCount: Int
    }

    // MARK: - Sample Data

    static let sampleEmails: [Email] = [
        Email(
            id: "email_001",
            subject: "Welcome to OpenClaw",
            from: "welcome@openclaw.ai",
            senderName: "OpenClaw Team",
            preview: "Welcome aboard! We're excited to have you join our community...",
            body: """
                Welcome to OpenClaw!

                We're thrilled to have you as part of our growing community of AI enthusiasts.

                In this email, you'll find:
                - Setup instructions
                - Documentation links
                - Community guidelines

                Best regards,
                The OpenClaw Team
                """,
            date: Date().addingTimeInterval(-86400), // 1 day ago
            isRead: true,
            hasAttachments: false,
            isStarred: true,
            threadCount: 1
        ),
        Email(
            id: "email_002",
            subject: "Project Update - January",
            from: "manager@company.com",
            senderName: "Sarah Manager",
            preview: "Here are the key milestones we achieved this month...",
            body: """
                Project Update - January 2026

                Key Achievements:
                - Completed Phase 7 UI testing implementation
                - Integrated security hardening measures
                - Updated documentation for all phases

                Next Steps:
                - Begin Phase 8 preparation
                - Schedule team meetings
                - Review roadmap

                Thanks,
                Sarah
                """,
            date: Date().addingTimeInterval(-172800), // 2 days ago
            isRead: true,
            hasAttachments: true,
            isStarred: false,
            threadCount: 3
        ),
        Email(
            id: "email_003",
            subject: "Meeting Reminder - Tuesday 10 AM",
            from: "calendar@company.com",
            senderName: "Calendar Assistant",
            preview: "Reminder: Team standup meeting tomorrow at 10:00 AM...",
            body: """
                Meeting Reminder

                Event: Weekly Team Standup
                Time: Tuesday, February 4, 2026 at 10:00 AM
                Location: Conference Room B
                Duration: 30 minutes

                Please confirm your attendance.
                """,
            date: Date().addingTimeInterval(-3600), // 1 hour ago
            isRead: false,
            hasAttachments: false,
            isStarred: false,
            threadCount: 1
        ),
        Email(
            id: "email_004",
            subject: "Code Review Request - Feature X",
            from: "dev@company.com",
            senderName: "Alex Developer",
            preview: "I've submitted a PR for the new feature implementation...",
            body: """
                Code Review Request

                Please review PR #1234 for the new feature implementation.

                Changes:
                - Added EmailTabUITests
                - Added CalendarTabUITests
                - Added TasksTabUITests
                - Created UITestUtils helper class

                The tests cover:
                - Navigation between tabs
                - Email composition and sending
                - Calendar event management
                - Task creation and editing

                All tests are passing locally.
                """,
            date: Date().addingTimeInterval(-7200), // 2 hours ago
            isRead: false,
            hasAttachments: true,
            isStarred: false,
            threadCount: 2
        ),
        Email(
            id: "email_005",
            subject: "Newsletter - OpenClaw Updates",
            from: "news@openclaw.ai",
            senderName: "OpenClaw News",
            preview: "Check out the latest features and improvements in this month's update...",
            body: """
                OpenClaw Monthly Newsletter

                Featured Updates:
                - New iOS app with Email, Calendar, Tasks integration
                - Enhanced security with encrypted secrets cache
                - Improved logging with sanitization
                - Updated documentation

                Community Highlights:
                - 1000+ active users
                - 50+ contributed plugins
                - Growing ecosystem

                Stay tuned for more updates!
                """,
            date: Date().addingTimeInterval(-259200), // 3 days ago
            isRead: true,
            hasAttachments: false,
            isStarred: false,
            threadCount: 1
        ),
        Email(
            id: "email_006",
            subject: "Action Required - Account Security",
            from: "security@openclaw.ai",
            senderName: "Security Team",
            preview: "We've detected unusual activity on your account. Please review...",
            body: """
                Account Security Alert

                We detected a login from a new device:
                - Device: iPhone 15 Pro
                - Location: San Francisco, CA
                - Time: February 3, 2026 at 5:30 PM

                If this was you, no action is required.
                If not, please change your password immediately.

                Security Team
                """,
            date: Date().addingTimeInterval(-432000), // 5 days ago
            isRead: true,
            hasAttachments: false,
            isStarred: true,
            threadCount: 1
        ),
    ]

    // MARK: - Sample Email for Compose

    static let composedEmail = Email(
        id: "email_new",
        subject: "Test Email",
        from: "test@example.com",
        senderName: "Test User",
        preview: "This is a test email body",
        body: "This is a test email body",
        date: Date(),
        isRead: false,
        hasAttachments: false,
        isStarred: false,
        threadCount: 1
    )

    // MARK: - Helper Methods

    /**
     * Returns email by ID
     * - Parameters:
     *   - id: Email identifier
     * - Returns: Email if found, nil otherwise
     */
    static func emailByID(_ id: String) -> Email? {
        return sampleEmails.first { $0.id == id }
    }

    /**
     * Returns unread emails only
     * - Returns: Array of unread emails
     */
    static func unreadEmails() -> [Email] {
        return sampleEmails.filter { !$0.isRead }
    }

    /**
     * Returns starred emails only
     * - Returns: Array of starred emails
     */
    static func starredEmails() -> [Email] {
        return sampleEmails.filter { $0.isStarred }
    }

    /**
     * Returns emails from specific sender
     * - Parameters:
     *   - sender: Sender email address
     * - Returns: Array of emails from sender
     */
    static func emailsFromSender(_ sender: String) -> [Email] {
        return sampleEmails.filter { $0.from.lowercased().contains(sender.lowercased()) }
    }

    /**
     * Returns emails matching search query
     * - Parameters:
     *   - query: Search text
     * - Returns: Array of matching emails
     */
    static func searchEmails(query: String) -> [Email] {
        let lowercaseQuery = query.lowercased()
        return sampleEmails.filter {
            $0.subject.lowercased().contains(lowercaseQuery) ||
            $0.from.lowercased().contains(lowercaseQuery) ||
            $0.preview.lowercased().contains(lowercaseQuery)
        }
    }

    /**
     * Returns emails sorted by date (newest first)
     * - Returns: Sorted array of emails
     */
    static func emailsSortedByDate() -> [Email] {
        return sampleEmails.sorted { $0.date > $1.date }
    }

    /**
     * Returns emails with attachments
     * - Returns: Array of emails with attachments
     */
    static func emailsWithAttachments() -> [Email] {
        return sampleEmails.filter { $0.hasAttachments }
    }
}

// MARK: - Extension for Testing

extension MockEmailData.Email: Identifiable {}
