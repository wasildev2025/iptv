package com.iptv.player.data.model

import androidx.compose.runtime.Immutable
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

data class XtreamHomeRequest(
    val url: String
)

data class XtreamCategoryRequest(
    val url: String,
    val categoryId: String
)

data class XtreamSearchRequest(
    val url: String,
    val query: String
)

data class XtreamHomeResponse(
    val featured: List<M3UChannel> = emptyList(),
    val categories: List<XtreamCategorySection> = emptyList(),
    val totalCategories: Int = 0
)

data class XtreamCategorySection(
    val categoryId: String,
    val title: String,
    val channels: List<M3UChannel> = emptyList()
)

data class XtreamCategoryResponse(
    val channels: List<M3UChannel> = emptyList()
)

data class XtreamSearchResponse(
    val results: List<M3UChannel> = emptyList()
)

data class XtreamEpgChannelsRequest(
    val url: String
)

data class XtreamEpgChannelsResponse(
    val channels: List<M3UChannel> = emptyList()
)

// --- M3U parsed models --------------------------------------------------------

@Immutable
data class M3UPlaylist(
    val channels: List<M3UChannel>,
    val groups: List<String>
)

@Immutable
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

@Immutable
@Entity(tableName = "favorites")
data class FavoriteChannel(
    @PrimaryKey val streamUrl: String,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val addedAt: Long = System.currentTimeMillis()
)

@Immutable
@Entity(tableName = "recent_channels")
data class RecentChannel(
    @PrimaryKey val streamUrl: String,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val watchedAt: Long = System.currentTimeMillis()
)

@Immutable
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

@Immutable
@Entity(tableName = "epg_programs", primaryKeys = ["channelId", "startTime"])
data class EpgProgram(
    val channelId: String,
    val title: String,
    val description: String,
    val startTime: Long,
    val endTime: Long
)
