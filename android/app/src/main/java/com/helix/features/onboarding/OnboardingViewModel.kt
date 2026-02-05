/**
 * Onboarding ViewModel - Helix Android
 * Manages onboarding state and navigation
 */

package com.helix.features.onboarding

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.helix.core.gateway.GatewayConfigStorage
import com.helix.core.gateway.GatewayConnectionConfig
import com.helix.features.onboarding.models.OnboardingData
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class OnboardingViewModel(private val context: Context) : ViewModel() {
    companion object {
        private const val PREFS_NAME = "helix_onboarding"
        private const val KEY_COMPLETED = "onboarding.completed"
        private const val KEY_INSTANCE_KEY = "onboarding.instanceKey"
    }

    private val _currentStep = MutableStateFlow(0)
    val currentStep: StateFlow<Int> = _currentStep.asStateFlow()

    private val _data = MutableStateFlow(OnboardingData())
    val data: StateFlow<OnboardingData> = _data.asStateFlow()

    private val _isCompleted = MutableStateFlow(false)
    val isCompleted: StateFlow<Boolean> = _isCompleted.asStateFlow()

    val totalSteps = 5

    val stepTitle: String
        get() = when (currentStep.value) {
            0 -> "Welcome"
            1 -> "Instance Key"
            2 -> "Desktop Setup"
            3 -> "Connect to Gateway"
            4 -> "Success!"
            else -> ""
        }

    val stepDescription: String
        get() = when (currentStep.value) {
            0 -> "Understand Helix architecture"
            1 -> "Generate your unique key"
            2 -> "Set up CLI on your desktop"
            3 -> "Verify connection"
            4 -> "Start using Helix"
            else -> ""
        }

    val canProceed: Boolean
        get() = when (currentStep.value) {
            0 -> true // Welcome step always available
            1 -> data.value.keySaved // Instance key must be saved
            2 -> data.value.desktopInstructionsViewed // Desktop instructions must be viewed
            3 -> data.value.gatewayConnected // Gateway must be connected
            4 -> true // Success step
            else -> false
        }

    init {
        loadSavedState()
    }

    fun nextStep() {
        if (_currentStep.value < totalSteps - 1) {
            _currentStep.value++
        }
    }

    fun previousStep() {
        if (_currentStep.value > 0) {
            _currentStep.value--
        }
    }

    fun skipToStep(step: Int) {
        if (step in 0 until totalSteps) {
            _currentStep.value = step
        }
    }

    fun updateData(update: (OnboardingData) -> OnboardingData) {
        val newData = update(_data.value)
        _data.value = newData
    }

    fun completeOnboarding() {
        viewModelScope.launch {
            // Save instance key and gateway URL to secure storage
            val configStorage = GatewayConfigStorage(context)
            val config = GatewayConnectionConfig(
                instanceKey = _data.value.instanceKey,
                gatewayUrl = _data.value.gatewayUrl
            )

            try {
                configStorage.saveConfig(config)
            } catch (e: Exception) {
                println("[Onboarding] Failed to save config: ${e.message}")
            }

            // Mark onboarding as complete in SharedPreferences
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putBoolean(KEY_COMPLETED, true)
                putString(KEY_INSTANCE_KEY, _data.value.instanceKey)
                apply()
            }

            _isCompleted.value = true
        }
    }

    fun resetOnboarding() {
        _currentStep.value = 0
        _data.value = OnboardingData()
        _isCompleted.value = false

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            remove(KEY_COMPLETED)
            remove(KEY_INSTANCE_KEY)
            apply()
        }
    }

    private fun loadSavedState() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isCompleted = prefs.getBoolean(KEY_COMPLETED, false)
        val instanceKey = prefs.getString(KEY_INSTANCE_KEY, null)

        if (isCompleted && instanceKey != null) {
            _isCompleted.value = true
        }
    }

    class Factory(private val context: Context) {
        fun create(): OnboardingViewModel = OnboardingViewModel(context)
    }
}
