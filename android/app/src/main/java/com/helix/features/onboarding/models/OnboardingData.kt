/**
 * Onboarding Data Model - Helix Android
 * Shared state across all onboarding steps
 */

package com.helix.features.onboarding.models

data class OnboardingData(
    val instanceKey: String = java.util.UUID.randomUUID().toString(),
    val keySaved: Boolean = false,
    val desktopInstructionsViewed: Boolean = false,
    val gatewayConnected: Boolean = false,
    val gatewayUrl: String = "wss://gateway.helix-project.org",
    val connectionError: String? = null
) {
    val isStep1Complete: Boolean get() = instanceKey.isNotEmpty()
    val isStep2Complete: Boolean get() = keySaved
    val isStep3Complete: Boolean get() = desktopInstructionsViewed
    val isStep4Complete: Boolean get() = gatewayConnected && connectionError == null

    fun reset(): OnboardingData = OnboardingData()

    fun copy(
        instanceKey: String = this.instanceKey,
        keySaved: Boolean = this.keySaved,
        desktopInstructionsViewed: Boolean = this.desktopInstructionsViewed,
        gatewayConnected: Boolean = this.gatewayConnected,
        gatewayUrl: String = this.gatewayUrl,
        connectionError: String? = this.connectionError
    ) = OnboardingData(
        instanceKey = instanceKey,
        keySaved = keySaved,
        desktopInstructionsViewed = desktopInstructionsViewed,
        gatewayConnected = gatewayConnected,
        gatewayUrl = gatewayUrl,
        connectionError = connectionError
    )
}
