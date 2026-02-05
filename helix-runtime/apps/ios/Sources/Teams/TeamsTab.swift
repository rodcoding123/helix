/**
 * Phase 11 Week 4: Teams Tab for iOS
 * Main UI for team selection and member management
 */

import SwiftUI

struct TeamsTab: View {
    @State private var teamsModel = TeamsModel()
    @State private var selectedTab: TeamsTabOption = .overview
    @Environment(\.scenePhase) private var scenePhase

    enum TeamsTabOption: String, CaseIterable {
        case overview = "Overview"
        case members = "Members"
        case settings = "Settings"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: 8) {
                    Text("Team Management")
                        .font(.title)
                        .fontWeight(.semibold)
                    Text("Manage your teams and members")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color(.systemGray6))
                .border(width: 0.5, edges: [.bottom], color: Color(.separator))

                if teamsModel.isLoading {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Loading teams...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
                } else if let error = teamsModel.error {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.title)
                            .foregroundStyle(.orange)
                        Text("Error")
                            .fontWeight(.semibold)
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
                } else if teamsModel.teams.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.2")
                            .font(.title)
                            .foregroundStyle(.secondary)
                        Text("No Teams")
                            .fontWeight(.semibold)
                        Text("You haven't joined any teams yet")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("Visit the web app to create or join a team")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.systemBackground))
                } else {
                    VStack(spacing: 0) {
                        // Team Selector
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(teamsModel.teams) { team in
                                    TeamCard(
                                        team: team,
                                        isSelected: teamsModel.currentTeam?.id == team.id,
                                        onSelect: {
                                            Task {
                                                await teamsModel.selectTeam(team)
                                            }
                                        }
                                    )
                                }
                            }
                            .padding()
                        }

                        Divider()

                        // Tab Selector
                        if let currentTeam = teamsModel.currentTeam {
                            Picker("Tab", selection: $selectedTab) {
                                ForEach(TeamsTabOption.allCases, id: \.self) { tab in
                                    Text(tab.rawValue).tag(tab)
                                }
                            }
                            .pickerStyle(.segmented)
                            .padding()

                            Divider()

                            // Tab Content
                            TabView(selection: $selectedTab) {
                                OverviewTab(team: currentTeam)
                                    .tag(TeamsTabOption.overview)

                                MembersTab(members: teamsModel.members)
                                    .tag(TeamsTabOption.members)

                                SettingsTab(team: currentTeam)
                                    .tag(TeamsTabOption.settings)
                            }
                            .tabViewStyle(.page(indexDisplayMode: .never))
                        }
                    }
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task {
                    await teamsModel.refreshTeams()
                }
            }
        }
    }
}

// MARK: - Team Card

struct TeamCard: View {
    let team: Team
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(team.name)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }

            HStack(spacing: 12) {
                Label(team.plan.displayName, systemImage: "tag.fill")
                    .font(.caption2)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())

                Spacer()

                Text(team.createdAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(isSelected ? Color(.systemBlue).opacity(0.1) : Color(.systemGray6))
        .border(width: 1, edges: [.all], color: isSelected ? Color(.systemBlue) : Color(.separator))
        .cornerRadius(8)
        .contentShape(Rectangle())
        .onTapGesture(perform: onSelect)
    }
}

// MARK: - Overview Tab

private struct OverviewTab: View {
    let team: Team

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Section(header: Text("Team Information")
                    .font(.headline)
                    .foregroundStyle(.primary)) {
                    VStack(alignment: .leading, spacing: 12) {
                        DetailRow(label: "Name", value: team.name)
                        DetailRow(label: "Plan", value: team.plan.displayName)
                        DetailRow(label: "Created", value: team.createdAt.formatted(date: .abbreviated, time: .omitted))
                        DetailRow(label: "ID", value: String(team.id.prefix(8)) + "...")
                    }
                    .padding(12)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Quick Actions")
                        .font(.headline)
                    Text("To invite members or manage settings, visit the web app")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
    }
}

// MARK: - Members Tab

private struct MembersTab: View {
    let members: [TeamMember]

    var body: some View {
        if members.isEmpty {
            VStack(spacing: 12) {
                Image(systemName: "person.badge.plus")
                    .font(.title)
                    .foregroundStyle(.secondary)
                Text("No Members")
                    .fontWeight(.semibold)
                Text("Invite team members via the web app")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
        } else {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(members) { member in
                        MemberCard(member: member)
                    }
                }
                .padding()
            }
        }
    }
}

// MARK: - Member Card

private struct MemberCard: View {
    let member: TeamMember

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            Circle()
                .fill(Color.accentColor.opacity(0.2))
                .frame(width: 40, height: 40)
                .overlay {
                    Text(String(member.displayName.prefix(1).uppercased()))
                        .font(.headline)
                        .foregroundStyle(.primary)
                }

            // Member Info
            VStack(alignment: .leading, spacing: 4) {
                Text(member.displayName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(member.email)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Role Badge
            Text(member.role.displayName)
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(roleColor(member.role))
                .cornerRadius(4)
        }
        .padding(12)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }

    private func roleColor(_ role: TeamRole) -> Color {
        switch role {
        case .owner: .red
        case .admin: .purple
        case .member: .blue
        case .viewer: .gray
        }
    }
}

// MARK: - Settings Tab

private struct SettingsTab: View {
    let team: Team

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Team Settings")
                        .font(.headline)
                    Text("Advanced team settings are available in the web app")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .background(Color(.systemBlue).opacity(0.1))
                .border(width: 1, edges: [.all], color: Color(.systemBlue).opacity(0.3))
                .cornerRadius(8)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Manage:")
                        .font(.headline)
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Billing & Plan", systemImage: "creditcard")
                        Label("Member Permissions", systemImage: "person.badge.key")
                        Label("Integrations", systemImage: "link")
                        Label("Audit Logs", systemImage: "list.bullet.clipboard")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Detail Row

private struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.semibold)
        }
        .font(.caption)
    }
}

// MARK: - View Extension

extension View {
    func border(width: CGFloat, edges: [Edge], color: Color) -> some View {
        overlay(EdgeBorder(width: width, edges: edges, color: color))
    }
}

// MARK: - Edge Border

struct EdgeBorder: View {
    let width: CGFloat
    let edges: [Edge]
    let color: Color

    var body: some View {
        VStack(spacing: 0) {
            if edges.contains(.top) {
                color.frame(height: width)
            }
            HStack(spacing: 0) {
                if edges.contains(.leading) {
                    color.frame(width: width)
                }
                Spacer()
                if edges.contains(.trailing) {
                    color.frame(width: width)
                }
            }
            if edges.contains(.bottom) {
                color.frame(height: width)
            }
        }
    }
}

#Preview {
    TeamsTab()
}
