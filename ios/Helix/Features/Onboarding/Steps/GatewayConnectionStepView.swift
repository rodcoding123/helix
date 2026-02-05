/**
 * Gateway Connection Step View - Helix iOS Onboarding
 * Verify connection to cloud gateway
 */

import SwiftUI

struct GatewayConnectionStepView: View {
    @Binding var data: OnboardingData
    @StateObject private var gateway = GatewayConnection.shared
    @State private var isConnecting = false
    @State private var showAdvancedOptions = false

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 16) {
                Text("Connect to Gateway")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text("Verify connection to the cloud gateway")
                    .font(.system(size: 14))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            VStack(spacing: 12) {
                Text("Gateway URL")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)

                TextField("Gateway URL", text: $data.gatewayUrl)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(12)
                    .background(Color(hex: "1a1a1a"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(hex: "0686D4").opacity(0.3), lineWidth: 1)
                    )
                    .cornerRadius(8)
                    .disabled(isConnecting)
            }

            // Connection status
            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: connectionStatusIcon)
                        .font(.system(size: 14))
                        .foregroundColor(connectionStatusColor)

                    Text(connectionStatusText)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(connectionStatusColor)

                    Spacer()
                }
                .padding(12)
                .background(connectionStatusBackground)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(connectionStatusBorder, lineWidth: 1)
                )
                .cornerRadius(8)

                if let error = data.connectionError {
                    Text(error)
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "EF4444"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Color(hex: "EF4444").opacity(0.1))
                        .cornerRadius(8)
                }
            }

            // Connection details
            if gateway.isConnected {
                VStack(spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundColor(Color(hex: "22C55E"))

                        VStack(spacing: 4) {
                            Text("Successfully Connected")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(Color(hex: "22C55E"))

                            Text("Your mobile app can now communicate with Helix")
                                .font(.system(size: 12))
                                .foregroundColor(Color(hex: "a1a1aa"))
                        }

                        Spacer()
                    }
                    .padding(12)
                    .background(Color(hex: "22C55E").opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(hex: "22C55E").opacity(0.3), lineWidth: 1)
                    )
                    .cornerRadius(8)
                }
            }

            Spacer()

            // Connect button
            HStack(spacing: 12) {
                Button(action: attemptConnection) {
                    if isConnecting {
                        HStack {
                            ProgressView()
                                .tint(.white)
                            Text("Connecting...")
                        }
                    } else if gateway.isConnected {
                        HStack {
                            Image(systemName: "checkmark")
                            Text("Connected")
                        }
                    } else {
                        HStack {
                            Image(systemName: "link")
                            Text("Connect")
                        }
                    }
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(
                    gateway.isConnected
                        ? Color(hex: "22C55E")
                        : Color(hex: "0686D4")
                )
                .cornerRadius(8)
                .disabled(isConnecting || data.instanceKey.isEmpty)

                if gateway.isConnected {
                    Button(action: { gateway.disconnect() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color(hex: "F59E0B"))
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(Color(hex: "F59E0B").opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color(hex: "F59E0B").opacity(0.3), lineWidth: 1)
                            )
                            .cornerRadius(8)
                    }
                }
            }

            // Advanced options
            DisclosureGroup("Advanced Options", isExpanded: $showAdvancedOptions) {
                VStack(spacing: 12) {
                    Text("Custom Gateway URL")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(hex: "a1a1aa"))
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text("For self-hosted or development gateways, enter the WebSocket URL (e.g., wss://custom-gateway.example.com/v1/connect)")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "71717a"))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(12)
                .background(Color(hex: "111111").opacity(0.5))
                .cornerRadius(8)
            }
        }
        .padding(24)
        .onChange(of: gateway.isConnected) { oldValue, newValue in
            if newValue {
                data.gatewayConnected = true
                data.connectionError = nil
            }
        }
        .onChange(of: gateway.lastError) { oldValue, newValue in
            if let error = newValue {
                data.connectionError = error.message
            }
        }
    }

    private var connectionStatusIcon: String {
        if isConnecting {
            return "hourglass"
        } else if gateway.isConnected {
            return "checkmark.circle.fill"
        } else if data.connectionError != nil {
            return "xmark.circle.fill"
        } else {
            return "circle"
        }
    }

    private var connectionStatusColor: Color {
        if gateway.isConnected {
            return Color(hex: "22C55E")
        } else if data.connectionError != nil {
            return Color(hex: "EF4444")
        } else {
            return Color(hex: "71717a")
        }
    }

    private var connectionStatusText: String {
        if isConnecting {
            return "Connecting to gateway..."
        } else if gateway.isConnected {
            return "Connected"
        } else if data.connectionError != nil {
            return "Connection failed"
        } else {
            return "Not connected"
        }
    }

    private var connectionStatusBackground: Color {
        if gateway.isConnected {
            return Color(hex: "22C55E").opacity(0.1)
        } else if data.connectionError != nil {
            return Color(hex: "EF4444").opacity(0.1)
        } else {
            return Color(hex: "1a1a1a").opacity(0.5)
        }
    }

    private var connectionStatusBorder: Color {
        if gateway.isConnected {
            return Color(hex: "22C55E").opacity(0.3)
        } else if data.connectionError != nil {
            return Color(hex: "EF4444").opacity(0.3)
        } else {
            return Color.white.opacity(0.05)
        }
    }

    private func attemptConnection() {
        isConnecting = true
        data.connectionError = nil

        Task { @MainActor in
            do {
                // Initialize gateway if not already done
                try await gateway.initialize(
                    instanceKey: data.instanceKey,
                    authTokenProvider: { await SupabaseAuthService.shared.getAccessToken() },
                    gatewayUrl: data.gatewayUrl
                )

                // Connect
                try await gateway.connect()

                data.gatewayConnected = true
                isConnecting = false
            } catch {
                data.connectionError = error.localizedDescription
                isConnecting = false
            }
        }
    }
}

#if DEBUG
#Preview {
    GatewayConnectionStepView(data: .constant(OnboardingData()))
        .preferredColorScheme(.dark)
}
#endif
