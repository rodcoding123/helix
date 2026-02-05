/**
 * Phase 11 Week 4: Teams ViewModel for Android
 * State management for team selection and member data
 */

package ai.openclaw.android.teams

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class TeamsUiState(
    val teams: List<Team> = emptyList(),
    val currentTeam: Team? = null,
    val members: List<TeamMember> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

class TeamsViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(TeamsUiState())
    val uiState: StateFlow<TeamsUiState> = _uiState.asStateFlow()

    init {
        loadTeams()
    }

    fun loadTeams() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                // Simulate loading teams from backend
                // In production, this would fetch from the Helix gateway
                _uiState.value = _uiState.value.copy(
                    teams = emptyList(),
                    currentTeam = null,
                    members = emptyList(),
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message
                )
            }
        }
    }

    fun selectTeam(team: Team) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(currentTeam = team)
            loadMembers(team.id)
        }
    }

    private fun loadMembers(teamId: String) {
        viewModelScope.launch {
            try {
                // Simulate loading members from backend
                // In production, this would fetch from the Helix gateway
                _uiState.value = _uiState.value.copy(members = emptyList())
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun refreshTeams() {
        loadTeams()
    }
}
