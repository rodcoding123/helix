package ai.openclaw.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Helix Void Pulse color palette
object HelixColors {
  // Primary brand colors
  val HelixBlue = Color(0xFF0686D4)
  val HelixBlueDark = Color(0xFF0573B8)
  val HelixBlueLight = Color(0xFF38A3E0)

  // Accent purple
  val AccentPurple = Color(0xFF7234ED)
  val AccentPurpleDark = Color(0xFF5F2AD0)
  val AccentPurpleLight = Color(0xFF9358FF)

  // Void backgrounds
  val Void = Color(0xFF050505)
  val BgPrimary = Color(0xFF0A0A0A)
  val BgSecondary = Color(0xFF111111)
  val BgTertiary = Color(0xFF1A1A1A)

  // Text colors
  val TextPrimary = Color(0xFFFAFAFA)
  val TextSecondary = Color(0xFFA1A1AA)
  val TextTertiary = Color(0xFF71717A)

  // Status colors
  val Success = Color(0xFF10B981)
  val Warning = Color(0xFFF59E0B)
  val Danger = Color(0xFFEF4444)

  // Surface overlays
  val SurfaceOverlay = Color(0xFF111111)
  val SurfaceOverlayLight = Color(0x22FFFFFF)
}

private val HelixDarkColorScheme = darkColorScheme(
  primary = HelixColors.HelixBlue,
  onPrimary = Color.White,
  primaryContainer = HelixColors.HelixBlueDark,
  onPrimaryContainer = Color.White,

  secondary = HelixColors.AccentPurple,
  onSecondary = Color.White,
  secondaryContainer = HelixColors.AccentPurpleDark,
  onSecondaryContainer = Color.White,

  tertiary = HelixColors.AccentPurpleLight,
  onTertiary = Color.White,

  background = HelixColors.BgPrimary,
  onBackground = HelixColors.TextPrimary,

  surface = HelixColors.BgSecondary,
  onSurface = HelixColors.TextPrimary,
  surfaceVariant = HelixColors.BgTertiary,
  onSurfaceVariant = HelixColors.TextSecondary,

  surfaceContainerLowest = HelixColors.Void,
  surfaceContainerLow = HelixColors.BgPrimary,
  surfaceContainer = HelixColors.BgSecondary,
  surfaceContainerHigh = HelixColors.BgTertiary,
  surfaceContainerHighest = Color(0xFF222222),

  outline = Color(0xFF27272A),
  outlineVariant = Color(0xFF3F3F46),

  error = HelixColors.Danger,
  onError = Color.White,
)

private val HelixLightColorScheme = lightColorScheme(
  primary = HelixColors.HelixBlue,
  onPrimary = Color.White,
  primaryContainer = HelixColors.HelixBlueLight,
  onPrimaryContainer = Color(0xFF003D5F),

  secondary = HelixColors.AccentPurple,
  onSecondary = Color.White,
  secondaryContainer = HelixColors.AccentPurpleLight,
  onSecondaryContainer = Color(0xFF21005E),

  tertiary = HelixColors.AccentPurpleLight,
  onTertiary = Color.White,

  background = Color(0xFFFAFAFA),
  onBackground = Color(0xFF18181B),

  surface = Color.White,
  onSurface = Color(0xFF18181B),
  surfaceVariant = Color(0xFFF4F4F5),
  onSurfaceVariant = Color(0xFF52525B),

  surfaceContainerLowest = Color.White,
  surfaceContainerLow = Color(0xFFFAFAFA),
  surfaceContainer = Color(0xFFF4F4F5),
  surfaceContainerHigh = Color(0xFFE4E4E7),
  surfaceContainerHighest = Color(0xFFD4D4D8),

  outline = Color(0xFFD4D4D8),
  outlineVariant = Color(0xFFE4E4E7),

  error = HelixColors.Danger,
  onError = Color.White,
)

@Composable
fun OpenClawTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit
) {
  val colorScheme = if (darkTheme) HelixDarkColorScheme else HelixLightColorScheme

  MaterialTheme(colorScheme = colorScheme, content = content)
}

@Composable
fun overlayContainerColor(): Color {
  val isDark = isSystemInDarkTheme()
  return if (isDark) {
    HelixColors.BgSecondary.copy(alpha = 0.95f)
  } else {
    HelixColors.BgSecondary.copy(alpha = 0.88f)
  }
}

@Composable
fun overlayIconColor(): Color {
  return MaterialTheme.colorScheme.onSurfaceVariant
}

// Utility colors for status indicators
object StatusColors {
  val Connected = HelixColors.Success
  val Connecting = HelixColors.Warning
  val Error = HelixColors.Danger
  val Disconnected = HelixColors.TextTertiary
}
