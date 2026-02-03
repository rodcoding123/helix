import SwiftUI

/// Main email tab view
struct EmailTab: View {
    @Environment(NodeAppModel.self) private var appModel
    @State private var emailStore: EmailStore?
    @State private var selectedTab: EmailTabType = .inbox
    @State private var searchText = ""
    @State private var isComposePresented = false
    @State private var showSettings = false

    enum EmailTabType {
        case inbox, sent, drafts, search, starred
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab selector
                HStack(spacing: 0) {
                    ForEach([EmailTabType.inbox, .sent, .drafts, .starred], id: \.self) { tab in
                        Button(action: { selectedTab = tab }) {
                            VStack(spacing: 4) {
                                Image(systemName: tabIcon(for: tab))
                                    .font(.system(size: 14))
                                Text(tabLabel(for: tab))
                                    .font(.caption)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .foregroundColor(selectedTab == tab ? .blue : .gray)
                        }

                        if tab != .starred {
                            Divider()
                        }
                    }
                }
                .background(Color(.systemGray6))
                .border(Color(.systemGray4), width: 0.5)

                // Search bar
                SearchBar(text: $searchText)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)

                // Content
                ZStack {
                    if let store = emailStore {
                        switch selectedTab {
                        case .inbox:
                            InboxView(store: store, isComposePresented: $isComposePresented)

                        case .sent:
                            SentView(store: store)

                        case .drafts:
                            DraftsView(store: store, isComposePresented: $isComposePresented)

                        case .search:
                            SearchView(store: store, query: searchText)

                        case .starred:
                            StarredView(store: store)
                        }
                    } else {
                        ProgressView()
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    // Compose button
                    HStack {
                        Spacer()

                        Button(action: { isComposePresented = true }) {
                            Image(systemName: "pencil.circle.fill")
                                .font(.system(size: 50))
                                .foregroundColor(.blue)
                        }
                        .padding(20)
                    }
                    .background(Color(.systemBackground))
                }
            }
            .navigationTitle("Email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showSettings = true }) {
                        Image(systemName: "gear")
                    }
                }
            }
            .sheet(isPresented: $isComposePresented) {
                if let store = emailStore {
                    ComposeView(store: store, isPresented: $isComposePresented)
                }
            }
            .sheet(isPresented: $showSettings) {
                EmailSettingsView()
            }
        }
        .onAppear {
            if emailStore == nil {
                let service = EmailService(gateway: appModel.gatewaySession)
                let store = EmailStore(service: service)
                emailStore = store

                Task {
                    await store.loadEmails()
                }
            }
        }
    }

    private func tabIcon(for tab: EmailTabType) -> String {
        switch tab {
        case .inbox:
            return "envelope.open"
        case .sent:
            return "paperplane"
        case .drafts:
            return "doc.text"
        case .search:
            return "magnifyingglass"
        case .starred:
            return "star.fill"
        }
    }

    private func tabLabel(for tab: EmailTabType) -> String {
        switch tab {
        case .inbox:
            return "Inbox"
        case .sent:
            return "Sent"
        case .drafts:
            return "Drafts"
        case .search:
            return "Search"
        case .starred:
            return "Starred"
        }
    }
}

// MARK: - Search Bar

struct SearchBar: View {
    @Binding var text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.gray)

            TextField("Search emails...", text: $text)
                .textFieldStyle(.roundedBorder)

            if !text.isEmpty {
                Button(action: { text = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - Email Settings View

struct EmailSettingsView: View {
    @Environment(\.dismiss) var dismiss
    @State private var autoRefresh = true
    @State private var refreshInterval: Double = 5

    var body: some View {
        NavigationStack {
            Form {
                Section("Auto-Refresh") {
                    Toggle("Enable auto-refresh", isOn: $autoRefresh)

                    if autoRefresh {
                        Stepper(
                            "Refresh every \(Int(refreshInterval)) minutes",
                            value: $refreshInterval,
                            in: 1...60,
                            step: 1
                        )
                    }
                }

                Section("Display") {
                    Toggle("Show preview text", isOn: .constant(true))
                    Toggle("Show sender avatars", isOn: .constant(true))
                }

                Section("Storage") {
                    HStack {
                        Text("Storage used")
                        Spacer()
                        Text("2.5 GB / 15 GB")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Email Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    EmailTab()
        .environment(NodeAppModel(gatewaySession: GatewaySession()))
}
