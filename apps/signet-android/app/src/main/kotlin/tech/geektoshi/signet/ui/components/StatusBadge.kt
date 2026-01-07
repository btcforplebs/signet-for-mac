package tech.geektoshi.signet.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.SignetPurple
import tech.geektoshi.signet.ui.theme.Success
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.Warning

enum class BadgeStatus {
    PENDING,
    APPROVED,
    AUTO_APPROVED,
    AUTO_TRUST,
    AUTO_PERMISSION,
    DENIED,
    EXPIRED,
    ADMIN
}

private data class BadgeConfig(
    val text: String,
    val backgroundColor: androidx.compose.ui.graphics.Color,
    val textColor: androidx.compose.ui.graphics.Color,
    val icon: ImageVector? = null
)

@Composable
fun StatusBadge(
    status: BadgeStatus,
    modifier: Modifier = Modifier
) {
    val config = when (status) {
        BadgeStatus.PENDING -> BadgeConfig("Pending", Warning.copy(alpha = 0.15f), Warning)
        BadgeStatus.APPROVED -> BadgeConfig("Approved", Success.copy(alpha = 0.15f), Success, Icons.Default.Check)
        BadgeStatus.AUTO_APPROVED -> BadgeConfig("Auto Approved", Success.copy(alpha = 0.15f), Success)
        BadgeStatus.AUTO_TRUST -> BadgeConfig("Approved", Success.copy(alpha = 0.15f), Success, Icons.Default.Shield)
        BadgeStatus.AUTO_PERMISSION -> BadgeConfig("Approved", Success.copy(alpha = 0.15f), Success, Icons.Default.Refresh)
        BadgeStatus.DENIED -> BadgeConfig("Denied", Danger.copy(alpha = 0.15f), Danger)
        BadgeStatus.EXPIRED -> BadgeConfig("Expired", TextMuted.copy(alpha = 0.15f), TextMuted)
        BadgeStatus.ADMIN -> BadgeConfig("Admin", SignetPurple.copy(alpha = 0.15f), SignetPurple)
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(config.backgroundColor)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        config.icon?.let { icon ->
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = config.textColor,
                modifier = Modifier.size(12.dp)
            )
        }
        Text(
            text = config.text,
            style = MaterialTheme.typography.labelSmall,
            color = config.textColor
        )
    }
}
