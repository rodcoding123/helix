import SwiftUI

// MARK: - Inbox View

struct InboxView: View {
    @Bindable var store: EmailStore
    @Binding var isComposePresented: Bool
    @State private var selectedEmail: Email?
    @State private var showDeleteConfirmation = false
    @State private var emailToDelete: Email?

    var body: some View {
        ZStack {
            if store.isLoading && store.emails.isEmpty {
                ProgressView()
            } else if store.emails.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "envelope.open")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)

                    Text("No emails")
                        .font(.headline)

                    Text("Your inbox is empty")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Button(action: { isComposePresented = true }) {
                        Label("Compose email", systemImage: "pencil")
                            .foregroundColor(.blue)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(store.emails) { email in
                        NavigationLink(
                            destination: EmailDetailView(email: email, store: store)
                        ) {
                            EmailRow(email: email, store: store)
                        }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive, action: {
                                emailToDelete = email
                                showDeleteConfirmation = true
                            }) {
                                Label("Delete", systemImage: "trash")
                            }

                            Button(action: {
                                Task {
                                    await store.toggleStar(email)
                                }
                            }) {
                                Label(
                                    email.isStarred ? "Unstar" : "Star",
                                    systemImage: email.isStarred ? "star.slash" : "star"
                                )
                            }
                            .tint(.orange)
                        }
                    }

                    // Load more button
                    if store.hasMoreEmails {
                        Button(action: {
                            Task {
                                await store.loadMoreEmails()
                            }
                        }) {
                            HStack {
                                Spacer()
                                if store.isLoading {
                                    ProgressView()
                                } else {
                                    Text("Load more")
                                        .foregroundColor(.blue)
                                }
                                Spacer()
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await store.refresh()
                }
            }
        }
        .confirmationDialog(
            "Delete email?",
            isPresented: $showDeleteConfirmation,
            presenting: emailToDelete
        ) { email in
            Button("Delete", role: .destructive) {
                Task {
                    await store.deleteEmail(email)
                }
            }
        } message: { email in
            Text("Delete this email from \(email.from.displayName)?")
        }
        .alert("Error", isPresented: .constant(store.error != nil), presenting: store.error) { _ in
            Button("OK") {
                store.error = nil
            }
        } message: { error in
            Text(error.localizedDescription)
        }
    }
}

// MARK: - Email Row

struct EmailRow: View {
    let email: Email
    @Bindable var store: EmailStore

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                if !email.isRead {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                }

                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(email.from.displayName)
                            .font(.system(.body, design: .default))
                            .fontWeight(email.isRead ? .regular : .semibold)
                            .lineLimit(1)

                        Spacer()

                        Text(formatDate(email.timestamp))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Text(email.subject)
                        .font(.system(.subheadline))
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                VStack(spacing: 4) {
                    if email.isStarred {
                        Image(systemName: "star.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.orange)
                    }

                    if email.attachmentCount > 0 {
                        Image(systemName: "paperclip")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }

    private func formatDate(_ date: Date) -> String {
        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(date) {
            return DateFormatter.localizedString(from: date, dateStyle: .none, timeStyle: .short)
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if calendar.dateComponents([.day], from: date, to: now).day ?? 0 < 7 {
            let formatter = DateFormatter()
            formatter.dateFormat = "EEE"
            return formatter.string(from: date)
        } else {
            return DateFormatter.localizedString(from: date, dateStyle: .short, timeStyle: .none)
        }
    }
}

// MARK: - Sent View

struct SentView: View {
    @Bindable var store: EmailStore

    var body: some View {
        ZStack {
            if store.isLoading {
                ProgressView()
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "paperplane")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)

                    Text("No sent emails")
                        .font(.headline)

                    Text("Your sent folder is empty")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

// MARK: - Drafts View

struct DraftsView: View {
    @Bindable var store: EmailStore
    @Binding var isComposePresented: Bool

    var body: some View {
        ZStack {
            if store.isLoading {
                ProgressView()
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)

                    Text("No drafts")
                        .font(.headline)

                    Text("Start composing a new email")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Button(action: { isComposePresented = true }) {
                        Label("Create draft", systemImage: "pencil")
                            .foregroundColor(.blue)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

// MARK: - Starred View

struct StarredView: View {
    @Bindable var store: EmailStore

    var body: some View {
        ZStack {
            if store.isLoading {
                ProgressView()
            } else {
                let starredEmails = store.emails.filter { $0.isStarred }

                if starredEmails.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "star")
                            .font(.system(size: 48))
                            .foregroundColor(.gray)

                        Text("No starred emails")
                            .font(.headline)

                        Text("Star important emails for later")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(starredEmails) { email in
                            NavigationLink(
                                destination: EmailDetailView(email: email, store: store)
                            ) {
                                EmailRow(email: email, store: store)
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Search View

struct SearchView: View {
    @Bindable var store: EmailStore
    let query: String

    var body: some View {
        ZStack {
            if query.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)

                    Text("Search emails")
                        .font(.headline)

                    Text("Enter search terms above")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.isSearching {
                ProgressView()
            } else if store.searchResults.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)

                    Text("No results")
                        .font(.headline)

                    Text("No emails match \"\(query)\"")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(store.searchResults) { email in
                        NavigationLink(
                            destination: EmailDetailView(email: email, store: store)
                        ) {
                            EmailRow(email: email, store: store)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .onChange(of: query) { _, newValue in
            if !newValue.isEmpty {
                Task {
                    var filter = EmailSearchFilter()
                    filter.query = newValue
                    await store.search(filter: filter)
                    store.saveSearch(newValue)
                }
            } else {
                store.searchResults = []
            }
        }
    }
}

#Preview {
    InboxView(store: EmailStore(service: EmailService(gateway: GatewaySession())), isComposePresented: .constant(false))
}
