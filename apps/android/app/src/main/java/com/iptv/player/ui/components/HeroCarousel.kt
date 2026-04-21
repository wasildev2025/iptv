package com.iptv.player.ui.components

import androidx.compose.animation.AnimatedVisibilityScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionScope
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.ui.theme.BrandAccent
import com.iptv.player.ui.theme.BrandBackground
import com.iptv.player.ui.theme.BrandNavyDeep
import com.iptv.player.ui.theme.BrandTextPrimary
import com.iptv.player.ui.theme.BrandTextSecondary
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private const val HERO_HEIGHT_DP = 340
private const val AUTO_ADVANCE_MS = 7_000L
private const val KEN_BURNS_DURATION_MS = 12_000
private const val PAGE_CHANGE_ANIM_MS = 900

/**
 * Auto-rotating featured carousel. Each page applies a slow Ken-Burns-style
 * pan + zoom to its backdrop; the whole carousel optionally parallaxes with a
 * parent scroll offset so the hero "lingers" as the feed scrolls up.
 *
 * - Auto-advance every 7s (pauses 7s after any user interaction).
 * - Scale 1.00 → 1.10 and slight X/Y pan over 12s, reversing — classic
 *   "still image that feels alive" pattern.
 * - Page indicator dots pinned to the lower-right, above the CTA row.
 *
 * @param parallaxOffsetPx Positive pixels of parent-list scroll. The backdrop
 *   translates by half this value, so the hero image lags the surrounding feed
 *   for the cinematic lingering effect. Pass `{ 0f }` for no parallax.
 */
@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun HeroCarousel(
    channels: List<M3UChannel>,
    onChannelClick: (M3UChannel) -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    parallaxOffsetPx: () -> Float = { 0f },
    modifier: Modifier = Modifier
) {
    if (channels.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { channels.size })

    // Auto-advance. The effect is keyed on `currentPage` so any user swipe /
    // programmatic change resets the countdown — no jank of advancing 500ms
    // after the user just swiped.
    LaunchedEffect(pagerState.currentPage, channels.size) {
        if (channels.size <= 1) return@LaunchedEffect
        while (isActive) {
            delay(AUTO_ADVANCE_MS)
            val next = (pagerState.currentPage + 1) % channels.size
            pagerState.animateScrollToPage(
                page = next,
                animationSpec = tween(PAGE_CHANGE_ANIM_MS)
            )
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(HERO_HEIGHT_DP.dp)
            .background(BrandNavyDeep)
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            HeroPage(
                channel = channels[page],
                isActive = page == pagerState.currentPage,
                onClick = { onChannelClick(channels[page]) },
                sharedTransitionScope = sharedTransitionScope,
                animatedVisibilityScope = animatedVisibilityScope,
                parallaxOffsetPx = parallaxOffsetPx
            )
        }

        // Bottom gradient: softens the transition into the feed background and
        // also provides the dark surface for the pill + headline + CTA text.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, BrandBackground),
                        startY = HERO_HEIGHT_DP * 1.8f
                    )
                )
        )

        if (channels.size > 1) {
            PageIndicator(
                count = channels.size,
                current = pagerState.currentPage,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 24.dp, bottom = 24.dp)
            )
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
private fun HeroPage(
    channel: M3UChannel,
    isActive: Boolean,
    onClick: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    parallaxOffsetPx: () -> Float
) {
    // Ken Burns: infinite transition that slowly zooms + pans the backdrop.
    // We animate even when the page isn't visible — it's cheap (one float) and
    // avoids a visible "jump" when the page becomes active.
    val kenBurns = rememberInfiniteTransition(label = "ken-burns-$isActive")
    val scale by kenBurns.animateFloat(
        initialValue = 1.00f,
        targetValue = 1.10f,
        animationSpec = infiniteRepeatable(
            animation = tween(KEN_BURNS_DURATION_MS, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )
    val panX by kenBurns.animateFloat(
        initialValue = -18f,
        targetValue = 18f,
        animationSpec = infiniteRepeatable(
            animation = tween(KEN_BURNS_DURATION_MS, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "panX"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BrandNavyDeep)
            .clickable(onClick = onClick)
    ) {
        with(sharedTransitionScope) {
            ChannelLogo(
                logoUrl = channel.logoUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = 0.70f,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        // Parallax: the image lingers as parent scrolls up.
                        translationY = parallaxOffsetPx() * 0.5f
                        // Ken Burns (only while the page is the active one —
                        // keeps inactive pages calm so the active one reads as
                        // the focal point).
                        if (isActive) {
                            scaleX = scale
                            scaleY = scale
                            translationX = panX
                        }
                    }
                    .sharedElement(
                        rememberSharedContentState(key = "logo-${channel.streamUrl}"),
                        animatedVisibilityScope = animatedVisibilityScope
                    )
            )
        }

        // Left-to-right dark gradient to ensure text always reads cleanly,
        // regardless of the underlying backdrop image.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            BrandBackground.copy(alpha = 0.85f),
                            BrandBackground.copy(alpha = 0.45f),
                            Color.Transparent
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 24.dp, end = 24.dp, bottom = 28.dp)
        ) {
            Surface(
                color = BrandAccent,
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = "FEATURED",
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(
                text = channel.name,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = BrandTextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            if (channel.groupTitle.isNotBlank()) {
                Text(
                    text = channel.groupTitle.uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = BrandTextSecondary
                )
            }
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = onClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White,
                    contentColor = Color.Black
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("Watch Now", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun PageIndicator(
    count: Int,
    current: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(count) { index ->
            val isActive = index == current
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(
                        if (isActive) BrandAccent
                        else Color.White.copy(alpha = 0.35f)
                    )
                    .size(
                        width = if (isActive) 18.dp else 6.dp,
                        height = 6.dp
                    )
            )
        }
    }
}
