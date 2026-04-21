package com.iptv.player.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

// --- API: device binding & state ----------------------------------------------

data class BindDeviceRequest(
    val macAddress: String,
    val appId: String? = null,
    val appSlug: String? = null
)

data class BindDeviceResponse(
    val token: String,
    val state: DeviceState
)

data class DeviceState(
    val device: DeviceSummary,
    val app: AppInfo,
    val playlists: List<PlaylistInfo>
)

data class DeviceSummary(
    val id: String,
    val macAddress: String,
    val status: String,
    val packageType: String,
    val activatedAt: String?,
    val expiresAt: String?,
    val graceEndsAt: String?,
    val isInGrace: Boolean = false
)

data class AppInfo(
    val id: String,
    val name: String,
    val slug: String,
    val iconUrl: String = ""
)

data class PlaylistInfo(
    val id: String,
    val name: String,
    val url: String,
    val xmlUrl: String = "",
    val isProtected: Boolean = false,
    val createdAt: String? = null
)

data class AppsListRequest(
    val macAddress: String? = null
)

data class VerifyPinRequest(
    val playlistId: String,
    val pin: String
)

data class VerifyPinResponse(
    val valid: Boolean
)

// --- M3U parsed models --------------------------------------------------------

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
    val isLive: Boolean = true
)

// --- Room entities ------------------------------------------------------------

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

// --- EPG models ---------------------------------------------------------------

@Entity(tableName = "epg_programs", primaryKeys = ["channelId", "startTime"])
data class EpgProgram(
    val channelId: String,
    val title: String,
    val description: String,
    val startTime: Long,
    val endTime: Long
)
