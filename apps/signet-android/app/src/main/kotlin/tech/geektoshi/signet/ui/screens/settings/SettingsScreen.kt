package tech.geektoshi.signet.ui.screens.settings

import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import tech.geektoshi.signet.BuildConfig
import tech.geektoshi.signet.data.repository.SettingsRepository
import tech.geektoshi.signet.ui.components.QRScannerSheet
import tech.geektoshi.signet.ui.theme.BgSecondary
import tech.geektoshi.signet.ui.theme.BgTertiary
import tech.geektoshi.signet.ui.theme.BorderDefault
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.SignetPurple
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.TextPrimary
import tech.geektoshi.signet.ui.theme.TextSecondary
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    settingsRepository: SettingsRepository,
    onHelpClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val savedUrl by settingsRepository.daemonUrl.collectAsState(initial = "")
    val savedTrustLevel by settingsRepository.defaultTrustLevel.collectAsState(initial = "reasonable")
    val appLockEnabled by settingsRepository.appLockEnabled.collectAsState(initial = false)
    val lockTimeoutMinutes by settingsRepository.lockTimeoutMinutes.collectAsState(initial = 1)

    var daemonUrl by remember { mutableStateOf("") }
    var selectedTrustLevel by remember { mutableStateOf("reasonable") }
    var showQRScanner by remember { mutableStateOf(false) }

    // QR Scanner Sheet
    if (showQRScanner) {
        QRScannerSheet(
            onScanned = { url ->
                daemonUrl = url
            },
            onDismiss = { showQRScanner = false }
        )
    }

    // Check if device supports biometric or device credential authentication
    val biometricManager = remember { BiometricManager.from(context) }
    val canAuthenticate = remember {
        biometricManager.canAuthenticate(BIOMETRIC_STRONG or DEVICE_CREDENTIAL) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    // Initialize text field with saved URL
    LaunchedEffect(savedUrl) {
        if (daemonUrl.isEmpty() && savedUrl.isNotEmpty()) {
            daemonUrl = savedUrl
        }
    }

    // Initialize trust level with saved value
    LaunchedEffect(savedTrustLevel) {
        selectedTrustLevel = savedTrustLevel
    }

    val hasUrlChanges = daemonUrl.trim() != savedUrl

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Settings",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )

        // Connection Settings
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = BgSecondary)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Connection",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary
                    )
                    if (hasUrlChanges) {
                        TextButton(
                            onClick = {
                                scope.launch {
                                    settingsRepository.setDaemonUrl(daemonUrl.trim())
                                    Toast.makeText(context, "Saved", Toast.LENGTH_SHORT).show()
                                }
                            }
                        ) {
                            Text("Save", color = SignetPurple)
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = daemonUrl,
                        onValueChange = { daemonUrl = it },
                        label = { Text("Daemon URL") },
                        placeholder = { Text("http://your-server") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = SignetPurple,
                            unfocusedBorderColor = BorderDefault,
                            focusedLabelColor = SignetPurple,
                            unfocusedLabelColor = TextMuted,
                            cursorColor = SignetPurple,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedPlaceholderColor = TextMuted,
                            unfocusedPlaceholderColor = TextMuted,
                            focusedContainerColor = BgTertiary,
                            unfocusedContainerColor = BgTertiary
                        )
                    )

                    IconButton(
                        onClick = { showQRScanner = true }
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.QrCodeScanner,
                            contentDescription = "Scan QR code",
                            tint = SignetPurple,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }
        }

        // Trust Level Settings
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = BgSecondary)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Default Trust Level",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                    modifier = Modifier.padding(16.dp)
                )

                TrustLevelOption(
                    title = "Paranoid",
                    description = "Require approval for every request",
                    selected = selectedTrustLevel == "paranoid",
                    onClick = {
                        selectedTrustLevel = "paranoid"
                        scope.launch { settingsRepository.setDefaultTrustLevel("paranoid") }
                    }
                )

                HorizontalDivider(
                    color = TextMuted.copy(alpha = 0.2f),
                    modifier = Modifier.padding(horizontal = 16.dp)
                )

                TrustLevelOption(
                    title = "Reasonable",
                    description = "Auto-approve notes, reactions, reposts, and zaps",
                    selected = selectedTrustLevel == "reasonable",
                    onClick = {
                        selectedTrustLevel = "reasonable"
                        scope.launch { settingsRepository.setDefaultTrustLevel("reasonable") }
                    }
                )

                HorizontalDivider(
                    color = TextMuted.copy(alpha = 0.2f),
                    modifier = Modifier.padding(horizontal = 16.dp)
                )

                TrustLevelOption(
                    title = "Full",
                    description = "Auto-approve all requests (use with caution)",
                    selected = selectedTrustLevel == "full",
                    onClick = {
                        selectedTrustLevel = "full"
                        scope.launch { settingsRepository.setDefaultTrustLevel("full") }
                    }
                )
            }
        }

        // Security Settings (only show if device supports authentication)
        if (canAuthenticate) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = BgSecondary)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Security",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary,
                        modifier = Modifier.padding(16.dp)
                    )

                    // App Lock Toggle
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                scope.launch {
                                    settingsRepository.setAppLockEnabled(!appLockEnabled)
                                }
                            }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Require unlock",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextPrimary
                            )
                            Text(
                                text = "Use fingerprint, face, or PIN to open app",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextMuted
                            )
                        }
                        Switch(
                            checked = appLockEnabled,
                            onCheckedChange = { enabled ->
                                scope.launch {
                                    settingsRepository.setAppLockEnabled(enabled)
                                }
                            },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = TextPrimary,
                                checkedTrackColor = SignetPurple,
                                uncheckedThumbColor = TextMuted,
                                uncheckedTrackColor = BgTertiary
                            )
                        )
                    }

                    // Lock Timeout (only show if app lock is enabled)
                    if (appLockEnabled) {
                        HorizontalDivider(
                            color = TextMuted.copy(alpha = 0.2f),
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )

                        Text(
                            text = "Lock after",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextPrimary,
                            modifier = Modifier.padding(start = 16.dp, top = 12.dp)
                        )

                        LockTimeoutOption(
                            title = "Immediately",
                            selected = lockTimeoutMinutes == 0,
                            onClick = {
                                scope.launch { settingsRepository.setLockTimeoutMinutes(0) }
                            }
                        )

                        LockTimeoutOption(
                            title = "1 minute",
                            selected = lockTimeoutMinutes == 1,
                            onClick = {
                                scope.launch { settingsRepository.setLockTimeoutMinutes(1) }
                            }
                        )

                        LockTimeoutOption(
                            title = "5 minutes",
                            selected = lockTimeoutMinutes == 5,
                            onClick = {
                                scope.launch { settingsRepository.setLockTimeoutMinutes(5) }
                            }
                        )

                        LockTimeoutOption(
                            title = "15 minutes",
                            selected = lockTimeoutMinutes == 15,
                            onClick = {
                                scope.launch { settingsRepository.setLockTimeoutMinutes(15) }
                            }
                        )

                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }

        // About & Help
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = BgSecondary)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                SettingsRow(
                    title = "Help",
                    subtitle = "Learn how Signet works",
                    onClick = onHelpClick
                )

                HorizontalDivider(
                    color = TextMuted.copy(alpha = 0.2f),
                    modifier = Modifier.padding(horizontal = 16.dp)
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Signet for Android",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                    Text(
                        text = "Version ${BuildConfig.VERSION_NAME}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted
                    )
                }
            }
        }

        // Disconnect at bottom
        Spacer(modifier = Modifier.weight(1f))

        TextButton(
            onClick = {
                scope.launch {
                    settingsRepository.setDaemonUrl("")
                    daemonUrl = ""
                }
            },
            modifier = Modifier.align(Alignment.CenterHorizontally)
        ) {
            Text("Disconnect", color = Danger)
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun TrustLevelOption(
    title: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = if (selected) SignetPurple else TextPrimary
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted
            )
        }
        if (selected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Selected",
                tint = SignetPurple
            )
        }
    }
}

@Composable
private fun SettingsRow(
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = TextMuted
        )
    }
}

@Composable
private fun LockTimeoutOption(
    title: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            color = if (selected) SignetPurple else TextSecondary
        )
        if (selected) {
            Icon(
                imageVector = Icons.Default.Check,
                contentDescription = "Selected",
                tint = SignetPurple
            )
        }
    }
}
