package tech.geektoshi.signet.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.geektoshi.signet.data.model.HealthStatus
import tech.geektoshi.signet.data.model.RelaysResponse
import tech.geektoshi.signet.ui.theme.BgSecondary
import tech.geektoshi.signet.ui.theme.BgTertiary
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.Success
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.TextPrimary
import tech.geektoshi.signet.ui.theme.TextSecondary
import tech.geektoshi.signet.ui.theme.Warning
import tech.geektoshi.signet.util.formatRelativeTime
import tech.geektoshi.signet.util.formatUptime

enum class UIHealthStatus {
    HEALTHY, DEGRADED, OFFLINE
}

fun HealthStatus?.toUIStatus(): UIHealthStatus = when {
    this == null -> UIHealthStatus.OFFLINE
    this.status == "degraded" -> UIHealthStatus.DEGRADED
    else -> UIHealthStatus.HEALTHY
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SystemStatusSheet(
    health: HealthStatus?,
    relays: RelaysResponse?,
    uiStatus: UIHealthStatus,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var relaysExpanded by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = BgTertiary
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Text(
                text = "System Status",
                style = MaterialTheme.typography.headlineSmall,
                color = TextPrimary
            )

            // Status Badge
            StatusPill(uiStatus = uiStatus)

            if (health != null) {
                HorizontalDivider(color = TextMuted.copy(alpha = 0.2f))

                // Stats Grid
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        StatItem(
                            label = "Uptime",
                            value = formatUptime(health.uptime),
                            modifier = Modifier.weight(1f)
                        )
                        StatItem(
                            label = "Memory",
                            value = "${health.memory.rssMB.toInt()} MB",
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        StatItem(
                            label = "Active Listeners",
                            value = health.subscriptions.toString(),
                            modifier = Modifier.weight(1f)
                        )
                        StatItem(
                            label = "Connected Clients",
                            value = health.sseClients.toString(),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        StatItem(
                            label = "Last Reset",
                            value = health.lastPoolReset?.let { formatRelativeTime(it) } ?: "Never",
                            modifier = Modifier.weight(1f)
                        )
                        StatItem(
                            label = "Keys",
                            value = buildString {
                                append("${health.keys.active} active")
                                if (health.keys.locked > 0) append(", ${health.keys.locked} locked")
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                HorizontalDivider(color = TextMuted.copy(alpha = 0.2f))

                // Expandable Relay Section
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { relaysExpanded = !relaysExpanded },
                    color = BgSecondary,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Relays (${health.relays.connected}/${health.relays.total} connected)",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                        Icon(
                            imageVector = if (relaysExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                            contentDescription = if (relaysExpanded) "Collapse" else "Expand",
                            tint = TextSecondary
                        )
                    }
                }

                AnimatedVisibility(visible = relaysExpanded && relays != null) {
                    Column(
                        modifier = Modifier.padding(top = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        relays?.relays?.forEach { relay ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = relay.url,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextPrimary
                                    )
                                    val statusText = if (relay.connected) {
                                        relay.lastConnected?.let { "Connected ${formatRelativeTime(it)}" } ?: "Connected"
                                    } else {
                                        relay.lastDisconnected?.let { "Disconnected ${formatRelativeTime(it)}" } ?: "Disconnected"
                                    }
                                    Text(
                                        text = statusText,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = TextMuted
                                    )
                                }
                                Icon(
                                    imageVector = if (relay.connected) Icons.Default.CheckCircle else Icons.Default.Error,
                                    contentDescription = if (relay.connected) "Connected" else "Disconnected",
                                    modifier = Modifier.size(20.dp),
                                    tint = if (relay.connected) Success else Danger
                                )
                            }
                        }
                    }
                }
            } else {
                // Offline message
                Text(
                    text = "Unable to connect to daemon",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextMuted
                )
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun StatusPill(uiStatus: UIHealthStatus) {
    val (text, color) = when (uiStatus) {
        UIHealthStatus.HEALTHY -> "Healthy" to Success
        UIHealthStatus.DEGRADED -> "Degraded" to Warning
        UIHealthStatus.OFFLINE -> "Offline" to Danger
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier.size(8.dp),
                color = color,
                shape = RoundedCornerShape(4.dp)
            ) {}
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium,
                color = color
            )
        }
    }
}

@Composable
private fun StatItem(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = TextMuted
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = TextPrimary
        )
    }
}
