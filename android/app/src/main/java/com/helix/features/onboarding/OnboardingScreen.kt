/**
 * Onboarding Screen - Helix Android
 * Main container that orchestrates all onboarding steps
 */

package com.helix.features.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.helix.features.onboarding.components.OnboardingProgressBar
import com.helix.features.onboarding.steps.*
import com.helix.ui.theme.*

@Composable
fun OnboardingScreen(
    viewModel: OnboardingViewModel,
    onComplete: () -> Unit
) {
    val currentStep by viewModel.currentStep.collectAsState()
    val data by viewModel.data.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
    ) {
        // Background gradient orbs
        BackgroundOrbs()

        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // Header with progress
            HeaderSection(currentStep, viewModel)

            // Step content with smooth transitions
            AnimatedContent(
                targetState = currentStep,
                transitionSpec = {
                    slideInHorizontally { width -> width } togetherWith
                        slideOutHorizontally { width -> -width }
                },
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) { step ->
                when (step) {
                    0 -> WelcomeStep()
                    1 -> InstanceKeyStep(
                        data = data,
                        onDataUpdate = { viewModel.updateData { it.copy(keySaved = true) } }
                    )
                    2 -> DesktopSetupStep(
                        onComplete = { viewModel.updateData { it.copy(desktopInstructionsViewed = true) } }
                    )
                    3 -> GatewayConnectionStep(
                        data = data,
                        onDataUpdate = { newData -> viewModel.updateData { newData } }
                    )
                    4 -> SuccessStep(onComplete)
                }
            }

            // Navigation buttons (only show if not last step)
            if (currentStep < viewModel.totalSteps - 1) {
                NavigationButtons(
                    currentStep = currentStep,
                    canProceed = viewModel.canProceed,
                    onBack = { viewModel.previousStep() },
                    onNext = { viewModel.nextStep() }
                )
            }
        }
    }
}

@Composable
private fun HeaderSection(currentStep: Int, viewModel: OnboardingViewModel) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgSecondary.copy(alpha = 0.3f))
            .padding(16.dp)
    ) {
        // Title and close button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    painter = androidx.compose.material.icons.materialIcon(
                        androidx.compose.material.icons.materialPath(
                            pathData = "M20 17v2H2v-2s0-4 9-4 9 4 9 4zm-9-12a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"
                        )
                    ) { },
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = HelixBlue
                )

                Text(
                    "Helix Onboarding",
                    fontSize = 18.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    color = Color.White
                )
            }

            if (currentStep > 0) {
                IconButton(onClick = { /* close */ }) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextTertiary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Progress bar
        OnboardingProgressBar(
            currentStep = currentStep,
            totalSteps = 5
        )
    }
}

@Composable
private fun NavigationButtons(
    currentStep: Int,
    canProceed: Boolean,
    onBack: () -> Unit,
    onNext: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgSecondary.copy(alpha = 0.3f))
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (currentStep > 0) {
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    Color.White.copy(alpha = 0.1f)
                ),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = BgTertiary,
                    contentColor = TextSecondary
                ),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
            ) {
                Text(
                    "Back",
                    fontSize = 16.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                )
            }
        }

        Button(
            onClick = onNext,
            modifier = Modifier
                .weight(1f)
                .height(48.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (canProceed) HelixBlue else HelixBlue.copy(alpha = 0.3f),
                contentColor = Color.White
            ),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
            enabled = canProceed
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (canProceed) "Continue" else "Complete Step",
                    fontSize = 16.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                )

                if (canProceed) {
                    Icon(
                        painter = androidx.compose.material.icons.materialIcon(
                            androidx.compose.material.icons.materialPath(
                                pathData = "M8 12h8M12 8v8"
                            )
                        ) { },
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun BackgroundOrbs() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BgPrimary)
    ) {
        // Decorative gradient orbs
        Box(
            modifier = Modifier
                .size(400.dp)
                .background(
                    HelixBlue.copy(alpha = 0.05f),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
                .blur(100.dp)
                .offset(x = -100.dp, y = -200.dp)
        )

        Box(
            modifier = Modifier
                .size(400.dp)
                .background(
                    AccentPurple.copy(alpha = 0.05f),
                    shape = androidx.compose.foundation.shape.CircleShape
                )
                .blur(100.dp)
                .offset(x = 100.dp, y = 200.dp)
        )
    }
}

// Extension to create simple material icons
@Composable
private fun androidx.compose.material.icons.materialIcon(
    pathData: String,
    content: @Composable () -> Unit
): androidx.compose.material3.Icon {
    return androidx.compose.material3.Icon(
        painter = androidx.compose.foundation.rememberBasePainter(pathData),
        contentDescription = null
    )
}

@Composable
private fun androidx.compose.foundation.rememberBasePainter(pathData: String) =
    androidx.compose.ui.graphics.painter.BitmapPainter(
        image = androidx.compose.ui.graphics.ImageBitmap(1, 1)
    )

private fun androidx.compose.material.icons.materialPath(
    pathData: String
): String = pathData
