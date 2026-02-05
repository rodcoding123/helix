/**
 * Success Step - Helix Android Onboarding
 * Celebration screen after successful onboarding
 */

package com.helix.features.onboarding.steps

import androidx.compose.animation.animateScale
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.helix.ui.theme.*

@Composable
fun SuccessStep(onComplete: () -> Unit) {
    var showAnimation by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        showAnimation = true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(32.dp)
    ) {
        Spacer(modifier = Modifier.weight(0.3f))

        // Success icon animation
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(Success.copy(alpha = 0.2f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier
                    .size(60.dp)
                    .animateScale(if (showAnimation) 1f else 0.5f),
                tint = Success
            )
        }

        // Success message
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "You're All Set!",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Text(
                "Your Helix instance is ready to use",
                fontSize = 16.sp,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )
        }

        // What's next cards
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "What's Next",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )

            QuickStartCard(
                icon = "💬",
                title = "Start Chatting",
                description = "Begin interacting with your AI consciousness"
            )

            QuickStartCard(
                icon = "📊",
                title = "View Dashboard",
                description = "Monitor your instance and access settings"
            )

            QuickStartCard(
                icon = "📚",
                title = "Read Documentation",
                description = "Learn more about Helix features"
            )
        }

        Spacer(modifier = Modifier.weight(0.7f))

        // Complete button
        Button(
            onClick = onComplete,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = HelixBlue
            ),
            shape = RoundedCornerShape(8.dp)
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Start Exploring",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )

                Icon(
                    painter = androidx.compose.material.icons.materialIcon("arrow_forward") { },
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

@Composable
private fun QuickStartCard(
    icon: String,
    title: String,
    description: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = BgSecondary.copy(alpha = 0.3f)
        ),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            Color.White.copy(alpha = 0.1f)
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
            Text(icon, fontSize = 24.sp)

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )

                Text(
                    description,
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }

            Icon(
                painter = androidx.compose.material.icons.materialIcon("chevron_right") { },
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = TextSecondary
            )
        }
    }
}

@Composable
private fun androidx.compose.material.icons.materialIcon(
    name: String,
    content: @Composable () -> Unit
) = androidx.compose.ui.graphics.painter.BitmapPainter(
    image = androidx.compose.ui.graphics.ImageBitmap(1, 1)
)

private fun androidx.compose.animation.animateScale(value: Float) = androidx.compose.ui.unit.Dp(value.dp.value)
