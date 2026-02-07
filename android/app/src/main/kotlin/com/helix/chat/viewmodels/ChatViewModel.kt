package com.helix.chat.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.helix.chat.models.Conversation
import com.helix.chat.models.Message
import com.helix.chat.services.HelixError
import com.helix.chat.services.OfflineSyncService
import com.helix.chat.services.SupabaseService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import timber.log.Timber
import java.util.UUID

/**
 * Chat View Model
 *
 * Manages chat state and interactions.
 * Coordinates between:
 * - SupabaseService (remote API)
 * - OfflineSyncService (offline queue)
 * - Compose views
 */
class ChatViewModel(
    application: Application,
    private val supabaseService: SupabaseService,
    private val offlineSyncService: OfflineSyncService
) : AndroidViewModel(application) {

    // Published state
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    private val _messageInput = MutableStateFlow("")
    val messageInput: StateFlow<String> = _messageInput.asStateFlow()

    private val _currentConversation = MutableStateFlow<Conversation?>(null)
    val currentConversation: StateFlow<Conversation?> = _currentConversation.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<HelixError?>(null)
    val error: StateFlow<HelixError?> = _error.asStateFlow()

    // Offline state (from sync service)
    val isOnline: StateFlow<Boolean> = offlineSyncService.isOnline
        .stateIn(viewModelScope, SharingStarted.Lazily, true)

    val isSyncing: StateFlow<Boolean> = offlineSyncService.isSyncing
        .stateIn(viewModelScope, SharingStarted.Lazily, false)

    val queueLength: StateFlow<Int> = offlineSyncService.queueLength
        .stateIn(viewModelScope, SharingStarted.Lazily, 0)

    val failedCount: StateFlow<Int> = offlineSyncService.failedCount
        .stateIn(viewModelScope, SharingStarted.Lazily, 0)

    /**
     * Load messages for current conversation
     */
    fun loadMessages() {
        val sessionKey = currentConversation?.sessionKey ?: return

        viewModelScope.launch {
            _isLoading.emit(true)
            try {
                val loadedMessages = supabaseService.loadMessages(sessionKey)
                _messages.emit(loadedMessages)

                // Subscribe to new messages
                supabaseService.subscribeToMessages(sessionKey) { updatedMessages ->
                    viewModelScope.launch {
                        _messages.emit(updatedMessages)
                    }
                }
            } catch (e: Exception) {
                _error.emit(
                    e as? HelixError ?: HelixError(
                        "LOAD_FAILED",
                        e.localizedMessage ?: "Failed to load messages"
                    )
                )
                Timber.e(e, "Failed to load messages")
            } finally {
                _isLoading.emit(false)
            }
        }
    }

    /**
     * Send a message
     */
    fun sendMessage() {
        val content = messageInput.value.trim()
        val sessionKey = currentConversation?.sessionKey ?: return

        if (content.isEmpty()) return

        _messageInput.value = ""
        _isLoading.value = true

        viewModelScope.launch {
            try {
                val clientId = UUID.randomUUID().toString()
                val timestamp = java.time.Instant.now().toString()

                // Create optimistic message
                val optimisticMessage = Message(
                    id = UUID.randomUUID().toString(),
                    sessionKey = sessionKey,
                    userId = "",
                    role = Message.MessageRole.USER,
                    content = content,
                    timestamp = timestamp,
                    clientId = clientId,
                    isPending = !isOnline.value,
                    platform = "android"
                )

                // Add to UI immediately
                val currentMessages = _messages.value
                _messages.emit(currentMessages + optimisticMessage)

                if (isOnline.value) {
                    // Send directly to Supabase
                    val sentMessage = supabaseService.sendMessage(
                        content = content,
                        sessionKey = sessionKey,
                        clientId = clientId
                    )

                    // Update UI with actual message
                    val updatedMessages = _messages.value.map { msg ->
                        if (msg.id == optimisticMessage.id) sentMessage else msg
                    }
                    _messages.emit(updatedMessages)
                } else {
                    // Queue for later sync
                    offlineSyncService.queueMessage(optimisticMessage, sessionKey)
                }
            } catch (e: Exception) {
                // Remove optimistic message on error
                _messages.emit(
                    _messages.value.filter { it.id != messageInput.value }
                )

                _error.emit(
                    e as? HelixError ?: HelixError(
                        "SEND_FAILED",
                        e.localizedMessage ?: "Failed to send message"
                    )
                )
                Timber.e(e, "Failed to send message")
            } finally {
                _isLoading.emit(false)
            }
        }
    }

    /**
     * Manually sync offline messages
     */
    fun syncMessages() {
        viewModelScope.launch {
            try {
                offlineSyncService.attemptSync()
            } catch (e: Exception) {
                Timber.e(e, "Sync failed")
                _error.emit(
                    e as? HelixError ?: HelixError(
                        "SYNC_FAILED",
                        e.localizedMessage ?: "Sync failed"
                    )
                )
            }
        }
    }

    /**
     * Retry failed messages
     */
    fun retryFailedMessages() {
        viewModelScope.launch {
            try {
                val failedMessages = offlineSyncService.getFailedMessages()
                if (failedMessages.isEmpty()) return@launch

                // Reset retries and sync again
                for (message in failedMessages) {
                    offlineSyncService.scheduleRetry(message.id)
                }
            } catch (e: Exception) {
                Timber.e(e, "Retry failed")
            }
        }
    }

    /**
     * Clear offline queue
     */
    fun clearQueue() {
        viewModelScope.launch {
            offlineSyncService.clearQueue()
        }
    }

    /**
     * Set current conversation
     */
    fun setConversation(conversation: Conversation) {
        _currentConversation.value = conversation
        loadMessages()
    }

    /**
     * Update message input
     */
    fun updateMessageInput(text: String) {
        _messageInput.value = text
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
