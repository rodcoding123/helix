/**
 * Subscription Tier Tests - Android
 * Unit tests for subscription tier hierarchy and access control
 */

package com.helix.core.subscription

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SubscriptionTierTest {

    // MARK: - Tier Level Tests

    @Test
    fun testCoreTierLevel() {
        val tier = SubscriptionTier.CORE
        assertEquals(0, tier.level)
    }

    @Test
    fun testPhantomTierLevel() {
        val tier = SubscriptionTier.PHANTOM
        assertEquals(1, tier.level)
    }

    @Test
    fun testOverseerTierLevel() {
        val tier = SubscriptionTier.OVERSEER
        assertEquals(2, tier.level)
    }

    @Test
    fun testArchitectTierLevel() {
        val tier = SubscriptionTier.ARCHITECT
        assertEquals(3, tier.level)
    }

    // MARK: - Tier Access Tests

    @Test
    fun testCoreTierCannotAccessPhantom() {
        val userTier = SubscriptionTier.CORE
        val requiredTier = SubscriptionTier.PHANTOM

        assertFalse(userTier.hasAccess(requiredTier))
    }

    @Test
    fun testPhantomTierCanAccessCore() {
        val userTier = SubscriptionTier.PHANTOM
        val requiredTier = SubscriptionTier.CORE

        assertTrue(userTier.hasAccess(requiredTier))
    }

    @Test
    fun testPhantomTierCannotAccessOverseer() {
        val userTier = SubscriptionTier.PHANTOM
        val requiredTier = SubscriptionTier.OVERSEER

        assertFalse(userTier.hasAccess(requiredTier))
    }

    @Test
    fun testOverseerTierCanAccessPhantom() {
        val userTier = SubscriptionTier.OVERSEER
        val requiredTier = SubscriptionTier.PHANTOM

        assertTrue(userTier.hasAccess(requiredTier))
    }

    @Test
    fun testArchitectTierCanAccessAll() {
        val userTier = SubscriptionTier.ARCHITECT

        assertTrue(userTier.hasAccess(SubscriptionTier.CORE))
        assertTrue(userTier.hasAccess(SubscriptionTier.PHANTOM))
        assertTrue(userTier.hasAccess(SubscriptionTier.OVERSEER))
        assertTrue(userTier.hasAccess(SubscriptionTier.ARCHITECT))
    }

    // MARK: - Same Tier Access Tests

    @Test
    fun testCoreTierCanAccessCore() {
        val userTier = SubscriptionTier.CORE
        assertTrue(userTier.hasAccess(SubscriptionTier.CORE))
    }

    @Test
    fun testPhantomTierCanAccessPhantom() {
        val userTier = SubscriptionTier.PHANTOM
        assertTrue(userTier.hasAccess(SubscriptionTier.PHANTOM))
    }

    @Test
    fun testOverseerTierCanAccessOverseer() {
        val userTier = SubscriptionTier.OVERSEER
        assertTrue(userTier.hasAccess(SubscriptionTier.OVERSEER))
    }

    @Test
    fun testArchitectTierCanAccessArchitect() {
        val userTier = SubscriptionTier.ARCHITECT
        assertTrue(userTier.hasAccess(SubscriptionTier.ARCHITECT))
    }

    // MARK: - Tier Ordering Tests

    @Test
    fun testTierOrdering() {
        val core = SubscriptionTier.CORE
        val phantom = SubscriptionTier.PHANTOM
        val overseer = SubscriptionTier.OVERSEER
        val architect = SubscriptionTier.ARCHITECT

        assertTrue(core.level < phantom.level)
        assertTrue(phantom.level < overseer.level)
        assertTrue(overseer.level < architect.level)
    }

    // MARK: - Access Matrix Tests

    @Test
    fun testAccessMatrix() {
        val tiers = listOf(
            SubscriptionTier.CORE,
            SubscriptionTier.PHANTOM,
            SubscriptionTier.OVERSEER,
            SubscriptionTier.ARCHITECT
        )

        for (userTier in tiers) {
            for (requiredTier in tiers) {
                val hasAccess = userTier.hasAccess(requiredTier)
                val expectedAccess = userTier.level >= requiredTier.level

                assertEquals(
                    expectedAccess,
                    hasAccess,
                    "User tier $userTier should ${if (expectedAccess) "have" else "not have"} access to $requiredTier"
                )
            }
        }
    }

    // MARK: - Tier Feature Tests

    @Test
    fun testCoreTierFeatures() {
        val features = SubscriptionTier.CORE.features
        assertTrue(features.isNotEmpty())
    }

    @Test
    fun testPhantomTierHasMoreFeaturesThanCore() {
        val coreFeatures = SubscriptionTier.CORE.features
        val phantomFeatures = SubscriptionTier.PHANTOM.features

        assertTrue(phantomFeatures.size >= coreFeatures.size)
    }

    @Test
    fun testArchitectTierHasAllFeatures() {
        val architectFeatures = SubscriptionTier.ARCHITECT.features
        assertTrue(architectFeatures.isNotEmpty())
    }

    // MARK: - Feature Comparison Tests

    @Test
    fun testFeatureCompleteness() {
        val tiers = listOf(
            SubscriptionTier.CORE,
            SubscriptionTier.PHANTOM,
            SubscriptionTier.OVERSEER,
            SubscriptionTier.ARCHITECT
        )

        for (i in 0 until tiers.size - 1) {
            val currentTierFeatures = tiers[i].features.size
            val nextTierFeatures = tiers[i + 1].features.size

            assertTrue(
                currentTierFeatures <= nextTierFeatures,
                "Tier ${tiers[i]} should have <= features than ${tiers[i + 1]}"
            )
        }
    }

    // MARK: - Subscription Model Tests

    @Test
    fun testSubscriptionWithActiveTier() {
        val subscription = Subscription(
            id = "sub_123",
            user_id = "user_456",
            tier = SubscriptionTier.ARCHITECT,
            status = SubscriptionStatus.ACTIVE,
            current_period_start = "2025-01-01T00:00:00Z",
            current_period_end = "2025-02-01T00:00:00Z"
        )

        assertEquals(SubscriptionTier.ARCHITECT, subscription.tier)
        assertEquals(SubscriptionStatus.ACTIVE, subscription.status)
    }

    @Test
    fun testSubscriptionStatus() {
        assertEquals("active", SubscriptionStatus.ACTIVE.value)
        assertEquals("past_due", SubscriptionStatus.PAST_DUE.value)
        assertEquals("canceled", SubscriptionStatus.CANCELED.value)
    }
}

// Test data classes
enum class SubscriptionStatus(val value: String) {
    ACTIVE("active"),
    PAST_DUE("past_due"),
    CANCELED("canceled")
}

data class Subscription(
    val id: String,
    val user_id: String,
    val tier: SubscriptionTier,
    val status: SubscriptionStatus,
    val current_period_start: String,
    val current_period_end: String
)
