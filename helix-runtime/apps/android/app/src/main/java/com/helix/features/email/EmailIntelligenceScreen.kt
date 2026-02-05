package com.helix.features.email

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import java.util.*

/// Email Intelligence Screen for Android
/// Integrates compose, classify, and respond operations
@Composable
fun EmailIntelligenceScreen(
  viewModel: EmailIntelligenceViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
  val selectedTab by viewModel.selectedTab.collectAsState()
  val isLoading by viewModel.isLoading.collectAsState()
  val error by viewModel.error.collectAsState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
  ) {
    // Header with operation toggles
    OperationHeaderRow(
      operations = viewModel.emailOperations,
      onToggle = { viewModel.toggleOperation(it) }
    )

    // Divider
    Divider()

    // Tab navigation
    TabRow(
      selectedTabIndex = selectedTab.ordinal,
      modifier = Modifier.fillMaxWidth()
    ) {
      EmailIntelligenceTab.values().forEachIndexed { index, tab ->
        Tab(
          selected = selectedTab.ordinal == index,
          onClick = { viewModel.selectTab(tab) },
          text = { Text(tab.label) }
        )
      }
    }

    // Content area
    Box(modifier = Modifier.weight(1f)) {
      when (selectedTab) {
        EmailIntelligenceTab.COMPOSE -> ComposeContent(viewModel, isLoading, error)
        EmailIntelligenceTab.CLASSIFY -> ClassifyContent(viewModel, isLoading, error)
        EmailIntelligenceTab.RESPOND -> RespondContent(viewModel, isLoading, error)
      }
    }
  }
}

@Composable
private fun ComposeContent(
  viewModel: EmailIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  var selectedTone by remember { mutableStateOf(EmailTone.PROFESSIONAL) }
  var context by remember { mutableStateOf("") }
  var maxLength by remember { mutableStateOf(500) }

  val composedEmail by viewModel.composedEmail.collectAsState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    Text(
      text = "Generate Email",
      fontSize = 20.sp,
      fontWeight = FontWeight.Bold
    )

    // Tone selector
    Text(text = "Tone", fontWeight = FontWeight.SemiBold)
    SingleSelectDropdown(
      options = EmailTone.values().map { it.label },
      selectedIndex = selectedTone.ordinal,
      onSelectionChange = { selectedTone = EmailTone.values()[it] }
    )

    // Context input
    Text(text = "Context", fontWeight = FontWeight.SemiBold)
    TextField(
      value = context,
      onValueChange = { context = it },
      modifier = Modifier
        .fillMaxWidth()
        .height(100.dp),
      placeholder = { Text("Enter email context") },
      singleLine = false,
      shape = MaterialTheme.shapes.medium
    )

    // Max length slider
    Text(text = "Max Length: $maxLength", fontWeight = FontWeight.SemiBold)
    Slider(
      value = maxLength.toFloat(),
      onValueChange = { maxLength = it.toInt() },
      valueRange = 100f..2000f,
      steps = 18,
      modifier = Modifier.fillMaxWidth()
    )

    // Composed email preview
    if (composedEmail != null) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
          containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
      ) {
        Column(
          modifier = Modifier.padding(12.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Text("Preview", fontWeight = FontWeight.SemiBold)
          Text("Subject: ${composedEmail!!.subject}", fontSize = 12.sp)
          Text(
            "Confidence: ${String.format("%.0f", composedEmail!!.confidence * 100)}%",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.secondary
          )

          TextField(
            value = composedEmail!!.body,
            onValueChange = {},
            enabled = false,
            modifier = Modifier
              .fillMaxWidth()
              .height(120.dp),
            singleLine = false
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            Button(
              onClick = { viewModel.copyToClipboard(composedEmail!!.body) },
              modifier = Modifier.weight(1f)
            ) {
              Text("Copy")
            }
            Button(
              onClick = { viewModel.sendEmail(composedEmail!!) },
              modifier = Modifier.weight(1f)
            ) {
              Text("Send")
            }
          }
        }
      }
    }

    // Generate button
    Button(
      onClick = {
        viewModel.generateEmail(
          tone = selectedTone,
          context = context,
          maxLength = maxLength
        )
      },
      enabled = !isLoading && context.isNotEmpty() && viewModel.isOperationEnabled("email-compose"),
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp)
    ) {
      if (isLoading) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
      } else {
        Text("Generate Email")
      }
    }

    // Error display
    if (!error.isNullOrEmpty()) {
      Text(
        text = error,
        color = MaterialTheme.colorScheme.error,
        fontSize = 12.sp,
        modifier = Modifier
          .fillMaxWidth()
          .padding(8.dp)
          .background(
            color = MaterialTheme.colorScheme.error.copy(alpha = 0.1f),
            shape = MaterialTheme.shapes.small
          )
          .padding(8.dp)
      )
    }
  }
}

@Composable
private fun ClassifyContent(
  viewModel: EmailIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  val classifiedEmails by viewModel.classifiedEmails.collectAsState()

  Column(modifier = Modifier.fillMaxSize()) {
    if (classifiedEmails.isEmpty() && !isLoading) {
      Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
      ) {
        Column(
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Icon(
            imageVector = Icons.Default.MailOutline,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.secondary
          )
          Text("No emails classified yet")
        }
      }
    } else {
      LazyColumn(
        modifier = Modifier
          .weight(1f)
          .fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        items(classifiedEmails) { classified ->
          ClassifiedEmailRow(classified)
        }
      }
    }

    if (isLoading) {
      Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
      ) {
        CircularProgressIndicator()
      }
    }

    Button(
      onClick = { viewModel.classifyInbox() },
      enabled = !isLoading && viewModel.isOperationEnabled("email-classify"),
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp)
        .padding(16.dp)
    ) {
      if (isLoading) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
      } else {
        Text("Classify Inbox")
      }
    }

    if (!error.isNullOrEmpty()) {
      Text(
        text = error,
        color = MaterialTheme.colorScheme.error,
        fontSize = 12.sp,
        modifier = Modifier
          .fillMaxWidth()
          .padding(8.dp)
      )
    }
  }
}

@Composable
private fun RespondContent(
  viewModel: EmailIntelligenceViewModel,
  isLoading: Boolean,
  error: String?
) {
  var selectedType by remember { mutableStateOf(EmailResponseType.ACKNOWLEDGE) }
  val generatedResponse by viewModel.generatedResponse.collectAsState()

  Column(
    modifier = Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp)
  ) {
    Text(
      text = "Generate Response",
      fontSize = 20.sp,
      fontWeight = FontWeight.Bold
    )

    // Response type selector
    Text(text = "Response Type", fontWeight = FontWeight.SemiBold)
    SingleSelectDropdown(
      options = EmailResponseType.values().map { it.label },
      selectedIndex = selectedType.ordinal,
      onSelectionChange = { selectedType = EmailResponseType.values()[it] }
    )

    // Generated response preview
    if (generatedResponse != null) {
      Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
          containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
      ) {
        Column(
          modifier = Modifier.padding(12.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
          Text("Draft Response", fontWeight = FontWeight.SemiBold)
          Text(
            "Confidence: ${String.format("%.0f", generatedResponse!!.confidence * 100)}%",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.secondary
          )

          TextField(
            value = generatedResponse!!.body,
            onValueChange = {},
            enabled = false,
            modifier = Modifier
              .fillMaxWidth()
              .height(120.dp),
            singleLine = false
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
          ) {
            Button(
              onClick = { viewModel.copyToClipboard(generatedResponse!!.body) },
              modifier = Modifier.weight(1f)
            ) {
              Text("Copy")
            }
            Button(
              onClick = { viewModel.sendResponse(generatedResponse!!) },
              modifier = Modifier.weight(1f)
            ) {
              Text("Send")
            }
          }
        }
      }
    }

    // Generate button
    Button(
      onClick = {
        viewModel.generateResponse(type = selectedType)
      },
      enabled = !isLoading && viewModel.isOperationEnabled("email-respond"),
      modifier = Modifier
        .fillMaxWidth()
        .height(48.dp)
    ) {
      if (isLoading) {
        CircularProgressIndicator(modifier = Modifier.size(24.dp))
      } else {
        Text("Generate Response")
      }
    }

    // Error display
    if (!error.isNullOrEmpty()) {
      Text(
        text = error,
        color = MaterialTheme.colorScheme.error,
        fontSize = 12.sp
      )
    }
  }
}

@Composable
private fun OperationHeaderRow(
  operations: Map<String, Boolean>,
  onToggle: (String) -> Unit
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .horizontalScroll(rememberScrollState())
      .padding(8.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp)
  ) {
    operations.keys.forEach { op ->
      FilterChip(
        selected = operations[op] ?: false,
        onClick = { onToggle(op) },
        label = {
          Text(
            text = op.removePrefix("email-"),
            fontSize = 12.sp
          )
        },
        leadingIcon = {
          if (operations[op] == true) {
            Icon(
              imageVector = Icons.Default.Check,
              contentDescription = null,
              modifier = Modifier.size(16.dp)
            )
          }
        }
      )
    }
  }
}

@Composable
private fun ClassifiedEmailRow(classified: ClassifiedEmail) {
  Card(
    modifier = Modifier
      .fillMaxWidth()
      .clickable { },
    colors = CardDefaults.cardColors(
      containerColor = MaterialTheme.colorScheme.surfaceVariant
    )
  ) {
    Column(
      modifier = Modifier.padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
      ) {
        Text(classified.subject, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        PriorityBadge(classified.priority)
      }

      Text(classified.description, fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)

      if (classified.needsResponse) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(4.dp),
          verticalAlignment = Alignment.CenterVertically
        ) {
          Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.warning
          )
          Text(
            "Response needed",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.warning
          )
        }
      }
    }
  }
}

@Composable
private fun PriorityBadge(priority: EmailPriority) {
  val backgroundColor = when (priority) {
    EmailPriority.HIGH -> Color(0xFFFF5252)
    EmailPriority.MEDIUM -> Color(0xFFFFAB40)
    EmailPriority.LOW -> Color(0xFF4CAF50)
  }

  Surface(
    color = backgroundColor,
    shape = MaterialTheme.shapes.small,
    modifier = Modifier.padding(4.dp)
  ) {
    Text(
      text = priority.label,
      color = Color.White,
      fontSize = 10.sp,
      fontWeight = FontWeight.Bold,
      modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
    )
  }
}

@Composable
private fun SingleSelectDropdown(
  options: List<String>,
  selectedIndex: Int,
  onSelectionChange: (Int) -> Unit
) {
  var expanded by remember { mutableStateOf(false) }

  Box(modifier = Modifier.fillMaxWidth()) {
    OutlinedButton(
      onClick = { expanded = !expanded },
      modifier = Modifier.fillMaxWidth()
    ) {
      Text(options.getOrNull(selectedIndex) ?: "Select option")
    }

    DropdownMenu(
      expanded = expanded,
      onDismissRequest = { expanded = false },
      modifier = Modifier.fillMaxWidth(0.9f)
    ) {
      options.forEachIndexed { index, option ->
        DropdownMenuItem(
          text = { Text(option) },
          onClick = {
            onSelectionChange(index)
            expanded = false
          }
        )
      }
    }
  }
}

// Models
enum class EmailIntelligenceTab(val label: String) {
  COMPOSE("Compose"),
  CLASSIFY("Classify"),
  RESPOND("Respond")
}

enum class EmailTone(val label: String) {
  PROFESSIONAL("Professional"),
  CASUAL("Casual"),
  FORMAL("Formal")
}

enum class EmailResponseType(val label: String) {
  ACKNOWLEDGE("Acknowledge"),
  APPROVE("Approve"),
  DECLINE("Decline"),
  REQUEST_INFO("Request Info")
}

enum class EmailPriority(val label: String) {
  HIGH("High"),
  MEDIUM("Medium"),
  LOW("Low")
}

data class ComposedEmail(
  val id: UUID = UUID.randomUUID(),
  val subject: String,
  val body: String,
  val confidence: Double,
  val suggestions: List<String>,
  val estimatedTokens: Int
)

data class ClassifiedEmail(
  val id: UUID = UUID.randomUUID(),
  val subject: String,
  val priority: EmailPriority,
  val category: String,
  val description: String,
  val needsResponse: Boolean,
  val responseDeadline: Date,
  val suggestedAction: String
)

data class EmailResponse(
  val id: UUID = UUID.randomUUID(),
  val body: String,
  val type: String,
  val tone: String,
  val confidence: Double,
  val estimatedTokens: Int
)

// ViewModel
class EmailIntelligenceViewModel : ViewModel() {
  val selectedTab = androidx.compose.runtime.mutableStateOf(EmailIntelligenceTab.COMPOSE)
  val isLoading = androidx.compose.runtime.mutableStateOf(false)
  val error = androidx.compose.runtime.mutableStateOf<String?>(null)
  val composedEmail = androidx.compose.runtime.mutableStateOf<ComposedEmail?>(null)
  val classifiedEmails = androidx.compose.runtime.mutableStateOf<List<ClassifiedEmail>>(emptyList())
  val generatedResponse = androidx.compose.runtime.mutableStateOf<EmailResponse?>(null)

  val emailOperations = mutableStateOf(
    mapOf(
      "email-compose" to true,
      "email-classify" to true,
      "email-respond" to false
    )
  )

  fun selectTab(tab: EmailIntelligenceTab) {
    selectedTab.value = tab
  }

  fun toggleOperation(operation: String) {
    val current = emailOperations.value.toMutableMap()
    current[operation] = !current.getOrDefault(operation, false)
    emailOperations.value = current
  }

  fun isOperationEnabled(operation: String): Boolean {
    return emailOperations.value.getOrDefault(operation, false)
  }

  fun generateEmail(tone: EmailTone, context: String, maxLength: Int) {
    isLoading.value = true
    error.value = null

    viewModelScope.launch {
      try {
        val email = ComposedEmail(
          subject = "Email subject based on context",
          body = "Generated email body for $tone tone with context: $context",
          confidence = 0.92,
          suggestions = listOf("suggestion1", "suggestion2"),
          estimatedTokens = 150
        )
        composedEmail.value = email
        isLoading.value = false
      } catch (e: Exception) {
        error.value = e.message
        isLoading.value = false
      }
    }
  }

  fun classifyInbox() {
    isLoading.value = true
    error.value = null

    viewModelScope.launch {
      try {
        val classified = listOf(
          ClassifiedEmail(
            subject = "Important Meeting",
            priority = EmailPriority.HIGH,
            category = "Meeting",
            description = "Conference call with team",
            needsResponse = true,
            responseDeadline = Date(System.currentTimeMillis() + 3600000),
            suggestedAction = "Respond immediately"
          )
        )
        classifiedEmails.value = classified
        isLoading.value = false
      } catch (e: Exception) {
        error.value = e.message
        isLoading.value = false
      }
    }
  }

  fun generateResponse(type: EmailResponseType) {
    isLoading.value = true
    error.value = null

    viewModelScope.launch {
      try {
        val response = EmailResponse(
          body = "Response to ${type.label.lowercase()} email",
          type = type.label,
          tone = "professional",
          confidence = 0.88,
          estimatedTokens = 120
        )
        generatedResponse.value = response
        isLoading.value = false
      } catch (e: Exception) {
        error.value = e.message
        isLoading.value = false
      }
    }
  }

  fun copyToClipboard(text: String) {
    // Copy to clipboard implementation
  }

  fun sendEmail(email: ComposedEmail) {
    viewModelScope.launch {
      try {
        composedEmail.value = null
        error.value = null
      } catch (e: Exception) {
        error.value = "Failed to send email: ${e.message}"
      }
    }
  }

  fun sendResponse(response: EmailResponse) {
    viewModelScope.launch {
      try {
        generatedResponse.value = null
        error.value = null
      } catch (e: Exception) {
        error.value = "Failed to send response: ${e.message}"
      }
    }
  }
}
