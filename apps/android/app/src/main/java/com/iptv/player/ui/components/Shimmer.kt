package com.iptv.player.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import com.iptv.player.ui.theme.BrandNavyDeep
import com.iptv.player.ui.theme.SurfaceDarkElevated

fun Modifier.shimmerEffect(): Modifier = composed {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1200, // Slightly slower, more premium feel
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslation"
    )

    // Using the premium brand palette for shimmers
    val shimmerColors = listOf(
        BrandNavyDeep,
        SurfaceDarkElevated,
        BrandNavyDeep,
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset.Zero,
        end = Offset(x = translateAnim.value, y = translateAnim.value)
    )

    return@composed this.background(brush)
}
