package com.iptv.player.data.repository

import com.iptv.player.data.api.IPTVApiService
import com.iptv.player.data.auth.DeviceAuthStore
import com.iptv.player.data.db.ChannelCacheDao
import com.iptv.player.data.db.EpgDao
import com.iptv.player.data.db.FavoriteDao
import com.iptv.player.data.db.RecentDao
import com.iptv.player.data.model.*
import com.iptv.player.data.parser.M3UParser
import com.iptv.player.data.parser.XmltvParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import retrofit2.Response
import java.net.URLDecoder
import java.net.URLEncoder
import java.net.URL
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class IPTVRepository @Inject constructor(
    private val api: IPTVApiService,
    private val authStore: DeviceAuthStore,
    private val favoriteDao: FavoriteDao,
    private val recentDao: RecentDao,
    private val channelCacheDao: ChannelCacheDao,
    private val epgDao: EpgDao
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
            // Chunk inserts so a single transaction never buffers 50k rows —
            // keeps SQLite's write page cache happy on low-end devices.
            cached.chunked(CACHE_INSERT_CHUNK).forEach { batch ->
                channelCacheDao.insertAll(batch)
            }
            playlist
        }
    }

    suspend fun loadXtreamHome(url: String): Result<XtreamHomeResponse> = safeCall {
        val response = api.getXtreamHome(XtreamHomeRequest(url))
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "Failed to load Xtream home"))
        }
        response.body()!!
    }

    suspend fun loadXtreamCategory(url: String, categoryId: String): Result<List<M3UChannel>> = safeCall {
        val response = api.getXtreamCategory(XtreamCategoryRequest(url, categoryId))
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "Failed to load Xtream category"))
        }
        response.body()!!.channels
    }

    suspend fun searchXtreamChannels(url: String, query: String): Result<List<M3UChannel>> = safeCall {
        val response = api.searchXtream(XtreamSearchRequest(url, query))
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "Failed to search Xtream channels"))
        }
        response.body()!!.results
    }

    suspend fun loadXtreamEpgChannels(url: String): Result<List<M3UChannel>> = safeCall {
        val response = api.getXtreamEpgChannels(XtreamEpgChannelsRequest(url))
        if (!response.isSuccessful || response.body() == null) {
            throw Exception(extractApiError(response, "Failed to load Xtream guide channels"))
        }
        response.body()!!.channels
    }

    fun isXtreamPlaylistUrl(url: String): Boolean = M3UParser.looksLikeXtreamUrl(url)

    suspend fun syncCurrentPlaylistEpg(): Result<Int> = withContext(Dispatchers.IO) {
        safeCall {
            val playlistUrl = authStore.currentPlaylistUrl().orEmpty()
            if (playlistUrl.isBlank()) {
                throw Exception("No active playlist URL found")
            }

            val xmlUrl = authStore.currentPlaylistXmlUrl()
                ?.takeIf { it.isNotBlank() }
                ?: deriveXtreamXmltvUrl(playlistUrl)
                ?: throw Exception("No EPG feed configured for this playlist")

            if (isXtreamPlaylistUrl(playlistUrl)) {
                loadXtreamEpgChannels(playlistUrl).getOrThrow().let { channels ->
                    replaceChannelCache(channels)
                }
            }

            val now = System.currentTimeMillis()
            val windowStart = now - SIX_HOURS_MS
            val windowEnd = now + THIRTY_SIX_HOURS_MS

            epgDao.clearAll()
            epgDao.deleteOldPrograms(now)

            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(90, TimeUnit.SECONDS)
                .build()

            val request = Request.Builder().url(xmlUrl).build()
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                throw Exception("Failed to download EPG: ${response.code}")
            }

            var inserted = 0
            response.body?.byteStream()?.use { rawStream ->
                val stream = if (
                    xmlUrl.endsWith(".gz", ignoreCase = true) ||
                    response.header("Content-Encoding").equals("gzip", ignoreCase = true)
                ) {
                    GZIPInputStream(rawStream)
                } else {
                    rawStream
                }

                XmltvParser.parsePrograms(stream, windowStart, windowEnd) { batch ->
                    epgDao.insertAll(batch)
                    inserted += batch.size
                }
            } ?: throw Exception("Empty EPG response")

            inserted
        }
    }

    suspend fun getCachedGroups(): List<String> = channelCacheDao.getGroups()
    suspend fun getChannelsByGroup(group: String): List<CachedChannel> = channelCacheDao.getByGroup(group)
    suspend fun searchChannels(query: String): List<CachedChannel> = channelCacheDao.search(query)
    suspend fun getCachedChannelCount(): Int = channelCacheDao.count()

    /** Only channels with EPG ids — for the EPG grid. */
    suspend fun getChannelsWithEpg(): List<CachedChannel> = channelCacheDao.getChannelsWithEpg()

    /** Paginated read — for any screen that wants every channel without blowing the CursorWindow. */
    suspend fun getCachedChannelsPage(limit: Int, offset: Int): List<CachedChannel> =
        channelCacheDao.getPaged(limit, offset)

    private companion object {
        /**
         * Room's default CursorWindow caps results at ~2 MB. Inserts don't use
         * CursorWindow, but large single transactions still thrash the
         * statement cache — 500 rows/batch keeps every write under ~200 KB.
         */
        const val CACHE_INSERT_CHUNK = 500
        const val SIX_HOURS_MS = 6 * 60 * 60 * 1000L
        const val THIRTY_SIX_HOURS_MS = 36 * 60 * 60 * 1000L
    }

    private suspend fun replaceChannelCache(channels: List<M3UChannel>) {
        val cached = channels.map { ch ->
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
        cached.chunked(CACHE_INSERT_CHUNK).forEach { batch ->
            channelCacheDao.insertAll(batch)
        }
    }

    private fun deriveXtreamXmltvUrl(playlistUrl: String): String? {
        if (!M3UParser.looksLikeXtreamUrl(playlistUrl)) return null
        return runCatching {
            val parsed = URL(playlistUrl)
            val query = parsed.query.orEmpty()
            val params = query.split("&")
                .mapNotNull { item ->
                    val parts = item.split("=", limit = 2)
                    if (parts.size == 2) parts[0] to parts[1] else null
                }
                .toMap()
            val username = URLDecoder.decode(params["username"] ?: return null, "UTF-8")
            val password = URLDecoder.decode(params["password"] ?: return null, "UTF-8")
            val portPart = if (parsed.port != -1 && parsed.port != parsed.defaultPort) ":${parsed.port}" else ""
            "${parsed.protocol}://${parsed.host}$portPart/xmltv.php?username=${URLEncoder.encode(username, "UTF-8")}&password=${URLEncoder.encode(password, "UTF-8")}"
        }.getOrNull()
    }

    // --- EPG ---

    suspend fun getProgramsInRange(startTime: Long, endTime: Long): List<EpgProgram> {
        return epgDao.getProgramsInRange(startTime, endTime)
    }

    fun getProgramsForChannel(channelId: String): Flow<List<EpgProgram>> {
        return epgDao.getProgramsForChannel(channelId, System.currentTimeMillis())
    }

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

    private suspend inline fun <T> safeCall(crossinline block: suspend () -> T): Result<T> = try {
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
