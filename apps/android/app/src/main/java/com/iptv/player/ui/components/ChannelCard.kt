package com.iptv.player.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import coil.compose.AsyncImage
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.size.Precision
import com.iptv.player.ui.theme.BrandAccent
import com.iptv.player.ui.theme.BrandNavyDeep

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChannelCard(
    name: String,
    groupTitle: String,
    logoUrl: String,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
    onFavoriteClick: () -> Unit = {},
    modifier: Modifier = Modifier,
    aspectRatio: Float = 16f / 9f
) {
    var isFocused by remember { mutableStateOf(false) }
    
    // Smooth scaling for TV-style focus
    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.08f else 1.0f,
        animationSpec = tween(durationMillis = 200),
        label = "scale"
    )
    
    val elevation by animateFloatAsState(
        targetValue = if (isFocused) 20f else 0f,
        animationSpec = tween(durationMillis = 200),
        label = "elevation"
    )

    val borderColor by animateColorAsState(
        targetValue = if (isFocused) BrandAccent.copy(alpha = 0.8f) else Color.Transparent,
        animationSpec = tween(durationMillis = 200),
        label = "borderColor"
    )

    Surface(
        modifier = modifier
            .zIndex(if (isFocused) 10f else 1f)
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                shadowElevation = elevation
            }
            .onFocusChanged { isFocused = it.isFocused }
            .clip(RoundedCornerShape(12.dp))
            .border(
                width = 2.dp,
                color = borderColor,
                shape = RoundedCornerShape(12.dp)
            )
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        color = BrandNavyDeep
    ) {
        Box(modifier = Modifier.aspectRatio(aspectRatio)) {
            // High-quality Image loading with size optimization
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(logoUrl.takeIf { it.isNotBlank() })
                    .crossfade(true)
                    .diskCachePolicy(CachePolicy.ENABLED)
                    .memoryCachePolicy(CachePolicy.ENABLED)
                    .size(400, 225) // Downsample to card size
                    .precision(Precision.EXACT)
                    .placeholder(null)
                    .error(null)
                    .build(),
                contentDescription = name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                alpha = if (isFocused) 1f else 0.85f
            )

            // Cinematic Gradient Overlay (Darker at bottom)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.2f),
                                Color.Black.copy(alpha = 0.9f)
                            ),
                            startY = 0f
                        )
                    )
            )

            // Content Overlay
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(12.dp)
            ) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontSize = 14.sp,
                        letterSpacing = 0.5.sp
                    ),
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                if (groupTitle.isNotBlank()) {
                    Text(
                        text = groupTitle.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontSize = 10.sp,
                            letterSpacing = 1.sp
                        ),
                        color = BrandAccent,
                        fontWeight = FontWeight.ExtraBold,
                        maxLines = 1
                    )
                }
            }

            // Minimalist Favorite Badge
            if (isFavorite) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .size(6.dp)
                        .background(BrandAccent, CircleShape)
                )
            }
            
            // Focus Glow effect
            if (isFocused) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .border(1.dp, BrandAccent.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                )
            }
        }
    }
}
