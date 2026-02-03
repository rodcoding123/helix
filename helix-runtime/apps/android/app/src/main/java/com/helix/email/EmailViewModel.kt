package com.helix.email

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class EmailUiState(
    val emails: List<Email> = emptyList(),
    val selectedEmail: Email? = null,
    val isLoading: Boolean = false,
    val error: EmailError? = null,
    val searchQuery: String = "",
    val searchResults: List<Email> = emptyList(),
    val draft: EmailDraft? = null,
    val isComposing: Boolean = false,
    val selectedAccountId: String? = null,
    val analytics: EmailAnalytics? = null,
    val pagination: EmailPaginationInfo? = null,
)

class EmailViewModel(private val service: EmailService) : ViewModel() {
    private val _uiState = MutableStateFlow(EmailUiState())
    val uiState: StateFlow<EmailUiState> = _uiState.asStateFlow()

    fun loadEmails(accountId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val emails = service.fetchEmails(accountId = accountId)
                _uiState.update {
                    it.copy(
                        emails = emails,
                        selectedAccountId = accountId,
                        isLoading = false,
                        error = null,
                    )
                }
            } catch (e: EmailError) {
                _uiState.update { it.copy(isLoading = false, error = e) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = EmailError.UnknownError) }
            }
        }
    }

    fun loadMoreEmails(accountId: String) {
        viewModelScope.launch {
            val currentPage = _uiState.value.pagination?.currentPage ?: 0
            val pageSize = _uiState.value.pagination?.pageSize ?: 50
            val offset = (currentPage + 1) * pageSize

            try {
                val newEmails = service.fetchEmails(
                    accountId = accountId,
                    offset = offset,
                )
                _uiState.update {
                    it.copy(emails = it.emails + newEmails)
                }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun selectEmail(email: Email) {
        _uiState.update { it.copy(selectedEmail = email) }
    }

    fun markAsRead(emailId: String, isRead: Boolean = true) {
        viewModelScope.launch {
            try {
                service.markAsRead(emailId, isRead)
                _uiState.update { state ->
                    state.copy(
                        emails = state.emails.map {
                            if (it.id == emailId) it.copy(isRead = isRead) else it
                        },
                        selectedEmail = if (state.selectedEmail?.id == emailId) {
                            state.selectedEmail.copy(isRead = isRead)
                        } else {
                            state.selectedEmail
                        },
                    )
                }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun toggleStar(emailId: String) {
        viewModelScope.launch {
            val email = _uiState.value.emails.find { it.id == emailId } ?: return@launch
            val newStarred = !email.isStarred

            try {
                service.markAsStarred(emailId, newStarred)
                _uiState.update { state ->
                    state.copy(
                        emails = state.emails.map {
                            if (it.id == emailId) it.copy(isStarred = newStarred) else it
                        },
                        selectedEmail = if (state.selectedEmail?.id == emailId) {
                            state.selectedEmail.copy(isStarred = newStarred)
                        } else {
                            state.selectedEmail
                        },
                    )
                }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun deleteEmail(emailId: String) {
        viewModelScope.launch {
            try {
                service.deleteEmail(emailId)
                _uiState.update { state ->
                    state.copy(
                        emails = state.emails.filter { it.id != emailId },
                        selectedEmail = if (state.selectedEmail?.id == emailId) null else state.selectedEmail,
                    )
                }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun search(query: String) {
        _uiState.update { it.copy(searchQuery = query) }

        if (query.isEmpty()) {
            _uiState.update { it.copy(searchResults = emptyList()) }
            return
        }

        viewModelScope.launch {
            try {
                val filter = EmailSearchFilter(query = query)
                val results = service.searchEmails(filter)
                _uiState.update { it.copy(searchResults = results, error = null) }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e, searchResults = emptyList()) }
            }
        }
    }

    fun startComposing() {
        _uiState.update { it.copy(isComposing = true) }
    }

    fun cancelComposing() {
        _uiState.update { it.copy(isComposing = false, draft = null) }
    }

    fun sendEmail(
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
    ) {
        viewModelScope.launch {
            val accountId = _uiState.value.selectedAccountId ?: return@launch

            _uiState.update { it.copy(isLoading = true) }
            try {
                val email = service.sendEmail(
                    accountId = accountId,
                    to = to,
                    subject = subject,
                    body = body,
                    cc = cc,
                    bcc = bcc,
                )

                _uiState.update {
                    it.copy(
                        emails = listOf(email) + it.emails,
                        isComposing = false,
                        draft = null,
                        isLoading = false,
                        error = null,
                    )
                }
            } catch (e: EmailError) {
                _uiState.update { it.copy(isLoading = false, error = e) }
            }
        }
    }

    fun saveDraft(
        to: List<String>,
        subject: String,
        body: String,
        cc: List<String> = emptyList(),
        bcc: List<String> = emptyList(),
    ) {
        viewModelScope.launch {
            val accountId = _uiState.value.selectedAccountId ?: return@launch

            try {
                val draft = service.saveDraft(
                    accountId = accountId,
                    to = to,
                    subject = subject,
                    body = body,
                    cc = cc,
                    bcc = bcc,
                )
                _uiState.update { it.copy(draft = draft, error = null) }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun loadAnalytics(accountId: String) {
        viewModelScope.launch {
            try {
                val analytics = service.getAnalytics(accountId)
                _uiState.update { it.copy(analytics = analytics, error = null) }
            } catch (e: EmailError) {
                _uiState.update { it.copy(error = e) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun refresh(accountId: String) {
        loadEmails(accountId)
        loadAnalytics(accountId)
    }
}
