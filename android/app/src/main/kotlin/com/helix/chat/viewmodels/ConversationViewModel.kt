package com.helix.chat.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.helix.chat.models.Conversation
import com.helix.chat.services.HelixError
import com.helix.chat.services.SupabaseService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * Conversation View Model
 *
 * Manages conversation list state and operations.
 * Handles creating, loading, searching conversations.
 */
class ConversationViewModel(
    application: Application,
    private val supabaseService: SupabaseService
) : AndroidViewModel(application) {

    // Published state
    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations: StateFlow<List<Conversation>> = _conversations.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<HelixError?>(null)
    val error: StateFlow<HelixError?> = _error.asStateFlow()

    /**
     * Filtered conversations based on search query
     */
    val filteredConversations: StateFlow<List<Conversation>> = MutableStateFlow<List<Conversation>>(emptyList()).apply {
        viewModelScope.launch {
            _conversations.collect { allConversations ->
                value = if (_searchQuery.value.isEmpty()) {
                    allConversations
                } else {
                    val query = _searchQuery.value.lowercase()
                    allConversations.filter { conversation ->
                        conversation.title.lowercase().contains(query) ||
                                (conversation.description?.lowercase()?.contains(query) ?: false)
                    }
                }
            }
        }
    }.asStateFlow()

    /**
     * Load conversations
     */
    fun loadConversations() {
        viewModelScope.launch {
            _isLoading.emit(true)
            try {
                val loadedConversations = supabaseService.loadConversations()
                _conversations.emit(loadedConversations)

                // Subscribe to real-time updates
                supabaseService.subscribeToConversations { updatedConversations ->
                    viewModelScope.launch {
                        _conversations.emit(updatedConversations)
                    }
                }
            } catch (e: Exception) {
                _error.emit(
                    e as? HelixError ?: HelixError(
                        "LOAD_FAILED",
                        e.localizedMessage ?: "Failed to load conversations"
                    )
                )
                Timber.e(e, "Failed to load conversations")
            } finally {
                _isLoading.emit(false)
            }
        }
    }

    /**
     * Create new conversation
     */
    fun createConversation(title: String) {
        if (title.isEmpty()) return

        viewModelScope.launch {
            _isLoading.emit(true)
            try {
                val newConversation = supabaseService.createConversation(title)
                val currentConversations = _conversations.value
                _conversations.emit(listOf(newConversation) + currentConversations)
            } catch (e: Exception) {
                _error.emit(
                    e as? HelixError ?: HelixError(
                        "CREATE_FAILED",
                        e.localizedMessage ?: "Failed to create conversation"
                    )
                )
                Timber.e(e, "Failed to create conversation")
            } finally {
                _isLoading.emit(false)
            }
        }
    }

    /**
     * Delete conversation
     */
    fun deleteConversation(conversation: Conversation) {
        viewModelScope.launch {
            try {
                // Remove from local list
                _conversations.emit(
                    _conversations.value.filter { it.sessionKey != conversation.sessionKey }
                )
                // TODO: Call API to delete from server
            } catch (e: Exception) {
                Timber.e(e, "Failed to delete conversation")
            }
        }
    }

    /**
     * Update search query
     */
    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    /**
     * Clear search query
     */
    fun clearSearchQuery() {
        _searchQuery.value = ""
    }

    /**
     * Clear error
     */
    fun clearError() {
        _error.value = null
    }

    // Cleanup
    override fun onCleared() {
        super.onCleared()
        supabaseService.unsubscribeAll()
    }
}
