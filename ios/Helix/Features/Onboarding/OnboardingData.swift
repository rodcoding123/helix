/**
 * Onboarding Data Model - Helix iOS
 * Shared state across all onboarding steps
 */

import Foundation

struct OnboardingData {
    var instanceKey: String = UUID().uuidString
    var keySaved: Bool = false
    var desktopInstructionsViewed: Bool = false
    var gatewayConnected: Bool = false
    var gatewayUrl: String = "wss://gateway.helix-project.org"
    var connectionError: String?
}

extension OnboardingData {
    mutating func reset() {
        self = OnboardingData()
    }

    var isStep1Complete: Bool {
        !instanceKey.isEmpty
    }

    var isStep2Complete: Bool {
        keySaved
    }

    var isStep3Complete: Bool {
        desktopInstructionsViewed
    }

    var isStep4Complete: Bool {
        gatewayConnected && connectionError == nil
    }
}
