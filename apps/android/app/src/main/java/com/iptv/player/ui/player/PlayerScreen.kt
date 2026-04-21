package com.iptv.player.ui.player

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.FormatListBulleted
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory
import androidx.media3.ui.PlayerView
import com.iptv.player.ui.theme.BrandAccent
import com.iptv.player.ui.theme.BrandNavyDeep
import com.iptv.player.ui.theme.BrandTextPrimary
import com.iptv.player.ui.theme.BrandTextSecondary
import kotlinx.coroutines.delay
import okhttp3.OkHttpClient

@OptIn(UnstableApi::class, ExperimentalMaterial3Api::class, ExperimentalSharedTransitionApi::class)
@Composable
fun PlayerScreen(
    streamUrl: String,
    channelName: String,
    groupTitle: String,
    logoUrl: String,
    onBack: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    viewModel: PlayerViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    var showControls by remember { mutableStateOf(true) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var isPlaying by remember { mutableStateOf(false) }

    val exoPlayer = remember {
        val okHttpClient = OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
            
        val dataSourceFactory: DataSource.Factory = DefaultDataSource.Factory(
            context,
            OkHttpDataSource.Factory(okHttpClient)
                .setUserAgent(Util.getUserAgent(context, "IPTVPlayer"))
        )

        val extractorsFactory = DefaultExtractorsFactory()
            .setTsExtractorFlags(
                DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES or 
                DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS
            )
            .setConstantBitrateSeekingEnabled(true)
        
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(
                DefaultMediaSourceFactory(context, extractorsFactory)
                    .setDataSourceFactory(dataSourceFactory)
            )
            .build()
            .apply {
                playWhenReady = true
                addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(playing: Boolean) {
                        isPlaying = playing
                    }
                    
                    override fun onPlayerError(error: PlaybackException) {
                        // Error handling could be added here
                    }
                })
            }
    }

    DisposableEffect(streamUrl) {
        val mimeType = when {
            streamUrl.contains("m3u8", ignoreCase = true) -> MimeTypes.APPLICATION_M3U8
            streamUrl.contains("mpd", ignoreCase = true) -> MimeTypes.APPLICATION_MPD
            streamUrl.contains("ism", ignoreCase = true) -> MimeTypes.APPLICATION_SS
            streamUrl.contains("output=m3u8", ignoreCase = true) -> MimeTypes.APPLICATION_M3U8
            else -> null
        }

        val mediaItem = MediaItem.Builder()
            .setUri(streamUrl)
            .apply {
                if (mimeType != null) {
                    setMimeType(mimeType)
                }
            }
            .build()

        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()

        onDispose {
            exoPlayer.release()
        }
    }

    // Auto-hide controls
    LaunchedEffect(showControls, isPlaying) {
        if (showControls && isPlaying) {
            delay(5000)
            showControls = false
        }
    }

    // Lock to landscape
    DisposableEffect(Unit) {
        val activity = context as? Activity
        val originalOrientation = activity?.requestedOrientation
        val window = activity?.window
        val insetsController = window?.let { WindowCompat.getInsetsController(it, it.decorView) }
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        if (window != null && insetsController != null) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            insetsController.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            insetsController.hide(WindowInsetsCompat.Type.systemBars())
        }
        onDispose {
            if (window != null && insetsController != null) {
                insetsController.show(WindowInsetsCompat.Type.systemBars())
                WindowCompat.setDecorFitsSystemWindows(window, true)
            }
            activity?.requestedOrientation = originalOrientation ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    BackHandler {
        if (uiState.isMiniEpgVisible) {
            viewModel.toggleMiniEpg()
        } else {
            onBack()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onKeyEvent { keyEvent ->
                if (keyEvent.nativeKeyEvent.action == KeyEvent.ACTION_DOWN) {
                    showControls = true
                    when (keyEvent.nativeKeyEvent.keyCode) {
                        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                            if (isPlaying) exoPlayer.pause() else exoPlayer.play()
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_UP -> {
                            viewModel.toggleMiniEpg()
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_DOWN -> {
                            showSettingsSheet = true
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_LEFT -> {
                            viewModel.zapPrevious()
                            true
                        }
                        KeyEvent.KEYCODE_DPAD_RIGHT -> {
                            viewModel.zapNext()
                            true
                        }
                        else -> false
                    }
                } else false
            }
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = exoPlayer
                    useController = false
                    // Media3 workaround for SurfaceView/Compose synchronization.
                    // This reduces rendering glitches and out-of-order buffer
                    // warnings on some devices when PlayerView lives inside an
                    // AndroidView composable.
                    setEnableComposeSurfaceSyncWorkaround(true)
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        DoubleTapSeekOverlay(
            player = exoPlayer,
            onSingleTap = { showControls = !showControls }
        )

        AnimatedVisibility(
            visible = showControls,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            PlayerControlsOverlay(
                player = exoPlayer,
                uiState = uiState,
                isPlaying = isPlaying,
                onPlayPause = { if (isPlaying) exoPlayer.pause() else exoPlayer.play() },
                onBack = onBack,
                onFavoriteToggle = { viewModel.toggleFavorite() },
                onZapNext = { viewModel.zapNext() },
                onZapPrev = { viewModel.zapPrevious() },
                onToggleEpg = { viewModel.toggleMiniEpg() },
                onOpenSettings = { showSettingsSheet = true },
                sharedTransitionScope = sharedTransitionScope,
                animatedVisibilityScope = animatedVisibilityScope
            )
        }

        if (showSettingsSheet) {
            PlayerSettingsSheet(
                player = exoPlayer,
                onDismiss = { showSettingsSheet = false }
            )
        }

        AnimatedVisibility(
            visible = uiState.isMiniEpgVisible,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it }),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            MiniEpgOverlay(programs = uiState.currentPrograms)
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
private fun PlayerControlsOverlay(
    player: Player,
    uiState: PlayerUiState,
    isPlaying: Boolean,
    onPlayPause: () -> Unit,
    onBack: () -> Unit,
    onFavoriteToggle: () -> Unit,
    onZapNext: () -> Unit,
    onZapPrev: () -> Unit,
    onToggleEpg: () -> Unit,
    onOpenSettings: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.6f),
                        Color.Transparent,
                        Color.Black.copy(alpha = 0.6f)
                    )
                )
            )
            .padding(24.dp)
    ) {
        // Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Color.White)
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = uiState.currentChannel?.name ?: "",
                    style = MaterialTheme.typography.titleLarge,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = uiState.currentChannel?.groupTitle ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.7f)
                )
            }

            IconButton(onClick = onFavoriteToggle) {
                Icon(
                    if (uiState.isFavorite) Icons.Default.Favorite else Icons.Outlined.FavoriteBorder,
                    contentDescription = "Favorite",
                    tint = if (uiState.isFavorite) BrandAccent else Color.White
                )
            }
            
            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Default.Settings, "Settings", tint = Color.White)
            }
        }

        // Center Controls
        Row(
            modifier = Modifier.align(Alignment.Center),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            IconButton(
                onClick = onZapPrev,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(Icons.Default.SkipPrevious, "Previous", tint = Color.White, modifier = Modifier.size(32.dp))
            }

            Surface(
                onClick = onPlayPause,
                shape = CircleShape,
                color = BrandAccent,
                modifier = Modifier.size(72.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = BrandNavyDeep,
                        modifier = Modifier.size(40.dp)
                    )
                }
            }

            IconButton(
                onClick = onZapNext,
                modifier = Modifier.size(48.dp)
            ) {
                Icon(Icons.Default.SkipNext, "Next", tint = Color.White, modifier = Modifier.size(32.dp))
            }
        }

        // Bottom Info
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onToggleEpg) {
                        Icon(Icons.AutoMirrored.Filled.FormatListBulleted, "EPG", tint = Color.White)
                    }
                    Text("Channel Guide", color = Color.White, style = MaterialTheme.typography.labelLarge)
                }
                
                Text(
                    text = "LIVE",
                    color = BrandAccent,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .background(BrandAccent.copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
        }
    }
}

@Composable
private fun MiniEpgOverlay(programs: List<com.iptv.player.data.model.EpgProgram>) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp),
        color = BrandNavyDeep.copy(alpha = 0.95f),
        shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "Up Next",
                style = MaterialTheme.typography.titleMedium,
                color = BrandAccent,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                items(programs) { program ->
                    MiniEpgItem(program)
                }
            }
        }
    }
}

@Composable
private fun MiniEpgItem(program: com.iptv.player.data.model.EpgProgram) {
    Column(modifier = Modifier.width(200.dp)) {
        Text(
            program.title,
            style = MaterialTheme.typography.bodyLarge,
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            "${program.startTime} - ${program.endTime}",
            style = MaterialTheme.typography.bodySmall,
            color = Color.White.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { 0.3f }, // Dummy progress
            modifier = Modifier.fillMaxWidth(),
            color = BrandAccent,
            trackColor = Color.White.copy(alpha = 0.1f)
        )
    }
}
