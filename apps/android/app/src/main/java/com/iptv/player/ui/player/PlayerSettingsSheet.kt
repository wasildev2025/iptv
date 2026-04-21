package com.iptv.player.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ClosedCaption
import androidx.compose.material.icons.filled.HighQuality
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import com.iptv.player.ui.theme.BrandAccent
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkElevated

/**
 * Netflix-style bottom sheet for picking audio track / subtitle track / video
 * quality. Reads current selections from [Player.getCurrentTracks] and writes
 * back via [Player.setTrackSelectionParameters].
 *
 * The sheet uses real Media3 track-selection overrides, not a custom state
 * layer — so the choices stick through pause/resume and carry into the next
 * media item of the same type.
 */
@OptIn(ExperimentalMaterial3Api::class, UnstableApi::class)
@Composable
fun PlayerSettingsSheet(
    player: Player,
    onDismiss: () -> Unit,
    sheetState: SheetState = rememberModalBottomSheetState()
) {
    // Observe track changes via a listener to ensure the UI updates when tracks are changed
    var tracks by remember { mutableStateOf(player.currentTracks) }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onTracksChanged(t: Tracks) {
                tracks = t
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceDark,
        dragHandle = null
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp)
        ) {
            Text(
                "Settings",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            TrackSection(
                title = "Audio",
                icon = { Icon(Icons.Default.VolumeUp, null, tint = BrandAccent) },
                entries = tracks.buildEntries(C.TRACK_TYPE_AUDIO),
                allowOff = false,
                onChoose = { entry -> player.applySelection(entry) }
            )

            Spacer(Modifier.height(16.dp))

            TrackSection(
                title = "Subtitles",
                icon = { Icon(Icons.Default.ClosedCaption, null, tint = BrandAccent) },
                entries = tracks.buildEntries(C.TRACK_TYPE_TEXT),
                allowOff = true,
                onChoose = { entry -> player.applySelection(entry) }
            )

            Spacer(Modifier.height(16.dp))

            TrackSection(
                title = "Quality",
                icon = { Icon(Icons.Default.HighQuality, null, tint = BrandAccent) },
                entries = tracks.buildEntries(C.TRACK_TYPE_VIDEO),
                allowOff = false,
                onChoose = { entry -> player.applySelection(entry) }
            )

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun TrackSection(
    title: String,
    icon: @Composable () -> Unit,
    entries: List<TrackEntry>,
    allowOff: Boolean,
    onChoose: (TrackEntry) -> Unit
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        icon()
        Spacer(Modifier.size(8.dp))
        Text(
            title,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.titleMedium
        )
    }
    Spacer(Modifier.height(8.dp))

    if (entries.isEmpty()) {
        Text(
            "No $title options available for this stream.",
            color = Color.White.copy(alpha = 0.55f),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(start = 32.dp, top = 4.dp, bottom = 4.dp)
        )
        return
    }

    val fullList = buildList {
        if (allowOff) add(TrackEntry.Off(isSelected = entries.none { it.isSelected }))
        addAll(entries)
    }

    // Cap the visible rows to keep the sheet reasonable; user can scroll.
    LazyColumn(
        modifier = Modifier.heightIn(max = 220.dp)
    ) {
        items(fullList, key = { it.key }) { entry ->
            TrackRow(entry = entry, onClick = { onChoose(entry) })
        }
    }
}

@Composable
private fun TrackRow(entry: TrackEntry, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = entry.label,
            color = if (entry.isSelected) BrandAccent else Color.White,
            fontWeight = if (entry.isSelected) FontWeight.SemiBold else FontWeight.Normal,
            style = MaterialTheme.typography.bodyLarge
        )
        if (entry.isSelected) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(BrandAccent),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Check,
                    null,
                    tint = Color.White,
                    modifier = Modifier.size(14.dp)
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(SurfaceDarkElevated)
            )
        }
    }
}

// ----------------------------------------------------------------------------
// Track-entry model + Media3 bridge
// ----------------------------------------------------------------------------

private sealed class TrackEntry {
    abstract val label: String
    abstract val isSelected: Boolean
    abstract val key: String

    data class Off(override val isSelected: Boolean) : TrackEntry() {
        override val label: String = "Off"
        override val key: String = "off"
    }

    data class Concrete(
        val group: Tracks.Group,
        val trackIndex: Int,
        override val isSelected: Boolean,
        override val label: String,
        val type: @androidx.media3.common.C.TrackType Int
    ) : TrackEntry() {
        override val key: String =
            "$type-${group.mediaTrackGroup.id}-$trackIndex"
    }
}

/** Turn a [Tracks] object into a flat list of selectable entries for one type. */
@OptIn(UnstableApi::class)
private fun Tracks.buildEntries(@androidx.media3.common.C.TrackType type: Int): List<TrackEntry> {
    return groups
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
}

/**
 * Human-readable label for a format. Language for audio/subs, resolution for
 * video. Falls back to the codec / bitrate when language is absent.
 */
private fun Format.friendlyLabel(@androidx.media3.common.C.TrackType type: Int): String {
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
                8 -> "7.1"
                in 3..Int.MAX_VALUE -> "$channelCount ch"
                else -> null
            }
            val codec = sampleMimeType?.substringAfterLast('/')?.uppercase()
            listOfNotNull(lang ?: label ?: "Audio", channels, codec).joinToString(" · ")
        }
        C.TRACK_TYPE_TEXT -> {
            val lang = language?.takeIf { it.isNotBlank() && it != "und" }?.uppercase()
            lang ?: label ?: "Subtitles"
        }
        else -> label ?: "Track"
    }
}

@OptIn(UnstableApi::class)
private fun Player.applySelection(entry: TrackEntry) {
    val newParams = trackSelectionParameters.buildUpon().apply {
        when (entry) {
            is TrackEntry.Off -> setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            is TrackEntry.Concrete -> {
                setTrackTypeDisabled(entry.type, false)
                setOverrideForType(
                    TrackSelectionOverride(
                        entry.group.mediaTrackGroup,
                        listOf(entry.trackIndex)
                    )
                )
            }
        }
    }.build()
    trackSelectionParameters = newParams
}
