package com.iptv.player.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.iptv.player.data.model.EpgProgram
import kotlinx.coroutines.flow.Flow

@Dao
interface EpgDao {
    @Query("SELECT * FROM epg_programs WHERE channelId = :channelId AND endTime > :currentTime ORDER BY startTime ASC")
    fun getProgramsForChannel(channelId: String, currentTime: Long): Flow<List<EpgProgram>>

    @Query("SELECT * FROM epg_programs WHERE startTime < :endTime AND endTime > :startTimeQuery ORDER BY startTime ASC")
    suspend fun getProgramsInRange(startTimeQuery: Long, endTime: Long): List<EpgProgram>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(programs: List<EpgProgram>)

    @Query("DELETE FROM epg_programs WHERE endTime < :currentTime")
    suspend fun deleteOldPrograms(currentTime: Long)

    @Query("DELETE FROM epg_programs")
    suspend fun clearAll()
}
