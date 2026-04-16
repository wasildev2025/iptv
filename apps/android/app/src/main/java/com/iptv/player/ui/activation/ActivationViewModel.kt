package com.iptv.player.ui.activation

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.AppInfo
import com.iptv.player.data.repository.IPTVRepository
import com.iptv.player.util.DeviceUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

val Context.activationDataStore: DataStore<Preferences> by preferencesDataStore(name = "activation")

object PrefsKeys {
    val IS_ACTIVATED = booleanPreferencesKey("is_activated")
    val PLAYLIST_URL = stringPreferencesKey("playlist_url")
    val APP_ID = stringPreferencesKey("app_id")
    val APP_NAME = stringPreferencesKey("app_name")
    val MAC_ADDRESS = stringPreferencesKey("mac_address")
    val EXPIRES_AT = stringPreferencesKey("expires_at")
}

sealed class ActivationState {
    data object Idle : ActivationState()
    data object Loading : ActivationState()
    data class Activated(val playlistUrl: String) : ActivationState()
    data class NotActivated(val error: String) : ActivationState()
    data class AlreadyActivated(val playlistUrl: String) : ActivationState()
    // Device is recognised and active on the server, but no playlist has been
    // configured for it yet. User should paste a playlist URL or contact their reseller.
    data class NeedsPlaylist(val appName: String) : ActivationState()
}

@HiltViewModel
class ActivationViewModel @Inject constructor(
    private val repository: IPTVRepository,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _activationState = MutableStateFlow<ActivationState>(ActivationState.Idle)
    val activationState: StateFlow<ActivationState> = _activationState.asStateFlow()

    private val _apps = MutableStateFlow<List<AppInfo>>(emptyList())
    val apps: StateFlow<List<AppInfo>> = _apps.asStateFlow()

    private val _selectedApp = MutableStateFlow<AppInfo?>(null)
    val selectedApp: StateFlow<AppInfo?> = _selectedApp.asStateFlow()

    private val _macAddress = MutableStateFlow("")
    val macAddress: StateFlow<String> = _macAddress.asStateFlow()

    private val _appsLoading = MutableStateFlow(false)
    val appsLoading: StateFlow<Boolean> = _appsLoading.asStateFlow()

    init {
        _macAddress.value = DeviceUtils.getDeviceMac(context)
        checkSavedActivation()
        loadApps()
    }

    private fun checkSavedActivation() {
        viewModelScope.launch {
            val prefs = context.activationDataStore.data.first()
            val isActivated = prefs[PrefsKeys.IS_ACTIVATED] ?: false
            val playlistUrl = prefs[PrefsKeys.PLAYLIST_URL] ?: ""
            if (isActivated && playlistUrl.isNotBlank()) {
                _activationState.value = ActivationState.AlreadyActivated(playlistUrl)
            }
        }
    }

    private fun loadApps() {
        viewModelScope.launch {
            _appsLoading.value = true
            // Pass the MAC address to fetch only allowed apps for this device
            val result = repository.getApps(_macAddress.value)
            result.onSuccess { appList ->
                _apps.value = appList
                if (appList.isNotEmpty()) {
                    _selectedApp.value = appList.first()
                }
            }
            _appsLoading.value = false
        }
    }

    fun selectApp(app: AppInfo) {
        _selectedApp.value = app
    }

    fun checkActivation() {
        val app = _selectedApp.value ?: return
        val mac = _macAddress.value
        if (mac.isBlank()) {
            _activationState.value = ActivationState.NotActivated("Unable to retrieve device MAC address.")
            return
        }

        viewModelScope.launch {
            _activationState.value = ActivationState.Loading
            val result = repository.checkDeviceActivation(mac, app.id)
            result.onSuccess { response ->
                when {
                    response.status == "active" && !response.playlistUrl.isNullOrBlank() -> {
                        persistActivation(app, mac, response.playlistUrl, response.expiresAt)
                        _activationState.value = ActivationState.Activated(response.playlistUrl)
                    }
                    response.status == "active" -> {
                        _activationState.value = ActivationState.NeedsPlaylist(app.name)
                    }
                    else -> {
                        _activationState.value = ActivationState.NotActivated(
                            "Device status: ${response.status}. Contact your reseller."
                        )
                    }
                }
            }.onFailure { e ->
                _activationState.value = ActivationState.NotActivated(
                    e.message ?: "Activation check failed. Please try again."
                )
            }
        }
    }

    fun submitManualPlaylist(url: String) {
        val trimmed = url.trim()
        if (trimmed.isBlank()) {
            _activationState.value = ActivationState.NotActivated("Please enter a playlist URL.")
            return
        }
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            _activationState.value = ActivationState.NotActivated("Playlist URL must start with http:// or https://")
            return
        }
        val app = _selectedApp.value ?: return
        val mac = _macAddress.value
        viewModelScope.launch {
            persistActivation(app, mac, trimmed, expiresAt = null)
            _activationState.value = ActivationState.Activated(trimmed)
        }
    }

    private suspend fun persistActivation(app: AppInfo, mac: String, playlistUrl: String, expiresAt: String?) {
        context.activationDataStore.edit { prefs ->
            prefs[PrefsKeys.IS_ACTIVATED] = true
            prefs[PrefsKeys.PLAYLIST_URL] = playlistUrl
            prefs[PrefsKeys.APP_ID] = app.id
            prefs[PrefsKeys.APP_NAME] = app.name
            prefs[PrefsKeys.MAC_ADDRESS] = mac
            prefs[PrefsKeys.EXPIRES_AT] = expiresAt ?: ""
        }
    }

    fun retry() {
        _activationState.value = ActivationState.Idle
        loadApps()
    }

    suspend fun getPlaylistUrl(): String {
        return context.activationDataStore.data.map { prefs ->
            prefs[PrefsKeys.PLAYLIST_URL] ?: ""
        }.first()
    }

    fun clearActivation() {
        viewModelScope.launch {
            context.activationDataStore.edit { it.clear() }
            _activationState.value = ActivationState.Idle
        }
    }
}
