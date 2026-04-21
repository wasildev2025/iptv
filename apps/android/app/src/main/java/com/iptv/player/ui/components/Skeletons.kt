package com.iptv.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.iptv.player.ui.theme.SurfaceDarkVariant

@Composable
fun ChannelCardSkeleton(
    modifier: Modifier = Modifier,
    aspectRatio: Float = 16f / 9f
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(aspectRatio)
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDarkVariant)
            .shimmerEffect()
    )
}

@Composable
fun HeroSectionSkeleton() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(300.dp)
            .background(SurfaceDarkVariant)
            .shimmerEffect()
    ) {
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(24.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(width = 80.dp, height = 16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(SurfaceDarkVariant)
                    .shimmerEffect()
            )
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .size(width = 200.dp, height = 32.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(SurfaceDarkVariant)
                    .shimmerEffect()
            )
            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .size(width = 120.dp, height = 20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(SurfaceDarkVariant)
                    .shimmerEffect()
            )
        }
    }
}

@Composable
fun EpgRowSkeleton() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(70.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Channel column skeleton
        Box(
            modifier = Modifier
                .width(120.dp)
                .fillMaxHeight()
                .padding(8.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(SurfaceDarkVariant)
                .shimmerEffect()
        )
        
        // Programs skeleton
        Row(
            modifier = Modifier.weight(1f).padding(horizontal = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(3) {
                Box(
                    modifier = Modifier
                        .width(200.dp)
                        .fillMaxHeight()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SurfaceDarkVariant)
                        .shimmerEffect()
                )
            }
        }
    }
}
