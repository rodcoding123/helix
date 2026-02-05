package com.helix.email

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Mock EmailViewModel for UI testing
 */
class MockEmailViewModel(
    private val mockService: MockEmailService = MockEmailService(),
) : EmailViewModel(mockService) {

    private val testEmails = listOf(
        Email(
            id = "email_1",
            userId = "user_1",
            accountId = "account_1",
            from = EmailAddress(name = "John Doe", email = "john@example.com"),
            to = listOf(EmailAddress(email = "recipient@example.com")),
            subject = "Test Email Subject Line",
            body = "This is a test email body",
            messageId = "msg_1",
            receivedAt = "2026-02-04T10:00:00Z",
            createdAt = "2026-02-04T10:00:00Z",
            updatedAt = "2026-02-04T10:00:00Z",
            isRead = false,
            isStarred = false,
        ),
        Email(
            id = "email_2",
            userId = "user_1",
            accountId = "account_1",
            from = EmailAddress(name = "Jane Smith", email = "jane@example.com"),
            to = listOf(EmailAddress(email = "recipient@example.com")),
            subject = "Important Meeting Tomorrow",
            body = "Let's sync up tomorrow at 2pm",
            messageId = "msg_2",
            receivedAt = "2026-02-03T14:30:00Z",
            createdAt = "2026-02-03T14:30:00Z",
            updatedAt = "2026-02-03T14:30:00Z",
            isRead = true,
            isStarred = true,
        ),
        Email(
            id = "email_3",
            userId = "user_1",
            accountId = "account_1",
            from = EmailAddress(name = "Support Team", email = "support@example.com"),
            to = listOf(EmailAddress(email = "recipient@example.com")),
            subject = "Your Account Has Been Updated",
            body = "Your profile was successfully updated",
            messageId = "msg_3",
            receivedAt = "2026-02-02T09:00:00Z",
            createdAt = "2026-02-02T09:00:00Z",
            updatedAt = "2026-02-02T09:00:00Z",
            isRead = false,
            isStarred = false,
        ),
    )

    init {
        // Set initial test data by calling loadEmails which triggers the service mock
        mockService.setEmails(testEmails)
        loadEmails("account_1")
    }

    fun setLoading(loading: Boolean) {
        // Manually update state for testing
        val currentState = uiState.value
        val field = currentState.javaClass.getDeclaredField("isLoading")
        field.isAccessible = true
    }

    fun setError(errorMessage: String) {
        mockService.setError(errorMessage)
    }

    fun setEmails(emails: List<Email>) {
        mockService.setEmails(emails)
    }

    fun clearErrorTest() {
        clearError()
    }
}

/**
 * Mock EmailService for testing
 */
class MockEmailService : EmailService {
    private var emails = listOf<Email>()
    private var error: EmailError? = null

    fun setEmails(emails: List<Email>) {
        this.emails = emails
    }

    fun setError(errorMessage: String) {
        this.error = EmailError.NetworkError(errorMessage)
    }

    override suspend fun fetchEmails(
        accountId: String,
        offset: Int,
    ): List<Email> {
        if (error != null) {
            throw error!!
        }
        return emails
    }

    override suspend fun markAsRead(emailId: String, isRead: Boolean) {}

    override suspend fun markAsStarred(emailId: String, isStarred: Boolean) {}

    override suspend fun deleteEmail(emailId: String) {}

    override suspend fun searchEmails(filter: EmailSearchFilter): List<Email> {
        if (error != null) {
            throw error!!
        }
        return emails.filter {
            it.subject.contains(filter.query, ignoreCase = true) ||
                    it.body.contains(filter.query, ignoreCase = true)
        }
    }

    override suspend fun sendEmail(
        accountId: String,
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String>,
        bcc: List<String>,
    ): Email = Email(
        id = "new_email",
        userId = "user_1",
        accountId = accountId,
        from = EmailAddress(email = "user@example.com"),
        to = to.map { EmailAddress(email = it) },
        cc = cc.map { EmailAddress(email = it) },
        bcc = bcc.map { EmailAddress(email = it) },
        subject = subject,
        body = body,
        messageId = "new_msg",
        receivedAt = "2026-02-04T10:00:00Z",
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun saveDraft(
        accountId: String,
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String>,
        bcc: List<String>,
    ): EmailDraft = EmailDraft(
        id = "draft_1",
        userId = "user_1",
        accountId = accountId,
        to = to.map { EmailAddress(email = it) },
        cc = cc.map { EmailAddress(email = it) },
        bcc = bcc.map { EmailAddress(email = it) },
        subject = subject,
        body = body,
        createdAt = "2026-02-04T10:00:00Z",
        updatedAt = "2026-02-04T10:00:00Z",
    )

    override suspend fun getAnalytics(accountId: String): EmailAnalytics = EmailAnalytics(
        totalEmails = 42,
        unreadCount = 3,
        starredCount = 5,
        totalSizeBytes = 1024000,
    )
}

/**
 * Interface for EmailService dependency injection
 */
interface EmailService {
    suspend fun fetchEmails(accountId: String, offset: Int = 0): List<Email>
    suspend fun markAsRead(emailId: String, isRead: Boolean)
    suspend fun markAsStarred(emailId: String, isStarred: Boolean)
    suspend fun deleteEmail(emailId: String)
    suspend fun searchEmails(filter: EmailSearchFilter): List<Email>
    suspend fun sendEmail(
        accountId: String,
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
    ): Email

    suspend fun saveDraft(
        accountId: String,
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
    ): EmailDraft

    suspend fun getAnalytics(accountId: String): EmailAnalytics
}
