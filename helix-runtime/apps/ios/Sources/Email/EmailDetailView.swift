import SwiftUI

/// Detailed view of a single email
struct EmailDetailView: View {
    let email: Email
    @Bindable var store: EmailStore
    @Environment(\.dismiss) var dismiss
    @State private var isReplying = false
    @State private var isForwarding = false
    @State private var showActions = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: 12) {
                    // Subject
                    Text(email.subject)
                        .font(.title2)
                        .bold()

                    // From/To
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("From")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .textCase(.uppercase)

                                Text(email.from.displayName)
                                    .font(.body)
                                    .fontWeight(.semibold)

                                Text(email.from.email)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }

                        if !email.to.isEmpty {
                            Divider()

                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("To")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .textCase(.uppercase)

                                    ForEach(email.to, id: \.email) { recipient in
                                        Text(recipient.displayName)
                                            .font(.body)
                                    }
                                }
                                Spacer()
                            }
                        }

                        // Date
                        Divider()

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Date")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .textCase(.uppercase)

                                Text(email.timestamp, style: .date)
                                    .font(.body)

                                Text(email.timestamp, style: .time)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                    }
                    .padding(.vertical, 12)

                    // Labels
                    if !email.labels.isEmpty {
                        HStack(spacing: 6) {
                            ForEach(email.labels, id: \.self) { label in
                                Text(label)
                                    .font(.caption2)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue)
                                    .cornerRadius(4)
                            }
                        }
                        .padding(.top, 8)
                    }
                }
                .padding(16)
                .background(Color(.systemGray6))

                Divider()

                // Body
                VStack(alignment: .leading) {
                    Text(email.body)
                        .font(.body)
                        .lineSpacing(4)
                        .padding(16)
                }

                // Attachments
                if email.attachmentCount > 0 {
                    Divider()

                    VStack(alignment: .leading, spacing: 12) {
                        Label("Attachments", systemImage: "paperclip")
                            .font(.headline)

                        ForEach(0..<email.attachmentCount, id: \.self) { index in
                            HStack {
                                Image(systemName: "doc.fill")
                                    .foregroundColor(.blue)

                                VStack(alignment: .leading) {
                                    Text("Attachment \(index + 1)")
                                        .font(.body)

                                    Text("3.2 MB")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                Image(systemName: "arrow.down.circle")
                                    .foregroundColor(.blue)
                            }
                            .padding(12)
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                        }
                    }
                    .padding(16)
                }

                Spacer()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(false)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button(action: {
                    Task {
                        await store.toggleStar(email)
                    }
                }) {
                    Image(systemName: email.isStarred ? "star.fill" : "star")
                        .foregroundColor(email.isStarred ? .orange : .gray)
                }

                Menu {
                    Button(action: { isReplying = true }) {
                        Label("Reply", systemImage: "arrowshape.turn.up.left")
                    }

                    Button(action: { isForwarding = true }) {
                        Label("Forward", systemImage: "arrowshape.turn.up.right")
                    }

                    Divider()

                    Button(role: .destructive, action: {
                        Task {
                            await store.deleteEmail(email)
                            dismiss()
                        }
                    }) {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $isReplying) {
            ComposeView(
                store: store,
                isPresented: $isReplying,
                replyTo: email
            )
        }
        .sheet(isPresented: $isForwarding) {
            ComposeView(
                store: store,
                isPresented: $isForwarding,
                forwardEmail: email
            )
        }
    }
}

#Preview {
    NavigationStack {
        EmailDetailView(
            email: Email(
                id: "1",
                userId: "user-1",
                from: EmailAddress(name: "John Doe", email: "john@example.com"),
                to: [EmailAddress(name: "Jane Smith", email: "jane@example.com")],
                cc: nil,
                bcc: nil,
                subject: "Hello world",
                body: "This is a test email",
                htmlBody: nil,
                isRead: true,
                isStarred: false,
                threadId: "thread-1",
                messageId: nil,
                inReplyTo: nil,
                labels: ["inbox"],
                attachmentCount: 0,
                timestamp: Date(),
                receivedAt: Date()
            ),
            store: EmailStore(service: EmailService(gateway: GatewaySession()))
        )
    }
}
