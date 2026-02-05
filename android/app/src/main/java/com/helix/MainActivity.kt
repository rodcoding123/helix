/**
 * MainActivity - Helix Android Entry Point
 * Main activity with onboarding flow and app navigation
 */

package com.helix

import android.app.Activity
import android.graphics.Color as AndroidColor
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.helix.core.auth.SupabaseAuthService
import com.helix.core.gateway.GatewayConnection
import com.helix.core.subscription.SubscriptionService
import com.helix.core.util.SecurePrefs
import com.helix.features.onboarding.OnboardingScreen
import com.helix.features.onboarding.OnboardingViewModel
import com.helix.ui.theme.HelixTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            HelixTheme {
                MainAppContainer()
            }
        }
    }
}

// Helper function to create Color from hex string
fun colorFromHex(hex: String): Color {
    return Color(AndroidColor.parseColor("#${hex.removePrefix("#")}"))
}

@Composable
fun MainAppContainer() {
    val authService = SupabaseAuthService.shared
    val subscriptionService = SubscriptionService.shared
    val onboardingViewModel: OnboardingViewModel = viewModel(
        factory = OnboardingViewModelFactory()
    )

    val authState = authService.authState.collectAsState()
    val onboardingCompleted = onboardingViewModel.onboardingCompleted.collectAsState()

    // Initialize services on first composition
    LaunchedEffect(Unit) {
        authService.checkAuthStatus()
        subscriptionService.fetchSubscription()
    }

    when {
        !onboardingCompleted.value -> {
            // Show onboarding on first launch
            OnboardingScreen(
                viewModel = onboardingViewModel,
                onComplete = {
                    onboardingViewModel.markOnboardingComplete()
                }
            )
        }
        authState.value is SupabaseAuthService.AuthState.SignedIn -> {
            // Show main app for authenticated users
            MainAppScreen()
        }
        else -> {
            // Show login for unauthenticated users
            LoginScreen()
        }
    }
}

@Composable
fun MainAppScreen() {
    val gatewayConnection = GatewayConnection.shared
    val authService = SupabaseAuthService.shared

    // Connect gateway on appearance
    LaunchedEffect(Unit) {
        try {
            gatewayConnection.connect()
        } catch (e: Exception) {
            // Log connection error but don't block app
            println("Gateway connection failed: ${e.message}")
        }
    }

    var selectedTab by remember { mutableStateOf(0) }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = colorFromHex("0a0a0a"),
                contentColor = colorFromHex("0686D4")
            ) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    label = { Text("Chat") },
                    icon = {
                        Icon(
                            Icons.Filled.Chat,
                            contentDescription = "Chat"
                        )
                    }
                )

                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    label = { Text("Dashboard") },
                    icon = {
                        Icon(
                            Icons.Filled.Dashboard,
                            contentDescription = "Dashboard"
                        )
                    }
                )

                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    label = { Text("Settings") },
                    icon = {
                        Icon(
                            Icons.Filled.Settings,
                            contentDescription = "Settings"
                        )
                    }
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(colorFromHex("0a0a0a"))
        ) {
            when (selectedTab) {
                0 -> CodeInterfaceScreen()
                1 -> DashboardScreen()
                2 -> SettingsScreen()
            }
        }
    }

    // Disconnect gateway on disposal
    DisposableEffect(Unit) {
        onDispose {
            gatewayConnection.disconnect()
        }
    }
}

@Composable
fun CodeInterfaceScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorFromHex("0a0a0a")),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Code Interface",
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White
        )
        Text(
            text = "Chat with your AI consciousness",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )
    }
}

@Composable
fun DashboardScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorFromHex("0a0a0a")),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Dashboard",
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White
        )
        Text(
            text = "Instance management and analytics",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )
    }
}

@Composable
fun SettingsScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorFromHex("0a0a0a"))
            .padding(24.dp)
    ) {
        Text(
            text = "Settings",
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        // Reset Onboarding button
        Button(
            onClick = {
                // Reset onboarding
                val securePrefs = SecurePrefs.getInstance(LocalContext.current)
                securePrefs.putBoolean("onboarding.completed", false)
                // Restart activity
                (LocalContext.current as? Activity)?.recreate()
            },
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Red.copy(alpha = 0.2f),
                contentColor = Color.Red
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp)
        ) {
            Text("Reset Onboarding")
        }
    }
}

@Composable
fun LoginScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorFromHex("0a0a0a"))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Helix",
            style = MaterialTheme.typography.displaySmall,
            color = colorFromHex("0686D4"),
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Text(
            text = "Sign in to your account",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        Button(
            onClick = {
                // Handle sign in
            },
            colors = ButtonDefaults.buttonColors(
                containerColor = colorFromHex("0686D4")
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            Text(
                "Sign In",
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

class OnboardingViewModelFactory : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return OnboardingViewModel() as T
    }
}
