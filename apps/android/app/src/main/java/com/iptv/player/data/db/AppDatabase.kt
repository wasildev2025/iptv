package com.iptv.player.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.RecentChannel
import com.iptv.player.data.model.CachedChannel

@Database(
    entities = [FavoriteChannel::class, RecentChannel::class, CachedChannel::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun favoriteDao(): FavoriteDao
    abstract fun recentDao(): RecentDao
    abstract fun channelCacheDao(): ChannelCacheDao
}
