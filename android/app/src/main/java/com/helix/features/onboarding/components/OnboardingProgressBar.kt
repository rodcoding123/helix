/**
 * Onboarding Progress Bar - Helix Android
 * Visual indicator of onboarding progress
 */

package com.helix.features.onboarding.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.helix.ui.theme.*

@Composable
fun OnboardingProgressBar(
    currentStep: Int,
    totalSteps: Int
) {
    val progress = (currentStep + 1) / totalSteps.toFloat()

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Progress bar
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .background(BgTertiary, RoundedCornerShape(4.dp)),
            color = HelixBlue,
            trackColor = BgTertiary,
            strokeCap = androidx.compose.ui.graphics.StrokeCap.Round
        )

        // Progress text
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Step ${currentStep + 1} of $totalSteps",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )

            Text(
                "${(progress * 100).toInt()}%",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = HelixBlue
            )
        }

        // Step indicators
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(totalSteps) { step ->
                val isCompleted = step < currentStep
                val isCurrent = step == currentStep

                val backgroundColor by animateColorAsState(
                    targetValue = when {
                        isCompleted -> Success
                        isCurrent -> HelixBlue.copy(alpha = 0.2f)
                        else -> BgTertiary
                    },
                    label = "stepColor"
                )

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp)
                        .background(backgroundColor, RoundedCornerShape(8.dp))
                        .border(
                            width = if (isCurrent) 2.dp else 1.dp,
                            color = if (isCurrent) HelixBlue.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.05f),
                            shape = RoundedCornerShape(8.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (isCompleted) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = Color.White
                        )
                    } else {
                        Text(
                            "${step + 1}",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isCurrent) HelixBlue else TextSecondary
                        )
                    }
                }
            }
        }
    }
}
