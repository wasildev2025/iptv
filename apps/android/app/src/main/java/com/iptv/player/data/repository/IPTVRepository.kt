package com.iptv.player.data.repository

import com.iptv.player.data.api.IPTVApiService
import com.iptv.player.data.auth.DeviceAuthStore
import com.iptv.player.data.db.ChannelCacheDao
import com.iptv.player.data.db.FavoriteDao
import com.iptv.player.data.db.RecentDao
import com.iptv.player.data.model.*
import com.iptv.player.data.parser.M3UParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IPTVRepository @Inject constructor(
    private val api: IPTVApiService,
    private val authStore: DeviceAuthStore,
    private val favoriteDao: FavoriteDao,
    private val recentDao: RecentDao,
    private val channelCacheDao: ChannelCacheDao
) {
    // --- Device auth / state ---

    suspend fun getApps(macAddress: String = ""): Result<List<AppInfo>> = safeCall {
        val response = api.getApps(
            AppsListRequest(macAddress = macAddress.takeIf { it.isNotBlank() })
        )
        if (response.isSuccessful) response.body() ?: emptyList()
        else throw Exception(extractApiError(response, "Failed to fetch apps"))
    }

    /** Exchange MAC + appId for a device token, persist the token, return state. */
    suspend fun bindDevice(macAddress: String, appId: String): Result<DeviceState> = safeCall {
        val response = api.bindDevice(BindDeviceRequest(macAddress = macAddress, appId = appId))
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "Device not activated"))
        }
        val body = response.body()!!
        authStore.saveToken(body.token)
        body.state
    }

    /** Refresh the current device state. Requires a saved token. */
    suspend fun refreshDeviceState(): Result<DeviceState> = safeCall {
        val response = api.checkActivation()
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "Unable to refresh activation"))
        }
        response.body()!!
    }

    /** Verify a PIN for a protected playlist. */
    suspend fun verifyPlaylistPin(playlistId: String, pin: String): Result<Boolean> = safeCall {
        val response = api.verifyPlaylistPin(VerifyPinRequest(playlistId, pin))
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "PIN verification failed"))
        }
        response.body()!!.valid
    }

    suspend fun revokeDeviceToken(): Result<Unit> = safeCall {
        runCatching { api.revokeDeviceToken() }
        authStore.clearAll()
    }

    // --- Playlist loading ---

    suspend fun loadPlaylist(url: String): Result<M3UPlaylist> = withContext(Dispatchers.IO) {
        safeCall {
            val playlist = M3UParser.parseFromUrl(url)
            val cached = playlist.channels.map { ch ->
                CachedChannel(
                    streamUrl = ch.streamUrl,
                    name = ch.name,
                    groupTitle = ch.groupTitle,
                    logoUrl = ch.logoUrl,
                    tvgId = ch.tvgId,
                    isLive = ch.isLive
                )
            }
            channelCacheDao.clearAll()
            channelCacheDao.insertAll(cached)
            playlist
        }
    }

    suspend fun getCachedChannels(): List<CachedChannel> = channelCacheDao.getAll()
    suspend fun getCachedGroups(): List<String> = channelCacheDao.getGroups()
    suspend fun getChannelsByGroup(group: String): List<CachedChannel> = channelCacheDao.getByGroup(group)
    suspend fun searchChannels(query: String): List<CachedChannel> = channelCacheDao.search(query)
    suspend fun getCachedChannelCount(): Int = channelCacheDao.count()

    // --- Favorites / recent ---

    fun getFavorites(): Flow<List<FavoriteChannel>> = favoriteDao.getAll()
    suspend fun isFavorite(url: String): Boolean = favoriteDao.isFavorite(url)
    suspend fun addFavorite(channel: M3UChannel) {
        favoriteDao.add(FavoriteChannel(
            streamUrl = channel.streamUrl,
            name = channel.name,
            groupTitle = channel.groupTitle,
            logoUrl = channel.logoUrl
        ))
    }
    suspend fun removeFavorite(url: String) = favoriteDao.removeByUrl(url)

    fun getRecent(): Flow<List<RecentChannel>> = recentDao.getAll()
    suspend fun addRecent(channel: M3UChannel) {
        recentDao.add(RecentChannel(
            streamUrl = channel.streamUrl,
            name = channel.name,
            groupTitle = channel.groupTitle,
            logoUrl = channel.logoUrl
        ))
    }
    suspend fun clearRecent() = recentDao.clearAll()

    // --- Helpers ---

    private inline fun <T> safeCall(block: () -> T): Result<T> = try {
        Result.success(block())
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun extractApiError(response: Response<*>, fallback: String): String {
        val body = response.errorBody()?.string().orEmpty()
        if (body.isBlank()) return fallback
        return try {
            val json = JSONObject(body)
            when (val msg = json.opt("message")) {
                is String -> msg
                is org.json.JSONArray -> (0 until msg.length())
                    .joinToString(", ") { msg.optString(it) }
                else -> fallback
            }
        } catch (_: Exception) {
            fallback
        }
    }
}
