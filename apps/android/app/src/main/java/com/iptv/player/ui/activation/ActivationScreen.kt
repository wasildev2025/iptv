package com.iptv.player.ui.activation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.PlaylistPlay
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.foundation.text.KeyboardOptions
import com.iptv.player.data.model.AppInfo
import com.iptv.player.data.model.PlaylistInfo
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.Red80
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkVariant
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

@Composable
fun ActivationScreen(
    onActivated: (playlistUrl: String) -> Unit,
    viewModel: ActivationViewModel = hiltViewModel()
) {
    val ui by viewModel.ui.collectAsState()

    LaunchedEffect(ui.state) {
        when (val state = ui.state) {
            is ActivationState.Activated -> onActivated(state.playlistUrl)
            is ActivationState.AlreadyActivated -> onActivated(state.playlistUrl)
            else -> {}
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(SurfaceDark)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(48.dp))

            Icon(
                imageVector = Icons.Default.LiveTv,
                contentDescription = "IPTV Player",
                modifier = Modifier.size(80.dp),
                tint = Red40
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "IPTV Player",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = Red40
            )

            Spacer(modifier = Modifier.height(48.dp))

            // MAC address
            Text(
                text = "Your Device MAC Address:",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = ui.macAddress.ifBlank { "Detecting..." },
                style = MaterialTheme.typography.headlineMedium,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceDarkVariant)
                    .padding(16.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            // App selector (hidden when we've already moved past app selection)
            if (ui.state is ActivationState.Idle || ui.state is ActivationState.Loading ||
                ui.state is ActivationState.NotActivated
            ) {
                Text(
                    text = "Select Application:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                AppDropdown(
                    apps = ui.apps,
                    selectedApp = ui.selectedApp,
                    isLoading = ui.appsLoading,
                    onAppSelected = { viewModel.selectApp(it) }
                )
                Spacer(modifier = Modifier.height(16.dp))

                if (!ui.appsLoading && ui.apps.isEmpty() && ui.macAddress.isNotBlank()) {
                    InfoBox(
                        text = "No activated apps found for this device. Please ask your " +
                            "reseller to activate the MAC address shown above.",
                        tone = BoxTone.Warning
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }

            // State-specific UI
            when (val state = ui.state) {
                is ActivationState.Idle -> PrimaryButton(
                    label = "Check Activation",
                    enabled = ui.selectedApp != null && ui.macAddress.isNotBlank(),
                    onClick = { viewModel.checkActivation() }
                )

                is ActivationState.Loading -> LoadingBlock("Checking activation...")

                is ActivationState.NeedsPlaylist -> NeedsPlaylistBlock(
                    appName = state.appName,
                    onSubmit = { viewModel.submitManualPlaylist(it) }
                )

                is ActivationState.PickPlaylist -> {
                    if (state.isInGrace) {
                        GraceBanner(graceEndsAt = state.graceEndsAt)
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                    PickPlaylistBlock(
                        playlists = state.playlists,
                        onPick = { viewModel.onPlaylistChosen(it) }
                    )
                }

                is ActivationState.NeedsPin -> {
                    PinDialog(
                        playlistName = state.playlist.name,
                        error = ui.pinError,
                        submitting = ui.pinSubmitting,
                        onSubmit = { viewModel.submitPin(it) },
                        onCancel = { viewModel.cancelPin() }
                    )
                }

                is ActivationState.NotActivated -> ErrorBlock(
                    message = state.error,
                    onRetry = { viewModel.retry() }
                )

                is ActivationState.Activated,
                is ActivationState.AlreadyActivated -> LoadingBlock("")
            }

            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}

// ---------------------------------------------------------------------------
// Sub-composables
// ---------------------------------------------------------------------------

@Composable
private fun PrimaryButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Red40),
        enabled = enabled
    ) {
        Text(text = label, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun LoadingBlock(label: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        CircularProgressIndicator(color = Red40, modifier = Modifier.size(48.dp))
        if (label.isNotEmpty()) {
            Spacer(modifier = Modifier.height(16.dp))
            Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun NeedsPlaylistBlock(appName: String, onSubmit: (String) -> Unit) {
    var manualUrl by remember { mutableStateOf("") }
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        InfoBox(
            text = "$appName is activated for this device, but no playlist URL is " +
                "configured. Paste your playlist (M3U) URL below or ask your reseller to add one.",
            tone = BoxTone.Info
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = manualUrl,
            onValueChange = { manualUrl = it },
            label = { Text("Playlist URL") },
            placeholder = { Text("http://example.com/get.php?...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Red40,
                cursorColor = Red40
            )
        )
        Spacer(modifier = Modifier.height(16.dp))
        PrimaryButton(
            label = "Continue",
            enabled = manualUrl.isNotBlank(),
            onClick = { onSubmit(manualUrl) }
        )
    }
}

@Composable
private fun PickPlaylistBlock(
    playlists: List<PlaylistInfo>,
    onPick: (PlaylistInfo) -> Unit
) {
    Text(
        text = "Choose a playlist:",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
    )
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .height(((playlists.size.coerceAtMost(5)) * 72).dp)
    ) {
        items(playlists, key = { it.id }) { playlist ->
            PlaylistRow(playlist = playlist, onClick = { onPick(playlist) })
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun PlaylistRow(playlist: PlaylistInfo, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDarkVariant)
            .clickable { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (playlist.isProtected) Icons.Default.Lock else Icons.Default.PlaylistPlay,
            contentDescription = null,
            tint = Red40,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = playlist.name.ifBlank { "Untitled playlist" },
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            if (playlist.isProtected) {
                Text(
                    text = "PIN required",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
        }
    }
}

@Composable
private fun GraceBanner(graceEndsAt: String?) {
    val pretty = formatDateRelative(graceEndsAt) ?: "soon"
    InfoBox(
        text = "Your subscription has expired. You are in a grace period that ends $pretty. " +
            "Please renew with your reseller.",
        tone = BoxTone.Warning
    )
}

@Composable
private fun ErrorBlock(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        InfoBox(text = message, tone = BoxTone.Error)
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = onRetry,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Red40)
        ) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Retry", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun PinDialog(
    playlistName: String,
    error: String?,
    submitting: Boolean,
    onSubmit: (String) -> Unit,
    onCancel: () -> Unit
) {
    var pin by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = { if (!submitting) onCancel() },
        title = { Text("Enter PIN") },
        text = {
            Column {
                Text(
                    text = "\"$playlistName\" is protected. Enter the PIN to continue.",
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = pin,
                    onValueChange = { pin = it.filter { c -> c.isDigit() || c.isLetter() } },
                    label = { Text("PIN") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    isError = error != null,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Red40,
                        cursorColor = Red40
                    )
                )
                if (error != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = error, color = Red80, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSubmit(pin) },
                enabled = !submitting && pin.isNotBlank()
            ) {
                if (submitting) {
                    CircularProgressIndicator(
                        color = Red40,
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Unlock", color = Red40, fontWeight = FontWeight.SemiBold)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onCancel, enabled = !submitting) {
                Text("Cancel")
            }
        }
    )
}

private enum class BoxTone { Info, Warning, Error }

@Composable
private fun InfoBox(text: String, tone: BoxTone) {
    val color = when (tone) {
        BoxTone.Info -> Red40.copy(alpha = 0.1f)
        BoxTone.Warning -> Red40.copy(alpha = 0.15f)
        BoxTone.Error -> Red40.copy(alpha = 0.12f)
    }
    val textColor = when (tone) {
        BoxTone.Info -> MaterialTheme.colorScheme.onSurface
        BoxTone.Warning -> Red80
        BoxTone.Error -> Red80
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(color)
            .padding(16.dp)
    ) {
        if (tone != BoxTone.Info) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                tint = textColor,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
        }
        Text(
            text = text,
            color = textColor,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = if (tone == BoxTone.Info) TextAlign.Center else TextAlign.Start,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun AppDropdown(
    apps: List<AppInfo>,
    selectedApp: AppInfo?,
    isLoading: Boolean,
    onAppSelected: (AppInfo) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(SurfaceDarkVariant)
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                    RoundedCornerShape(12.dp)
                )
                .clickable(enabled = apps.isNotEmpty()) { expanded = true }
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = Red40
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = "Loading apps...",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            } else {
                Text(
                    text = selectedApp?.name ?: "No apps available",
                    color = if (selectedApp != null)
                        MaterialTheme.colorScheme.onSurface
                    else
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = "Select app",
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .background(SurfaceDarkVariant)
        ) {
            apps.forEach { app ->
                DropdownMenuItem(
                    text = { Text(text = app.name, color = MaterialTheme.colorScheme.onSurface) },
                    onClick = {
                        onAppSelected(app)
                        expanded = false
                    }
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Small formatting helper (no extra deps — uses java.time)
// ---------------------------------------------------------------------------

private fun formatDateRelative(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return runCatching {
        val instant = Instant.parse(iso)
        val millis = instant.toEpochMilli() - System.currentTimeMillis()
        val days = TimeUnit.MILLISECONDS.toDays(millis)
        when {
            days <= 0 -> "soon"
            days == 1L -> "tomorrow"
            days < 7 -> "in $days days"
            else -> "on " + DateTimeFormatter.ofPattern("d MMM yyyy")
                .withZone(ZoneId.systemDefault())
                .format(instant)
        }
    }.getOrNull()
}
