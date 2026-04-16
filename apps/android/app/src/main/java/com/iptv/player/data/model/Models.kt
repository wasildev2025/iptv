package com.iptv.player.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

// API response models
data class DeviceCheckResponse(
    val id: String,
    val macAddress: String,
    val status: String,
    val packageType: String,
    val expiresAt: String?,
    val playlistUrl: String?,
    val app: AppInfo?
)

data class AppInfo(
    val id: String,
    val name: String,
    val slug: String,
    val iconUrl: String
)

data class ActivationRequest(
    val macAddress: String,
    val appId: String? = null,
    val appSlug: String? = null
)

data class AppsListRequest(
    val macAddress: String? = null
)

data class PlaylistResponse(
    val id: String,
    val macAddress: String,
    val playlistUrl: String,
    val playlistName: String,
    val appPlatform: String
)

// M3U parsed models
data class M3UPlaylist(
    val channels: List<M3UChannel>,
    val groups: List<String>
)

data class M3UChannel(
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val streamUrl: String,
    val tvgId: String = "",
    val tvgName: String = "",
    val isLive: Boolean = true  // vs VOD
)

// Room entities
@Entity(tableName = "favorites")
data class FavoriteChannel(
    @PrimaryKey val streamUrl: String,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "recent_channels")
data class RecentChannel(
    @PrimaryKey val streamUrl: String,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val watchedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_channels")
data class CachedChannel(
    @PrimaryKey val streamUrl: String,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val tvgId: String,
    val isLive: Boolean,
    val cachedAt: Long = System.currentTimeMillis()
)

// EPG models
data class EpgProgram(
    val channelId: String,
    val title: String,
    val description: String,
    val startTime: Long,
    val endTime: Long
)
