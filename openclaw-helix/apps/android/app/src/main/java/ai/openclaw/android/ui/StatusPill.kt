package ai.openclaw.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun StatusPill(
  gateway: GatewayState,
  voiceEnabled: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  activity: StatusActivity? = null,
) {
  Surface(
    onClick = onClick,
    modifier = modifier,
    shape = RoundedCornerShape(16.dp),
    color = overlayContainerColor(),
    tonalElevation = 2.dp,
    shadowElevation = 0.dp,
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(
          modifier = Modifier.size(8.dp),
          shape = CircleShape,
          color = gateway.color,
        ) {}

        Text(
          text = gateway.title,
          style = MaterialTheme.typography.labelLarge,
          color = HelixColors.TextPrimary,
        )
      }

      VerticalDivider(
        modifier = Modifier.height(14.dp).alpha(0.25f),
        color = HelixColors.TextTertiary,
      )

      if (activity != null) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(
            imageVector = activity.icon,
            contentDescription = activity.contentDescription,
            tint = activity.tint ?: overlayIconColor(),
            modifier = Modifier.size(18.dp),
          )
          Text(
            text = activity.title,
            style = MaterialTheme.typography.labelLarge,
            color = HelixColors.TextSecondary,
            maxLines = 1,
          )
        }
      } else {
        Icon(
          imageVector = if (voiceEnabled) Icons.Default.Mic else Icons.Default.MicOff,
          contentDescription = if (voiceEnabled) "Voice enabled" else "Voice disabled",
          tint =
            if (voiceEnabled) {
              HelixColors.HelixBlue
            } else {
              HelixColors.TextTertiary
            },
          modifier = Modifier.size(18.dp),
        )
      }

      Spacer(modifier = Modifier.width(2.dp))
    }
  }
}

data class StatusActivity(
  val title: String,
  val icon: androidx.compose.ui.graphics.vector.ImageVector,
  val contentDescription: String,
  val tint: Color? = null,
)

enum class GatewayState(val title: String, val color: Color) {
  Connected("Connected", StatusColors.Connected),
  Connecting("Connecting…", StatusColors.Connecting),
  Error("Error", StatusColors.Error),
  Disconnected("Offline", StatusColors.Disconnected),
}
