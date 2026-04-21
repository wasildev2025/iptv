package com.iptv.player.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import com.iptv.player.ui.theme.BrandAccent
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

/**
 * VOD scrub bar. Polls the player for position/duration while visible and
 * reflects drag-to-seek with a thumb preview. On live streams (duration ==
 * TIME_UNSET) this composable returns `false` via the caller pattern —
 * caller should check [isSeekable] first and render the LIVE pill instead.
 *
 * Interaction model:
 *  - While not dragging, slider value tracks `player.currentPosition` once per
 *    200ms.
 *  - While dragging, we stop syncing from the player and just drive the value
 *    locally so the thumb doesn't stutter.
 *  - On release, single `seekTo()` call with the final value.
 */
@OptIn(UnstableApi::class)
@Composable
fun PlayerProgressBar(
    player: Player,
    modifier: Modifier = Modifier
) {
    var duration by remember { mutableStateOf(0L) }
    var currentPosition by remember { mutableStateOf(0L) }
    var isDragging by remember { mutableStateOf(false) }
    var dragPosition by remember { mutableStateOf(0f) }

    LaunchedEffect(player) {
        while (isActive) {
            val d = player.duration
            duration = if (d == C.TIME_UNSET) 0L else d
            if (!isDragging) {
                currentPosition = player.currentPosition.coerceAtLeast(0L)
            }
            delay(200)
        }
    }

    val displayPosition = if (isDragging) dragPosition.toLong() else currentPosition
    val safeDuration = duration.coerceAtLeast(1L)

    Column(modifier = modifier.fillMaxWidth()) {
        Slider(
            value = displayPosition.toFloat(),
            onValueChange = { value ->
                isDragging = true
                dragPosition = value
            },
            onValueChangeFinished = {
                player.seekTo(dragPosition.toLong())
                currentPosition = dragPosition.toLong()
                isDragging = false
            },
            valueRange = 0f..safeDuration.toFloat(),
            colors = SliderDefaults.colors(
                thumbColor = BrandAccent,
                activeTrackColor = BrandAccent,
                inactiveTrackColor = Color.White.copy(alpha = 0.25f)
            ),
            modifier = Modifier.fillMaxWidth()
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            TimeLabel(displayPosition)
            TimeLabel(duration)
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun TimeLabel(millis: Long) {
    Text(
        text = formatHms(millis),
        color = Color.White,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        style = MaterialTheme.typography.labelMedium
    )
}

/** Check from the caller: if false, render the LIVE pill instead of the scrub bar. */
@OptIn(UnstableApi::class)
fun isSeekable(player: Player): Boolean {
    val d = player.duration
    return d != C.TIME_UNSET && d > 0L
}

private fun formatHms(millis: Long): String {
    if (millis <= 0) return "0:00"
    val totalSeconds = millis / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
    } else {
        "%d:%02d".format(minutes, seconds)
    }
}
