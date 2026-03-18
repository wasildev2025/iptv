package com.iptv.player.data.db

import androidx.room.*
import com.iptv.player.data.model.FavoriteChannel
import kotlinx.coroutines.flow.Flow

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites ORDER BY addedAt DESC")
    fun getAll(): Flow<List<FavoriteChannel>>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE streamUrl = :url)")
    suspend fun isFavorite(url: String): Boolean

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun add(channel: FavoriteChannel)

    @Delete
    suspend fun remove(channel: FavoriteChannel)

    @Query("DELETE FROM favorites WHERE streamUrl = :url")
    suspend fun removeByUrl(url: String)
}
