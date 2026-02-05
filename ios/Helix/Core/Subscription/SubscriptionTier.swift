/**
 * Subscription Tier Types - Helix iOS
 * Tier hierarchy: core < phantom < overseer < architect
 */

import Foundation

enum SubscriptionTier: String, Codable {
    case core = "core"             // Free
    case phantom = "phantom"        // $9/mo - Privacy
    case overseer = "overseer"      // $29/mo - Observatory
    case architect = "architect"    // $99/mo - Full access

    var level: Int {
        switch self {
        case .core: return 0
        case .phantom: return 1
        case .overseer: return 2
        case .architect: return 3
        }
    }

    var name: String {
        switch self {
        case .core: return "Core"
        case .phantom: return "Phantom"
        case .overseer: return "Overseer"
        case .architect: return "Architect"
        }
    }

    var pricePerMonth: Int {
        switch self {
        case .core: return 0
        case .phantom: return 9
        case .overseer: return 29
        case .architect: return 99
        }
    }

    var features: [String] {
        switch self {
        case .core:
            return [
                "Single instance",
                "Basic chat interface",
                "Community support"
            ]
        case .phantom:
            return [
                "Everything in Core",
                "5 instances",
                "Private instance keys",
                "Email support"
            ]
        case .overseer:
            return [
                "Everything in Phantom",
                "Unlimited instances",
                "Observable interface",
                "Real-time logging",
                "Priority support"
            ]
        case .architect:
            return [
                "Everything in Overseer",
                "Full code interface",
                "Custom integrations",
                "Advanced analytics",
                "Dedicated support"
            ]
        }
    }

    func hasAccess(to requiredTier: SubscriptionTier) -> Bool {
        return self.level >= requiredTier.level
    }
}

struct Subscription: Codable, Identifiable {
    let id: String
    let userId: String
    let tier: SubscriptionTier
    let status: SubscriptionStatus
    let currentPeriodStart: Date
    let currentPeriodEnd: Date
    let cancelAtPeriodEnd: Bool

    enum CodingKeys: String, CodingKey {
        case id, userId, tier, status
        case currentPeriodStart = "current_period_start"
        case currentPeriodEnd = "current_period_end"
        case cancelAtPeriodEnd = "cancel_at_period_end"
    }
}

enum SubscriptionStatus: String, Codable {
    case active = "active"
    case pastDue = "past_due"
    case canceled = "canceled"
    case unpaid = "unpaid"
    case incomplete = "incomplete"

    var isActive: Bool {
        self == .active
    }

    var displayName: String {
        switch self {
        case .active: return "Active"
        case .pastDue: return "Past Due"
        case .canceled: return "Canceled"
        case .unpaid: return "Unpaid"
        case .incomplete: return "Incomplete"
        }
    }
}
