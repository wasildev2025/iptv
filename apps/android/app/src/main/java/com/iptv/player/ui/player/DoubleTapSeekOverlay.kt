package com.iptv.player.ui.player

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.RotateLeft
import androidx.compose.material.icons.automirrored.filled.RotateRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val SEEK_STEP_MS = 10_000L
private const val RIPPLE_DURATION_MS = 600
private const val BADGE_AUTO_HIDE_MS = 700L

/**
 * Full-screen transparent overlay that turns double-taps on the left half into
 * −10s seeks and on the right half into +10s seeks. Each tap spawns an
 * expanding ripple ring at the tap point plus a "−10s"/"+10s" badge.
 *
 * Single taps are forwarded to [onSingleTap] so the caller (player screen) can
 * keep its "tap to toggle controls" behaviour.
 */
@OptIn(UnstableApi::class)
@Composable
fun DoubleTapSeekOverlay(
    player: Player,
    onSingleTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    var size by remember { mutableStateOf(IntSize.Zero) }
    val ripples = remember { mutableStateListOf<Ripple>() }
    var forwardBadgeVisible by remember { mutableStateOf(false) }
    var backwardBadgeVisible by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Box(
        modifier = modifier
            .fillMaxSize()
            .onSizeChanged { size = it }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onSingleTap() },
                    onDoubleTap = { offset ->
                        val isLeft = offset.x < size.width / 2f
                        if (isLeft) {
                            player.seekBack(SEEK_STEP_MS)
                            backwardBadgeVisible = true
                        } else {
                            player.seekForward(SEEK_STEP_MS)
                            forwardBadgeVisible = true
                        }
                        scope.launch {
                            val ripple = Ripple(center = offset)
                            ripples += ripple
                            ripple.run()
                            ripples -= ripple
                        }
                        scope.launch {
                            delay(BADGE_AUTO_HIDE_MS)
                            if (isLeft) backwardBadgeVisible = false
                            else forwardBadgeVisible = false
                        }
                    }
                )
            }
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            ripples.forEach { ripple ->
                val radius = ripple.radius.value
                val alpha = ripple.alpha.value
                drawCircle(
                    color = Color.White.copy(alpha = alpha * 0.6f),
                    radius = radius,
                    center = ripple.center,
                    style = Stroke(width = 3.dp.toPx())
                )
                drawCircle(
                    color = Color.White.copy(alpha = alpha * 0.15f),
                    radius = radius,
                    center = ripple.center
                )
            }
        }

        SeekBadge(
            visible = backwardBadgeVisible,
            icon = Icons.AutoMirrored.Filled.RotateLeft,
            label = "-10s",
            modifier = Modifier.align(Alignment.CenterStart)
        )
        SeekBadge(
            visible = forwardBadgeVisible,
            icon = Icons.AutoMirrored.Filled.RotateRight,
            label = "+10s",
            modifier = Modifier.align(Alignment.CenterEnd)
        )
    }
}

@Composable
private fun SeekBadge(
    visible: Boolean,
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(80)),
        exit = fadeOut(animationSpec = tween(220)),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(Color.Black.copy(alpha = 0.55f))
                .size(92.dp, 92.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(28.dp)
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = label,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

/** Per-tap expanding ring with fade-out. Animatable state is observed by Canvas. */
private class Ripple(val center: Offset) {
    val radius = Animatable(40f)
    val alpha = Animatable(1f)

    suspend fun run() = coroutineScope {
        launch {
            radius.animateTo(
                targetValue = 320f,
                animationSpec = tween(RIPPLE_DURATION_MS)
            )
        }
        launch {
            alpha.animateTo(
                targetValue = 0f,
                animationSpec = tween(RIPPLE_DURATION_MS)
            )
        }
    }
}
