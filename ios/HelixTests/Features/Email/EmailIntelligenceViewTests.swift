import XCTest
@testable import Helix

@MainActor
class EmailIntelligenceViewTests: XCTestCase {

  func testEmailIntelligenceViewRendering() {
    let view = EmailIntelligenceView()
    XCTAssertNotNil(view)
  }

  func testComposedEmailModel() {
    let email = ComposedEmail(
      id: UUID(),
      subject: "Test Subject",
      body: "Test body content",
      confidence: 0.92,
      suggestions: ["suggestion1", "suggestion2"],
      estimatedTokens: 150
    )

    XCTAssertEqual(email.subject, "Test Subject")
    XCTAssertEqual(email.confidence, 0.92)
    XCTAssertEqual(email.estimatedTokens, 150)
  }

  func testClassifiedEmailModel() {
    let classified = ClassifiedEmail(
      id: UUID(),
      subject: "Important Meeting",
      priority: .high,
      category: "Meeting",
      description: "Conference call with team",
      needsResponse: true,
      responseDeadline: Date().addingTimeInterval(3600),
      suggestedAction: "Respond immediately"
    )

    XCTAssertEqual(classified.priority, .high)
    XCTAssertTrue(classified.needsResponse)
    XCTAssertEqual(classified.category, "Meeting")
  }

  func testEmailPriorityColor() {
    XCTAssertEqual(EmailPriority.high.color, .red)
    XCTAssertEqual(EmailPriority.medium.color, .orange)
    XCTAssertEqual(EmailPriority.low.color, .green)
  }

  func testEmailResponseModel() {
    let response = EmailResponse(
      id: UUID(),
      body: "Response text",
      type: "acknowledge",
      tone: "professional",
      confidence: 0.88,
      estimatedTokens: 120
    )

    XCTAssertEqual(response.type, "acknowledge")
    XCTAssertEqual(response.confidence, 0.88)
  }

  func testEmailToneAllCases() {
    let tones = EmailTone.allCases
    XCTAssertEqual(tones.count, 3)
    XCTAssertTrue(tones.contains(.professional))
    XCTAssertTrue(tones.contains(.casual))
    XCTAssertTrue(tones.contains(.formal))
  }

  func testEmailResponseTypeAllCases() {
    let types = EmailResponseType.allCases
    XCTAssertEqual(types.count, 4)
    XCTAssertTrue(types.contains(.acknowledge))
    XCTAssertTrue(types.contains(.approve))
    XCTAssertTrue(types.contains(.decline))
    XCTAssertTrue(types.contains(.request_info))
  }

  func testEmailMessageModel() {
    let now = Date()
    let message = EmailMessage(
      id: UUID(),
      subject: "Test Email",
      from: "sender@example.com",
      body: "Email body",
      date: now
    )

    XCTAssertEqual(message.subject, "Test Email")
    XCTAssertEqual(message.from, "sender@example.com")
  }
}

@MainActor
class EmailIntelligenceViewModelTests: XCTestCase {
  var viewModel: EmailIntelligenceViewModel!

  override func setUp() {
    super.setUp()
    viewModel = EmailIntelligenceViewModel()
  }

  override func tearDown() {
    viewModel = nil
    super.tearDown()
  }

  func testInitialState() {
    XCTAssertEqual(viewModel.selectedTab, .compose)
    XCTAssertFalse(viewModel.isLoading)
    XCTAssertNil(viewModel.error)
    XCTAssertTrue(viewModel.emailOperations.isEmpty)
    XCTAssertNil(viewModel.composedEmail)
    XCTAssertTrue(viewModel.classifiedEmails.isEmpty)
    XCTAssertNil(viewModel.generatedResponse)
  }

  func testToggleOperation() {
    viewModel.emailOperations["email-compose"] = true
    viewModel.emailOperations["email-classify"] = false

    viewModel.toggleOperation("email-compose")
    XCTAssertFalse(viewModel.emailOperations["email-compose"] ?? true)

    viewModel.toggleOperation("email-classify")
    XCTAssertTrue(viewModel.emailOperations["email-classify"] ?? false)
  }

  func testIsOperationEnabled() {
    viewModel.emailOperations["email-compose"] = true
    viewModel.emailOperations["email-classify"] = false

    XCTAssertTrue(viewModel.isOperationEnabled("email-compose"))
    XCTAssertFalse(viewModel.isOperationEnabled("email-classify"))
    XCTAssertFalse(viewModel.isOperationEnabled("nonexistent"))
  }

  func testCopyToClipboard() {
    let testString = "Test clipboard content"
    viewModel.copyToClipboard(testString)

    XCTAssertEqual(UIPasteboard.general.string, testString)
  }

  func testComposeEmailStateChanges() {
    let email = ComposedEmail(
      id: UUID(),
      subject: "Test",
      body: "Body",
      confidence: 0.9,
      suggestions: [],
      estimatedTokens: 100
    )

    viewModel.composedEmail = email
    XCTAssertEqual(viewModel.composedEmail?.subject, "Test")
  }

  func testClassifyEmailsStateChanges() {
    let classified = ClassifiedEmail(
      id: UUID(),
      subject: "Important",
      priority: .high,
      category: "Meeting",
      description: "Test",
      needsResponse: false,
      responseDeadline: Date(),
      suggestedAction: "Reply"
    )

    viewModel.classifiedEmails = [classified]
    XCTAssertEqual(viewModel.classifiedEmails.count, 1)
    XCTAssertEqual(viewModel.classifiedEmails[0].priority, .high)
  }

  func testResponseStateChanges() {
    let response = EmailResponse(
      id: UUID(),
      body: "Response",
      type: "acknowledge",
      tone: "professional",
      confidence: 0.85,
      estimatedTokens: 100
    )

    viewModel.generatedResponse = response
    XCTAssertEqual(viewModel.generatedResponse?.type, "acknowledge")
  }

  func testErrorStateHandling() {
    let errorMessage = "Test error occurred"
    viewModel.error = errorMessage

    XCTAssertEqual(viewModel.error, errorMessage)

    viewModel.error = nil
    XCTAssertNil(viewModel.error)
  }

  func testLoadingStateTransitions() {
    XCTAssertFalse(viewModel.isLoading)

    viewModel.isLoading = true
    XCTAssertTrue(viewModel.isLoading)

    viewModel.isLoading = false
    XCTAssertFalse(viewModel.isLoading)
  }

  func testTabSelection() {
    viewModel.selectedTab = .compose
    XCTAssertEqual(viewModel.selectedTab, .compose)

    viewModel.selectedTab = .classify
    XCTAssertEqual(viewModel.selectedTab, .classify)

    viewModel.selectedTab = .respond
    XCTAssertEqual(viewModel.selectedTab, .respond)
  }

  func testMultipleEmailsClassification() {
    let emails = (0..<5).map { i in
      ClassifiedEmail(
        id: UUID(),
        subject: "Email \(i)",
        priority: i % 2 == 0 ? .high : .low,
        category: "Category",
        description: "Description",
        needsResponse: i % 3 == 0,
        responseDeadline: Date(),
        suggestedAction: "Action"
      )
    }

    viewModel.classifiedEmails = emails
    XCTAssertEqual(viewModel.classifiedEmails.count, 5)

    let highPriority = viewModel.classifiedEmails.filter { $0.priority == .high }
    XCTAssertEqual(highPriority.count, 3)
  }

  func testComposedEmailWithSuggestions() {
    let email = ComposedEmail(
      id: UUID(),
      subject: "Subject",
      body: "Body",
      confidence: 0.95,
      suggestions: ["suggestion1", "suggestion2", "suggestion3"],
      estimatedTokens: 250
    )

    viewModel.composedEmail = email
    XCTAssertEqual(viewModel.composedEmail?.suggestions.count, 3)
    XCTAssertEqual(viewModel.composedEmail?.confidence, 0.95)
  }

  func testOperationLoadingSequence() {
    viewModel.emailOperations = [
      "email-compose": true,
      "email-classify": true,
      "email-respond": false
    ]

    let enabledCount = viewModel.emailOperations.values.filter { $0 }.count
    XCTAssertEqual(enabledCount, 2)
  }

  func testResponseDifferentTypes() {
    let types = ["acknowledge", "approve", "decline", "request_info"]

    for type in types {
      let response = EmailResponse(
        id: UUID(),
        body: "Test response",
        type: type,
        tone: "professional",
        confidence: 0.9,
        estimatedTokens: 100
      )
      XCTAssertEqual(response.type, type)
    }
  }

  func testConcurrentEmailOperations() {
    let email1 = ComposedEmail(
      id: UUID(),
      subject: "Email 1",
      body: "Body 1",
      confidence: 0.9,
      suggestions: [],
      estimatedTokens: 100
    )

    let email2 = ComposedEmail(
      id: UUID(),
      subject: "Email 2",
      body: "Body 2",
      confidence: 0.85,
      suggestions: [],
      estimatedTokens: 120
    )

    viewModel.composedEmail = email1
    XCTAssertEqual(viewModel.composedEmail?.subject, "Email 1")

    viewModel.composedEmail = email2
    XCTAssertEqual(viewModel.composedEmail?.subject, "Email 2")
  }

  func testEmailClassificationWithNeedsResponse() {
    let classified = ClassifiedEmail(
      id: UUID(),
      subject: "Urgent Request",
      priority: .high,
      category: "Request",
      description: "Needs immediate response",
      needsResponse: true,
      responseDeadline: Date().addingTimeInterval(3600),
      suggestedAction: "Reply immediately"
    )

    XCTAssertTrue(classified.needsResponse)
    XCTAssertEqual(classified.suggestedAction, "Reply immediately")
  }

  func testEmptyOperationsState() {
    XCTAssertTrue(viewModel.emailOperations.isEmpty)
    XCTAssertFalse(viewModel.isOperationEnabled("any-operation"))
  }

  func testErrorClearingOnNewOperation() {
    viewModel.error = "Previous error"
    XCTAssertEqual(viewModel.error, "Previous error")

    viewModel.error = nil
    XCTAssertNil(viewModel.error)
  }

  func testClassifiedEmailPriorityDistribution() {
    let emails = [
      ClassifiedEmail(id: UUID(), subject: "1", priority: .high, category: "C", description: "D", needsResponse: false, responseDeadline: Date(), suggestedAction: "A"),
      ClassifiedEmail(id: UUID(), subject: "2", priority: .high, category: "C", description: "D", needsResponse: false, responseDeadline: Date(), suggestedAction: "A"),
      ClassifiedEmail(id: UUID(), subject: "3", priority: .medium, category: "C", description: "D", needsResponse: false, responseDeadline: Date(), suggestedAction: "A"),
      ClassifiedEmail(id: UUID(), subject: "4", priority: .low, category: "C", description: "D", needsResponse: false, responseDeadline: Date(), suggestedAction: "A"),
    ]

    viewModel.classifiedEmails = emails

    let highCount = emails.filter { $0.priority == .high }.count
    let mediumCount = emails.filter { $0.priority == .medium }.count
    let lowCount = emails.filter { $0.priority == .low }.count

    XCTAssertEqual(highCount, 2)
    XCTAssertEqual(mediumCount, 1)
    XCTAssertEqual(lowCount, 1)
  }
}
