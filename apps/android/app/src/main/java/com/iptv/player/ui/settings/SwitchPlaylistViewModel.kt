package com.iptv.player.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.auth.DeviceAuthStore
import com.iptv.player.data.model.PlaylistInfo
import com.iptv.player.data.repository.IPTVRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SwitchPlaylistUi(
    val loading: Boolean = true,
    val error: String? = null,
    val playlists: List<PlaylistInfo> = emptyList(),
    val currentPlaylistId: String? = null,
    val pendingPlaylist: PlaylistInfo? = null,
    val pinError: String? = null,
    val pinSubmitting: Boolean = false,
    /** Set when a playlist has been chosen (and PIN-verified if needed). Screen navigates home. */
    val completedPlaylistUrl: String? = null
)

@HiltViewModel
class SwitchPlaylistViewModel @Inject constructor(
    private val repository: IPTVRepository,
    private val authStore: DeviceAuthStore
) : ViewModel() {

    private val _ui = MutableStateFlow(SwitchPlaylistUi())
    val ui: StateFlow<SwitchPlaylistUi> = _ui.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        _ui.value = _ui.value.copy(loading = true, error = null)
        viewModelScope.launch {
            val current = authStore.currentPlaylistId()
            val result = repository.refreshDeviceState()
            _ui.value = result.fold(
                onSuccess = { state ->
                    _ui.value.copy(
                        loading = false,
                        playlists = state.playlists,
                        currentPlaylistId = current,
                        error = if (state.playlists.isEmpty())
                            "No playlists are attached to this device yet."
                        else null
                    )
                },
                onFailure = { e ->
                    _ui.value.copy(
                        loading = false,
                        error = e.message ?: "Could not load playlists."
                    )
                }
            )
        }
    }

    fun onPlaylistChosen(playlist: PlaylistInfo) {
        if (playlist.isProtected) {
            _ui.value = _ui.value.copy(
                pendingPlaylist = playlist,
                pinError = null
            )
            return
        }
        viewModelScope.launch { finalize(playlist) }
    }

    fun submitPin(pin: String) {
        val playlist = _ui.value.pendingPlaylist ?: return
        if (pin.isBlank()) {
            _ui.value = _ui.value.copy(pinError = "Enter the PIN to continue.")
            return
        }
        viewModelScope.launch {
            _ui.value = _ui.value.copy(pinSubmitting = true, pinError = null)
            val result = repository.verifyPlaylistPin(playlist.id, pin)
            result.onSuccess { valid ->
                if (valid) {
                    _ui.value = _ui.value.copy(pinSubmitting = false)
                    finalize(playlist)
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
        _ui.value = _ui.value.copy(pendingPlaylist = null, pinError = null)
    }

    private suspend fun finalize(playlist: PlaylistInfo) {
        authStore.updateSelectedPlaylist(
            playlistId = playlist.id,
            playlistName = playlist.name,
            playlistUrl = playlist.url,
            playlistXmlUrl = playlist.xmlUrl
        )
        _ui.value = _ui.value.copy(
            pendingPlaylist = null,
            pinError = null,
            completedPlaylistUrl = playlist.url
        )
    }
}
