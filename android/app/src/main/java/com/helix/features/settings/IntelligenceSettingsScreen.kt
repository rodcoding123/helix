/**
 * Intelligence Settings Screen - Phase 8 Android
 * Configure AI operations, model selection, and budget limits
 * Jetpack Compose implementation for Android with real API integration
 */

package com.helix.features.settings

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

// UI Data Classes
data class AIOperation(
    val id: String,
    val name: String,
    val description: String,
    val primaryModel: String,
    val fallbackModel: String?,
    val costCriticality: String,
    val estimatedCostUsd: Double,
    val enabled: Boolean
)

data class BudgetSettings(
    val dailyLimitUsd: Double = 50.0,
    val monthlyLimitUsd: Double = 1000.0,
    val warningThreshold: Int = 80
)

data class UsageStats(
    val dailyUsd: Double = 0.0,
    val monthlyUsd: Double = 0.0,
    val dailyOperations: Int = 0,
    val monthlyOperations: Int = 0,
    val budgetStatus: String = "normal"
)

sealed class SettingsTab {
    object Operations : SettingsTab()
    object Budget : SettingsTab()
    object Models : SettingsTab()
}

sealed class LoadingState {
    object Idle : LoadingState()
    object Loading : LoadingState()
    data class Error(val message: String) : LoadingState()
    object Success : LoadingState()
}

class IntelligenceSettingsViewModelFactory(
    private val supabaseUrl: String,
    private val authTokenProvider: () -> String?
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(IntelligenceSettingsViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return IntelligenceSettingsViewModel(supabaseUrl, authTokenProvider) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}

class IntelligenceSettingsViewModel(
    supabaseUrl: String,
    authTokenProvider: () -> String?
) : ViewModel() {

    private val service = IntelligenceSettingsService.getInstance(supabaseUrl, authTokenProvider)

    private val _operations = mutableStateOf<List<AIOperation>>(emptyList())
    val operations: State<List<AIOperation>> = _operations

    private val _budgetSettings = mutableStateOf(BudgetSettings())
    val budgetSettings: State<BudgetSettings> = _budgetSettings

    private val _usageStats = mutableStateOf(UsageStats())
    val usageStats: State<UsageStats> = _usageStats

    private val _loadingState = mutableStateOf<LoadingState>(LoadingState.Idle)
    val loadingState: State<LoadingState> = _loadingState

    private val _isSaving = mutableStateOf(false)
    val isSaving: State<Boolean> = _isSaving

    private val _lastSaved = mutableStateOf<Long?>(null)
    val lastSaved: State<Long?> = _lastSaved

    private val _errorMessage = mutableStateOf<String?>(null)
    val errorMessage: State<String?> = _errorMessage

    fun clearError() {
        _errorMessage.value = null
    }

    fun loadSettings() {
        viewModelScope.launch {
            _loadingState.value = LoadingState.Loading

            when (val result = service.fetchSettings()) {
                is ApiResult.Success -> {
                    val data = result.data

                    // Map API response to UI models
                    _operations.value = data.operations.map { op ->
                        AIOperation(
                            id = op.operation_id,
                            name = op.operation_name,
                            description = op.description ?: "",
                            primaryModel = op.primary_model,
                            fallbackModel = op.fallback_model,
                            costCriticality = op.cost_criticality,
                            estimatedCostUsd = op.estimated_cost_usd,
                            enabled = op.enabled
                        )
                    }

                    _budgetSettings.value = BudgetSettings(
                        dailyLimitUsd = data.budget.daily_limit_usd,
                        monthlyLimitUsd = data.budget.monthly_limit_usd,
                        warningThreshold = data.budget.warning_threshold
                    )

                    _usageStats.value = UsageStats(
                        dailyUsd = data.usage.daily_usd,
                        monthlyUsd = data.usage.monthly_usd,
                        dailyOperations = data.usage.daily_operations,
                        monthlyOperations = data.usage.monthly_operations,
                        budgetStatus = data.usage.budget_status
                    )

                    _loadingState.value = LoadingState.Success
                }

                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                    _loadingState.value = LoadingState.Error(result.message)

                    // Load demo data as fallback
                    loadDemoData()
                }
            }
        }
    }

    private fun loadDemoData() {
        _operations.value = listOf(
            AIOperation(
                id = "email-compose",
                name = "Email Compose",
                description = "AI-powered email composition with context awareness",
                primaryModel = "deepseek-v3.2",
                fallbackModel = "gemini-2.0-flash",
                costCriticality = "LOW",
                estimatedCostUsd = 0.0015,
                enabled = true
            ),
            AIOperation(
                id = "email-classify",
                name = "Email Classification",
                description = "Automatic email categorization and priority detection",
                primaryModel = "deepseek-v3.2",
                fallbackModel = "gemini-2.0-flash",
                costCriticality = "LOW",
                estimatedCostUsd = 0.0006,
                enabled = true
            ),
            AIOperation(
                id = "calendar-suggest",
                name = "Calendar Suggestions",
                description = "Smart meeting time suggestions based on availability",
                primaryModel = "deepseek-v3.2",
                fallbackModel = "gemini-2.0-flash",
                costCriticality = "MEDIUM",
                estimatedCostUsd = 0.0012,
                enabled = true
            ),
            AIOperation(
                id = "task-prioritize",
                name = "Task Prioritization",
                description = "Intelligent task ordering based on deadlines and importance",
                primaryModel = "deepseek-v3.2",
                fallbackModel = "gemini-2.0-flash",
                costCriticality = "LOW",
                estimatedCostUsd = 0.0008,
                enabled = true
            )
        )
        _budgetSettings.value = BudgetSettings()
        _usageStats.value = UsageStats(
            dailyUsd = 2.50,
            monthlyUsd = 45.00,
            dailyOperations = 150,
            monthlyOperations = 3200
        )
    }

    fun saveSettings() {
        viewModelScope.launch {
            _isSaving.value = true

            val operationsToSave = _operations.value.map { op ->
                OperationSettingSaveRequest(
                    operation_id = op.id,
                    enabled = op.enabled
                )
            }

            val budgetToSave = BudgetSettingSaveRequest(
                daily_limit_usd = _budgetSettings.value.dailyLimitUsd,
                monthly_limit_usd = _budgetSettings.value.monthlyLimitUsd,
                warning_threshold = _budgetSettings.value.warningThreshold
            )

            when (val result = service.saveSettings(operationsToSave, budgetToSave)) {
                is ApiResult.Success -> {
                    _lastSaved.value = System.currentTimeMillis()
                    _errorMessage.value = null
                }

                is ApiResult.Error -> {
                    _errorMessage.value = "Failed to save: ${result.message}"
                }
            }

            _isSaving.value = false
        }
    }

    fun toggleOperation(operationId: String) {
        _operations.value = _operations.value.map {
            if (it.id == operationId) it.copy(enabled = !it.enabled) else it
        }
    }

    fun updateDailyBudget(amount: Double) {
        _budgetSettings.value = _budgetSettings.value.copy(dailyLimitUsd = amount)
    }

    fun updateMonthlyBudget(amount: Double) {
        _budgetSettings.value = _budgetSettings.value.copy(monthlyLimitUsd = amount)
    }

    fun updateWarningThreshold(threshold: Int) {
        _budgetSettings.value = _budgetSettings.value.copy(warningThreshold = threshold)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntelligenceSettingsScreen(
    supabaseUrl: String = "",
    authTokenProvider: () -> String? = { null },
    viewModel: IntelligenceSettingsViewModel = viewModel(
        factory = IntelligenceSettingsViewModelFactory(supabaseUrl, authTokenProvider)
    )
) {
    val operations by viewModel.operations
    val budgetSettings by viewModel.budgetSettings
    val usageStats by viewModel.usageStats
    val loadingState by viewModel.loadingState
    val isSaving by viewModel.isSaving
    val lastSaved by viewModel.lastSaved
    val errorMessage by viewModel.errorMessage

    var selectedTab by remember { mutableStateOf<SettingsTab>(SettingsTab.Operations) }

    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    // Show error in snackbar
    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(
                message = it,
                actionLabel = "Dismiss",
                duration = SnackbarDuration.Short
            )
            viewModel.clearError()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadSettings()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Header
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .border(
                        width = 1.dp,
                        color = MaterialTheme.colorScheme.outlineVariant,
                        shape = RectangleShape
                    )
                    .padding(16.dp)
            ) {
                Text(
                    text = "Intelligence Settings",
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                Text(
                    text = "Configure AI operations, models, and budget limits",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Loading indicator
            if (loadingState is LoadingState.Loading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Tab selector
            TabRow(
                selectedTabIndex = when (selectedTab) {
                    SettingsTab.Operations -> 0
                    SettingsTab.Budget -> 1
                    SettingsTab.Models -> 2
                }
            ) {
                Tab(
                    selected = selectedTab is SettingsTab.Operations,
                    onClick = { selectedTab = SettingsTab.Operations },
                    text = { Text("Operations") }
                )
                Tab(
                    selected = selectedTab is SettingsTab.Budget,
                    onClick = { selectedTab = SettingsTab.Budget },
                    text = { Text("Budget") }
                )
                Tab(
                    selected = selectedTab is SettingsTab.Models,
                    onClick = { selectedTab = SettingsTab.Models },
                    text = { Text("Models") }
                )
            }

            // Content
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                when (selectedTab) {
                    SettingsTab.Operations -> OperationsTabContent(operations, viewModel)
                    SettingsTab.Budget -> BudgetTabContent(budgetSettings, usageStats, viewModel)
                    SettingsTab.Models -> ModelsTabContent()
                }
            }

            // Footer
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        width = 1.dp,
                        color = MaterialTheme.colorScheme.outlineVariant,
                        shape = RectangleShape
                    )
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (lastSaved != null) {
                    Text(
                        text = "Last saved: ${
                            java.text.SimpleDateFormat(
                                "HH:mm:ss",
                                java.util.Locale.US
                            ).format(lastSaved)
                        }",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { viewModel.loadSettings() },
                        modifier = Modifier
                            .weight(1f)
                            .height(40.dp),
                        enabled = loadingState !is LoadingState.Loading
                    ) {
                        Text("Reset")
                    }

                    Button(
                        onClick = { scope.launch { viewModel.saveSettings() } },
                        modifier = Modifier
                            .weight(1f)
                            .height(40.dp),
                        enabled = !isSaving && loadingState !is LoadingState.Loading
                    ) {
                        if (isSaving) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text(if (isSaving) "Saving..." else "Save Settings")
                    }
                }
            }
        }
    }
}

@Composable
private fun OperationsTabContent(
    operations: List<AIOperation>,
    viewModel: IntelligenceSettingsViewModel
) {
    val emailOps = operations.filter { it.id.contains("email") }
    val calendarOps = operations.filter { it.id.contains("calendar") }
    val taskOps = operations.filter { it.id.contains("task") }
    val analyticsOps = operations.filter { it.id.contains("analytics") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        if (emailOps.isNotEmpty()) OperationSection("Email Intelligence", emailOps, viewModel)
        if (calendarOps.isNotEmpty()) OperationSection("Calendar Intelligence", calendarOps, viewModel)
        if (taskOps.isNotEmpty()) OperationSection("Task Intelligence", taskOps, viewModel)
        if (analyticsOps.isNotEmpty()) OperationSection("Analytics Intelligence", analyticsOps, viewModel)

        // Show uncategorized operations
        val categorizedIds = (emailOps + calendarOps + taskOps + analyticsOps).map { it.id }
        val otherOps = operations.filterNot { it.id in categorizedIds }
        if (otherOps.isNotEmpty()) OperationSection("Other Operations", otherOps, viewModel)
    }
}

@Composable
private fun OperationSection(
    title: String,
    operations: List<AIOperation>,
    viewModel: IntelligenceSettingsViewModel
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text = title, style = MaterialTheme.typography.titleMedium)

        operations.forEach { op ->
            OperationCard(op, viewModel)
        }
    }
}

@Composable
private fun OperationCard(
    operation: AIOperation,
    viewModel: IntelligenceSettingsViewModel
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .toggleable(
                        value = operation.enabled,
                        onValueChange = { viewModel.toggleOperation(operation.id) },
                        role = Role.Checkbox
                    ),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = operation.enabled,
                    onCheckedChange = { viewModel.toggleOperation(operation.id) }
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = operation.name,
                        style = MaterialTheme.typography.labelLarge
                    )
                    Text(
                        text = operation.description,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Cost: $${String.format("%.4f", operation.estimatedCostUsd)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Text(
                    text = "Criticality: ${operation.costCriticality}",
                    style = MaterialTheme.typography.labelSmall,
                    color = getCriticalityColor(operation.costCriticality)
                )
            }
        }
    }
}

@Composable
private fun BudgetTabContent(
    budgetSettings: BudgetSettings,
    usageStats: UsageStats,
    viewModel: IntelligenceSettingsViewModel
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Daily budget
        OutlinedTextField(
            value = budgetSettings.dailyLimitUsd.toString(),
            onValueChange = {
                if (it.isNotEmpty()) viewModel.updateDailyBudget(
                    it.toDoubleOrNull() ?: 0.0
                )
            },
            label = { Text("Daily Budget Limit (USD)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
            prefix = { Text("$") }
        )
        Text(
            text = "Default: $50.00/day",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Monthly budget
        OutlinedTextField(
            value = budgetSettings.monthlyLimitUsd.toString(),
            onValueChange = {
                if (it.isNotEmpty()) viewModel.updateMonthlyBudget(
                    it.toDoubleOrNull() ?: 0.0
                )
            },
            label = { Text("Monthly Budget Limit (USD)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
            prefix = { Text("$") }
        )
        Text(
            text = "Default: $1,000.00/month",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        // Warning threshold
        Column {
            Text(
                text = "Warning Threshold: ${budgetSettings.warningThreshold}%",
                style = MaterialTheme.typography.labelMedium
            )
            Slider(
                value = budgetSettings.warningThreshold.toFloat(),
                onValueChange = { viewModel.updateWarningThreshold(it.toInt()) },
                valueRange = 0f..100f,
                modifier = Modifier.fillMaxWidth()
            )
            Text(
                text = "Alert when usage exceeds this threshold",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Current usage
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = when (usageStats.budgetStatus) {
                    "warning" -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f)
                    "exceeded" -> MaterialTheme.colorScheme.errorContainer
                    else -> MaterialTheme.colorScheme.primaryContainer
                }
            )
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Current Usage",
                        style = MaterialTheme.typography.labelMedium
                    )
                    if (usageStats.budgetStatus != "normal") {
                        AssistChip(
                            onClick = { },
                            label = {
                                Text(
                                    text = usageStats.budgetStatus.uppercase(),
                                    style = MaterialTheme.typography.labelSmall
                                )
                            },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = if (usageStats.budgetStatus == "exceeded")
                                    MaterialTheme.colorScheme.error
                                else
                                    MaterialTheme.colorScheme.tertiary
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = "Today",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "$${String.format("%.2f", usageStats.dailyUsd)}",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "${usageStats.dailyOperations} ops",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "This Month",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "$${String.format("%.2f", usageStats.monthlyUsd)}",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "${usageStats.monthlyOperations} ops",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                val monthlyProgress = if (budgetSettings.monthlyLimitUsd > 0)
                    (usageStats.monthlyUsd / budgetSettings.monthlyLimitUsd).toFloat().coerceIn(0f, 1f)
                else 0f

                LinearProgressIndicator(
                    progress = { monthlyProgress },
                    modifier = Modifier.fillMaxWidth(),
                    color = when {
                        monthlyProgress > 0.9f -> MaterialTheme.colorScheme.error
                        monthlyProgress > (budgetSettings.warningThreshold / 100f) -> MaterialTheme.colorScheme.tertiary
                        else -> MaterialTheme.colorScheme.primary
                    }
                )

                Text(
                    text = "$${String.format("%.2f", usageStats.monthlyUsd)} / $${
                        String.format(
                            "%.2f",
                            budgetSettings.monthlyLimitUsd
                        )
                    }",
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun ModelsTabContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Text(
            text = "Model Configuration",
            style = MaterialTheme.typography.titleMedium
        )
        Text(
            text = "Select primary and fallback models for each operation category",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        listOf("Email", "Calendar", "Task", "Analytics").forEach { category ->
            ModelConfigCard(category)
        }

        ElevatedCard(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.elevatedCardColors(
                containerColor = MaterialTheme.colorScheme.tertiaryContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onTertiaryContainer,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Model selection is automatic based on cost and availability",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun ModelConfigCard(category: String) {
    var primaryModel by remember { mutableStateOf("DeepSeek v3.2") }
    var fallbackModel by remember { mutableStateOf("Gemini 2.0 Flash") }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(text = category, style = MaterialTheme.typography.labelLarge)

            // Primary model dropdown (simplified - in real app use DropdownMenu)
            Text(
                text = "Primary: $primaryModel",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(top = 8.dp)
            )

            Text(
                text = "Fallback: $fallbackModel",
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun getCriticalityColor(criticality: String): Color {
    return when (criticality) {
        "HIGH" -> Color(0xFFE53935)  // Red
        "MEDIUM" -> Color(0xFFFFA726) // Orange
        "LOW" -> Color(0xFF66BB6A)    // Green
        else -> Color.Gray
    }
}
