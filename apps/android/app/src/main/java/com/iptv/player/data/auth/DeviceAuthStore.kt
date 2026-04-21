package com.iptv.player.data.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

/** Backing DataStore for everything the activation/auth flow needs to persist. */
val Context.activationDataStore: DataStore<Preferences> by preferencesDataStore(name = "activation")

object AuthKeys {
    val DEVICE_TOKEN = stringPreferencesKey("device_token")
    val IS_ACTIVATED = booleanPreferencesKey("is_activated")
    val PLAYLIST_URL = stringPreferencesKey("playlist_url")
    val PLAYLIST_ID = stringPreferencesKey("playlist_id")
    val PLAYLIST_NAME = stringPreferencesKey("playlist_name")
    val PLAYLIST_XML_URL = stringPreferencesKey("playlist_xml_url")
    val APP_ID = stringPreferencesKey("app_id")
    val APP_NAME = stringPreferencesKey("app_name")
    val MAC_ADDRESS = stringPreferencesKey("mac_address")
    val EXPIRES_AT = stringPreferencesKey("expires_at")
    val GRACE_ENDS_AT = stringPreferencesKey("grace_ends_at")
}

@Singleton
class DeviceAuthStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    /** Synchronous read used by the OkHttp interceptor. */
    fun readTokenBlocking(): String? = runBlocking {
        context.activationDataStore.data.map { it[AuthKeys.DEVICE_TOKEN] }.first()
    }

    fun tokenFlow(): Flow<String?> =
        context.activationDataStore.data.map { it[AuthKeys.DEVICE_TOKEN] }

    suspend fun saveToken(token: String) {
        context.activationDataStore.edit { it[AuthKeys.DEVICE_TOKEN] = token }
    }

    suspend fun clearAll() {
        context.activationDataStore.edit { it.clear() }
    }

    suspend fun saveActivation(
        appId: String,
        appName: String,
        macAddress: String,
        playlistId: String,
        playlistName: String,
        playlistUrl: String,
        playlistXmlUrl: String,
        expiresAt: String?,
        graceEndsAt: String?
    ) {
        context.activationDataStore.edit { prefs ->
            prefs[AuthKeys.IS_ACTIVATED] = true
            prefs[AuthKeys.APP_ID] = appId
            prefs[AuthKeys.APP_NAME] = appName
            prefs[AuthKeys.MAC_ADDRESS] = macAddress
            prefs[AuthKeys.PLAYLIST_ID] = playlistId
            prefs[AuthKeys.PLAYLIST_NAME] = playlistName
            prefs[AuthKeys.PLAYLIST_URL] = playlistUrl
            prefs[AuthKeys.PLAYLIST_XML_URL] = playlistXmlUrl
            prefs[AuthKeys.EXPIRES_AT] = expiresAt ?: ""
            prefs[AuthKeys.GRACE_ENDS_AT] = graceEndsAt ?: ""
        }
    }
}
