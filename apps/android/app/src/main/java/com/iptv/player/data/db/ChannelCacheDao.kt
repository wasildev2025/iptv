package com.iptv.player.data.db

import androidx.room.*
import com.iptv.player.data.model.CachedChannel

/**
 * IMPORTANT: there is deliberately NO `getAll()` method here. Android's SQLite
 * CursorWindow has a hard 2 MB limit per result set, and Xtream playlists
 * regularly return 10k–50k channels which blows past that with
 * `CursorWindow: Failed NO_MEMORY`. Always scope reads by group, prefix, or
 * bounded page via [getPaged].
 */
@Dao
interface ChannelCacheDao {

    @Query("SELECT DISTINCT groupTitle FROM cached_channels ORDER BY groupTitle ASC")
    suspend fun getGroups(): List<String>

    @Query("SELECT * FROM cached_channels WHERE groupTitle = :group ORDER BY name ASC")
    suspend fun getByGroup(group: String): List<CachedChannel>

    @Query("""
        SELECT * FROM cached_channels
        WHERE name LIKE '%' || :query || '%'
        ORDER BY name ASC
        LIMIT :limit
    """)
    suspend fun search(query: String, limit: Int = 200): List<CachedChannel>

    /** Bounded page read — safe against CursorWindow limits. */
    @Query("SELECT * FROM cached_channels ORDER BY name ASC LIMIT :limit OFFSET :offset")
    suspend fun getPaged(limit: Int, offset: Int): List<CachedChannel>

    /**
     * Only channels that actually have an EPG id populated. Xtream catalogues
     * contain many thousands of VOD entries without EPG; loading only the
     * live-channel subset with tvgId keeps the EPG grid query tiny.
     */
    @Query("SELECT * FROM cached_channels WHERE tvgId != '' ORDER BY name ASC")
    suspend fun getChannelsWithEpg(): List<CachedChannel>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(channels: List<CachedChannel>)

    @Query("DELETE FROM cached_channels")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM cached_channels")
    suspend fun count(): Int
}
