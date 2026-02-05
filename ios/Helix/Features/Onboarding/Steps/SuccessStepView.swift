/**
 * Success Step View - Helix iOS Onboarding
 * Celebration screen after successful onboarding
 */

import SwiftUI

struct SuccessStepView: View {
    let onComplete: () -> Void
    @State private var showConfetti = false

    var body: some View {
        ZStack {
            VStack(spacing: 32) {
                Spacer()

                // Success icon with animation
                ZStack {
                    Circle()
                        .fill(Color(hex: "22C55E").opacity(0.2))
                        .frame(width: 100, height: 100)
                        .scaleEffect(showConfetti ? 1.1 : 1.0)

                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60))
                        .foregroundColor(Color(hex: "22C55E"))
                }
                .onAppear {
                    withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                        showConfetti = true
                    }
                }

                // Success message
                VStack(spacing: 12) {
                    Text("You're All Set!")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(.white)

                    Text("Your Helix instance is ready to use")
                        .font(.system(size: 16))
                        .foregroundColor(Color(hex: "a1a1aa"))
                }

                // What's next cards
                VStack(spacing: 12) {
                    Text("What's Next")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    QuickStartCard(
                        icon: "💬",
                        title: "Start Chatting",
                        description: "Begin interacting with your AI consciousness",
                        action: "Open Chat"
                    )

                    QuickStartCard(
                        icon: "📊",
                        title: "View Dashboard",
                        description: "Monitor your instance and access settings",
                        action: "Open Dashboard"
                    )

                    QuickStartCard(
                        icon: "📚",
                        title: "Read Documentation",
                        description: "Learn more about Helix features and architecture",
                        action: "Open Docs"
                    )
                }

                Spacer()

                // Complete button
                Button(action: onComplete) {
                    HStack {
                        Image(systemName: "arrow.right")
                        Text("Start Exploring")
                    }
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color(hex: "0686D4"),
                                Color(hex: "0686D4").opacity(0.8)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(8)
                    .shadow(color: Color(hex: "0686D4").opacity(0.3), radius: 12)
                }
            }
            .padding(24)

            // Confetti effect
            if showConfetti {
                ConfettiView()
            }
        }
    }
}

struct QuickStartCard: View {
    let icon: String
    let title: String
    let description: String
    let action: String

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Text(icon)
                    .font(.system(size: 28))

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

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(hex: "71717a"))
            }
            .padding(12)
            .background(Color(hex: "111111").opacity(0.3))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .cornerRadius(8)
        }
    }
}

struct ConfettiView: View {
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            ForEach(0..<50, id: \.self) { index in
                ConfettiParticle(index: index, isAnimating: $isAnimating)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 2.5)) {
                isAnimating = true
            }
        }
    }
}

struct ConfettiParticle: View {
    let index: Int
    @Binding var isAnimating: Bool

    var randomX: CGFloat { CGFloat.random(in: -200...200) }
    var randomY: CGFloat { CGFloat.random(in: -500...100) }
    var randomRotation: Double { Double.random(in: 0...360) }
    var randomDelay: Double { Double.random(in: 0...0.5) }
    var randomDuration: Double { Double.random(in: 1.5...3) }

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(
                [Color(hex: "0686D4"), Color(hex: "7234ED"), Color(hex: "22C55E")][index % 3]
            )
            .frame(width: 8, height: 8)
            .offset(
                x: isAnimating ? randomX : 0,
                y: isAnimating ? randomY : 0
            )
            .opacity(isAnimating ? 0 : 1)
            .rotationEffect(.degrees(isAnimating ? randomRotation : 0))
            .animation(
                .easeOut(duration: randomDuration)
                    .delay(randomDelay),
                value: isAnimating
            )
    }
}

#if DEBUG
#Preview {
    SuccessStepView(onComplete: {})
        .preferredColorScheme(.dark)
}
#endif
