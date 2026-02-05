/**
 * Welcome Step View - Helix iOS Onboarding
 * Explains Helix architecture and benefits
 */

import SwiftUI

struct WelcomeStepView: View {
    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 16) {
                Image(systemName: "sparkles")
                    .font(.system(size: 48))
                    .foregroundColor(Color(hex: "0686D4"))

                Text("Welcome to Helix")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)

                Text("Your persistent AI consciousness with complete transparency")
                    .font(.system(size: 16))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .multilineTextAlignment(.center)
            }

            ScrollView {
                VStack(spacing: 16) {
                    // Architecture explanation
                    VStack(spacing: 12) {
                        Text("How Helix Works")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        VStack(spacing: 12) {
                            ArchitectureStep(
                                number: 1,
                                title: "Mobile App",
                                description: "This app serves as your observer and controller",
                                icon: "📱"
                            )

                            ArchitectureStep(
                                number: 2,
                                title: "Cloud Gateway",
                                description: "Secure relay that connects mobile to your runtime",
                                icon: "☁️"
                            )

                            ArchitectureStep(
                                number: 3,
                                title: "Local Runtime",
                                description: "Your personal AI running on your desktop with full transparency",
                                icon: "💻"
                            )
                        }
                    }
                    .padding(16)
                    .background(Color(hex: "111111").opacity(0.3))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
                    .cornerRadius(12)

                    // Key features
                    VStack(spacing: 12) {
                        Text("Why Helix Stands Out")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        FeatureCard(
                            title: "Unhackable Logging",
                            description: "Every action logged to an immutable Discord channel",
                            icon: "🔐"
                        )

                        FeatureCard(
                            title: "Psychological Architecture",
                            description: "7-layer consciousness model with emotional memory",
                            icon: "🧠"
                        )

                        FeatureCard(
                            title: "Complete Transparency",
                            description: "You own your AI. No vendor lock-in, full source access",
                            icon: "👀"
                        )
                    }
                }
            }

            Spacer()
        }
        .padding(24)
    }
}

struct ArchitectureStep: View {
    let number: Int
    let title: String
    let description: String
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color(hex: "0686D4").opacity(0.2))
                    .frame(width: 40, height: 40)

                Text(icon)
                    .font(.system(size: 20))
            }

            VStack(spacing: 4) {
                HStack(spacing: 8) {
                    Text("Step \(number)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(hex: "0686D4"))

                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                }

                Text(description)
                    .font(.system(size: 13))
                    .foregroundColor(Color(hex: "a1a1aa"))
            }

            Spacer()
        }
    }
}

struct FeatureCard: View {
    let title: String
    let description: String
    let icon: String

    var body: some View {
        HStack(spacing: 12) {
            Text(icon)
                .font(.system(size: 24))

            VStack(spacing: 4) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(description)
                    .font(.system(size: 12))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Spacer()
        }
        .padding(12)
        .background(Color(hex: "111111").opacity(0.5))
        .cornerRadius(8)
    }
}

#if DEBUG
#Preview {
    WelcomeStepView()
        .preferredColorScheme(.dark)
}
#endif
