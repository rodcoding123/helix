/**
 * Instance Key Step - Helix Android Onboarding (Secure)
 * CRITICAL FIX 1.1: Instance keys stored in EncryptedSharedPreferences only
 * CRITICAL FIX 1.3: Clipboard auto-clears after 60 seconds
 * CRITICAL FIX 1.2: Content visibility flag set during sensitive operations
 */

package com.helix.features.onboarding.steps

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.helix.features.onboarding.models.OnboardingData
import com.helix.ui.theme.*
import com.helix.utils.SecurePrefsManager
import java.util.*

@Composable
fun InstanceKeyStepSecure(
    data: OnboardingData,
    onDataUpdate: () -> Unit
) {
    val context = LocalContext.current
    var copied by remember { mutableStateOf(false) }
    var showQRCode by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    val clipboardManager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val securePrefs = SecurePrefsManager.getInstance(context)
    val handler = Handler(Looper.getMainLooper())

    LaunchedEffect(Unit) {
        // Load instance key from EncryptedSharedPreferences on first appearance
        loadInstanceKeyFromSecureStorage(securePrefs, data)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Error banner
        error?.let { errorMsg ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Red.copy(alpha = 0.1f)
                ),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    Color.Red.copy(alpha = 0.3f)
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = Color.Red
                    )

                    Text(
                        errorMsg,
                        fontSize = 12.sp,
                        color = Color.Red
                    )

                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }

        // Warning banner
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = Warning.copy(alpha = 0.1f)
            ),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                Warning.copy(alpha = 0.3f)
            ),
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = Warning
                )

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        "Critical: Save This Key Now!",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Warning
                    )

                    Text(
                        "You cannot recover it later if lost",
                        fontSize = 12.sp,
                        color = Warning.copy(alpha = 0.8f)
                    )
                }
            }
        }

        // Key display
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Your Instance Key",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, HelixBlue.copy(alpha = 0.3f), RoundedCornerShape(12.dp)),
                colors = CardDefaults.cardColors(
                    containerColor = BgTertiary
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    data.instanceKey,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 16.sp,
                    color = HelixAccent
                )
            }
        }

        // Action buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = {
                    isLoading = true
                    copyKeySecurelyWithAutoClear(
                        context = context,
                        key = data.instanceKey,
                        clipboardManager = clipboardManager,
                        onCopied = { copied = true },
                        onCleared = { copied = false },
                        handler = handler,
                        onError = { error = it }
                    ) {
                        isLoading = false
                    }
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = HelixBlue
                ),
                shape = RoundedCornerShape(8.dp),
                enabled = !isLoading
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        imageVector = if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(if (copied) "Copied!" else "Copy")
                }
            }

            IconButton(
                onClick = { showQRCode = true },
                modifier = Modifier
                    .height(48.dp)
                    .border(1.dp, HelixBlue.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
                enabled = !isLoading
            ) {
                Icon(
                    imageVector = Icons.Default.QrCode,
                    contentDescription = "QR Code",
                    tint = HelixBlue
                )
            }

            IconButton(
                onClick = {
                    isLoading = true
                    regenerateKeySecurely(
                        securePrefs = securePrefs,
                        data = data,
                        onSuccess = {
                            saveInstanceKeyToSecureStorage(securePrefs, data.instanceKey) {
                                data.keySaved = true
                                isLoading = false
                                onDataUpdate()
                            }
                        },
                        onError = { error = it; isLoading = false }
                    )
                },
                modifier = Modifier
                    .height(48.dp)
                    .border(1.dp, Warning.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
                enabled = !isLoading
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Regenerate Key",
                    tint = Warning
                )
            }
        }

        // Confirmation checkbox
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    1.dp,
                    if (data.keySaved) Success.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.05f),
                    RoundedCornerShape(8.dp)
                ),
            colors = CardDefaults.cardColors(
                containerColor = BgTertiary.copy(alpha = 0.5f)
            ),
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = data.keySaved,
                    onCheckedChange = {
                        if (it) {
                            saveInstanceKeyToSecureStorage(securePrefs, data.instanceKey) {
                                data.keySaved = true
                                onDataUpdate()
                            }
                        } else {
                            data.keySaved = false
                            onDataUpdate()
                        }
                    },
                    colors = CheckboxDefaults.colors(
                        checkedColor = Success
                    ),
                    enabled = !isLoading
                )

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        "I have saved my instance key",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextPrimary
                    )

                    Text(
                        "Saved to device's secure encrypted storage",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }

    // QR Code sheet with screen protection
    if (showQRCode) {
        QRCodeSheetSecure(
            instanceKey = data.instanceKey,
            onDismiss = { showQRCode = false }
        )
    }
}

// MARK: - Secure Storage Functions

private fun saveInstanceKeyToSecureStorage(
    securePrefs: SecurePrefsManager,
    instanceKey: String,
    onComplete: () -> Unit
) {
    securePrefs.putString("instanceKey", instanceKey)
    securePrefs.putBoolean("keySaved", true)
    onComplete()
}

private fun loadInstanceKeyFromSecureStorage(
    securePrefs: SecurePrefsManager,
    data: OnboardingData
) {
    val storedKey = securePrefs.getString("instanceKey", "")
    if (storedKey.isNotEmpty()) {
        data.instanceKey = storedKey
        data.keySaved = securePrefs.getBoolean("keySaved", false)
    }
}

private fun regenerateKeySecurely(
    securePrefs: SecurePrefsManager,
    data: OnboardingData,
    onSuccess: () -> Unit,
    onError: (String) -> Unit
) {
    try {
        val newKey = UUID.randomUUID().toString()
        data.instanceKey = newKey
        onSuccess()
    } catch (e: Exception) {
        onError("Failed to regenerate key: ${e.message}")
    }
}

private fun copyKeySecurelyWithAutoClear(
    context: Context,
    key: String,
    clipboardManager: ClipboardManager,
    onCopied: () -> Unit,
    onCleared: () -> Unit,
    handler: Handler,
    onError: (String) -> Unit,
    onComplete: () -> Unit
) {
    try {
        // Copy to clipboard
        val clip = ClipData.newPlainText("instanceKey", key)
        clipboardManager.setPrimaryClip(clip)
        onCopied()

        // Auto-clear clipboard after 60 seconds (CRITICAL FIX 1.3)
        handler.postDelayed({
            try {
                // Only clear if clipboard still contains our key
                if (clipboardManager.primaryClip?.getItemAt(0)?.text == key) {
                    val emptyClip = ClipData.newPlainText("", "")
                    clipboardManager.setPrimaryClip(emptyClip)
                }
                // Update UI after clipboard is cleared
                handler.postDelayed({
                    onCleared()
                }, 2000)
            } catch (e: Exception) {
                onError("Failed to clear clipboard: ${e.message}")
            }
        }, 60000) // 60 seconds

        onComplete()
    } catch (e: Exception) {
        onError("Failed to copy key: ${e.message}")
        onComplete()
    }
}

// MARK: - QR Code Display with Screen Protection

@Composable
private fun QRCodeSheetSecure(
    instanceKey: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        // Enable screen protection during QR display (CRITICAL FIX 1.2)
        enableScreenProtection(context)
    }

    DisposableEffect(Unit) {
        onDispose {
            // Disable screen protection when dismissed
            disableScreenProtection(context)
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                "Instance Key QR Code",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Screen protection indicator
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = Success.copy(alpha = 0.1f)
                    ),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        Success.copy(alpha = 0.3f)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = Success
                        )

                        Text(
                            "Screen capture protected",
                            fontSize = 12.sp,
                            color = Success
                        )
                    }
                }

                // QR code placeholder (would use actual QR library)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                        .background(Color.White, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.QrCode,
                        contentDescription = "QR Code",
                        modifier = Modifier.size(100.dp),
                        tint = HelixBlue
                    )
                }

                // Key display
                Text(
                    instanceKey,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(BgTertiary, RoundedCornerShape(8.dp))
                        .padding(12.dp),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(
                    containerColor = HelixBlue
                )
            ) {
                Text("Close")
            }
        }
    )
}

// MARK: - Screen Protection Utilities

private fun enableScreenProtection(context: Context) {
    try {
        if (context is android.app.Activity) {
            context.window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        }
    } catch (e: Exception) {
        android.util.Log.e("ScreenProtection", "Failed to enable screen protection", e)
    }
}

private fun disableScreenProtection(context: Context) {
    try {
        if (context is android.app.Activity) {
            context.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
    } catch (e: Exception) {
        android.util.Log.e("ScreenProtection", "Failed to disable screen protection", e)
    }
}
