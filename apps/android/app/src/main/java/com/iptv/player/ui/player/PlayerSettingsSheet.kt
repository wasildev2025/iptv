package com.iptv.player.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ClosedCaption
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material3.*
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import com.iptv.player.ui.theme.BrandAccent
import com.iptv.player.ui.theme.BrandNavyDeep

@OptIn(UnstableApi::class, ExperimentalMaterial3Api::class)
@Composable
fun PlayerSettingsSheet(
    player: Player,
    onDismiss: () -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tracks by remember(player) {
        mutableStateOf(player.currentTracks)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = BrandNavyDeep,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Color.White.copy(alpha = 0.3f)) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(bottom = 24.dp)
        ) {
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = Color.Transparent,
                contentColor = BrandAccent,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = BrandAccent
                    )
                },
                divider = {}
            ) {
                SettingTab(0, "Quality", Icons.Default.HighQuality, selectedTab) { selectedTab = 0 }
                SettingTab(1, "Audio", Icons.Default.Audiotrack, selectedTab) { selectedTab = 1 }
                SettingTab(2, "Captions", Icons.Default.ClosedCaption, selectedTab) { selectedTab = 2 }
            }

            Spacer(modifier = Modifier.height(16.dp))

            val currentType = when (selectedTab) {
                0 -> C.TRACK_TYPE_VIDEO
                1 -> C.TRACK_TYPE_AUDIO
                else -> C.TRACK_TYPE_TEXT
            }

            TrackList(
                entries = tracks.buildEntries(currentType),
                onSelect = { entry ->
                    when (entry) {
                        is TrackEntry.Auto -> {
                            player.trackSelectionParameters = player.trackSelectionParameters
                                .buildUpon()
                                .clearOverridesOfType(currentType)
                                .build()
                        }
                        is TrackEntry.Concrete -> {
                            player.trackSelectionParameters = player.trackSelectionParameters
                                .buildUpon()
                                .setOverrideForType(
                                    TrackSelectionOverride(
                                        entry.group.mediaTrackGroup,
                                        entry.trackIndex
                                    )
                                )
                                .build()
                        }
                    }
                    onDismiss()
                }
            )
        }
    }
}

@Composable
private fun SettingTab(
    index: Int,
    label: String,
    icon: ImageVector,
    selectedTab: Int,
    onClick: () -> Unit
) {
    Tab(
        selected = selectedTab == index,
        onClick = onClick,
        text = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(label, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal)
            }
        }
    )
}

@Composable
private fun TrackList(
    entries: List<TrackEntry>,
    onSelect: (TrackEntry) -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
        items(entries) { entry ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSelect(entry) }
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = entry.label,
                    color = Color.White,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f)
                )
                if (entry.isSelected) {
                    Icon(Icons.Default.Check, contentDescription = null, tint = BrandAccent)
                }
            }
        }
    }
}

private sealed class TrackEntry {
    abstract val label: String
    abstract val isSelected: Boolean
    abstract val key: String

    data class Auto(override val isSelected: Boolean) : TrackEntry() {
        override val label: String = "Auto"
        override val key: String = "auto"
    }

    @OptIn(UnstableApi::class)
    data class Concrete(
        val group: Tracks.Group,
        val trackIndex: Int,
        override val isSelected: Boolean,
        override val label: String,
        val type: Int
    ) : TrackEntry() {
        override val key: String =
            "$type-${group.mediaTrackGroup.id}-$trackIndex"
    }
}

/** Turn a [Tracks] object into a flat list of selectable entries for one type. */
@OptIn(UnstableApi::class)
private fun Tracks.buildEntries(type: Int): List<TrackEntry> {
    val concrete = groups
        .filter { it.type == type && it.isSupported }
        .flatMap { group ->
            (0 until group.length).mapNotNull { index ->
                if (!group.isTrackSupported(index)) return@mapNotNull null
                val format = group.getTrackFormat(index)
                TrackEntry.Concrete(
                    group = group,
                    trackIndex = index,
                    isSelected = group.isTrackSelected(index),
                    label = format.friendlyLabel(type),
                    type = type
                )
            }
        }

    return if (concrete.isEmpty()) emptyList() 
    else listOf(TrackEntry.Auto(concrete.none { it.isSelected })) + concrete
}

/**
 * Human-readable label for a format. Language for audio/subs, resolution for
 * video. Falls back to the codec / bitrate when language is absent.
 */
@OptIn(UnstableApi::class)
private fun Format.friendlyLabel(type: Int): String {
    return when (type) {
        C.TRACK_TYPE_VIDEO -> {
            val res = if (width > 0 && height > 0) "${height}p" else null
            val fps = if (frameRate > 0) "${frameRate.toInt()}fps" else null
            val parts = listOfNotNull(res, fps, sampleMimeType?.substringAfterLast('/'))
            if (parts.isEmpty()) "Track ${id ?: ""}" else parts.joinToString(" · ")
        }
        C.TRACK_TYPE_AUDIO -> {
            val lang = language?.takeIf { it.isNotBlank() && it != "und" }?.uppercase()
            val channels = when (channelCount) {
                1 -> "Mono"
                2 -> "Stereo"
                6 -> "5.1"
                else -> null
            }
            listOfNotNull(lang, channels, label).joinToString(" · ").ifBlank { "Audio Track" }
        }
        else -> {
            language?.uppercase()?.takeIf { it.isNotBlank() && it != "und" } ?: "Subtitle Track"
        }
    }
}
