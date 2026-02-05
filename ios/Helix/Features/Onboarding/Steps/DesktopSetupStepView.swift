/**
 * Desktop Setup Step View - Helix iOS Onboarding
 * Guide users to install CLI on desktop
 */

import SwiftUI

struct DesktopSetupStepView: View {
    @Binding var data: OnboardingData
    @State private var selectedOS: OperatingSystem = .macOS
    @State private var showQRCode = false

    enum OperatingSystem: String, CaseIterable {
        case macOS = "macOS"
        case windows = "Windows"
        case linux = "Linux"

        var icon: String {
            switch self {
            case .macOS: return "apple.logo"
            case .windows: return "pc"
            case .linux: return "terminal"
            }
        }
    }

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 12) {
                Text("Set Up on Desktop")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text("Install Helix CLI on your desktop to run the local runtime")
                    .font(.system(size: 14))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Operating system selector
            VStack(spacing: 12) {
                Text("Select Your Operating System")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack(spacing: 8) {
                    ForEach(OperatingSystem.allCases, id: \.self) { os in
                        Button(action: { selectedOS = os }) {
                            VStack(spacing: 6) {
                                Image(systemName: os.icon)
                                    .font(.system(size: 16))

                                Text(os.rawValue)
                                    .font(.system(size: 11, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(
                                selectedOS == os
                                    ? Color(hex: "0686D4").opacity(0.2)
                                    : Color(hex: "111111").opacity(0.5)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(
                                        selectedOS == os
                                            ? Color(hex: "0686D4").opacity(0.5)
                                            : Color.white.opacity(0.05),
                                        lineWidth: 1
                                    )
                            )
                            .cornerRadius(8)
                            .foregroundColor(.white)
                        }
                    }
                }
            }

            // Instructions
            VStack(spacing: 12) {
                Text("Installation Instructions")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)

                ScrollView {
                    VStack(spacing: 12) {
                        switch selectedOS {
                        case .macOS:
                            installationSteps(
                                title: "macOS (Homebrew)",
                                steps: [
                                    "brew install helix-project/tap/helix",
                                    "helix init",
                                    "helix start"
                                ],
                                description: "Install via Homebrew (recommended)"
                            )

                        case .windows:
                            installationSteps(
                                title: "Windows (PowerShell)",
                                steps: [
                                    "iwr https://install.helix-project.org/windows.ps1 -useb | iex",
                                    "helix init",
                                    "helix start"
                                ],
                                description: "Run as Administrator"
                            )

                        case .linux:
                            installationSteps(
                                title: "Linux (curl)",
                                steps: [
                                    "curl -fsSL https://install.helix-project.org/linux.sh | bash",
                                    "helix init",
                                    "helix start"
                                ],
                                description: "Requires Node.js 22+"
                            )
                        }
                    }
                }
                .frame(maxHeight: 250)
            }

            // QR Code to web setup
            VStack(spacing: 12) {
                Button(action: { showQRCode = true }) {
                    HStack {
                        Image(systemName: "qrcode.viewfinder")
                        Text("Scan for Web Setup")
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(hex: "0686D4"))
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color(hex: "0686D4").opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(hex: "0686D4").opacity(0.3), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }

                Text("Scan with your desktop camera or visit the web setup page for detailed instructions")
                    .font(.system(size: 12))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .multilineTextAlignment(.center)
            }

            Spacer()

            // Confirm button
            HStack(spacing: 8) {
                Button(action: { data.desktopInstructionsViewed = true }) {
                    HStack {
                        Image(systemName: "checkmark")
                        Text("I've Set Up Helix")
                    }
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(12)
                    .background(Color(hex: "0686D4"))
                    .cornerRadius(8)
                }

                Button(action: { data.desktopInstructionsViewed = true }) {
                    Text("Skip")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color(hex: "a1a1aa"))
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(Color(hex: "111111").opacity(0.5))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.white.opacity(0.05), lineWidth: 1)
                        )
                        .cornerRadius(8)
                }
            }

            .sheet(isPresented: $showQRCode) {
                SetupQRSheet(os: selectedOS)
            }
        }
        .padding(24)
    }

    @ViewBuilder
    private func installationSteps(title: String, steps: [String], description: String) -> some View {
        VStack(spacing: 12) {
            VStack(spacing: 4) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(description)
                    .font(.system(size: 12))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            VStack(spacing: 8) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    HStack(spacing: 8) {
                        Text("\(index + 1)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color(hex: "0686D4"))
                            .frame(width: 20)

                        Text(step)
                            .font(.system(size: 12, design: .monospaced))
                            .foregroundColor(Color(hex: "33a7e7"))

                        Spacer()
                    }
                    .padding(8)
                    .background(Color(hex: "1a1a1a"))
                    .cornerRadius(6)
                }
            }
        }
        .padding(12)
        .background(Color(hex: "111111").opacity(0.5))
        .cornerRadius(8)
    }
}

struct SetupQRSheet: View {
    let os: DesktopSetupStepView.OperatingSystem
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 16) {
            HStack {
                Text("Desktop Setup QR Code")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)

                Spacer()

                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(Color(hex: "71717a"))
                }
            }

            Text("Scan this QR code on your desktop to open the setup page")
                .font(.system(size: 14))
                .foregroundColor(Color(hex: "a1a1aa"))

            QRCodeView(data: "https://helix-project.org/setup?os=\(os.rawValue)")
                .frame(height: 300)

            Text("Or visit: https://helix-project.org/setup")
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(Color(hex: "a1a1aa"))

            Spacer()
        }
        .padding(24)
        .background(Color(hex: "0a0a0a"))
    }
}

#if DEBUG
#Preview {
    DesktopSetupStepView(data: .constant(OnboardingData()))
        .preferredColorScheme(.dark)
}
#endif
