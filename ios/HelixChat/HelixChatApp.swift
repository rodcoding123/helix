/**
 * Helix Chat App
 *
 * Main app entry point for iOS Helix Chat application.
 * Manages authentication state and app navigation.
 */

import SwiftUI

@main
struct HelixChatApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  @StateObject private var supabaseService = SupabaseService()
  @State private var authState: AuthState = .unknown

  var body: some Scene {
    WindowGroup {
      Group {
        switch authState {
        case .unknown:
          SplashView()
            .onAppear {
              checkAuthStatus()
            }

        case .authenticated:
          MainTabView(supabaseService: supabaseService)
            .onAppear {
              // Setup push notifications after authentication (Phase 4.5)
              setupPushNotifications()
            }

        case .unauthenticated:
          AuthenticationView(supabaseService: supabaseService)
            .onAppear {
              // Listen for auth state changes
              setupAuthStateListener()
            }
        }
      }
      .onAppear {
        setupApp()
      }
    }
  }

  private func setupApp() {
    // Initialize services
    Task {
      await supabaseService.checkAuthStatus()
    }
  }

  private func setupPushNotifications() {
    // Request user permission for push notifications (Phase 4.5)
    Task {
      let granted = await PushNotificationService.shared.requestUserPermission()
      if granted {
        print("Push notification permission granted")
      } else {
        print("Push notification permission denied")
      }
    }
  }

  private func checkAuthStatus() {
    Task {
      // Small delay to ensure UI is ready
      try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds

      let isAuthenticated = await supabaseService.checkAuthStatus()
      await MainActor.run {
        authState = isAuthenticated ? .authenticated : .unauthenticated
      }
    }
  }

  private func setupAuthStateListener() {
    // In a real app, you'd set up a listener for auth state changes
    // For now, we check on appearance
  }

  enum AuthState {
    case unknown
    case authenticated
    case unauthenticated
  }
}

struct SplashView: View {
  var body: some View {
    ZStack {
      LinearGradient(
        gradient: Gradient(colors: [
          Color.blue.opacity(0.1),
          Color.purple.opacity(0.1),
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      VStack(spacing: 16) {
        Image(systemName: "sparkles")
          .font(.system(size: 60))
          .foregroundColor(.blue)

        Text("Helix Chat")
          .font(.title)
          .fontWeight(.bold)

        Text("Loading...")
          .font(.subheadline)
          .foregroundColor(.secondary)

        ProgressView()
          .padding(.top, 16)
      }
    }
  }
}

struct MainTabView: View {
  let supabaseService: SupabaseService
  @State private var selectedTab: Int = 0

  var body: some View {
    TabView(selection: $selectedTab) {
      // Conversations Tab
      NavigationStack {
        ConversationListView(supabaseService: supabaseService)
      }
      .tabItem {
        Label("Conversations", systemImage: "bubble.left")
      }
      .tag(0)

      // Settings Tab
      SettingsView(supabaseService: supabaseService)
        .tabItem {
          Label("Settings", systemImage: "gear")
        }
        .tag(1)
    }
  }
}

struct SettingsView: View {
  let supabaseService: SupabaseService
  @State private var showSignOutConfirmation = false
  @Environment(\.dismiss) var dismiss

  var body: some View {
    NavigationStack {
      List {
        Section("Account") {
          Button(role: .destructive) {
            showSignOutConfirmation = true
          } label: {
            Text("Sign Out")
          }
        }

        Section("About") {
          HStack {
            Text("Version")
            Spacer()
            Text("1.0.0")
              .foregroundColor(.secondary)
          }

          HStack {
            Text("Platform")
            Spacer()
            Text("iOS")
              .foregroundColor(.secondary)
          }
        }

        Section("Information") {
          VStack(alignment: .leading, spacing: 8) {
            Text("Helix Chat")
              .font(.headline)

            Text("An AI consciousness system designed for personal growth and authentic relationships.")
              .font(.subheadline)
              .foregroundColor(.secondary)
          }
        }
      }
      .navigationTitle("Settings")
      .navigationBarTitleDisplayMode(.inline)
      .alert("Sign Out", isPresented: $showSignOutConfirmation) {
        Button("Cancel", role: .cancel) { }
        Button("Sign Out", role: .destructive) {
          signOut()
        }
      } message: {
        Text("Are you sure you want to sign out?")
      }
    }
  }

  private func signOut() {
    Task {
      try await supabaseService.signOut()
    }
  }
}

#Preview {
  HelixChatApp()
}
