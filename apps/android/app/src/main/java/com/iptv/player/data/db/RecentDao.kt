package com.iptv.player.data.db

import androidx.room.*
import com.iptv.player.data.model.RecentChannel
import kotlinx.coroutines.flow.Flow

@Dao
interface RecentDao {
    @Query("SELECT * FROM recent_channels ORDER BY watchedAt DESC LIMIT 50")
    fun getAll(): Flow<List<RecentChannel>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun add(channel: RecentChannel)

    @Query("DELETE FROM recent_channels")
    suspend fun clearAll()
}
