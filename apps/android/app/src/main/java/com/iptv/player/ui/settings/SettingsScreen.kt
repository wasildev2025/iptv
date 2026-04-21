package com.iptv.player.ui.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Router
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.edit
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.BuildConfig
import com.iptv.player.data.repository.IPTVRepository
import com.iptv.player.data.auth.AuthKeys
import com.iptv.player.data.auth.activationDataStore
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkElevated
import com.iptv.player.ui.theme.SurfaceDarkVariant
import com.iptv.player.util.DeviceUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: IPTVRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _macAddress = MutableStateFlow("")
    val macAddress: StateFlow<String> = _macAddress.asStateFlow()

    private val _playlistUrl = MutableStateFlow("")
    val playlistUrl: StateFlow<String> = _playlistUrl.asStateFlow()

    private val _isActivated = MutableStateFlow(false)
    val isActivated: StateFlow<Boolean> = _isActivated.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    init {
        _macAddress.value = DeviceUtils.getDeviceMac(context)
        loadPrefs()
    }

    private fun loadPrefs() {
        viewModelScope.launch {
            val prefs = context.activationDataStore.data.first()
            _isActivated.value = prefs[AuthKeys.IS_ACTIVATED] ?: false
            _playlistUrl.value = prefs[AuthKeys.PLAYLIST_URL] ?: ""
        }
    }

    fun refreshPlaylist(onComplete: (Boolean) -> Unit) {
        viewModelScope.launch {
            _refreshing.value = true
            val url = _playlistUrl.value
            val success = if (url.isNotBlank()) {
                repository.loadPlaylist(url).isSuccess
            } else {
                false
            }
            _refreshing.value = false
            onComplete(success)
        }
    }

    fun clearFavorites() {
        viewModelScope.launch {
            // Remove all favorites by getting the list and removing each
            val favs = repository.getFavorites().first()
            favs.forEach { fav ->
                repository.removeFavorite(fav.streamUrl)
            }
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            repository.clearRecent()
        }
    }

    fun deactivate(onDeactivated: () -> Unit) {
        viewModelScope.launch {
            // Revoke server-side first so a stolen token is useless, then wipe locally.
            runCatching { repository.revokeDeviceToken() }
            context.activationDataStore.edit { it.clear() }
            repository.clearRecent()
            val favs = repository.getFavorites().first()
            favs.forEach { fav ->
                repository.removeFavorite(fav.streamUrl)
            }
            onDeactivated()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onDeactivated: () -> Unit,
    onSwitchPlaylist: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val macAddress by viewModel.macAddress.collectAsState()
    val playlistUrl by viewModel.playlistUrl.collectAsState()
    val isActivated by viewModel.isActivated.collectAsState()
    val refreshing by viewModel.refreshing.collectAsState()
    val context = LocalContext.current

    var showDeactivateDialog by remember { mutableStateOf(false) }
    var showClearFavoritesDialog by remember { mutableStateOf(false) }
    var showClearHistoryDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Settings",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SurfaceDark
                )
            )
        },
        containerColor = SurfaceDark
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Device Info Section
            SectionHeader("Device Information")

            SettingsInfoItem(
                icon = Icons.Default.Router,
                label = "MAC Address",
                value = macAddress,
                trailing = {
                    IconButton(
                        onClick = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("MAC Address", macAddress))
                            Toast.makeText(context, "MAC copied to clipboard", Toast.LENGTH_SHORT).show()
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy MAC",
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            )

            SettingsInfoItem(
                icon = Icons.Default.CheckCircle,
                label = "Activation Status",
                value = if (isActivated) "Active" else "Not Activated",
                valueColor = if (isActivated) Color(0xFF4CAF50) else Red40
            )

            if (playlistUrl.isNotBlank()) {
                SettingsInfoItem(
                    icon = Icons.Default.Link,
                    label = "Playlist URL",
                    value = playlistUrl,
                    maxLines = 2
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
            Spacer(modifier = Modifier.height(8.dp))

            // Actions Section
            SectionHeader("Actions")

            SettingsActionItem(
                icon = Icons.Default.SwapHoriz,
                label = "Switch Playlist",
                subtitle = "Pick a different playlist attached to this device",
                onClick = onSwitchPlaylist
            )

            SettingsActionItem(
                icon = Icons.Default.Refresh,
                label = "Refresh Playlist",
                subtitle = "Re-download and parse M3U playlist",
                isLoading = refreshing,
                onClick = {
                    viewModel.refreshPlaylist { success ->
                        val msg = if (success) "Playlist refreshed" else "Failed to refresh playlist"
                        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                    }
                }
            )

            SettingsActionItem(
                icon = Icons.Default.Favorite,
                label = "Clear Favorites",
                subtitle = "Remove all favorited channels",
                onClick = { showClearFavoritesDialog = true }
            )

            SettingsActionItem(
                icon = Icons.Default.History,
                label = "Clear Watch History",
                subtitle = "Remove all watch history",
                onClick = { showClearHistoryDialog = true }
            )

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
            Spacer(modifier = Modifier.height(8.dp))

            // App Info
            SectionHeader("About")

            SettingsInfoItem(
                icon = Icons.Default.Info,
                label = "App Version",
                value = BuildConfig.VERSION_NAME
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Deactivate Button
            Button(
                onClick = { showDeactivateDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Red40.copy(alpha = 0.15f),
                    contentColor = Red40
                )
            ) {
                Icon(
                    imageVector = Icons.Default.ExitToApp,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Deactivate Device",
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Confirmation Dialogs
    if (showDeactivateDialog) {
        ConfirmationDialog(
            title = "Deactivate Device",
            message = "This will clear all saved data and return to the activation screen. Are you sure?",
            confirmText = "Deactivate",
            onConfirm = {
                showDeactivateDialog = false
                viewModel.deactivate { onDeactivated() }
            },
            onDismiss = { showDeactivateDialog = false }
        )
    }

    if (showClearFavoritesDialog) {
        ConfirmationDialog(
            title = "Clear Favorites",
            message = "This will remove all your favorited channels. Continue?",
            confirmText = "Clear",
            onConfirm = {
                showClearFavoritesDialog = false
                viewModel.clearFavorites()
                Toast.makeText(context, "Favorites cleared", Toast.LENGTH_SHORT).show()
            },
            onDismiss = { showClearFavoritesDialog = false }
        )
    }

    if (showClearHistoryDialog) {
        ConfirmationDialog(
            title = "Clear Watch History",
            message = "This will remove all your watch history. Continue?",
            confirmText = "Clear",
            onConfirm = {
                showClearHistoryDialog = false
                viewModel.clearHistory()
                Toast.makeText(context, "History cleared", Toast.LENGTH_SHORT).show()
            },
            onDismiss = { showClearHistoryDialog = false }
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = Red40,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(vertical = 8.dp)
    )
}

@Composable
private fun SettingsInfoItem(
    icon: ImageVector,
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
    maxLines: Int = 1,
    trailing: @Composable (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDarkVariant)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.size(24.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = valueColor,
                fontWeight = FontWeight.Medium,
                maxLines = maxLines,
                overflow = TextOverflow.Ellipsis,
                fontFamily = if (label == "MAC Address") FontFamily.Monospace else FontFamily.Default
            )
        }

        if (trailing != null) {
            trailing()
        }
    }
}

@Composable
private fun SettingsActionItem(
    icon: ImageVector,
    label: String,
    subtitle: String,
    isLoading: Boolean = false,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDarkVariant)
            .clickable(enabled = !isLoading) { onClick() }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.size(24.dp)
        )

        Spacer(modifier = Modifier.width(16.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }

        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = Red40
            )
        }
    }
}

@Composable
private fun ConfirmationDialog(
    title: String,
    message: String,
    confirmText: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = title,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(text = message)
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(text = confirmText, color = Red40, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "Cancel")
            }
        },
        containerColor = SurfaceDarkElevated,
        titleContentColor = MaterialTheme.colorScheme.onSurface,
        textContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
    )
}
