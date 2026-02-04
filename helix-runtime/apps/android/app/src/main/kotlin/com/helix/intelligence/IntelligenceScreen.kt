/**
 * Phase 8: Intelligence Dashboard - Android
 * Jetpack Compose screen for accessing all AI intelligence features
 * Integrates with Phase 0.5 AI Operations Control Plane
 */

package com.helix.intelligence

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch

/**
 * Intelligence Feature data class
 */
data class IntelligenceFeature(
  val id: String,
  val name: String,
  val description: String,
  val icon: ImageVector,
  val enabled: Boolean,
  val estimatedCost: Double,
  val category: String,
)

/**
 * Budget Status data class
 */
data class BudgetStatus(
  val dailyLimit: Double,
  val currentSpend: Double,
  val remaining: Double,
  val percentUsed: Double,
  val operationsToday: Int,
)

/**
 * Intelligence View Model
 */
class IntelligenceViewModel : ViewModel() {
  var budgetStatus by mutableStateOf<BudgetStatus?>(null)
  var selectedFeature by mutableStateOf<IntelligenceFeature?>(null)
  var isLoading by mutableStateOf(false)
  var errorMessage by mutableStateOf<String?>(null)

  fun loadBudgetStatus() {
    isLoading = true
    // In production, call router client to get budget status
    budgetStatus = BudgetStatus(
      dailyLimit = 50.0,
      currentSpend = 8.43,
      remaining = 41.57,
      percentUsed = 16.86,
      operationsToday = 45,
    )
    isLoading = false
  }

  fun selectFeature(feature: IntelligenceFeature) {
    selectedFeature = feature
  }

  fun closeFeature() {
    selectedFeature = null
  }
}

/**
 * Main Intelligence Screen
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IntelligenceScreen(
  viewModel: IntelligenceViewModel = viewModel(),
) {
  val scope = rememberCoroutineScope()

  LaunchedEffect(Unit) {
    if (viewModel.budgetStatus == null) {
      viewModel.loadBudgetStatus()
    }
  }

  val intelligenceFeatures = listOf(
    IntelligenceFeature(
      id = "email-compose",
      name = "Email Composition",
      description = "AI-powered email drafting",
      icon = Icons.Filled.Mail,
      enabled = true,
      estimatedCost = 0.0015,
      category = "email",
    ),
    IntelligenceFeature(
      id = "email-classify",
      name = "Email Classification",
      description = "Auto-categorize emails",
      icon = Icons.Filled.Label,
      enabled = true,
      estimatedCost = 0.0006,
      category = "email",
    ),
    IntelligenceFeature(
      id = "email-respond",
      name = "Response Suggestions",
      description = "Smart reply suggestions",
      icon = Icons.Filled.Reply,
      enabled = true,
      estimatedCost = 0.0012,
      category = "email",
    ),
    IntelligenceFeature(
      id = "calendar-prep",
      name = "Meeting Preparation",
      description = "Auto-generate meeting prep",
      icon = Icons.Filled.DateRange,
      enabled = true,
      estimatedCost = 0.0025,
      category = "calendar",
    ),
    IntelligenceFeature(
      id = "calendar-time",
      name = "Optimal Meeting Times",
      description = "Find best meeting slots",
      icon = Icons.Filled.Schedule,
      enabled = true,
      estimatedCost = 0.008,
      category = "calendar",
    ),
    IntelligenceFeature(
      id = "task-prioritize",
      name = "Task Prioritization",
      description = "AI-powered task ordering",
      icon = Icons.Filled.CheckCircle,
      enabled = true,
      estimatedCost = 0.0018,
      category = "task",
    ),
    IntelligenceFeature(
      id = "task-breakdown",
      name = "Task Breakdown",
      description = "Generate subtasks",
      icon = Icons.Filled.List,
      enabled = true,
      estimatedCost = 0.0012,
      category = "task",
    ),
    IntelligenceFeature(
      id = "analytics-summary",
      name = "Weekly Summary",
      description = "AI productivity reports",
      icon = Icons.Filled.BarChart,
      enabled = true,
      estimatedCost = 0.03,
      category = "analytics",
    ),
    IntelligenceFeature(
      id = "analytics-anomaly",
      name = "Pattern Anomalies",
      description = "Detect unusual patterns",
      icon = Icons.Filled.Warning,
      enabled = true,
      estimatedCost = 0.0009,
      category = "analytics",
    ),
  )

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("Intelligence") },
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = MaterialTheme.colorScheme.primaryContainer,
        ),
      )
    },
  ) { paddingValues ->
    LazyColumn(
      modifier = Modifier
        .fillMaxSize()
        .padding(paddingValues)
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      // Budget Status Card
      item {
        viewModel.budgetStatus?.let { budget ->
          BudgetStatusCard(budget = budget)
        }
      }

      // Email Intelligence Section
      item {
        FeatureSection(
          title = "Email Intelligence",
          features = intelligenceFeatures.filter { it.category == "email" },
          onFeatureSelected = { feature ->
            viewModel.selectFeature(feature)
          },
        )
      }

      // Calendar Intelligence Section
      item {
        FeatureSection(
          title = "Calendar Intelligence",
          features = intelligenceFeatures.filter { it.category == "calendar" },
          onFeatureSelected = { feature ->
            viewModel.selectFeature(feature)
          },
        )
      }

      // Task Intelligence Section
      item {
        FeatureSection(
          title = "Task Intelligence",
          features = intelligenceFeatures.filter { it.category == "task" },
          onFeatureSelected = { feature ->
            viewModel.selectFeature(feature)
          },
        )
      }

      // Analytics Intelligence Section
      item {
        FeatureSection(
          title = "Analytics Intelligence",
          features = intelligenceFeatures.filter { it.category == "analytics" },
          onFeatureSelected = { feature ->
            viewModel.selectFeature(feature)
          },
        )
      }

      // Info Footer
      item {
        InfoCard()
      }
    }
  }

  // Feature Detail Dialog
  viewModel.selectedFeature?.let { feature ->
    FeatureDetailDialog(
      feature = feature,
      onDismiss = { viewModel.closeFeature() },
    )
  }
}

/**
 * Budget Status Card
 */
@Composable
fun BudgetStatusCard(budget: BudgetStatus) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surfaceVariant,
    ),
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(
          text = "Daily AI Budget",
          style = MaterialTheme.typography.headlineSmall,
        )
        Text(
          text = "Phase 0.5",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }

      // Budget Metrics Grid
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        BudgetMetricBox(
          label = "Limit",
          value = "$%.2f".format(budget.dailyLimit),
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier.weight(1f),
        )
        BudgetMetricBox(
          label = "Spent",
          value = "$%.2f".format(budget.currentSpend),
          color = MaterialTheme.colorScheme.tertiary,
          modifier = Modifier.weight(1f),
        )
        BudgetMetricBox(
          label = "Remaining",
          value = "$%.2f".format(budget.remaining),
          color = MaterialTheme.colorScheme.secondary,
          modifier = Modifier.weight(1f),
        )
        BudgetMetricBox(
          label = "Usage",
          value = "%.0f%%".format(budget.percentUsed),
          color = MaterialTheme.colorScheme.error,
          modifier = Modifier.weight(1f),
        )
      }

      // Budget Progress Bar
      Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        LinearProgressIndicator(
          progress = (budget.percentUsed / 100f).coerceIn(0f, 1f),
          modifier = Modifier.fillMaxWidth(),
          color = if (budget.percentUsed > 80) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
        )
        Text(
          text = "${budget.operationsToday} operations today",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
  }
}

/**
 * Budget Metric Box
 */
@Composable
fun BudgetMetricBox(
  label: String,
  value: String,
  color: Color,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surface,
    ),
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(8.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        text = value,
        style = MaterialTheme.typography.labelMedium.copy(
          fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
        ),
        color = color,
        fontWeight = FontWeight.SemiBold,
      )
    }
  }
}

/**
 * Feature Section
 */
@Composable
fun FeatureSection(
  title: String,
  features: List<IntelligenceFeature>,
  onFeatureSelected: (IntelligenceFeature) -> Unit,
) {
  Column(
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    Text(
      text = title,
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )

    Column(
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      features.forEach { feature ->
        FeatureCard(
          feature = feature,
          onTap = { onFeatureSelected(feature) },
        )
      }
    }
  }
}

/**
 * Feature Card
 */
@Composable
fun FeatureCard(
  feature: IntelligenceFeature,
  onTap: () -> Unit,
) {
  Card(
    modifier = Modifier
      .fillMaxWidth()
      .clickable(onClick = onTap),
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surfaceVariant,
    ),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      // Icon
      Icon(
        imageVector = feature.icon,
        contentDescription = null,
        modifier = Modifier
          .size(40.dp)
          .background(
            color = MaterialTheme.colorScheme.primary,
            shape = MaterialTheme.shapes.small,
          )
          .padding(8.dp),
        tint = MaterialTheme.colorScheme.onPrimary,
      )

      // Title and Description
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(2.dp),
      ) {
        Text(
          text = feature.name,
          style = MaterialTheme.typography.headlineSmall,
        )
        Text(
          text = feature.description,
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
        )
      }

      // Cost and Status
      Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        if (feature.enabled) {
          Text(
            text = "Enabled",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.tertiary,
          )
        }

        Text(
          text = "${"%.4f".format(feature.estimatedCost)}",
          style = MaterialTheme.typography.labelSmall.copy(
            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
          ),
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
  }
}

/**
 * Info Card
 */
@Composable
fun InfoCard() {
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.primaryContainer,
    ),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.Top,
    ) {
      Icon(
        imageVector = Icons.Filled.Info,
        contentDescription = null,
        modifier = Modifier.size(20.dp),
        tint = MaterialTheme.colorScheme.onPrimaryContainer,
      )

      Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        Text(
          text = "Phase 0.5 Integration",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        Text(
          text = "All operations are integrated with the unified AI Operations Control Plane",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
      }
    }
  }
}

/**
 * Feature Detail Dialog
 */
@Composable
fun FeatureDetailDialog(
  feature: IntelligenceFeature,
  onDismiss: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(feature.name) },
    text = {
      Column(
        verticalArrangement = Arrangement.spacedBy(16.dp),
      ) {
        Text(feature.description)

        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text(
            text = "Status: ${if (feature.enabled) "Enabled" else "Disabled"}",
            style = MaterialTheme.typography.labelSmall,
          )
          Text(
            text = "Cost: ${"%.4f".format(feature.estimatedCost)}/call",
            style = MaterialTheme.typography.labelSmall,
          )
        }

        Card(
          colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
          ),
        ) {
          Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
          ) {
            Text(
              text = "Phase 0.5 Integration",
              style = MaterialTheme.typography.labelMedium,
            )
            Text(
              text = "This operation is integrated with the unified AI Operations Control Plane",
              style = MaterialTheme.typography.labelSmall,
            )
          }
        }
      }
    },
    confirmButton = {
      Button(onClick = { /* Use Feature */ }) {
        Text("Use Feature")
      }
    },
    dismissButton = {
      TextButton(onClick = onDismiss) {
        Text("Close")
      }
    },
  )
}

#Preview
@Composable
private fun IntelligenceScreenPreview() {
  IntelligenceScreen()
}
