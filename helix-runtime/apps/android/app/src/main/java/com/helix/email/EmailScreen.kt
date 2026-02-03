package com.helix.email

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailScreen(
    viewModel: EmailViewModel,
    accountId: String,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()
    var showCompose by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableStateOf(0) }

    LaunchedEffect(accountId) {
        viewModel.loadEmails(accountId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Email") },
                actions = {
                    IconButton(onClick = { /* Show search */ }) {
                        Icon(Icons.Filled.Search, contentDescription = "Search")
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCompose = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Compose")
            }
        },
        modifier = modifier,
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
        ) {
            if (uiState.isLoading && uiState.emails.isEmpty()) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                )
            } else {
                Column {
                    // Tab Row
                    TabRow(selectedTabIndex = selectedTab) {
                        Tab(
                            selected = selectedTab == 0,
                            onClick = { selectedTab = 0 },
                            text = { Text("Inbox") },
                        )
                        Tab(
                            selected = selectedTab == 1,
                            onClick = { selectedTab = 1 },
                            text = { Text("Sent") },
                        )
                        Tab(
                            selected = selectedTab == 2,
                            onClick = { selectedTab = 2 },
                            text = { Text("Drafts") },
                        )
                        Tab(
                            selected = selectedTab == 3,
                            onClick = { selectedTab = 3 },
                            text = { Text("Search") },
                        )
                    }

                    // Content
                    when (selectedTab) {
                        0 -> InboxView(
                            emails = uiState.emails,
                            onEmailClick = { viewModel.selectEmail(it) },
                            onStarClick = { viewModel.toggleStar(it.id) },
                            onDeleteClick = { viewModel.deleteEmail(it.id) },
                        )

                        1 -> SentView()
                        2 -> DraftsView()
                        3 -> SearchView(
                            searchQuery = uiState.searchQuery,
                            searchResults = uiState.searchResults,
                            onSearch = { viewModel.search(it) },
                            onEmailClick = { viewModel.selectEmail(it) },
                        )
                    }
                }
            }

            if (uiState.error != null) {
                AlertDialog(
                    onDismissRequest = { viewModel.clearError() },
                    title = { Text("Error") },
                    text = { Text(uiState.error?.localizedMessage ?: "Unknown error") },
                    confirmButton = {
                        Button(onClick = { viewModel.clearError() }) {
                            Text("OK")
                        }
                    },
                )
            }
        }
    }

    if (showCompose) {
        ComposeEmailDialog(
            onDismiss = { showCompose = false },
            onSend = { to, subject, body ->
                viewModel.sendEmail(to, subject, body)
                showCompose = false
            },
        )
    }
}

@Composable
fun InboxView(
    emails: List<Email>,
    onEmailClick: (Email) -> Unit,
    onStarClick: (Email) -> Unit,
    onDeleteClick: (Email) -> Unit,
) {
    if (emails.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("No emails")
            }
        }
    } else {
        LazyColumn {
            items(emails) { email ->
                EmailRow(
                    email = email,
                    onClick = { onEmailClick(email) },
                    onStarClick = { onStarClick(email) },
                    onDeleteClick = { onDeleteClick(email) },
                )
            }
        }
    }
}

@Composable
fun EmailRow(
    email: Email,
    onClick: () -> Unit,
    onStarClick: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(8.dp)
            .clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = email.from.displayName,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        text = email.subject,
                        style = MaterialTheme.typography.titleSmall,
                    )
                    Text(
                        text = email.displayDate,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.Gray,
                    )
                }

                Row {
                    IconButton(onClick = onStarClick) {
                        Icon(
                            Icons.Filled.Star,
                            contentDescription = "Star",
                            tint = if (email.isStarred) Color.Yellow else Color.Gray,
                        )
                    }
                    IconButton(onClick = onDeleteClick) {
                        Icon(Icons.Filled.Delete, contentDescription = "Delete")
                    }
                }
            }
        }
    }
}

@Composable
fun SentView() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text("Sent emails")
    }
}

@Composable
fun DraftsView() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text("Drafts")
    }
}

@Composable
fun SearchView(
    searchQuery: String,
    searchResults: List<Email>,
    onSearch: (String) -> Unit,
    onEmailClick: (Email) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        TextField(
            value = searchQuery,
            onValueChange = onSearch,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Search emails") },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (searchResults.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text("No results")
            }
        } else {
            LazyColumn {
                items(searchResults) { email ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp)
                            .clickable { onEmailClick(email) },
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                        ) {
                            Text(email.from.displayName)
                            Text(email.subject)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ComposeEmailDialog(
    onDismiss: () -> Unit,
    onSend: (List<String>, String, String) -> Unit,
) {
    var to by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Compose Email") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                TextField(
                    value = to,
                    onValueChange = { to = it },
                    label = { Text("To") },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(8.dp))
                TextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Subject") },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(modifier = Modifier.height(8.dp))
                TextField(
                    value = body,
                    onValueChange = { body = it },
                    label = { Text("Body") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSend(to.split(",").map { it.trim() }, subject, body) },
                enabled = to.isNotEmpty() && subject.isNotEmpty() && body.isNotEmpty(),
            ) {
                Text("Send")
            }
        },
        dismissButton = {
            Button(onClick = onDismiss) {
                Text("Cancel")
            }
        },
    )
}
