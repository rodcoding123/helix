package com.helix.chat.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.helix.chat.models.Message
import com.helix.chat.viewmodels.ChatViewModel

/**
 * Chat Screen
 *
 * Main chat interface for sending and receiving messages.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val messages by viewModel.messages.collectAsState()
    val messageInput by viewModel.messageInput.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val isOnline by viewModel.isOnline.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val queueLength by viewModel.queueLength.collectAsState()
    val failedCount by viewModel.failedCount.collectAsState()
    val currentConversation by viewModel.currentConversation.collectAsState()

    val listState = rememberLazyListState()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column {
                        Text(
                            text = currentConversation?.title ?: "Chat",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Offline Banner
            if (!isOnline) {
                OfflineBanner(
                    queueLength = queueLength,
                    onSyncClick = { viewModel.syncMessages() },
                    isSyncing = isSyncing
                )
            }

            // Online Banner
            if (isOnline && queueLength > 0) {
                SyncingBanner(
                    queueLength = queueLength,
                    isSyncing = isSyncing,
                    failedCount = failedCount
                )
            }

            // Error Message
            if (error != null) {
                ErrorCard(
                    message = error!!.message,
                    onDismiss = { viewModel.clearError() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            // Messages List
            if (messages.isEmpty()) {
                // Empty state
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.Cloud,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.outline
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "No messages yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        "Start the conversation",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    state = listState,
                    contentPadding = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(messages) { message ->
                        MessageBubble(message = message)
                    }

                    // Loading indicator
                    if (isLoading) {
                        item {
                            CircularProgressIndicator(
                                modifier = Modifier
                                    .align(Alignment.CenterHorizontally)
                                    .padding(16.dp)
                            )
                        }
                    }
                }
            }

            // Input Area
            MessageInput(
                message = messageInput,
                onMessageChange = { viewModel.updateMessageInput(it) },
                onSendClick = { viewModel.sendMessage() },
                isOnline = isOnline,
                isLoading = isLoading,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun MessageBubble(
    message: Message,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = if (message.isUser) Arrangement.End else Arrangement.Start
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth(0.85f)
                .background(
                    color = if (message.isUser)
                        MaterialTheme.colorScheme.primaryContainer
                    else
                        MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(12.dp)
                )
        ) {
            Column(
                modifier = Modifier.padding(12.dp)
            ) {
                Text(
                    text = message.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (message.isUser)
                        MaterialTheme.colorScheme.onPrimaryContainer
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = message.formattedTime,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (message.isUser)
                            MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        else
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                    )

                    if (message.isPending == true) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.CloudUpload,
                                contentDescription = "Pending",
                                modifier = Modifier.size(12.dp),
                                tint = if (message.isUser)
                                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f)
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Pending",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (message.isUser)
                                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.5f)
                                else
                                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OfflineBanner(
    queueLength: Int,
    onSyncClick: () -> Unit,
    isSyncing: Boolean,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(12.dp),
        containerColor = MaterialTheme.colorScheme.warningContainer
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.CloudOff,
                    contentDescription = "Offline",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onWarningContainer
                )

                Spacer(modifier = Modifier.width(8.dp))

                Column {
                    Text(
                        text = "You're offline",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onWarningContainer
                    )

                    if (queueLength > 0) {
                        Text(
                            text = "$queueLength message${if (queueLength > 1) "s" else ""} waiting to sync",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onWarningContainer
                        )
                    }
                }
            }

            Button(
                onClick = onSyncClick,
                enabled = !isSyncing && queueLength > 0
            ) {
                if (isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Sync")
                }
            }
        }
    }
}

@Composable
fun SyncingBanner(
    queueLength: Int,
    isSyncing: Boolean,
    failedCount: Int,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(12.dp),
        containerColor = MaterialTheme.colorScheme.infoContainer
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (isSyncing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Cloud,
                        contentDescription = "Syncing",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Column {
                    Text(
                        text = if (isSyncing) "Syncing messages..." else "Synced",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold
                    )

                    if (queueLength > 0 || failedCount > 0) {
                        Text(
                            text = "${queueLength} queued, ${failedCount} failed",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MessageInput(
    message: String,
    onMessageChange: (String) -> Unit,
    onSendClick: () -> Unit,
    isOnline: Boolean,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .padding(8.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        TextField(
            value = message,
            onValueChange = onMessageChange,
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 48.dp, max = 120.dp),
            placeholder = {
                Text(
                    if (isOnline) "Type a message..." else "Offline - messages will sync",
                    style = MaterialTheme.typography.bodyMedium
                )
            },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            shape = RoundedCornerShape(12.dp),
            singleLine = false,
            enabled = !isLoading
        )

        IconButton(
            onClick = onSendClick,
            enabled = message.isNotBlank() && !isLoading,
            modifier = Modifier
                .size(48.dp)
                .background(
                    color = MaterialTheme.colorScheme.primary,
                    shape = RoundedCornerShape(12.dp)
                )
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = Color.White,
                    strokeWidth = 2.dp
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = "Send",
                    tint = Color.White
                )
            }
        }
    }
}

// Helper composable for info container color
private val MaterialTheme.colorScheme.infoContainer: Color
    @Composable
    get() = Color.Blue.copy(alpha = 0.1f)

private val MaterialTheme.colorScheme.warningContainer: Color
    @Composable
    get() = Color(0xFFFFF3CD)

private val MaterialTheme.colorScheme.onWarningContainer: Color
    @Composable
    get() = Color(0xFF664D03)
