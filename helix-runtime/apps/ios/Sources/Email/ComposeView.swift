import SwiftUI

/// Email composition view
struct ComposeView: View {
    @Bindable var store: EmailStore
    @Binding var isPresented: Bool
    var replyTo: Email? = nil
    var forwardEmail: Email? = nil

    @State private var draft: EmailDraft = EmailDraft()
    @State private var isSending = false
    @State private var showError = false
    @State private var errorMessage = ""
    @FocusState private var focusedField: FocusedField?

    enum FocusedField {
        case to, subject, body
    }

    var isValid: Bool {
        !draft.to.isEmpty && !draft.subject.isEmpty && !draft.body.isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: 12) {
                    // To field
                    HStack {
                        Text("To")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .frame(width: 40)

                        TextField("Recipients", text: Binding(
                            get: { draft.to.map { $0.email }.joined(separator: ", ") },
                            set: { newValue in
                                draft.to = newValue.split(separator: ",")
                                    .map { EmailAddress(name: nil, email: String($0).trimmingCharacters(in: .whitespaces)) }
                            }
                        ))
                        .focused($focusedField, equals: .to)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)

                    Divider()

                    // Cc/Bcc toggle
                    if !draft.cc.isEmpty || !draft.bcc.isEmpty {
                        HStack {
                            Text("Cc")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(width: 40)

                            TextField("Cc", text: Binding(
                                get: { draft.cc.map { $0.email }.joined(separator: ", ") },
                                set: { newValue in
                                    draft.cc = newValue.split(separator: ",")
                                        .map { EmailAddress(name: nil, email: String($0).trimmingCharacters(in: .whitespaces)) }
                                }
                            ))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)

                        Divider()

                        HStack {
                            Text("Bcc")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(width: 40)

                            TextField("Bcc", text: Binding(
                                get: { draft.bcc.map { $0.email }.joined(separator: ", ") },
                                set: { newValue in
                                    draft.bcc = newValue.split(separator: ",")
                                        .map { EmailAddress(name: nil, email: String($0).trimmingCharacters(in: .whitespaces)) }
                                }
                            ))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)

                        Divider()
                    }

                    // Subject
                    HStack {
                        Text("Subject")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .frame(width: 60)

                        TextField("Subject", text: $draft.subject)
                            .focused($focusedField, equals: .subject)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                }
                .background(Color(.systemGray6))

                // Body
                TextEditor(text: $draft.body)
                    .focused($focusedField, equals: .body)
                    .padding(12)
                    .font(.body)

                Spacer()
            }
            .navigationTitle("Compose Email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: sendEmail) {
                        if isSending {
                            ProgressView()
                        } else {
                            Text("Send")
                        }
                    }
                    .disabled(!isValid || isSending)
                }
            }
        }
        .onAppear {
            setupDraft()
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") { showError = false }
        } message: {
            Text(errorMessage)
        }
    }

    private func setupDraft() {
        draft = EmailDraft()

        if let replyTo {
            draft.to = [replyTo.from]
            draft.subject = replyTo.subject.hasPrefix("Re: ") ? replyTo.subject : "Re: \(replyTo.subject)"
            draft.inReplyTo = replyTo.id
        } else if let forwardEmail {
            draft.subject = forwardEmail.subject.hasPrefix("Fwd: ") ? forwardEmail.subject : "Fwd: \(forwardEmail.subject)"
        }
    }

    private func sendEmail() {
        isSending = true

        Task {
            do {
                await store.sendEmail(draft)
                isPresented = false
            } catch {
                errorMessage = error.localizedDescription
                showError = true
                isSending = false
            }
        }
    }
}

#Preview {
    ComposeView(
        store: EmailStore(service: EmailService(gateway: GatewaySession())),
        isPresented: .constant(true)
    )
}
