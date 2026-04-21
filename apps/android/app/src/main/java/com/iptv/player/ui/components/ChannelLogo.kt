package com.iptv.player.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import coil.compose.AsyncImage
import coil.request.ImageRequest
import androidx.compose.ui.platform.LocalContext

/**
 * Channel logo renderer. Handles the common case where an M3U entry has no
 * `tvg-logo` attribute (either omitted by the server or the playlist is a
 * plain `type=m3u` export) without spamming Coil's `NullRequestDataException`
 * into the log.
 */
@Composable
fun ChannelLogo(
    logoUrl: String?,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    contentScale: ContentScale = ContentScale.Fit,
    alpha: Float = 1f
) {
    var loadFailed by remember(logoUrl) { mutableStateOf(false) }
    val hasLogo = !logoUrl.isNullOrBlank() && !loadFailed
    if (hasLogo) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(logoUrl)
                .crossfade(true)
                .listener(
                    onError = { _, _ -> loadFailed = true }
                )
                .build(),
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = contentScale,
            alpha = alpha
        )
    } else {
        val fallbackLabel = remember(contentDescription) {
            contentDescription
                ?.split(" ")
                ?.filter { it.isNotBlank() }
                ?.take(2)
                ?.joinToString("") { part -> part.take(1).uppercase() }
                ?.ifBlank { null }
        }
        Box(
            modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            if (fallbackLabel != null) {
                Text(
                    text = fallbackLabel,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f * alpha),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
            } else {
                Icon(
                    imageVector = Icons.Default.LiveTv,
                    contentDescription = contentDescription,
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f * alpha)
                )
            }
        }
    }
}
