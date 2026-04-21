package com.iptv.player.ui.activation

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.auth.AuthKeys
import com.iptv.player.data.auth.DeviceAuthStore
import com.iptv.player.data.auth.activationDataStore
import com.iptv.player.data.model.AppInfo
import com.iptv.player.data.model.DeviceState
import com.iptv.player.data.model.PlaylistInfo
import com.iptv.player.data.repository.IPTVRepository
import com.iptv.player.util.DeviceUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Single snapshot of everything the activation UI needs to render.
 * Keeping a selected playlist on the state lets us gate it behind a PIN
 * without losing the rest of the device context.
 */
data class ActivationUi(
    val state: ActivationState = ActivationState.Idle,
    val apps: List<AppInfo> = emptyList(),
    val selectedApp: AppInfo? = null,
    val macAddress: String = "",
    val appsLoading: Boolean = false,
    val deviceState: DeviceState? = null,
    val pendingPlaylist: PlaylistInfo? = null,
    val pinError: String? = null,
    val pinSubmitting: Boolean = false
)

sealed class ActivationState {
    data object Idle : ActivationState()
    data object Loading : ActivationState()

    /** Token acquired, but the reseller has not attached any playlist yet. */
    data class NeedsPlaylist(val appName: String) : ActivationState()

    /** Token acquired, multiple playlists available — user picks. */
    data class PickPlaylist(
        val playlists: List<PlaylistInfo>,
        val isInGrace: Boolean,
        val graceEndsAt: String?
    ) : ActivationState()

    /** Selected playlist requires a PIN. */
    data class NeedsPin(val playlist: PlaylistInfo) : ActivationState()

    data class Activated(
        val playlistUrl: String,
        val xmlUrl: String,
        val playlistName: String,
        val isInGrace: Boolean = false,
        val graceEndsAt: String? = null
    ) : ActivationState()

    data class AlreadyActivated(val playlistUrl: String, val xmlUrl: String) : ActivationState()

    data class NotActivated(val error: String) : ActivationState()
}

@HiltViewModel
class ActivationViewModel @Inject constructor(
    private val repository: IPTVRepository,
    private val authStore: DeviceAuthStore,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _ui = MutableStateFlow(ActivationUi())
    val ui: StateFlow<ActivationUi> = _ui.asStateFlow()

    init {
        val mac = DeviceUtils.getDeviceMac(context)
        _ui.value = _ui.value.copy(macAddress = mac)
        viewModelScope.launch {
            resumeSavedActivation()
            loadApps()
        }
    }

    // --- Initial load ---

    private suspend fun resumeSavedActivation() {
        val prefs = context.activationDataStore.data.first()
        val isActivated = prefs[AuthKeys.IS_ACTIVATED] ?: false
        val playlistUrl = prefs[AuthKeys.PLAYLIST_URL].orEmpty()
        val xmlUrl = prefs[AuthKeys.PLAYLIST_XML_URL].orEmpty()
        if (isActivated && playlistUrl.isNotBlank()) {
            // Optimistically resume; fire a refresh in the background.
            _ui.value = _ui.value.copy(
                state = ActivationState.AlreadyActivated(playlistUrl, xmlUrl)
            )
            viewModelScope.launch { silentRefresh() }
        }
    }

    private suspend fun silentRefresh() {
        val token = authStore.tokenFlow().first()
        if (token.isNullOrBlank()) return
        repository.refreshDeviceState().onSuccess { state ->
            _ui.value = _ui.value.copy(deviceState = state)
            // If the device went away / expired past grace, kick the user out.
            if (state.device.status == "expired" || state.device.status == "disabled") {
                signOut(
                    "Your activation is no longer valid (${state.device.status}). " +
                        "Please contact your reseller."
                )
            }
        }
    }

    private fun loadApps() {
        viewModelScope.launch {
            _ui.value = _ui.value.copy(appsLoading = true)
            val result = repository.getApps(_ui.value.macAddress)
            _ui.value = result.fold(
                onSuccess = { list ->
                    _ui.value.copy(
                        apps = list,
                        selectedApp = list.firstOrNull(),
                        appsLoading = false
                    )
                },
                onFailure = { _ui.value.copy(appsLoading = false) }
            )
        }
    }

    // --- User actions ---

    fun selectApp(app: AppInfo) {
        _ui.value = _ui.value.copy(selectedApp = app)
    }

    fun checkActivation() {
        val app = _ui.value.selectedApp ?: return
        val mac = _ui.value.macAddress
        if (mac.isBlank()) {
            _ui.value = _ui.value.copy(
                state = ActivationState.NotActivated("Unable to retrieve device MAC address.")
            )
            return
        }

        viewModelScope.launch {
            _ui.value = _ui.value.copy(state = ActivationState.Loading)
            val result = repository.bindDevice(mac, app.id)
            result.onSuccess { state ->
                _ui.value = _ui.value.copy(deviceState = state)
                handleDeviceState(app, mac, state)
            }.onFailure { e ->
                _ui.value = _ui.value.copy(
                    state = ActivationState.NotActivated(
                        e.message ?: "Activation check failed. Please try again."
                    )
                )
            }
        }
    }

    private suspend fun handleDeviceState(app: AppInfo, mac: String, state: DeviceState) {
        val playlists = state.playlists
        when {
            playlists.isEmpty() ->
                _ui.value = _ui.value.copy(
                    state = ActivationState.NeedsPlaylist(app.name)
                )
            playlists.size == 1 -> selectPlaylist(app, mac, state, playlists.first())
            else -> _ui.value = _ui.value.copy(
                state = ActivationState.PickPlaylist(
                    playlists = playlists,
                    isInGrace = state.device.isInGrace,
                    graceEndsAt = state.device.graceEndsAt
                )
            )
        }
    }

    /** Called when the user taps a playlist from the picker. */
    fun onPlaylistChosen(playlist: PlaylistInfo) {
        val app = _ui.value.selectedApp ?: return
        val mac = _ui.value.macAddress
        val state = _ui.value.deviceState ?: return
        viewModelScope.launch { selectPlaylist(app, mac, state, playlist) }
    }

    private suspend fun selectPlaylist(
        app: AppInfo,
        mac: String,
        state: DeviceState,
        playlist: PlaylistInfo
    ) {
        if (playlist.isProtected) {
            _ui.value = _ui.value.copy(
                state = ActivationState.NeedsPin(playlist),
                pendingPlaylist = playlist,
                pinError = null
            )
            return
        }
        finalizeActivation(app, mac, state, playlist)
    }

    fun submitPin(pin: String) {
        val playlist = _ui.value.pendingPlaylist ?: return
        val app = _ui.value.selectedApp ?: return
        val mac = _ui.value.macAddress
        val state = _ui.value.deviceState ?: return

        if (pin.isBlank()) {
            _ui.value = _ui.value.copy(pinError = "Enter the PIN to continue.")
            return
        }

        viewModelScope.launch {
            _ui.value = _ui.value.copy(pinSubmitting = true, pinError = null)
            val result = repository.verifyPlaylistPin(playlist.id, pin)
            result.onSuccess { valid ->
                if (valid) {
                    _ui.value = _ui.value.copy(pinSubmitting = false, pinError = null)
                    finalizeActivation(app, mac, state, playlist)
                } else {
                    _ui.value = _ui.value.copy(
                        pinSubmitting = false,
                        pinError = "Incorrect PIN."
                    )
                }
            }.onFailure { e ->
                _ui.value = _ui.value.copy(
                    pinSubmitting = false,
                    pinError = e.message ?: "Could not verify PIN."
                )
            }
        }
    }

    fun cancelPin() {
        val state = _ui.value.deviceState ?: return
        val playlists = state.playlists
        _ui.value = _ui.value.copy(pendingPlaylist = null, pinError = null)
        _ui.value = _ui.value.copy(
            state = if (playlists.size > 1) {
                ActivationState.PickPlaylist(
                    playlists = playlists,
                    isInGrace = state.device.isInGrace,
                    graceEndsAt = state.device.graceEndsAt
                )
            } else {
                ActivationState.Idle
            }
        )
    }

    fun submitManualPlaylist(url: String) {
        val trimmed = url.trim()
        if (trimmed.isBlank()) {
            _ui.value = _ui.value.copy(
                state = ActivationState.NotActivated("Please enter a playlist URL.")
            )
            return
        }
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            _ui.value = _ui.value.copy(
                state = ActivationState.NotActivated(
                    "Playlist URL must start with http:// or https://"
                )
            )
            return
        }
        val app = _ui.value.selectedApp ?: return
        val mac = _ui.value.macAddress
        viewModelScope.launch {
            authStore.saveActivation(
                appId = app.id,
                appName = app.name,
                macAddress = mac,
                playlistId = "",
                playlistName = "Manual Playlist",
                playlistUrl = trimmed,
                playlistXmlUrl = "",
                expiresAt = null,
                graceEndsAt = null
            )
            _ui.value = _ui.value.copy(
                state = ActivationState.Activated(
                    playlistUrl = trimmed,
                    xmlUrl = "",
                    playlistName = "Manual Playlist"
                )
            )
        }
    }

    private suspend fun finalizeActivation(
        app: AppInfo,
        mac: String,
        state: DeviceState,
        playlist: PlaylistInfo
    ) {
        authStore.saveActivation(
            appId = app.id,
            appName = app.name,
            macAddress = mac,
            playlistId = playlist.id,
            playlistName = playlist.name,
            playlistUrl = playlist.url,
            playlistXmlUrl = playlist.xmlUrl,
            expiresAt = state.device.expiresAt,
            graceEndsAt = state.device.graceEndsAt
        )
        _ui.value = _ui.value.copy(
            state = ActivationState.Activated(
                playlistUrl = playlist.url,
                xmlUrl = playlist.xmlUrl,
                playlistName = playlist.name,
                isInGrace = state.device.isInGrace,
                graceEndsAt = state.device.graceEndsAt
            ),
            pendingPlaylist = null,
            pinError = null
        )
    }

    fun retry() {
        _ui.value = _ui.value.copy(state = ActivationState.Idle)
        loadApps()
    }

    fun clearActivation() {
        viewModelScope.launch {
            // Best-effort server-side revoke, then nuke local state.
            runCatching { repository.revokeDeviceToken() }
            authStore.clearAll()
            _ui.value = ActivationUi(
                macAddress = DeviceUtils.getDeviceMac(context)
            )
            loadApps()
        }
    }

    private suspend fun signOut(reason: String) {
        authStore.clearAll()
        _ui.value = _ui.value.copy(state = ActivationState.NotActivated(reason))
    }
}
