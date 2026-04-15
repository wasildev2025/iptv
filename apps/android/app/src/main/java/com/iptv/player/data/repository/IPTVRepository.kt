package com.iptv.player.data.repository

import com.iptv.player.data.api.IPTVApiService
import com.iptv.player.data.db.ChannelCacheDao
import com.iptv.player.data.db.FavoriteDao
import com.iptv.player.data.db.RecentDao
import com.iptv.player.data.model.*
import com.iptv.player.data.parser.M3UParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IPTVRepository @Inject constructor(
    private val api: IPTVApiService,
    private val favoriteDao: FavoriteDao,
    private val recentDao: RecentDao,
    private val channelCacheDao: ChannelCacheDao
) {
    // --- Device Activation ---
    suspend fun checkDeviceActivation(macAddress: String, appId: String): Result<DeviceCheckResponse> {
        return try {
            val response = api.checkDeviceStatus(ActivationRequest(macAddress, appId))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Device not activated"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getApps(macAddress: String): Result<List<AppInfo>> {
        return try {
            // Use getAllowedApps with MAC address to filter apps specifically for this device
            val response = api.getAllowedApps(macAddress)
            if (response.isSuccessful) Result.success(response.body() ?: emptyList())
            else Result.failure(Exception("Failed to fetch apps"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Playlist Loading ---
    suspend fun loadPlaylist(url: String): Result<M3UPlaylist> {
        return withContext(Dispatchers.IO) {
            try {
                val playlist = M3UParser.parseFromUrl(url)
                // Cache channels locally
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
                Result.success(playlist)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    suspend fun getCachedChannels(): List<CachedChannel> = channelCacheDao.getAll()
    suspend fun getCachedGroups(): List<String> = channelCacheDao.getGroups()
    suspend fun getChannelsByGroup(group: String): List<CachedChannel> = channelCacheDao.getByGroup(group)
    suspend fun searchChannels(query: String): List<CachedChannel> = channelCacheDao.search(query)
    suspend fun getCachedChannelCount(): Int = channelCacheDao.count()

    // --- Favorites ---
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

    // --- Recent ---
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
}
