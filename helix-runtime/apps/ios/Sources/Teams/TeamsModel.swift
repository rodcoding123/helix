/**
 * Phase 11 Week 4: Teams Model for iOS
 * State management for team selection and member data
 */

import Foundation
import Observation

// MARK: - Models

struct Team: Codable, Identifiable {
    let id: String
    let name: String
    let plan: TeamPlan
    let ownerId: String
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case plan
        case ownerId = "owner_id"
        case createdAt = "created_at"
    }
}

enum TeamPlan: String, Codable {
    case free
    case pro
    case enterprise

    var displayName: String {
        switch self {
        case .free: "Free"
        case .pro: "Pro"
        case .enterprise: "Enterprise"
        }
    }

    var color: String {
        switch self {
        case .free: "gray"
        case .pro: "blue"
        case .enterprise: "purple"
        }
    }
}

struct TeamMember: Codable, Identifiable {
    let id: String
    let tenantId: String
    let userId: String
    let email: String
    let name: String?
    let role: TeamRole
    let joinedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case tenantId = "tenant_id"
        case userId = "user_id"
        case email
        case name
        case role
        case joinedAt = "joined_at"
    }

    var displayName: String {
        name ?? email
    }
}

enum TeamRole: String, Codable {
    case owner
    case admin
    case member
    case viewer

    var displayName: String {
        switch self {
        case .owner: "Owner"
        case .admin: "Admin"
        case .member: "Member"
        case .viewer: "Viewer"
        }
    }

    var color: String {
        switch self {
        case .owner: "red"
        case .admin: "purple"
        case .member: "blue"
        case .viewer: "gray"
        }
    }
}

// MARK: - Teams State Manager

@MainActor
@Observable
final class TeamsModel {
    var teams: [Team] = []
    var currentTeam: Team?
    var members: [TeamMember] = []
    var isLoading: Bool = false
    var error: String?

    init() {
        Task {
            await loadTeams()
        }
    }

    func loadTeams() async {
        isLoading = true
        error = nil

        do {
            // Simulate loading teams from backend
            // In production, this would fetch from the Helix gateway
            teams = []
            currentTeam = nil
            members = []
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    func selectTeam(_ team: Team) async {
        currentTeam = team
        await loadMembers(for: team.id)
    }

    private func loadMembers(for teamId: String) async {
        do {
            // Simulate loading members from backend
            // In production, this would fetch from the Helix gateway
            members = []
        } catch {
            self.error = error.localizedDescription
        }
    }

    func refreshTeams() async {
        await loadTeams()
    }
}

// MARK: - Mock Data (for development)

extension Team {
    static let mock1 = Team(
        id: "team-1",
        name: "Personal Team",
        plan: .pro,
        ownerId: "user-1",
        createdAt: Date(timeIntervalSinceNow: -86400 * 30) // 30 days ago
    )

    static let mock2 = Team(
        id: "team-2",
        name: "Work Team",
        plan: .enterprise,
        ownerId: "user-2",
        createdAt: Date(timeIntervalSinceNow: -86400 * 60) // 60 days ago
    )

    static let mockList = [mock1, mock2]
}

extension TeamMember {
    static let mock1 = TeamMember(
        id: "member-1",
        tenantId: "team-1",
        userId: "user-1",
        email: "user@example.com",
        name: "John Doe",
        role: .owner,
        joinedAt: Date(timeIntervalSinceNow: -86400 * 30)
    )

    static let mock2 = TeamMember(
        id: "member-2",
        tenantId: "team-1",
        userId: "user-2",
        email: "admin@example.com",
        name: "Jane Smith",
        role: .admin,
        joinedAt: Date(timeIntervalSinceNow: -86400 * 15)
    )

    static let mock3 = TeamMember(
        id: "member-3",
        tenantId: "team-1",
        userId: "user-3",
        email: "member@example.com",
        name: nil,
        role: .member,
        joinedAt: Date(timeIntervalSinceNow: -86400 * 5)
    )

    static let mockList = [mock1, mock2, mock3]
}
