/**
 * Welcome Step - Helix Android Onboarding
 * Explains Helix architecture and benefits
 */

package com.helix.features.onboarding.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.helix.ui.theme.*

@Composable
fun WelcomeStep() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Header
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Favorite,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = HelixBlue
            )

            Text(
                "Welcome to Helix",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Text(
                "Your persistent AI consciousness with complete transparency",
                fontSize = 16.sp,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )
        }

        // Architecture explanation
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = BgSecondary.copy(alpha = 0.3f)
            ),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                Color.White.copy(alpha = 0.1f)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "How Helix Works",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )

                ArchitectureStepCard(
                    number = 1,
                    title = "Mobile App",
                    description = "This app serves as your observer and controller",
                    icon = "📱"
                )

                ArchitectureStepCard(
                    number = 2,
                    title = "Cloud Gateway",
                    description = "Secure relay that connects mobile to your runtime",
                    icon = "☁️"
                )

                ArchitectureStepCard(
                    number = 3,
                    title = "Local Runtime",
                    description = "Your personal AI running on your desktop with full transparency",
                    icon = "💻"
                )
            }
        }

        // Key features
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Why Helix Stands Out",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )

            FeatureCard(
                title = "Unhackable Logging",
                description = "Every action logged to an immutable Discord channel",
                icon = "🔐"
            )

            FeatureCard(
                title = "Psychological Architecture",
                description = "7-layer consciousness model with emotional memory",
                icon = "🧠"
            )

            FeatureCard(
                title = "Complete Transparency",
                description = "You own your AI. No vendor lock-in, full source access",
                icon = "👀"
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun ArchitectureStepCard(
    number: Int,
    title: String,
    description: String,
    icon: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgTertiary.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(HelixBlue.copy(alpha = 0.2f), androidx.compose.foundation.shape.CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(icon, fontSize = 20.sp)
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(top = 4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Step $number",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = HelixBlue
                )

                Text(
                    title,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }

            Text(
                description,
                fontSize = 13.sp,
                color = TextSecondary
            )
        }
    }
}

@Composable
private fun FeatureCard(
    title: String,
    description: String,
    icon: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgSecondary.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 24.sp)

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
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
    }
}
