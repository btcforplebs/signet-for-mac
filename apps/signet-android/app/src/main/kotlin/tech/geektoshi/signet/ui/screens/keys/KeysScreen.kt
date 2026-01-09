package tech.geektoshi.signet.ui.screens.keys

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import tech.geektoshi.signet.data.api.ServerEvent
import tech.geektoshi.signet.data.api.SignetApiClient
import tech.geektoshi.signet.data.model.KeyInfo
import tech.geektoshi.signet.data.repository.EventBusRepository
import tech.geektoshi.signet.data.repository.SettingsRepository
import tech.geektoshi.signet.ui.components.CreateKeySheet
import tech.geektoshi.signet.ui.components.EmptyState
import tech.geektoshi.signet.ui.components.KeyDetailSheet
import tech.geektoshi.signet.ui.components.SkeletonKeyCard
import tech.geektoshi.signet.ui.components.pressScale
import tech.geektoshi.signet.ui.theme.BgSecondary
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.SignetPurple
import tech.geektoshi.signet.ui.theme.Success
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.TextPrimary
import tech.geektoshi.signet.ui.theme.Warning
import tech.geektoshi.signet.util.formatRelativeTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KeysScreen() {
    val context = LocalContext.current
    val settingsRepository = remember { SettingsRepository(context) }
    val daemonUrl by settingsRepository.daemonUrl.collectAsState(initial = "")

    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var keys by remember { mutableStateOf<List<KeyInfo>>(emptyList()) }
    var selectedKey by remember { mutableStateOf<KeyInfo?>(null) }
    var showCreateKey by remember { mutableStateOf(false) }
    var refreshCounter by remember { mutableIntStateOf(0) }
    val eventBus = remember { EventBusRepository.getInstance() }

    // Connect to SSE when daemon URL is available
    LaunchedEffect(daemonUrl) {
        if (daemonUrl.isNotEmpty()) {
            eventBus.connect(daemonUrl)
        }
    }

    // Subscribe to SSE events for real-time updates
    LaunchedEffect(Unit) {
        eventBus.events.collect { event ->
            when (event) {
                is ServerEvent.KeyCreated,
                is ServerEvent.KeyUnlocked,
                is ServerEvent.KeyDeleted,
                is ServerEvent.KeyRenamed,
                is ServerEvent.KeyUpdated -> {
                    // Refresh list on any key change
                    refreshCounter++
                }
                else -> {}
            }
        }
    }

    // Show create key sheet
    if (showCreateKey) {
        CreateKeySheet(
            daemonUrl = daemonUrl,
            onDismiss = { showCreateKey = false },
            onKeyCreated = { refreshCounter++ }
        )
    }

    // Show bottom sheet when a key is selected
    selectedKey?.let { key ->
        KeyDetailSheet(
            key = key,
            daemonUrl = daemonUrl,
            onDismiss = { selectedKey = null },
            onActionComplete = { refreshCounter++ }
        )
    }

    LaunchedEffect(daemonUrl, refreshCounter) {
        if (daemonUrl.isNotEmpty()) {
            if (!isRefreshing) isLoading = true
            error = null
            val client = SignetApiClient(daemonUrl)
            try {
                keys = client.getKeys().keys
            } catch (e: Exception) {
                error = e.message ?: "Failed to connect"
            } finally {
                client.close()
                isLoading = false
                isRefreshing = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (isLoading) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Keys",
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(8.dp))
                SkeletonKeyCard()
                SkeletonKeyCard()
                SkeletonKeyCard()
            }
            return@Box
        }

        if (error != null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Connection Error",
                        style = MaterialTheme.typography.titleLarge,
                        color = Danger
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = error!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted
                    )
                }
            }
            return@Box
        }

        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                refreshCounter++
            }
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Keys",
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        IconButton(
                            onClick = { showCreateKey = true }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Create Key",
                                tint = SignetPurple
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (keys.isEmpty()) {
                    item {
                        EmptyState(
                            icon = Icons.Outlined.Key,
                            message = "No keys configured",
                            subtitle = "Tap + to create a new key"
                        )
                    }
                } else {
                    items(keys) { key ->
                        KeyCard(
                            key = key,
                            onClick = { selectedKey = key }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun KeyCard(
    key: KeyInfo,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .pressScale(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = BgSecondary)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Header: Key name + lock icon + status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = key.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = TextPrimary
                    )
                    if (key.isEncrypted) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Encrypted",
                            modifier = Modifier.size(14.dp),
                            tint = SignetPurple
                        )
                    }
                }
                StatusBadge(status = key.status)
            }

            // Truncated npub
            key.npub?.let { npub ->
                Text(
                    text = "${npub.take(12)}...${npub.takeLast(4)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }

            // Summary: apps • requests • relative time
            val lastUsed = key.lastUsedAt?.let { formatRelativeTime(it) }
            Text(
                text = listOfNotNull(
                    "${key.userCount} apps",
                    "${key.requestCount} requests",
                    lastUsed
                ).joinToString(" • "),
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted
            )
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (color, label) = when (status.lowercase()) {
        "online" -> Success to "Online"
        "locked" -> Warning to "Locked"
        "offline" -> TextMuted to "Offline"
        else -> TextMuted to status
    }

    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = color
    )
}

