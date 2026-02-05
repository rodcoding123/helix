/**
 * Intelligence Settings Screen - Phase 8 Android
 * Configure AI operations, model selection, and budget limits
 * Jetpack Compose implementation for Android
 */

package com.helix.features.settings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

data class AIOperation(
    val id: String,
    val name: String,
    val description: String,
    val primaryModel: String,
    val fallbackModel: String,
    val costCriticality: String,
    val estimatedCostUsd: Double,
    val enabled: Boolean
)

data class BudgetSettings(
    val dailyLimitUsd: Double = 50.0,
    val monthlyLimitUsd: Double = 1000.0,
    val warningThreshold: Double = 80.0
)

sealed class SettingsTab {
    object Operations : SettingsTab()
    object Budget : SettingsTab()
    object Models : SettingsTab()
}

class IntelligenceSettingsViewModel : ViewModel() {
    private val _operations = mutableStateOf<List<AIOperation>>(emptyList())
    val operations: State<List<AIOperation>> = _operations

    private val _budgetSettings = mutableStateOf(BudgetSettings())
    val budgetSettings: State<BudgetSettings> = _budgetSettings

    private val _isSaving = mutableStateOf(false)
    val isSaving: State<Boolean> = _isSaving

    private val _lastSaved = mutableStateOf<Long?>(null)
    val lastSaved: State<Long?> = _lastSaved

    fun loadOperations() {
        // In real implementation, fetch from API
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
            // ... more operations
        )
    }

    fun loadSettings() {
        // In real implementation, fetch from API
        _budgetSettings.value = BudgetSettings()
    }

    fun saveSettings() {
        _isSaving.value = true
        // In real implementation, post to API
        _lastSaved.value = System.currentTimeMillis()
        _isSaving.value = false
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

    fun updateWarningThreshold(threshold: Double) {
        _budgetSettings.value = _budgetSettings.value.copy(warningThreshold = threshold)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntelligenceSettingsScreen(viewModel: IntelligenceSettingsViewModel = viewModel()) {
    val operations by viewModel.operations
    val budgetSettings by viewModel.budgetSettings
    val isSaving by viewModel.isSaving
    val lastSaved by viewModel.lastSaved

    var selectedTab by remember { mutableStateOf<SettingsTab>(SettingsTab.Operations) }

    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        viewModel.loadOperations()
        viewModel.loadSettings()
    }

    Column(modifier = Modifier.fillMaxSize()) {
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
                SettingsTab.Budget -> BudgetTabContent(budgetSettings, viewModel)
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
                    text = "Last saved: ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(lastSaved)}",
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
                        .height(40.dp)
                ) {
                    Text("Reset")
                }

                Button(
                    onClick = { scope.launch { viewModel.saveSettings() } },
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp),
                    enabled = !isSaving
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
        OperationSection("Email Intelligence", emailOps, viewModel)
        OperationSection("Calendar Intelligence", calendarOps, viewModel)
        OperationSection("Task Intelligence", taskOps, viewModel)
        OperationSection("Analytics Intelligence", analyticsOps, viewModel)
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
            onValueChange = { if (it.isNotEmpty()) viewModel.updateDailyBudget(it.toDoubleOrNull() ?: 0.0) },
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
            onValueChange = { if (it.isNotEmpty()) viewModel.updateMonthlyBudget(it.toDoubleOrNull() ?: 0.0) },
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
                text = "Warning Threshold: ${budgetSettings.warningThreshold.toInt()}%",
                style = MaterialTheme.typography.labelMedium
            )
            Slider(
                value = budgetSettings.warningThreshold.toFloat(),
                onValueChange = { viewModel.updateWarningThreshold(it.toDouble()) },
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
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = "Current Usage",
                    style = MaterialTheme.typography.labelMedium
                )
                Text(
                    text = "This month: \$15.40 / \$1,000.00",
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(top = 4.dp)
                )
                LinearProgressIndicator(
                    progress = { 0.0154f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
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
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.warningContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onWarningContainer,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Model selection is automatic based on cost and availability",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onWarningContainer
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
        "HIGH" -> Color.Red
        "MEDIUM" -> Color.Yellow
        "LOW" -> Color.Green
        else -> Color.Gray
    }
}
