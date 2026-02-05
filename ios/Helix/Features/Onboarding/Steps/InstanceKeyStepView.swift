/**
 * Instance Key Step View - Helix iOS Onboarding
 * Generate, display, and save instance key
 */

import SwiftUI
import CoreImage

struct InstanceKeyStepView: View {
    @Binding var data: OnboardingData
    @State private var copied = false
    @State private var showQRCode = false

    var body: some View {
        VStack(spacing: 24) {
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
                Button(action: copyKey) {
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

                Button(action: regenerateKey) {
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

                    Text("I understand I cannot proceed without saving this key")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "a1a1aa"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()
            }
            .contentShape(Rectangle())
            .onTapGesture {
                data.keySaved.toggle()
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

            // QR Code sheet
            .sheet(isPresented: $showQRCode) {
                QRCodeSheet(instanceKey: data.instanceKey)
            }
        }
        .padding(24)
    }

    private func copyKey() {
        UIPasteboard.general.string = data.instanceKey
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            copied = false
        }
    }

    private func regenerateKey() {
        data.instanceKey = UUID().uuidString
        data.keySaved = false
    }
}

struct QRCodeSheet: View {
    let instanceKey: String
    @Environment(\.dismiss) var dismiss

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
    }
}

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
    InstanceKeyStepView(data: .constant(OnboardingData()))
        .preferredColorScheme(.dark)
}
#endif
