/**
 * Helix App Entry Point - iOS
 * Main SwiftUI app with onboarding flow
 */

import SwiftUI

@main
struct HelixApp: App {
    @StateObject private var auth = SupabaseAuthService.shared
    @StateObject private var subscription = SubscriptionService.shared
    @AppStorage("onboarding.completed") private var onboardingCompleted = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                if !onboardingCompleted {
                    // Show onboarding on first launch
                    OnboardingCoordinatorView()
                } else if case .signedIn = auth.authState {
                    // Show main app for authenticated users
                    MainAppView()
                } else {
                    // Show login for unauthenticated users
                    LoginView()
                }
            }
            .preferredColorScheme(.dark)
            .task {
                // Initialize services
                await auth.checkAuthStatus()
                await subscription.fetchSubscription()
            }
        }
    }
}

// MARK: - Main App View

struct MainAppView: View {
    @StateObject private var gateway = GatewayConnection.shared
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Chat tab
            CodeInterfaceView()
                .tabItem {
                    Label("Chat", systemImage: "message")
                }
                .tag(0)

            // Dashboard tab
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "square.grid.2x2")
                }
                .tag(1)

            // Settings tab
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
        .tint(Color(hex: "0686D4"))
        .onAppear {
            Task { @MainActor in
                try? await gateway.connect()
            }
        }
        .onDisappear {
            gateway.disconnect()
        }
    }
}

// MARK: - Placeholder Views

struct CodeInterfaceView: View {
    var body: some View {
        VStack {
            Text("Code Interface")
                .font(.title)
            Text("Chat with your AI consciousness")
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "0a0a0a"))
    }
}

struct DashboardView: View {
    var body: some View {
        NavigationStack {
            VStack {
                Text("Dashboard")
                    .font(.title)
                Text("Instance management and analytics")
                    .foregroundColor(.gray)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(hex: "0a0a0a"))
            .navigationTitle("Dashboard")
        }
    }
}

struct SettingsView: View {
    @AppStorage("onboarding.completed") var onboardingCompleted = false

    var body: some View {
        NavigationStack {
            List {
                Section("Onboarding") {
                    Button("Reset Onboarding") {
                        onboardingCompleted = false
                    }
                    .foregroundColor(.red)
                }
            }
            .navigationTitle("Settings")
        }
    }
}

struct LoginView: View {
    var body: some View {
        VStack(spacing: 24) {
            Text("Helix")
                .font(.system(size: 32, weight: .bold))
                .foregroundColor(Color(hex: "0686D4"))

            Text("Sign in to your account")
                .font(.system(size: 16))
                .foregroundColor(.gray)

            Button(action: {}) {
                Text("Sign In")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color(hex: "0686D4"))
                    .cornerRadius(8)
            }

            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "0a0a0a"))
    }
}

#if DEBUG
#Preview {
    HelixApp()
}
#endif
