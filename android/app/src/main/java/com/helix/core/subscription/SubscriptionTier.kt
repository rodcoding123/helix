/**
 * Subscription Tier Types - Helix Android
 * Tier hierarchy: core < phantom < overseer < architect
 */

package com.helix.core.subscription

import kotlinx.serialization.Serializable

@Serializable
enum class SubscriptionTier(val level: Int, val displayName: String, val pricePerMonth: Int) {
    CORE(0, "Core", 0),           // Free
    PHANTOM(1, "Phantom", 9),      // $9/mo - Privacy
    OVERSEER(2, "Overseer", 29),   // $29/mo - Observatory
    ARCHITECT(3, "Architect", 99); // $99/mo - Full access

    val features: List<String>
        get() = when (this) {
            CORE -> listOf(
                "Single instance",
                "Basic chat interface",
                "Community support"
            )
            PHANTOM -> listOf(
                "Everything in Core",
                "5 instances",
                "Private instance keys",
                "Email support"
            )
            OVERSEER -> listOf(
                "Everything in Phantom",
                "Unlimited instances",
                "Observable interface",
                "Real-time logging",
                "Priority support"
            )
            ARCHITECT -> listOf(
                "Everything in Overseer",
                "Full code interface",
                "Custom integrations",
                "Advanced analytics",
                "Dedicated support"
            )
        }

    fun hasAccess(requiredTier: SubscriptionTier): Boolean {
        return this.level >= requiredTier.level
    }
}

@Serializable
data class Subscription(
    val id: String,
    val user_id: String,
    val tier: SubscriptionTier,
    val status: SubscriptionStatus,
    val current_period_start: String,
    val current_period_end: String,
    val cancel_at_period_end: Boolean
)

@Serializable
enum class SubscriptionStatus {
    ACTIVE,
    PAST_DUE,
    CANCELED,
    UNPAID,
    INCOMPLETE;

    val isActive: Boolean get() = this == ACTIVE

    val displayName: String
        get() = when (this) {
            ACTIVE -> "Active"
            PAST_DUE -> "Past Due"
            CANCELED -> "Canceled"
            UNPAID -> "Unpaid"
            INCOMPLETE -> "Incomplete"
        }
}
