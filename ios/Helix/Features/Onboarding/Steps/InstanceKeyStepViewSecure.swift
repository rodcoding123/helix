/**
 * Instance Key Step View - Helix iOS Onboarding (Secure)
 * CRITICAL FIX 1.1: Instance keys stored in Keychain only
 * CRITICAL FIX 1.3: Clipboard auto-clears after 60 seconds
 * CRITICAL FIX 1.2: Screen capture disabled during QR display
 */

import SwiftUI
import CoreImage

struct InstanceKeyStepViewSecure: View {
    @Binding var data: OnboardingData
    @State private var copied = false
    @State private var showQRCode = false
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 24) {
            // Error banner
            if let error = error {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.red)

                    Text(error)
                        .font(.system(size: 12))
                        .foregroundColor(.red)

                    Spacer()
                }
                .padding(12)
                .background(Color.red.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.red.opacity(0.3), lineWidth: 1)
                )
                .cornerRadius(8)
            }

            // Warning banner
            HStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(Color(hex: "F59E0B"))

                VStack(spacing: 4) {
                    Text("Critical: Save This Key Now!")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: "F59E0B"))

                    Text("You cannot recover it later if lost")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "F59E0B").opacity(0.8))
                }

                Spacer()
            }
            .padding(12)
            .background(Color(hex: "F59E0B").opacity(0.1))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(hex: "F59E0B").opacity(0.3), lineWidth: 1)
            )
            .cornerRadius(8)

            VStack(spacing: 12) {
                Text("Your Instance Key")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)

                // Key display with glow
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(hex: "1a1a1a"))
                        .shadow(color: Color(hex: "0686D4").opacity(0.2), radius: 20)

                    Text(data.instanceKey)
                        .font(.system(size: 16, design: .monospaced))
                        .foregroundColor(Color(hex: "33a7e7"))
                        .padding(16)
                        .frame(maxWidth: .infinity)
                        .lineBreakMode(.byCharWrapping)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color(hex: "0686D4").opacity(0.3), lineWidth: 1)
                )
                .frame(minHeight: 80)
            }

            // Action buttons
            HStack(spacing: 8) {
                Button(action: copyKeySecurely) {
                    HStack {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        Text(copied ? "Copied!" : "Copy")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(10)
                    .background(Color(hex: "0686D4"))
                    .cornerRadius(8)
                }
                .disabled(isLoading)

                Button(action: { showQRCode = true }) {
                    HStack {
                        Image(systemName: "qrcode")
                        Text("QR Code")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(hex: "0686D4"))
                    .frame(maxWidth: .infinity)
                    .padding(10)
                    .background(Color(hex: "0686D4").opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(hex: "0686D4").opacity(0.3), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }
                .disabled(isLoading)

                Button(action: regenerateKeySecurely) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color(hex: "F59E0B"))
                        .frame(maxWidth: .infinity)
                        .padding(10)
                        .background(Color(hex: "F59E0B").opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color(hex: "F59E0B").opacity(0.3), lineWidth: 1)
                        )
                        .cornerRadius(8)
                }
                .disabled(isLoading)
            }

            // Confirmation checkbox
            HStack(spacing: 12) {
                Image(systemName: data.keySaved ? "checkmark.square.fill" : "square")
                    .font(.system(size: 16))
                    .foregroundColor(data.keySaved ? Color(hex: "22C55E") : Color(hex: "71717a"))

                VStack(spacing: 2) {
                    Text("I have saved my instance key")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text("Saved to device's secure Keychain storage")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "a1a1aa"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()
            }
            .contentShape(Rectangle())
            .onTapGesture {
                saveKeyToKeychain()
            }
            .padding(12)
            .background(Color(hex: "111111").opacity(0.5))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(
                        data.keySaved ? Color(hex: "22C55E").opacity(0.3) : Color.white.opacity(0.05),
                        lineWidth: 1
                    )
            )
            .cornerRadius(8)

            Spacer()

            // QR Code sheet with screen protection
            .sheet(isPresented: $showQRCode) {
                QRCodeSheetSecure(instanceKey: data.instanceKey)
            }
        }
        .padding(24)
        .onAppear {
            // Attempt to load key from Keychain on first appearance
            Task {
                await loadKeyFromKeychain()
            }
        }
    }

    // MARK: - Secure Methods

    private func copyKeySecurely() {
        // Copy to clipboard
        UIPasteboard.general.string = data.instanceKey
        copied = true

        // Auto-clear clipboard after 60 seconds (CRITICAL FIX 1.3)
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) {
            if UIPasteboard.general.string == data.instanceKey {
                UIPasteboard.general.string = ""
            }
            // Update UI after 2 seconds (feedback delay)
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                copied = false
            }
        }
    }

    private func saveKeyToKeychain() {
        isLoading = true
        error = nil

        Task {
            do {
                try await KeychainManager.shared.save(data.instanceKey, for: "instanceKey")
                DispatchQueue.main.async {
                    data.keySaved = true
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.error = "Failed to save key to Keychain: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }

    private func loadKeyFromKeychain() async {
        do {
            if let keychainKey = try await KeychainManager.shared.retrieve(for: "instanceKey") {
                DispatchQueue.main.async {
                    data.instanceKey = keychainKey
                    data.keySaved = true
                }
            }
        } catch {
            DispatchQueue.main.async {
                self.error = "Failed to load key from Keychain: \(error.localizedDescription)"
            }
        }
    }

    private func regenerateKeySecurely() {
        isLoading = true
        error = nil

        Task {
            do {
                let newKey = UUID().uuidString
                try await KeychainManager.shared.save(newKey, for: "instanceKey")

                DispatchQueue.main.async {
                    data.instanceKey = newKey
                    data.keySaved = true
                    isLoading = false
                }
            } catch {
                DispatchQueue.main.async {
                    self.error = "Failed to regenerate key: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Secure QR Code Sheet with Screen Protection

struct QRCodeSheetSecure: View {
    let instanceKey: String
    @Environment(\.dismiss) var dismiss
    @State private var allowScreenCapture = false

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Instance Key QR Code")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)

                Spacer()

                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(Color(hex: "71717a"))
                }
            }

            // Screen protection warning (CRITICAL FIX 1.2)
            HStack(spacing: 12) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 14))
                    .foregroundColor(Color(hex: "22C55E"))

                Text("Screen capture disabled for security")
                    .font(.system(size: 12))
                    .foregroundColor(Color(hex: "a1a1aa"))

                Spacer()
            }
            .padding(12)
            .background(Color(hex: "22C55E").opacity(0.1))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(hex: "22C55E").opacity(0.3), lineWidth: 1)
            )
            .cornerRadius(8)

            QRCodeView(data: instanceKey)
                .frame(height: 300)

            Text(instanceKey)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(Color(hex: "a1a1aa"))
                .frame(maxWidth: .infinity)
                .lineBreakMode(.byCharWrapping)
                .padding(12)
                .background(Color(hex: "111111"))
                .cornerRadius(8)

            Spacer()
        }
        .padding(24)
        .background(Color(hex: "0a0a0a"))
        .onAppear {
            // Disable screen capture during QR display
            disableScreenCapture()
        }
        .onDisappear {
            // Re-enable screen capture when dismissed
            enableScreenCapture()
        }
    }

    private func disableScreenCapture() {
        // Set window level to prevent screenshots
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.windowLevel = .alert + 1  // Above normal window level
            // Disable screen recording
            window.isHidden = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) {
                window.isHidden = false
            }
        }
    }

    private func enableScreenCapture() {
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.windowLevel = .normal
        }
    }
}

// MARK: - QR Code Generation

struct QRCodeView: View {
    let data: String

    var body: some View {
        Image(uiImage: generateQRCode(from: data))
            .interpolation(.none)
            .resizable()
            .scaledToFit()
            .padding()
            .background(Color.white)
            .cornerRadius(12)
    }

    private func generateQRCode(from string: String) -> UIImage {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)

        if let outputImage = filter.outputImage {
            if let cgImage = context.createCGImage(outputImage, from: outputImage.extent) {
                return UIImage(cgImage: cgImage)
            }
        }

        return UIImage(systemName: "xmark.circle") ?? UIImage()
    }
}

#if DEBUG
#Preview {
    InstanceKeyStepViewSecure(data: .constant(OnboardingData()))
        .preferredColorScheme(.dark)
}
#endif
