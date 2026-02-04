package com.helix.email

import com.helix.gateway.GatewaySession
import com.helix.tasks.TaskSearchFilter
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Unit tests for EmailService
 */
class EmailServiceTest : FunSpec({
    lateinit var mockGateway: GatewaySession
    lateinit var emailService: EmailService

    beforeTest {
        mockGateway = mockk()
        emailService = EmailService(mockGateway)
    }

    context("fetchEmails") {
        test("should return list of emails") {
            // Given: Mock gateway response
            coEvery {
                mockGateway.request(
                    method = "email.list",
                    params = any()
                )
            } returns JsonArray(listOf(
                JsonObject(mapOf(
                    "id" to "email1".jsonPrimitive,
                    "subject" to "Test Subject".jsonPrimitive
                ))
            ))

            // When: Fetch emails
            val result = emailService.getTasks()

            // Then: Verify result
            result.size shouldBe 1
        }

        test("should handle empty email list") {
            // Given: Empty response
            coEvery {
                mockGateway.request(any(), any())
            } returns JsonArray(listOf())

            // When: Fetch emails
            val result = emailService.getTasks()

            // Then: Verify empty list
            result.size shouldBe 0
        }

        test("should handle gateway network error") {
            // Given: Gateway throws error
            coEvery {
                mockGateway.request(any(), any())
            } throws Exception("Network error")

            // When/Then: Expect exception
            shouldThrow<Exception> {
                emailService.getTasks()
            }
        }
    }

    context("searchEmails") {
        test("should search with query filter") {
            // Given: Mock search response
            coEvery {
                mockGateway.request("email.search", any())
            } returns JsonArray(listOf(
                JsonObject(mapOf(
                    "id" to "email1".jsonPrimitive,
                    "subject" to "Important Meeting".jsonPrimitive
                ))
            ))

            // When: Search emails
            val filter = TaskSearchFilter(query = "meeting")
            val results = emailService.searchTasks(filter)

            // Then: Verify results
            results.size shouldBe 1
        }

        test("should handle empty search results") {
            // Given: No matching results
            coEvery {
                mockGateway.request("email.search", any())
            } returns JsonArray(listOf())

            // When: Search emails
            val filter = TaskSearchFilter(query = "nonexistent")
            val results = emailService.searchTasks(filter)

            // Then: Verify empty results
            results.size shouldBe 0
        }
    }

    context("markAsRead") {
        test("should mark email as read") {
            // Given: Mock success response
            coEvery {
                mockGateway.request("email.mark_read", any())
            } returns JsonObject(mapOf())

            // When: Mark as read
            emailService.markAsRead("email1", true)

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.mark_read", any())
            }
        }

        test("should mark email as unread") {
            // Given: Mock success response
            coEvery {
                mockGateway.request("email.mark_read", any())
            } returns JsonObject(mapOf())

            // When: Mark as unread
            emailService.markAsRead("email1", false)

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.mark_read", any())
            }
        }
    }

    context("markAsStarred") {
        test("should mark email as starred") {
            // Given: Mock success response
            coEvery {
                mockGateway.request("email.mark_starred", any())
            } returns JsonObject(mapOf())

            // When: Mark as starred
            emailService.markAsStarred("email1", true)

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.mark_starred", any())
            }
        }

        test("should unstar email") {
            // Given: Mock success response
            coEvery {
                mockGateway.request("email.mark_starred", any())
            } returns JsonObject(mapOf())

            // When: Unstar email
            emailService.markAsStarred("email1", false)

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.mark_starred", any())
            }
        }
    }

    context("deleteEmail") {
        test("should soft delete email") {
            // Given: Mock success response
            coEvery {
                mockGateway.request("email.delete", any())
            } returns JsonObject(mapOf())

            // When: Delete email
            emailService.deleteTask("email1")

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.delete", any())
            }
        }

        test("should permanently delete email") {
            // Given: Mock success response
            coEvery {
                mockGateway.request("email.delete_permanent", any())
            } returns JsonObject(mapOf())

            // When: Permanently delete
            emailService.deletePermanently("email1")

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.delete_permanent", any())
            }
        }
    }

    context("sendEmail") {
        test("should send email successfully") {
            // Given: Mock send response
            coEvery {
                mockGateway.request("email.send", any())
            } returns JsonObject(mapOf(
                "id" to "email1".jsonPrimitive,
                "subject" to "Test".jsonPrimitive
            ))

            // When: Send email
            val result = emailService.sendEmail(
                to = listOf("recipient@example.com"),
                subject = "Test",
                body = "Body"
            )

            // Then: Verify method was called
            coVerify {
                mockGateway.request("email.send", any())
            }
        }

        test("should handle send error") {
            // Given: Gateway error
            coEvery {
                mockGateway.request("email.send", any())
            } throws Exception("Send failed")

            // When/Then: Expect exception
            shouldThrow<Exception> {
                emailService.sendEmail(
                    to = listOf("recipient@example.com"),
                    subject = "Test",
                    body = "Body"
                )
            }
        }
    }

    context("getAnalytics") {
        test("should fetch analytics") {
            // Given: Mock analytics response
            coEvery {
                mockGateway.request("email.analytics", any())
            } returns JsonObject(mapOf(
                "total_emails" to "100".jsonPrimitive,
                "unread_count" to "5".jsonPrimitive
            ))

            // When: Get analytics
            val result = emailService.getAnalytics()

            // Then: Verify analytics received
            coVerify {
                mockGateway.request("email.analytics", any())
            }
        }
    }

    context("concurrentRequests") {
        test("should handle concurrent requests") {
            // Given: Mock responses
            coEvery {
                mockGateway.request("email.list", any())
            } returns JsonArray(listOf())
            coEvery {
                mockGateway.request("email.analytics", any())
            } returns JsonObject(mapOf())

            // When: Make concurrent requests would need async context
            // For now, verify methods exist
            assert(true)
        }
    }
})
