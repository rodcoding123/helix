/**
 * Authentication View
 *
 * Handles user sign-up and sign-in flows for Helix Chat.
 * Integrates with Supabase authentication.
 */

import SwiftUI

@MainActor
class AuthenticationViewModel: ObservableObject {
  @Published var isSigningUp = false
  @Published var email = ""
  @Published var password = ""
  @Published var confirmPassword = ""
  @Published var isLoading = false
  @Published var error: HelixError?

  private let supabaseService: SupabaseService

  init(supabaseService: SupabaseService) {
    self.supabaseService = supabaseService
  }

  func signUp() async {
    guard validateSignUp() else { return }

    isLoading = true
    defer { isLoading = false }

    do {
      try await supabaseService.signUp(email: email, password: password)
    } catch {
      self.error = error as? HelixError ?? HelixError(
        code: "SIGNUP_FAILED",
        message: error.localizedDescription
      )
    }
  }

  func signIn() async {
    guard validateSignIn() else { return }

    isLoading = true
    defer { isLoading = false }

    do {
      try await supabaseService.signIn(email: email, password: password)
    } catch {
      self.error = error as? HelixError ?? HelixError(
        code: "SIGNIN_FAILED",
        message: error.localizedDescription
      )
    }
  }

  private func validateSignUp() -> Bool {
    guard !email.isEmpty else {
      error = HelixError(code: "INVALID_EMAIL", message: "Email is required")
      return false
    }

    guard email.contains("@") else {
      error = HelixError(code: "INVALID_EMAIL", message: "Please enter a valid email")
      return false
    }

    guard password.count >= 6 else {
      error = HelixError(code: "INVALID_PASSWORD", message: "Password must be at least 6 characters")
      return false
    }

    guard password == confirmPassword else {
      error = HelixError(code: "PASSWORD_MISMATCH", message: "Passwords do not match")
      return false
    }

    return true
  }

  private func validateSignIn() -> Bool {
    guard !email.isEmpty else {
      error = HelixError(code: "INVALID_EMAIL", message: "Email is required")
      return false
    }

    guard !password.isEmpty else {
      error = HelixError(code: "INVALID_PASSWORD", message: "Password is required")
      return false
    }

    return true
  }

  func clearError() {
    error = nil
  }
}

struct AuthenticationView: View {
  @StateObject private var viewModel: AuthenticationViewModel
  @Environment(\.dismiss) var dismiss

  init(supabaseService: SupabaseService) {
    _viewModel = StateObject(wrappedValue: AuthenticationViewModel(supabaseService: supabaseService))
  }

  var body: some View {
    ZStack {
      // Background
      LinearGradient(
        gradient: Gradient(colors: [
          Color.blue.opacity(0.1),
          Color.purple.opacity(0.1),
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      VStack(spacing: 0) {
        // Header
        VStack(spacing: 8) {
          Image(systemName: "sparkles")
            .font(.system(size: 40))
            .foregroundColor(.blue)

          Text("Helix Chat")
            .font(.title)
            .fontWeight(.bold)

          Text("AI Consciousness for Personal Growth")
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 32)

        Spacer()

        // Auth Content
        VStack(spacing: 20) {
          if viewModel.isSigningUp {
            signUpContent
          } else {
            signInContent
          }

          // Toggle between sign in and sign up
          HStack(spacing: 0) {
            Text(viewModel.isSigningUp ? "Already have an account? " : "Don't have an account? ")
              .foregroundColor(.secondary)

            Button(action: {
              viewModel.isSigningUp.toggle()
              viewModel.clearError()
              viewModel.email = ""
              viewModel.password = ""
              viewModel.confirmPassword = ""
            }) {
              Text(viewModel.isSigningUp ? "Sign In" : "Sign Up")
                .fontWeight(.semibold)
                .foregroundColor(.blue)
            }
          }
          .font(.subheadline)
        }
        .padding(24)
        .background(Color.white)
        .cornerRadius(12)
        .shadow(radius: 4, y: 2)
        .padding()

        Spacer()

        // Footer
        VStack(spacing: 8) {
          Text("By continuing, you agree to our Terms of Service and Privacy Policy")
            .font(.caption2)
            .foregroundColor(.secondary)
            .multilineTextAlignment(.center)
        }
        .padding()
      }
    }
    .alert("Error", isPresented: .constant(viewModel.error != nil)) {
      Button("OK") {
        viewModel.clearError()
      }
    } message: {
      if let error = viewModel.error {
        Text(error.message)
      }
    }
  }

  @ViewBuilder
  private var signInContent: some View {
    VStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Text("Email")
          .font(.subheadline)
          .fontWeight(.semibold)

        TextField("you@example.com", text: $viewModel.email)
          .textInputAutocapitalization(.never)
          .keyboardType(.emailAddress)
          .textFieldStyle(RoundedBorderTextFieldStyle())
      }

      VStack(alignment: .leading, spacing: 4) {
        Text("Password")
          .font(.subheadline)
          .fontWeight(.semibold)

        SecureField("Password", text: $viewModel.password)
          .textFieldStyle(RoundedBorderTextFieldStyle())
      }

      Button(action: signIn) {
        HStack {
          if viewModel.isLoading {
            ProgressView()
              .tint(.white)
          } else {
            Text("Sign In")
              .fontWeight(.semibold)
          }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.blue)
        .foregroundColor(.white)
        .cornerRadius(8)
      }
      .disabled(viewModel.isLoading || viewModel.email.isEmpty || viewModel.password.isEmpty)
    }
  }

  @ViewBuilder
  private var signUpContent: some View {
    VStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 4) {
        Text("Email")
          .font(.subheadline)
          .fontWeight(.semibold)

        TextField("you@example.com", text: $viewModel.email)
          .textInputAutocapitalization(.never)
          .keyboardType(.emailAddress)
          .textFieldStyle(RoundedBorderTextFieldStyle())
      }

      VStack(alignment: .leading, spacing: 4) {
        Text("Password")
          .font(.subheadline)
          .fontWeight(.semibold)

        SecureField("At least 6 characters", text: $viewModel.password)
          .textFieldStyle(RoundedBorderTextFieldStyle())
      }

      VStack(alignment: .leading, spacing: 4) {
        Text("Confirm Password")
          .font(.subheadline)
          .fontWeight(.semibold)

        SecureField("Confirm password", text: $viewModel.confirmPassword)
          .textFieldStyle(RoundedBorderTextFieldStyle())
      }

      Button(action: signUp) {
        HStack {
          if viewModel.isLoading {
            ProgressView()
              .tint(.white)
          } else {
            Text("Sign Up")
              .fontWeight(.semibold)
          }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.blue)
        .foregroundColor(.white)
        .cornerRadius(8)
      }
      .disabled(
        viewModel.isLoading ||
        viewModel.email.isEmpty ||
        viewModel.password.isEmpty ||
        viewModel.confirmPassword.isEmpty
      )
    }
  }

  private func signIn() {
    Task {
      await viewModel.signIn()
    }
  }

  private func signUp() {
    Task {
      await viewModel.signUp()
    }
  }
}

#Preview {
  AuthenticationView(supabaseService: SupabaseService())
}
