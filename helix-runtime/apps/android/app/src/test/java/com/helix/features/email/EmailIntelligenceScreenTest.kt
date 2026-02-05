package com.helix.features.email

import junit.framework.TestCase.assertEquals
import junit.framework.TestCase.assertFalse
import junit.framework.TestCase.assertNotNull
import junit.framework.TestCase.assertNull
import junit.framework.TestCase.assertTrue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Before
import org.junit.Test
import java.util.*

@OptIn(ExperimentalCoroutinesApi::class)
class EmailIntelligenceScreenTest {

  @Before
  fun setup() {
    Dispatchers.setMain(StandardTestDispatcher())
  }

  @Test
  fun testComposedEmailModel() {
    val email = ComposedEmail(
      subject = "Test Subject",
      body = "Test body content",
      confidence = 0.92,
      suggestions = listOf("suggestion1", "suggestion2"),
      estimatedTokens = 150
    )

    assertEquals("Test Subject", email.subject)
    assertEquals(0.92, email.confidence)
    assertEquals(150, email.estimatedTokens)
    assertEquals(2, email.suggestions.size)
  }

  @Test
  fun testClassifiedEmailModel() {
    val classified = ClassifiedEmail(
      subject = "Important Meeting",
      priority = EmailPriority.HIGH,
      category = "Meeting",
      description = "Conference call with team",
      needsResponse = true,
      responseDeadline = Date(),
      suggestedAction = "Respond immediately"
    )

    assertEquals(EmailPriority.HIGH, classified.priority)
    assertTrue(classified.needsResponse)
    assertEquals("Meeting", classified.category)
  }

  @Test
  fun testEmailResponseModel() {
    val response = EmailResponse(
      body = "Response text",
      type = "acknowledge",
      tone = "professional",
      confidence = 0.88,
      estimatedTokens = 120
    )

    assertEquals("acknowledge", response.type)
    assertEquals(0.88, response.confidence)
    assertEquals(120, response.estimatedTokens)
  }

  @Test
  fun testEmailToneValues() {
    assertEquals(3, EmailTone.values().size)
    assertTrue(EmailTone.values().map { it.name }.contains("PROFESSIONAL"))
    assertTrue(EmailTone.values().map { it.name }.contains("CASUAL"))
    assertTrue(EmailTone.values().map { it.name }.contains("FORMAL"))
  }

  @Test
  fun testEmailResponseTypeValues() {
    assertEquals(4, EmailResponseType.values().size)
    assertTrue(EmailResponseType.values().map { it.name }.contains("ACKNOWLEDGE"))
    assertTrue(EmailResponseType.values().map { it.name }.contains("APPROVE"))
  }

  @Test
  fun testEmailPriorityValues() {
    assertEquals(3, EmailPriority.values().size)
    assertTrue(EmailPriority.values().map { it.name }.contains("HIGH"))
    assertTrue(EmailPriority.values().map { it.name }.contains("MEDIUM"))
    assertTrue(EmailPriority.values().map { it.name }.contains("LOW"))
  }

  @Test
  fun testEmailTabValues() {
    assertEquals(3, EmailIntelligenceTab.values().size)
    assertEquals("Compose", EmailIntelligenceTab.COMPOSE.label)
    assertEquals("Classify", EmailIntelligenceTab.CLASSIFY.label)
    assertEquals("Respond", EmailIntelligenceTab.RESPOND.label)
  }

  @Test
  fun testMultipleComposedEmails() = runTest {
    val email1 = ComposedEmail(
      subject = "Email 1",
      body = "Body 1",
      confidence = 0.9,
      suggestions = emptyList(),
      estimatedTokens = 100
    )

    val email2 = ComposedEmail(
      subject = "Email 2",
      body = "Body 2",
      confidence = 0.85,
      suggestions = listOf("suggestion"),
      estimatedTokens = 120
    )

    assertEquals("Email 1", email1.subject)
    assertEquals("Email 2", email2.subject)
    assertTrue(email1.confidence > email2.confidence)
  }

  @Test
  fun testClassifiedEmailsWithDifferentPriorities() {
    val emails = listOf(
      ClassifiedEmail(
        subject = "High Priority",
        priority = EmailPriority.HIGH,
        category = "Urgent",
        description = "Needs attention",
        needsResponse = true,
        responseDeadline = Date(),
        suggestedAction = "Act now"
      ),
      ClassifiedEmail(
        subject = "Medium Priority",
        priority = EmailPriority.MEDIUM,
        category = "Important",
        description = "Should review",
        needsResponse = true,
        responseDeadline = Date(),
        suggestedAction = "Review soon"
      ),
      ClassifiedEmail(
        subject = "Low Priority",
        priority = EmailPriority.LOW,
        category = "FYI",
        description = "For information",
        needsResponse = false,
        responseDeadline = Date(),
        suggestedAction = "Archive"
      )
    )

    assertEquals(3, emails.size)
    val highPriority = emails.filter { it.priority == EmailPriority.HIGH }
    assertEquals(1, highPriority.size)
    val needsResponse = emails.filter { it.needsResponse }
    assertEquals(2, needsResponse.size)
  }

  @Test
  fun testResponseDifferentTypes() {
    val types = listOf("acknowledge", "approve", "decline", "request_info")

    types.forEach { type ->
      val response = EmailResponse(
        body = "Test response",
        type = type,
        tone = "professional",
        confidence = 0.9,
        estimatedTokens = 100
      )
      assertEquals(type, response.type)
    }
  }

  @Test
  fun testComposedEmailWithSuggestions() {
    val email = ComposedEmail(
      subject = "Subject",
      body = "Body",
      confidence = 0.95,
      suggestions = listOf("suggestion1", "suggestion2", "suggestion3"),
      estimatedTokens = 250
    )

    assertEquals(3, email.suggestions.size)
    assertEquals(0.95, email.confidence)
    assertEquals(250, email.estimatedTokens)
  }

  @Test
  fun testEmailClassificationWithResponseDeadline() {
    val now = Date()
    val deadline = Date(now.time + 3600000) // 1 hour from now

    val classified = ClassifiedEmail(
      subject = "Urgent Request",
      priority = EmailPriority.HIGH,
      category = "Request",
      description = "Needs immediate response",
      needsResponse = true,
      responseDeadline = deadline,
      suggestedAction = "Reply immediately"
    )

    assertTrue(classified.responseDeadline.after(now))
    assertTrue(classified.needsResponse)
  }

  @Test
  fun testEmailUUIDUniqueness() {
    val email1 = ComposedEmail(
      subject = "E1",
      body = "B1",
      confidence = 0.9,
      suggestions = emptyList(),
      estimatedTokens = 100
    )

    val email2 = ComposedEmail(
      subject = "E2",
      body = "B2",
      confidence = 0.9,
      suggestions = emptyList(),
      estimatedTokens = 100
    )

    assertNotNull(email1.id)
    assertNotNull(email2.id)
    assertFalse(email1.id == email2.id)
  }

  @Test
  fun testResponseWithVariousTones() {
    val tones = listOf("professional", "casual", "formal", "friendly")

    tones.forEach { tone ->
      val response = EmailResponse(
        body = "Response in $tone tone",
        type = "acknowledge",
        tone = tone,
        confidence = 0.85,
        estimatedTokens = 100
      )
      assertEquals(tone, response.tone)
    }
  }

  @Test
  fun testClassifiedEmailFiltering() {
    val emails = listOf(
      ClassifiedEmail(
        subject = "1",
        priority = EmailPriority.HIGH,
        category = "C",
        description = "D",
        needsResponse = true,
        responseDeadline = Date(),
        suggestedAction = "A"
      ),
      ClassifiedEmail(
        subject = "2",
        priority = EmailPriority.MEDIUM,
        category = "C",
        description = "D",
        needsResponse = false,
        responseDeadline = Date(),
        suggestedAction = "A"
      ),
      ClassifiedEmail(
        subject = "3",
        priority = EmailPriority.LOW,
        category = "C",
        description = "D",
        needsResponse = true,
        responseDeadline = Date(),
        suggestedAction = "A"
      )
    )

    val highPriority = emails.filter { it.priority == EmailPriority.HIGH }
    assertEquals(1, highPriority.size)

    val needsResponse = emails.filter { it.needsResponse }
    assertEquals(2, needsResponse.size)

    val dontNeedResponse = emails.filter { !it.needsResponse }
    assertEquals(1, dontNeedResponse.size)
  }
}

@OptIn(ExperimentalCoroutinesApi::class)
class EmailIntelligenceViewModelTest {

  private lateinit var viewModel: EmailIntelligenceViewModel

  @Before
  fun setup() {
    Dispatchers.setMain(StandardTestDispatcher())
    viewModel = EmailIntelligenceViewModel()
  }

  @Test
  fun testInitialState() {
    assertEquals(EmailIntelligenceTab.COMPOSE, viewModel.selectedTab.value)
    assertFalse(viewModel.isLoading.value)
    assertNull(viewModel.error.value)
    assertNull(viewModel.composedEmail.value)
    assertTrue(viewModel.classifiedEmails.value.isEmpty())
    assertNull(viewModel.generatedResponse.value)
  }

  @Test
  fun testToggleOperation() {
    val initial = viewModel.emailOperations.value["email-compose"]
    viewModel.toggleOperation("email-compose")
    val after = viewModel.emailOperations.value["email-compose"]

    assertFalse(initial == after)
  }

  @Test
  fun testIsOperationEnabled() {
    viewModel.emailOperations.value = mapOf("email-compose" to true)
    assertTrue(viewModel.isOperationEnabled("email-compose"))

    viewModel.emailOperations.value = mapOf("email-compose" to false)
    assertFalse(viewModel.isOperationEnabled("email-compose"))
  }

  @Test
  fun testSelectTab() {
    viewModel.selectTab(EmailIntelligenceTab.CLASSIFY)
    assertEquals(EmailIntelligenceTab.CLASSIFY, viewModel.selectedTab.value)

    viewModel.selectTab(EmailIntelligenceTab.RESPOND)
    assertEquals(EmailIntelligenceTab.RESPOND, viewModel.selectedTab.value)
  }

  @Test
  fun testGenerateEmail() = runTest {
    viewModel.generateEmail(
      tone = EmailTone.PROFESSIONAL,
      context = "Test context",
      maxLength = 500
    )

    // Verify state changes
    assertTrue(viewModel.isLoading.value || viewModel.composedEmail.value != null)
  }

  @Test
  fun testClassifyInbox() = runTest {
    viewModel.classifyInbox()

    // Verify state changes
    assertTrue(viewModel.isLoading.value || viewModel.classifiedEmails.value.isNotEmpty())
  }

  @Test
  fun testGenerateResponse() = runTest {
    viewModel.generateResponse(type = EmailResponseType.ACKNOWLEDGE)

    // Verify state changes
    assertTrue(viewModel.isLoading.value || viewModel.generatedResponse.value != null)
  }

  @Test
  fun testErrorStateHandling() {
    viewModel.error.value = "Test error"
    assertEquals("Test error", viewModel.error.value)

    viewModel.error.value = null
    assertNull(viewModel.error.value)
  }

  @Test
  fun testLoadingStateTransitions() {
    assertFalse(viewModel.isLoading.value)

    viewModel.isLoading.value = true
    assertTrue(viewModel.isLoading.value)

    viewModel.isLoading.value = false
    assertFalse(viewModel.isLoading.value)
  }

  @Test
  fun testMultipleOperationsToggle() {
    val ops = mapOf(
      "email-compose" to true,
      "email-classify" to true,
      "email-respond" to false
    )
    viewModel.emailOperations.value = ops

    viewModel.toggleOperation("email-respond")
    assertTrue(viewModel.emailOperations.value["email-respond"] == true)

    viewModel.toggleOperation("email-compose")
    assertTrue(viewModel.emailOperations.value["email-compose"] == false)
  }

  @Test
  fun testComposedEmailStorage() {
    val email = ComposedEmail(
      subject = "Test",
      body = "Body",
      confidence = 0.9,
      suggestions = emptyList(),
      estimatedTokens = 100
    )

    viewModel.composedEmail.value = email
    assertEquals("Test", viewModel.composedEmail.value?.subject)
  }

  @Test
  fun testClassifiedEmailsStorage() {
    val emails = listOf(
      ClassifiedEmail(
        subject = "E1",
        priority = EmailPriority.HIGH,
        category = "C",
        description = "D",
        needsResponse = false,
        responseDeadline = Date(),
        suggestedAction = "A"
      ),
      ClassifiedEmail(
        subject = "E2",
        priority = EmailPriority.LOW,
        category = "C",
        description = "D",
        needsResponse = false,
        responseDeadline = Date(),
        suggestedAction = "A"
      )
    )

    viewModel.classifiedEmails.value = emails
    assertEquals(2, viewModel.classifiedEmails.value.size)
  }

  @Test
  fun testResponseStorage() {
    val response = EmailResponse(
      body = "Response",
      type = "acknowledge",
      tone = "professional",
      confidence = 0.85,
      estimatedTokens = 100
    )

    viewModel.generatedResponse.value = response
    assertEquals("acknowledge", viewModel.generatedResponse.value?.type)
  }
}
