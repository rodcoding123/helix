/**
 * Subscription Tier Tests - iOS
 * Unit tests for subscription tier hierarchy and access control
 */

import XCTest
@testable import Helix

final class SubscriptionTierTests: XCTestCase {

    // MARK: - Tier Level Tests

    func testCoreTierLevel() {
        let tier = SubscriptionTier.core
        XCTAssertEqual(tier.level, 0)
    }

    func testPhantomTierLevel() {
        let tier = SubscriptionTier.phantom
        XCTAssertEqual(tier.level, 1)
    }

    func testOverseerTierLevel() {
        let tier = SubscriptionTier.overseer
        XCTAssertEqual(tier.level, 2)
    }

    func testArchitectTierLevel() {
        let tier = SubscriptionTier.architect
        XCTAssertEqual(tier.level, 3)
    }

    // MARK: - Tier Access Tests

    func testCoreTierCannotAccessPhantom() {
        let userTier = SubscriptionTier.core
        let requiredTier = SubscriptionTier.phantom

        XCTAssertFalse(userTier.hasAccess(to: requiredTier))
    }

    func testPhantomTierCanAccessCore() {
        let userTier = SubscriptionTier.phantom
        let requiredTier = SubscriptionTier.core

        XCTAssertTrue(userTier.hasAccess(to: requiredTier))
    }

    func testPhantomTierCannotAccessOverseer() {
        let userTier = SubscriptionTier.phantom
        let requiredTier = SubscriptionTier.overseer

        XCTAssertFalse(userTier.hasAccess(to: requiredTier))
    }

    func testOverseerTierCanAccessPhantom() {
        let userTier = SubscriptionTier.overseer
        let requiredTier = SubscriptionTier.phantom

        XCTAssertTrue(userTier.hasAccess(to: requiredTier))
    }

    func testArchitectTierCanAccessAll() {
        let userTier = SubscriptionTier.architect

        XCTAssertTrue(userTier.hasAccess(to: .core))
        XCTAssertTrue(userTier.hasAccess(to: .phantom))
        XCTAssertTrue(userTier.hasAccess(to: .overseer))
        XCTAssertTrue(userTier.hasAccess(to: .architect))
    }

    // MARK: - Same Tier Access Tests

    func testCoreTierCanAccessCore() {
        let userTier = SubscriptionTier.core
        XCTAssertTrue(userTier.hasAccess(to: .core))
    }

    func testPhantomTierCanAccessPhantom() {
        let userTier = SubscriptionTier.phantom
        XCTAssertTrue(userTier.hasAccess(to: .phantom))
    }

    func testOverseerTierCanAccessOverseer() {
        let userTier = SubscriptionTier.overseer
        XCTAssertTrue(userTier.hasAccess(to: .overseer))
    }

    func testArchitectTierCanAccessArchitect() {
        let userTier = SubscriptionTier.architect
        XCTAssertTrue(userTier.hasAccess(to: .architect))
    }

    // MARK: - Subscription Status Tests

    func testSubscriptionStatusActive() {
        let status = SubscriptionStatus.active
        XCTAssertEqual(status.rawValue, "active")
    }

    func testSubscriptionStatusPastDue() {
        let status = SubscriptionStatus.past_due
        XCTAssertEqual(status.rawValue, "past_due")
    }

    func testSubscriptionStatusCanceled() {
        let status = SubscriptionStatus.canceled
        XCTAssertEqual(status.rawValue, "canceled")
    }

    // MARK: - Subscription Model Tests

    func testSubscriptionWithActiveTier() {
        let subscription = Subscription(
            id: "sub_123",
            user_id: "user_456",
            tier: .architect,
            status: .active,
            current_period_start: "2025-01-01T00:00:00Z",
            current_period_end: "2025-02-01T00:00:00Z"
        )

        XCTAssertEqual(subscription.tier, .architect)
        XCTAssertEqual(subscription.status, .active)
    }

    func testSubscriptionTierComparison() {
        let tiers: [(tier: SubscriptionTier, level: Int)] = [
            (.core, 0),
            (.phantom, 1),
            (.overseer, 2),
            (.architect, 3)
        ]

        for (tier, expectedLevel) in tiers {
            XCTAssertEqual(tier.level, expectedLevel)
        }
    }

    // MARK: - Tier Ordering Tests

    func testTierOrdering() {
        let core = SubscriptionTier.core
        let phantom = SubscriptionTier.phantom
        let overseer = SubscriptionTier.overseer
        let architect = SubscriptionTier.architect

        XCTAssertLessThan(core.level, phantom.level)
        XCTAssertLessThan(phantom.level, overseer.level)
        XCTAssertLessThan(overseer.level, architect.level)
    }

    // MARK: - Access Matrix Tests

    func testAccessMatrix() {
        let tiers = [SubscriptionTier.core, .phantom, .overseer, .architect]

        for userTier in tiers {
            for requiredTier in tiers {
                let hasAccess = userTier.hasAccess(to: requiredTier)
                let expectedAccess = userTier.level >= requiredTier.level

                XCTAssertEqual(
                    hasAccess,
                    expectedAccess,
                    "User tier \(userTier) should \(expectedAccess ? "have" : "not have") access to \(requiredTier)"
                )
            }
        }
    }

    // MARK: - Codable Tests

    func testSubscriptionTierCodable() throws {
        let tier = SubscriptionTier.architect
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        let encoded = try encoder.encode(tier)
        let decoded = try decoder.decode(SubscriptionTier.self, from: encoded)

        XCTAssertEqual(tier, decoded)
    }

    func testSubscriptionCodable() throws {
        let subscription = Subscription(
            id: "sub_123",
            user_id: "user_456",
            tier: .phantom,
            status: .active,
            current_period_start: "2025-01-01T00:00:00Z",
            current_period_end: "2025-02-01T00:00:00Z"
        )

        let encoder = JSONEncoder()
        let decoder = JSONDecoder()

        let encoded = try encoder.encode(subscription)
        let decoded = try decoder.decode(Subscription.self, from: encoded)

        XCTAssertEqual(subscription.id, decoded.id)
        XCTAssertEqual(subscription.tier, decoded.tier)
        XCTAssertEqual(subscription.status, decoded.status)
    }
}
