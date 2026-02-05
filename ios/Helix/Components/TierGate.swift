/**
 * Tier Gate - Helix iOS
 * SwiftUI view modifier for protecting features behind subscription tiers
 * Reference: web/src/components/auth/TierGate.tsx
 */

import SwiftUI

struct TierGateModifier<Upgrade: View>: ViewModifier {
    @StateObject private var subscription = SubscriptionService.shared

    let requiredTier: SubscriptionTier
    let upgrade: Upgrade?
    let showUpgrade: Bool

    func body(content: Content) -> some View {
        Group {
            if subscription.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(hex: "0a0a0a"))
            } else if subscription.hasAccess(to: requiredTier) {
                content
            } else if let upgrade = upgrade {
                upgrade
            } else if showUpgrade {
                defaultUpgradePrompt
            } else {
                EmptyView()
            }
        }
        .task {
            await subscription.fetchSubscription()
        }
    }

    private var defaultUpgradePrompt: some View {
        VStack(spacing: 24) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color(hex: "1a1a1a"))
                    .frame(width: 64, height: 64)

                Image(systemName: "lock.fill")
                    .font(.system(size: 32))
                    .foregroundColor(Color(hex: "71717a"))
            }

            VStack(spacing: 12) {
                Text("\(requiredTier.name) Required")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)

                Text("This feature requires the \(requiredTier.name) plan ($\(requiredTier.pricePerMonth)/month). Upgrade to unlock this and other premium features.")
                    .font(.system(size: 16))
                    .foregroundColor(Color(hex: "a1a1aa"))
                    .multilineTextAlignment(.center)
            }

            // Features list
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 12))
                        .foregroundColor(Color(hex: "33a7e7"))

                    Text("What you'll get:")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color(hex: "d4d4d8"))
                }

                VStack(spacing: 8) {
                    ForEach(requiredTier.features, id: \.self) { feature in
                        HStack(spacing: 8) {
                            Text("•")
                                .foregroundColor(Color(hex: "33a7e7"))

                            Text(feature)
                                .font(.system(size: 14))
                                .foregroundColor(Color(hex: "a1a1aa"))

                            Spacer()
                        }
                    }
                }
            }
            .padding(16)
            .background(Color(hex: "1a1a1a").opacity(0.5))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color(hex: "27272a"), lineWidth: 1)
            )

            HStack(spacing: 12) {
                NavigationLink(destination: Text("Pricing Page")) {
                    Text("View Plans")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(Color(hex: "0686D4"))
                        .cornerRadius(8)
                }

                NavigationLink(destination: Text("Dashboard")) {
                    Text("Back to Dashboard")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color(hex: "a1a1aa"))
                        .frame(maxWidth: .infinity)
                        .padding(12)
                        .background(Color(hex: "1a1a1a"))
                        .cornerRadius(8)
                }
            }

            Spacer()
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "0a0a0a"))
    }
}

extension View {
    /// Gate a view behind a subscription tier
    func tierGate(
        requiredTier: SubscriptionTier,
        showUpgrade: Bool = true,
        upgrade: AnyView? = nil
    ) -> some View {
        self.modifier(TierGateModifier(requiredTier: requiredTier, upgrade: upgrade, showUpgrade: showUpgrade))
    }

    /// Gate a view with custom upgrade view
    func tierGate<Upgrade: View>(
        requiredTier: SubscriptionTier,
        @ViewBuilder upgrade: () -> Upgrade
    ) -> some View {
        self.modifier(TierGateModifier(requiredTier: requiredTier, upgrade: upgrade(), showUpgrade: false))
    }
}

// MARK: - Preview

#if DEBUG
struct TierGate_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            Text("Architect Feature")
                .font(.title)
        }
        .tierGate(requiredTier: .architect)
    }
}
#endif
