/**
 * Onboarding Coordinator - Helix iOS
 * Manages navigation and state across onboarding steps
 */

import SwiftUI

@Observable
final class OnboardingCoordinator {
    var currentStep: Int = 0
    var data: OnboardingData = OnboardingData()
    var isCompleted: Bool = false

    let totalSteps = 5

    var stepTitle: String {
        switch currentStep {
        case 0: return "Welcome"
        case 1: return "Instance Key"
        case 2: return "Desktop Setup"
        case 3: return "Connect to Gateway"
        case 4: return "Success!"
        default: return ""
        }
    }

    var stepDescription: String {
        switch currentStep {
        case 0: return "Understand Helix architecture"
        case 1: return "Generate your unique key"
        case 2: return "Set up CLI on your desktop"
        case 3: return "Verify connection"
        case 4: return "Start using Helix"
        default: return ""
        }
    }

    var canProceed: Bool {
        switch currentStep {
        case 0: return true // Welcome step always available
        case 1: return data.keySaved // Instance key must be saved
        case 2: return data.desktopInstructionsViewed // Desktop instructions must be viewed
        case 3: return data.gatewayConnected // Gateway must be connected
        case 4: return true // Success step
        default: return false
        }
    }

    func nextStep() {
        if currentStep < totalSteps - 1 {
            currentStep += 1
        }
    }

    func previousStep() {
        if currentStep > 0 {
            currentStep -= 1
        }
    }

    func skipToStep(_ step: Int) {
        if step >= 0 && step < totalSteps {
            currentStep = step
        }
    }

    func completeOnboarding() {
        Task { @MainActor in
            // Save instance key to Keychain
            let configStorage = await GatewayConfigStorage.shared
            let config = GatewayConnectionConfig(
                instanceKey: data.instanceKey,
                gatewayUrl: data.gatewayUrl
            )

            do {
                try await configStorage.saveConfig(config)
            } catch {
                print("[Onboarding] Failed to save config: \(error)")
            }

            // Mark onboarding as complete
            UserDefaults.standard.set(true, forKey: "onboarding.completed")
            UserDefaults.standard.set(data.instanceKey, forKey: "onboarding.instanceKey")

            self.isCompleted = true
        }
    }

    func resetOnboarding() {
        currentStep = 0
        data.reset()
        isCompleted = false
        UserDefaults.standard.removeObject(forKey: "onboarding.completed")
        UserDefaults.standard.removeObject(forKey: "onboarding.instanceKey")
    }
}
