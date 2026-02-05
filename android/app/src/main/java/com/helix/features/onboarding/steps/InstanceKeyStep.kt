/**
 * Instance Key Step - Helix Android Onboarding
 * Generate, display, and save instance key
 */

package com.helix.features.onboarding.steps

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
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
import java.util.*

@Composable
fun InstanceKeyStep(
    data: OnboardingData,
    onDataUpdate: () -> Unit
) {
    val context = LocalContext.current
    var copied by remember { mutableStateOf(false) }
    var showQRCode by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
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
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("instanceKey", data.instanceKey))
                    copied = true
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = HelixBlue
                ),
                shape = RoundedCornerShape(8.dp)
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
                    .border(1.dp, HelixBlue.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            ) {
                Icon(
                    painter = androidx.compose.material.icons.materialIcon("qrcode") { },
                    contentDescription = "QR Code",
                    tint = HelixBlue
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
                    onCheckedChange = { onDataUpdate() },
                    colors = CheckboxDefaults.colors(
                        checkedColor = Success
                    )
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
                        "I understand I cannot proceed without saving this key",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun androidx.compose.material.icons.materialIcon(
    name: String,
    content: @Composable () -> Unit
) = androidx.compose.material3.Icon(
    painter = androidx.compose.ui.graphics.painter.BitmapPainter(
        image = androidx.compose.ui.graphics.ImageBitmap(1, 1)
    ),
    contentDescription = name
)
