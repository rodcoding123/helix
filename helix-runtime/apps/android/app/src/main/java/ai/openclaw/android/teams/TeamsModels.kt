/**
 * Phase 11 Week 4: Teams Models for Android
 * Data models for team selection and member management
 */

package ai.openclaw.android.teams

import java.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Team(
    val id: String,
    val name: String,
    val plan: TeamPlan,
    @SerialName("owner_id")
    val ownerId: String,
    @SerialName("created_at")
    val createdAt: Instant
)

@Serializable
enum class TeamPlan(val displayName: String) {
    @SerialName("free")
    FREE("Free"),

    @SerialName("pro")
    PRO("Pro"),

    @SerialName("enterprise")
    ENTERPRISE("Enterprise")
}

@Serializable
data class TeamMember(
    val id: String,
    @SerialName("tenant_id")
    val tenantId: String,
    @SerialName("user_id")
    val userId: String,
    val email: String,
    val name: String? = null,
    val role: TeamRole,
    @SerialName("joined_at")
    val joinedAt: Instant
) {
    val displayName: String
        get() = name ?: email
}

@Serializable
enum class TeamRole(val displayName: String) {
    @SerialName("owner")
    OWNER("Owner"),

    @SerialName("admin")
    ADMIN("Admin"),

    @SerialName("member")
    MEMBER("Member"),

    @SerialName("viewer")
    VIEWER("Viewer")
}

// Mock data for development
object TeamsMockData {
    val mockTeam1 = Team(
        id = "team-1",
        name = "Personal Team",
        plan = TeamPlan.PRO,
        ownerId = "user-1",
        createdAt = Instant.now().minusSeconds(86400 * 30)
    )

    val mockTeam2 = Team(
        id = "team-2",
        name = "Work Team",
        plan = TeamPlan.ENTERPRISE,
        ownerId = "user-2",
        createdAt = Instant.now().minusSeconds(86400 * 60)
    )

    val mockTeamList = listOf(mockTeam1, mockTeam2)

    val mockMember1 = TeamMember(
        id = "member-1",
        tenantId = "team-1",
        userId = "user-1",
        email = "user@example.com",
        name = "John Doe",
        role = TeamRole.OWNER,
        joinedAt = Instant.now().minusSeconds(86400 * 30)
    )

    val mockMember2 = TeamMember(
        id = "member-2",
        tenantId = "team-1",
        userId = "user-2",
        email = "admin@example.com",
        name = "Jane Smith",
        role = TeamRole.ADMIN,
        joinedAt = Instant.now().minusSeconds(86400 * 15)
    )

    val mockMember3 = TeamMember(
        id = "member-3",
        tenantId = "team-1",
        userId = "user-3",
        email = "member@example.com",
        name = null,
        role = TeamRole.MEMBER,
        joinedAt = Instant.now().minusSeconds(86400 * 5)
    )

    val mockMemberList = listOf(mockMember1, mockMember2, mockMember3)
}
