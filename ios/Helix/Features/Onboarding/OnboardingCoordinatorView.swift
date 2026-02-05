/**
 * Onboarding Coordinator View - Helix iOS
 * Main container that orchestrates all onboarding steps
 */

import SwiftUI

struct OnboardingCoordinatorView: View {
    @State private var coordinator = OnboardingCoordinator()
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            // Background with gradient orbs
            ZStack {
                Color(hex: "0a0a0a")

                // Decorative orbs
                Circle()
                    .fill(Color(hex: "0686D4").opacity(0.05))
                    .blur(radius: 100)
                    .frame(width: 400, height: 400)
                    .offset(x: -100, y: -200)

                Circle()
                    .fill(Color(hex: "7234ED").opacity(0.05))
                    .blur(radius: 100)
                    .frame(width: 400, height: 400)
                    .offset(x: 100, y: 200)
            }
            .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                VStack(spacing: 12) {
                    HStack {
                        Image(systemName: "sparkles")
                            .font(.system(size: 20))
                            .foregroundColor(Color(hex: "0686D4"))

                        Text("Helix Onboarding")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)

                        Spacer()

                        if coordinator.currentStep > 0 {
                            Button(action: { coordinator.previousStep() }) {
                                Image(systemName: "xmark")
                                    .font(.system(size: 16))
                                    .foregroundColor(Color(hex: "71717a"))
                            }
                        }
                    }
                    .padding(16)

                    OnboardingProgressBar(currentStep: coordinator.currentStep, totalSteps: coordinator.totalSteps)
                        .padding(16)
                }
                .background(Color(hex: "111111").opacity(0.3))
                .border(bottom: Color.white.opacity(0.05))

                // Step content
                TabView(selection: $coordinator.currentStep) {
                    WelcomeStepView()
                        .tag(0)

                    InstanceKeyStepView(data: $coordinator.data)
                        .tag(1)

                    DesktopSetupStepView(data: $coordinator.data)
                        .tag(2)

                    GatewayConnectionStepView(data: $coordinator.data)
                        .tag(3)

                    SuccessStepView(onComplete: completeOnboarding)
                        .tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .ignoresSafeArea()

                // Navigation buttons
                if coordinator.currentStep < coordinator.totalSteps - 1 {
                    HStack(spacing: 12) {
                        if coordinator.currentStep > 0 {
                            Button(action: { coordinator.previousStep() }) {
                                Text("Back")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(Color(hex: "a1a1aa"))
                                    .frame(maxWidth: .infinity)
                                    .padding(12)
                                    .background(Color(hex: "1a1a1a"))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(Color.white.opacity(0.05), lineWidth: 1)
                                    )
                                    .cornerRadius(8)
                            }
                        }

                        Button(action: { coordinator.nextStep() }) {
                            HStack(spacing: 8) {
                                Text(coordinator.canProceed ? "Continue" : "Complete Step")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(.white)

                                Image(systemName: "arrow.right")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(12)
                            .background(coordinator.canProceed ? Color(hex: "0686D4") : Color(hex: "0686D4").opacity(0.3))
                            .cornerRadius(8)
                        }
                        .disabled(!coordinator.canProceed)
                    }
                    .padding(16)
                    .background(Color(hex: "111111").opacity(0.3))
                    .border(top: Color.white.opacity(0.05))
                }
            }
        }
        .preferredColorScheme(.dark)
        .onChange(of: coordinator.isCompleted) { _, newValue in
            if newValue {
                dismiss()
            }
        }
    }

    private func completeOnboarding() {
        coordinator.completeOnboarding()
    }
}

// MARK: - View Extensions

extension View {
    func border(top: Color) -> some View {
        VStack(spacing: 0) {
            Divider()
                .background(top)
            self
        }
    }

    func border(bottom: Color) -> some View {
        VStack(spacing: 0) {
            self
            Divider()
                .background(bottom)
        }
    }
}

#if DEBUG
#Preview {
    OnboardingCoordinatorView()
}
#endif
