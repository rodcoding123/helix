# Phase 6: Native iOS/Android Applications - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Phase 5 features (Email, Calendar, Tasks) to native iOS and Android apps using SwiftUI and Jetpack Compose.

**Architecture:** Extend existing gateway-connected apps with tabs for Email, Calendar, and Tasks. Reuse service layer logic from web via gateway RPC calls. Create native UI for each feature.

**Tech Stack:**

- **iOS:** SwiftUI, Combine, URLSession, Keychain
- **Android:** Jetpack Compose, Coroutines, Retrofit, DataStore

---

## Context: Current State

**Existing Infrastructure:**

- iOS app (SwiftUI): Gateway connection, Voice, Screen, Settings tabs
- Android app (Jetpack Compose): Gateway connection, Voice, Screen, Settings tabs
- Both apps use gateway RPC protocol for communication
- Shared types in `helix-runtime/apps/shared/OpenClawKit`

**Screens to Add:**

1. Email tab with Inbox, Compose, Search, Analytics
2. Calendar tab with Month/Week/Day views, Conflict detection
3. Tasks tab with Kanban board, Time tracking, Analytics

---

## Phase 6 Breakdown

### Track 6.1: iOS Email Integration (5 days)

#### Task 1.1: Email Service Layer (iOS)

**Files:**

- Create: `helix-runtime/apps/ios/Sources/Email/EmailService.swift` (300 lines)
- Create: `helix-runtime/apps/ios/Sources/Email/EmailModels.swift` (150 lines)
- Create: `helix-runtime/apps/ios/Sources/Email/EmailStore.swift` (200 lines)

**Step 1: Write test expectations**

```swift
test_emailService_fetchesInbox {
    let service = EmailService(gateway: mockGateway)
    let emails = await service.fetchEmails(limit: 10)
    XCTAssertEqual(emails.count, 10)
    XCTAssertEqual(emails[0].subject, "Test email")
}

test_emailService_searchesEmails {
    let service = EmailService(gateway: mockGateway)
    let results = await service.searchEmails(query: "urgent", limit: 20)
    XCTAssertGreaterThan(results.count, 0)
}
```

**Step 2: Implement EmailModels.swift**

```swift
struct Email: Identifiable, Codable {
    let id: String
    let userId: String
    let from: EmailAddress
    let to: [EmailAddress]
    let subject: String
    let body: String
    let isRead: Bool
    let isStarred: Bool
    let threadId: String
    let labels: [String]
    let timestamp: Date
}

struct EmailAddress: Codable {
    let name: String?
    let email: String
}

@Observable
class EmailStore {
    var emails: [Email] = []
    var selectedEmail: Email?
    var isLoading = false
    var searchQuery = ""

    func loadEmails() async { }
    func search(query: String) async { }
    func markAsRead(_ email: Email) async { }
}
```

**Step 3: Implement EmailService.swift**

```swift
class EmailService {
    let gateway: GatewaySession

    func fetchEmails(limit: Int = 20) async throws -> [Email] {
        let response = try await gateway.request(
            "email.list",
            params: ["limit": limit, "skip": 0]
        )
        return try JSONDecoder().decode([Email].self, from: response)
    }

    func searchEmails(query: String, limit: Int = 20) async throws -> [Email] {
        let response = try await gateway.request(
            "email.search",
            params: ["query": query, "limit": limit]
        )
        return try JSONDecoder().decode([Email].self, from: response)
    }

    func sendEmail(to: String, subject: String, body: String) async throws -> Email {
        let response = try await gateway.request(
            "email.send",
            params: ["to": to, "subject": subject, "body": body]
        )
        return try JSONDecoder().decode(Email.self, from: response)
    }
}
```

**Step 4: Write and run tests**

```bash
cd helix-runtime/apps/ios
xcodebuild test -scheme OpenClaw -testPlan EmailServiceTests
# Expected: All tests pass
```

**Step 5: Commit**

```bash
git add helix-runtime/apps/ios/Sources/Email/
git commit -m "feat(ios): add email service layer with gateway integration"
```

---

#### Task 1.2: iOS Email Inbox UI (SwiftUI)

**Files:**

- Create: `helix-runtime/apps/ios/Sources/Email/EmailTab.swift` (200 lines)
- Create: `helix-runtime/apps/ios/Sources/Email/InboxView.swift` (250 lines)
- Create: `helix-runtime/apps/ios/Sources/Email/EmailDetailView.swift` (200 lines)

**Step 1: Design EmailTab structure**

```swift
struct EmailTab: View {
    @Environment(NodeAppModel.self) private var appModel
    @State private var emailStore: EmailStore
    @State private var selectedTab: EmailTabType = .inbox
    @State private var searchText = ""

    enum EmailTabType {
        case inbox, sent, drafts, search
    }

    var body: some View {
        NavigationStack {
            VStack {
                // Tab selector
                Picker("", selection: $selectedTab) {
                    Text("Inbox").tag(EmailTabType.inbox)
                    Text("Sent").tag(EmailTabType.sent)
                    Text("Drafts").tag(EmailTabType.drafts)
                    Text("Search").tag(EmailTabType.search)
                }
                .pickerStyle(.segmented)
                .padding()

                // Content based on selected tab
                switch selectedTab {
                case .inbox:
                    InboxView(store: emailStore)
                case .sent:
                    SentView(store: emailStore)
                case .drafts:
                    DraftsView(store: emailStore)
                case .search:
                    SearchView(store: emailStore, query: searchText)
                }
            }
            .navigationTitle("Email")
        }
        .task {
            await emailStore.loadEmails()
        }
    }
}
```

**Step 2: Implement InboxView**

```swift
struct InboxView: View {
    @Bindable var store: EmailStore

    var body: some View {
        List {
            if store.isLoading {
                ProgressView()
            } else if store.emails.isEmpty {
                Text("No emails")
                    .foregroundColor(.secondary)
            } else {
                ForEach(store.emails) { email in
                    NavigationLink(destination: EmailDetailView(email: email)) {
                        VStack(alignment: .leading) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(email.from.name ?? email.from.email)
                                        .font(.headline)
                                    Text(email.subject)
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                VStack(alignment: .trailing) {
                                    Text(email.timestamp, style: .time)
                                        .font(.caption)
                                    if !email.isRead {
                                        Image(systemName: "circle.fill")
                                            .font(.caption)
                                            .foregroundColor(.blue)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
        }
    }
}
```

**Step 3: Implement EmailDetailView**

```swift
struct EmailDetailView: View {
    let email: Email
    @Environment(\.dismiss) var dismiss
    @State private var isReplying = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                // Header
                VStack(alignment: .leading) {
                    Text(email.subject)
                        .font(.title2)
                        .bold()

                    HStack {
                        Text(email.from.name ?? email.from.email)
                            .font(.subheadline)
                        Spacer()
                        Text(email.timestamp, style: .date)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)

                // Body
                Text(email.body)
                    .padding()

                Spacer()

                // Actions
                HStack {
                    Button(action: { isReplying = true }) {
                        Label("Reply", systemImage: "arrowshape.turn.up.left")
                    }
                    .buttonStyle(.bordered)

                    Button(action: { /* Mark as starred */ }) {
                        Label("Star", systemImage: email.isStarred ? "star.fill" : "star")
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isReplying) {
            ComposeView(toEmail: email.from.email, subject: "Re: \(email.subject)")
        }
    }
}
```

**Step 4: Build and test UI**

```bash
xcodebuild build -scheme OpenClaw
# Expected: Builds without errors
```

**Step 5: Commit**

```bash
git add helix-runtime/apps/ios/Sources/Email/
git commit -m "feat(ios): add email inbox UI with detail and reply views"
```

---

#### Task 1.3: iOS Email Compose UI

**Files:**

- Create: `helix-runtime/apps/ios/Sources/Email/ComposeView.swift` (200 lines)

**Implementation:**

- Rich text input for body
- To/Cc/Bcc fields
- Subject input
- Send button with error handling
- Draft auto-save

---

#### Task 1.4: iOS Email Search & Analytics

**Files:**

- Create: `helix-runtime/apps/ios/Sources/Email/SearchView.swift` (150 lines)
- Create: `helix-runtime/apps/ios/Sources/Email/AnalyticsView.swift` (150 lines)

**SearchView Features:**

- Query input
- Results list with highlighting
- Filter by sender, date, label
- Save search presets

**AnalyticsView Features:**

- Total emails count
- Unread count
- Storage usage
- Most active senders
- Email frequency chart

---

#### Task 1.5: iOS Email Integration

**Files to Modify:**

- Modify: `helix-runtime/apps/ios/Sources/RootTabs.swift` - Add Email tab

```swift
TabView(selection: self.$selectedTab) {
    ScreenTab()
        .tabItem { Label("Screen", systemImage: "rectangle.and.hand.point.up.left") }
        .tag(0)

    VoiceTab()
        .tabItem { Label("Voice", systemImage: "mic") }
        .tag(1)

    EmailTab()
        .tabItem { Label("Email", systemImage: "envelope") }
        .tag(2)

    SettingsTab()
        .tabItem { Label("Settings", systemImage: "gearshape") }
        .tag(3)
}
```

**Steps:**

1. Add EmailTab to navigation
2. Initialize EmailStore in app model
3. Test navigation and tab switching
4. Commit: `feat(ios): integrate email tab into root navigation`

---

### Track 6.2: iOS Calendar Integration (4 days)

#### Task 2.1-2.4: Calendar Service, UI, Views, Integration

Similar structure to Email:

- CalendarService.swift (gateway RPC calls)
- CalendarStore.swift (state management)
- CalendarTab.swift (main view)
- CalendarGridView.swift (month/week/day views)
- EventDetailView.swift (event details with conflicts)
- ConflictView.swift (conflict warnings)

**Key Features:**

- Month/week/day view switching
- Event creation and editing
- Conflict detection highlighting
- Attendee list display
- Timezone support

---

### Track 6.3: iOS Tasks Integration (3 days)

#### Task 3.1-3.3: Tasks Service, Kanban UI, Time Tracking

- TaskService.swift (gateway RPC calls)
- TaskStore.swift (state management)
- TasksTab.swift (main view)
- KanbanBoardView.swift (columns with tasks)
- TaskDetailView.swift (full task details)
- TimeTrackerView.swift (time entry logging)

**Key Features:**

- Drag-and-drop between columns (using iOS 17+ API)
- Priority color coding
- Time tracking with progress
- Dependency warnings
- Analytics dashboard

---

### Track 6.4: Android Email Integration (5 days)

Similar to iOS but using Jetpack Compose:

- `helix-runtime/apps/android/app/src/main/java/ai/openclaw/android/email/EmailService.kt`
- `helix-runtime/apps/android/app/src/main/java/ai/openclaw/android/email/EmailScreen.kt`
- `helix-runtime/apps/android/app/src/main/java/ai/openclaw/android/email/InboxScreen.kt`
- etc.

**Compose equivalents:**

- `List { }` → `LazyColumn`
- `NavigationStack` → `NavController`
- `@State` → `mutableStateOf()`
- `@Environment` → `CompositionLocal`

---

### Track 6.5: Android Calendar Integration (4 days)

- CalendarService.kt
- CalendarScreen.kt
- CalendarGridView.kt (Compose)
- EventDetailScreen.kt
- ConflictIndicator.kt

---

### Track 6.6: Android Tasks Integration (3 days)

- TaskService.kt
- TasksScreen.kt
- KanbanColumnView.kt (Compose)
- TaskDetailScreen.kt
- TimeTrackerComposable.kt

---

## Implementation Order

**Week 1: iOS Email & Calendar (9 days)**

- Day 1-5: Email (Service, Inbox, Detail, Compose, Integration)
- Day 6-9: Calendar (Service, Views, Conflicts, Integration)

**Week 2: iOS Tasks & Android Email (8 days)**

- Day 10-12: Tasks (Service, Kanban, TimeTracker)
- Day 13-17: Android Email (Service, Screens, Integration)

**Week 3: Android Calendar & Tasks (7 days)**

- Day 18-21: Android Calendar
- Day 22-24: Android Tasks
- Day 25: Testing & documentation

---

## Testing Strategy

### iOS Testing

```swift
// Unit Tests
class EmailServiceTests: XCTestCase {
    func test_fetchEmails_returnsEmails() async { }
    func test_searchEmails_returnsFiltered() async { }
    func test_sendEmail_updatesStore() async { }
}

// UI Tests
class EmailUITests: XCTestCase {
    func test_inboxView_displaysEmails() { }
    func test_navigation_toEmailDetail() { }
    func test_compose_sendsEmail() { }
}
```

### Android Testing

```kotlin
// Unit Tests
class EmailServiceTest {
    @Test
    fun fetchEmails_returnsEmails() = runTest { }

    @Test
    fun searchEmails_returnsFiltered() = runTest { }
}

// UI Tests
class EmailScreenTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun inboxScreen_displaysEmails() { }
}
```

---

## Success Criteria

### Functionality

- ✅ Email: Inbox, compose, search, analytics on both platforms
- ✅ Calendar: Month/week/day views, conflict detection on both platforms
- ✅ Tasks: Kanban board, time tracking, analytics on both platforms
- ✅ Gateway RPC integration working for all features
- ✅ Proper error handling and loading states

### Quality

- ✅ Unit tests for all services (>80% coverage)
- ✅ UI tests for critical flows
- ✅ No crashes on navigation
- ✅ Smooth scrolling and animations
- ✅ Proper memory management

### Performance

- ✅ Email list scrolling: 60 FPS
- ✅ Calendar month view: 60 FPS
- ✅ Kanban board: 60 FPS
- ✅ Search completes in <500ms
- ✅ App size <100MB (iOS), <80MB (Android)

### Documentation

- ✅ Service layer documented
- ✅ UI components documented
- ✅ Architecture overview
- ✅ Setup instructions for building

---

## Risk Mitigation

**Risk:** SwiftUI/Compose API differences

- **Mitigation:** Test each platform separately, create platform-specific views

**Risk:** Gateway RPC timeouts on slow networks

- **Mitigation:** Implement retry logic, offline caching, graceful degradation

**Risk:** Large email/calendar datasets performance

- **Mitigation:** Pagination, lazy loading, indexed search

**Risk:** Gateway connection interruptions during uploads

- **Mitigation:** Queue uploads, resume capability, user notifications

---

## Files to Create/Modify

### iOS Files (18 new, 3 modified)

**Email (5 files):**

- `Sources/Email/EmailService.swift`
- `Sources/Email/EmailModels.swift`
- `Sources/Email/EmailStore.swift`
- `Sources/Email/EmailTab.swift`
- `Sources/Email/InboxView.swift`
- `Sources/Email/EmailDetailView.swift`
- `Sources/Email/ComposeView.swift`
- `Sources/Email/SearchView.swift`
- `Sources/Email/AnalyticsView.swift`

**Calendar (4 files):**

- `Sources/Calendar/CalendarService.swift`
- `Sources/Calendar/CalendarStore.swift`
- `Sources/Calendar/CalendarTab.swift`
- `Sources/Calendar/CalendarGridView.swift`
- `Sources/Calendar/EventDetailView.swift`
- `Sources/Calendar/ConflictView.swift`

**Tasks (3 files):**

- `Sources/Tasks/TaskService.swift`
- `Sources/Tasks/TaskStore.swift`
- `Sources/Tasks/TasksTab.swift`
- `Sources/Tasks/KanbanBoardView.swift`
- `Sources/Tasks/TaskDetailView.swift`
- `Sources/Tasks/TimeTrackerView.swift`

**Modified:**

- `Sources/RootTabs.swift`
- `Sources/Model/NodeAppModel.swift`
- Tests files

### Android Files (18 new, 2 modified)

**Email (7 files):**

- `email/EmailService.kt`
- `email/EmailModels.kt`
- `email/EmailViewModel.kt`
- `email/EmailScreen.kt`
- `email/InboxScreen.kt`
- `email/EmailDetailScreen.kt`
- `email/ComposeScreen.kt`

**Calendar (6 files):**

- `calendar/CalendarService.kt`
- `calendar/CalendarViewModel.kt`
- `calendar/CalendarScreen.kt`
- `calendar/CalendarGridView.kt`
- `calendar/EventDetailScreen.kt`
- `calendar/ConflictView.kt`

**Tasks (5 files):**

- `tasks/TaskService.kt`
- `tasks/TaskViewModel.kt`
- `tasks/TasksScreen.kt`
- `tasks/KanbanBoardView.kt`
- `tasks/TaskDetailScreen.kt`

**Modified:**

- `MainActivity.kt`
- `MainViewModel.kt`

---

## Estimated Effort

- **iOS Development:** 70 hours (Email 25h, Calendar 20h, Tasks 15h)
- **Android Development:** 70 hours (Email 25h, Calendar 20h, Tasks 15h)
- **Testing:** 20 hours
- **Documentation:** 10 hours
- **Total:** 170 hours (~3.5 weeks)

---

## Next Steps After Plan Approval

1. iOS Email service layer (Day 1-2)
2. iOS Email UI (Day 3-5)
3. iOS Calendar integration (Day 6-9)
4. iOS Tasks integration (Day 10-12)
5. Android Email (Day 13-17)
6. Android Calendar (Day 18-21)
7. Android Tasks (Day 22-24)
8. Testing and documentation (Day 25+)

---

**Status:** Ready for execution
**Complexity:** High (18+ screens, 6 service layers, cross-platform)
**Risk Level:** Medium (Existing app scaffold reduces risk)
