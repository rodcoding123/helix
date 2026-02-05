/**
 * Gateway Connection Step - Helix Android Onboarding
 * Verify connection to cloud gateway
 */

package com.helix.features.onboarding.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.helix.features.onboarding.models.OnboardingData
import com.helix.ui.theme.*

@Composable
fun GatewayConnectionStep(
    data: OnboardingData,
    onDataUpdate: (OnboardingData) -> Unit
) {
    var url by remember { mutableStateOf(data.gatewayUrl) }
    var isConnecting by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Connect to Gateway",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )

            Text(
                "Verify connection to the cloud gateway",
                fontSize = 14.sp,
                color = TextSecondary
            )
        }

        // Gateway URL input
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Gateway URL",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )

            TextField(
                value = url,
                onValueChange = { url = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BgTertiary, RoundedCornerShape(8.dp)),
                colors = TextFieldDefaults.colors(
                    unfocusedContainerColor = BgTertiary,
                    focusedContainerColor = BgTertiary,
                    unfocusedTextColor = Color.White,
                    focusedTextColor = Color.White
                ),
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontFamily = FontFamily.Monospace,
                    fontSize = 14.sp
                ),
                enabled = !isConnecting,
                singleLine = true
            )
        }

        // Connection status
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (data.gatewayConnected) Success.copy(alpha = 0.1f)
                    else if (data.connectionError != null) Color(0xFFEF4444).copy(alpha = 0.1f)
                    else BgTertiary.copy(alpha = 0.5f)
            ),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                if (data.gatewayConnected) Success.copy(alpha = 0.3f)
                else if (data.connectionError != null) Color(0xFFEF4444).copy(alpha = 0.3f)
                else Color.White.copy(alpha = 0.05f)
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
                    imageVector = when {
                        data.gatewayConnected -> Icons.Default.Check
                        data.connectionError != null -> Icons.Default.Close
                        else -> Icons.Default.Link
                    },
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = when {
                        data.gatewayConnected -> Success
                        data.connectionError != null -> Color(0xFFEF4444)
                        else -> TextSecondary
                    }
                )

                Text(
                    when {
                        isConnecting -> "Connecting..."
                        data.gatewayConnected -> "Connected"
                        data.connectionError != null -> "Connection failed"
                        else -> "Not connected"
                    },
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = when {
                        data.gatewayConnected -> Success
                        data.connectionError != null -> Color(0xFFEF4444)
                        else -> TextSecondary
                    }
                )

                Spacer(modifier = Modifier.weight(1f))

                if (isConnecting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = HelixBlue
                    )
                }
            }
        }

        // Error message
        if (data.connectionError != null) {
            Text(
                data.connectionError,
                fontSize = 12.sp,
                color = Color(0xFFEF4444),
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFEF4444).copy(alpha = 0.1f), RoundedCornerShape(8.dp))
                    .padding(12.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Connect button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = {
                    isConnecting = true
                    onDataUpdate(data.copy(
                        gatewayConnected = true,
                        gatewayUrl = url,
                        connectionError = null
                    ))
                },
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (data.gatewayConnected) Success else HelixBlue,
                    disabledContainerColor = HelixBlue.copy(alpha = 0.3f)
                ),
                shape = RoundedCornerShape(8.dp),
                enabled = !isConnecting && data.instanceKey.isNotEmpty()
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        imageVector = if (data.gatewayConnected) Icons.Default.Check else Icons.Default.Link,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        if (data.gatewayConnected) "Connected" else "Connect",
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            if (data.gatewayConnected) {
                OutlinedButton(
                    onClick = { onDataUpdate(data.copy(gatewayConnected = false, connectionError = null)) },
                    modifier = Modifier
                        .height(48.dp)
                        .border(1.dp, Color(0xFFF59E0B).copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFFF59E0B)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}
