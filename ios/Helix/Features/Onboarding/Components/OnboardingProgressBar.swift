/**
 * Onboarding Progress Bar - Helix iOS
 * Visual indicator of onboarding progress
 */

import SwiftUI

struct OnboardingProgressBar: View {
    let currentStep: Int
    let totalSteps: Int

    var progress: Double {
        Double(currentStep + 1) / Double(totalSteps)
    }

    var body: some View {
        VStack(spacing: 16) {
            // Progress bar
            VStack(spacing: 8) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Background
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color(hex: "1a1a1a"))

                        // Progress
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                LinearGradient(
                                    gradient: Gradient(colors: [
                                        Color(hex: "0686D4"),
                                        Color(hex: "33a7e7")
                                    ]),
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * progress)
                            .animation(.easeInOut(duration: 0.3), value: progress)
                    }
                }
                .frame(height: 4)

                HStack {
                    Text("Step \(currentStep + 1) of \(totalSteps)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(hex: "a1a1aa"))

                    Spacer()

                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(hex: "0686D4"))
                }
            }

            // Step indicators
            HStack(spacing: 12) {
                ForEach(0..<totalSteps, id: \.self) { step in
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(
                                    step < currentStep
                                        ? Color(hex: "22C55E")
                                        : step == currentStep
                                            ? Color(hex: "0686D4").opacity(0.2)
                                            : Color(hex: "1a1a1a")
                                )
                                .frame(width: 32, height: 32)

                            if step < currentStep {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(.white)
                            } else {
                                Text("\(step + 1)")
                                    .font(.system(size: 12, weight: .semibold))
                                    .foregroundColor(
                                        step == currentStep
                                            ? Color(hex: "0686D4")
                                            : Color(hex: "71717a")
                                    )
                            }
                        }
                        .overlay(
                            Circle()
                                .stroke(
                                    step == currentStep
                                        ? Color(hex: "0686D4").opacity(0.5)
                                        : Color.clear,
                                    lineWidth: 2
                                )
                        )

                        if step == currentStep {
                            Text("Current")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(Color(hex: "0686D4"))
                        }
                    }
                    .frame(maxWidth: .infinity)

                    if step < totalSteps - 1 {
                        VStack {
                            Divider()
                                .background(Color(hex: "27272a"))
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .frame(height: 60)
        }
        .padding(16)
        .background(Color(hex: "111111").opacity(0.3))
        .cornerRadius(8)
    }
}

#if DEBUG
#Preview {
    VStack(spacing: 16) {
        OnboardingProgressBar(currentStep: 0, totalSteps: 5)
        OnboardingProgressBar(currentStep: 2, totalSteps: 5)
        OnboardingProgressBar(currentStep: 4, totalSteps: 5)
    }
    .padding()
    .background(Color(hex: "0a0a0a"))
    .preferredColorScheme(.dark)
}
#endif
