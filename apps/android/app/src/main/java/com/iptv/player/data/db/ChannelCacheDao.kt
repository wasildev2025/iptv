package com.iptv.player.data.db

import androidx.room.*
import com.iptv.player.data.model.CachedChannel

@Dao
interface ChannelCacheDao {
    @Query("SELECT * FROM cached_channels ORDER BY name ASC")
    suspend fun getAll(): List<CachedChannel>

    @Query("SELECT DISTINCT groupTitle FROM cached_channels ORDER BY groupTitle ASC")
    suspend fun getGroups(): List<String>

    @Query("SELECT * FROM cached_channels WHERE groupTitle = :group ORDER BY name ASC")
    suspend fun getByGroup(group: String): List<CachedChannel>

    @Query("SELECT * FROM cached_channels WHERE name LIKE '%' || :query || '%' ORDER BY name ASC")
    suspend fun search(query: String): List<CachedChannel>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(channels: List<CachedChannel>)

    @Query("DELETE FROM cached_channels")
    suspend fun clearAll()

    @Query("SELECT COUNT(*) FROM cached_channels")
    suspend fun count(): Int
}
