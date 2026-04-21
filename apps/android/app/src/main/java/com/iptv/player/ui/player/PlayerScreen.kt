package com.iptv.player.ui.player

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.KeyEvent
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.iptv.player.data.model.EpgProgram
import com.iptv.player.ui.theme.BrandAccent
import kotlinx.coroutines.delay
import okhttp3.OkHttpClient
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

@OptIn(UnstableApi::class)
@ExperimentalSharedTransitionApi
@Composable
fun PlayerScreen(
    onBack: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    viewModel: PlayerViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val uiState by viewModel.uiState.collectAsState()

    var isPlaying by remember { mutableStateOf(true) }
    var showControls by remember { mutableStateOf(true) }
    var isBuffering by remember { mutableStateOf(true) }

    LaunchedEffect(showControls, uiState.isMiniEpgVisible) {
        if (showControls && !uiState.isMiniEpgVisible) {
            delay(5000)
            showControls = false
        }
    }

    DisposableEffect(Unit) {
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    BackHandler { 
        if (uiState.isMiniEpgVisible) viewModel.toggleMiniEpg() else onBack() 
    }

    val exoPlayer = remember {
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .build()
        
        val dataSourceFactory: DataSource.Factory = DefaultDataSource.Factory(
            context,
            OkHttpDataSource.Factory(okHttpClient)
                .setUserAgent(Util.getUserAgent(context, "IPTVPlayer"))
        )

        ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(context).setDataSourceFactory(dataSourceFactory))
            .build()
    }

    LaunchedEffect(uiState.currentChannel?.streamUrl) {
        val url = uiState.currentChannel?.streamUrl ?: return@LaunchedEffect
        isBuffering = true
        exoPlayer.stop()
        exoPlayer.setMediaItem(MediaItem.fromUri(url))
        exoPlayer.prepare()
        exoPlayer.playWhenReady = true
        showControls = true
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                isBuffering = state == Player.STATE_BUFFERING
            }
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
            override fun onPlayerError(error: PlaybackException) {
                viewModel.onPlayerError("Stream Error: ${error.errorCodeName}")
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onKeyEvent { keyEvent ->
                if (keyEvent.nativeKeyEvent.action == KeyEvent.ACTION_DOWN) {
                    when (keyEvent.nativeKeyEvent.keyCode) {
                        KeyEvent.KEYCODE_DPAD_UP -> { viewModel.zapPrevious(); true }
                        KeyEvent.KEYCODE_DPAD_DOWN -> { viewModel.zapNext(); true }
                        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> { showControls = true; true }
                        KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT -> {
                            if (showControls) viewModel.toggleMiniEpg()
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
                    layoutParams = FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            modifier = Modifier.fillMaxSize().clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) {
                showControls = !showControls
            }
        )

        if (isBuffering) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center).size(56.dp), color = BrandAccent)
        }

        AnimatedVisibility(
            visible = showControls,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            PlayerControlsOverlay(
                uiState = uiState,
                isPlaying = isPlaying,
                onPlayPause = { if (isPlaying) exoPlayer.pause() else exoPlayer.play() },
                onBack = onBack,
                onFavoriteToggle = { viewModel.toggleFavorite() },
                onZapNext = { viewModel.zapNext() },
                onZapPrev = { viewModel.zapPrevious() },
                onToggleEpg = { viewModel.toggleMiniEpg() },
                sharedTransitionScope = sharedTransitionScope,
                animatedVisibilityScope = animatedVisibilityScope
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

        uiState.playerError?.let { error ->
            ErrorOverlay(error = error, onRetry = { viewModel.clearError(); exoPlayer.prepare() }, onBack = onBack)
        }
    }
}

@ExperimentalSharedTransitionApi
@Composable
fun PlayerControlsOverlay(
    uiState: PlayerUiState,
    isPlaying: Boolean,
    onPlayPause: () -> Unit,
    onBack: () -> Unit,
    onFavoriteToggle: () -> Unit,
    onZapNext: () -> Unit,
    onZapPrev: () -> Unit,
    onToggleEpg: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color.Black.copy(alpha = 0.6f), Color.Transparent, Color.Black.copy(alpha = 0.8f))
                )
            )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(24.dp).align(Alignment.TopStart),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack, modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.1f))) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, tint = Color.White)
            }
            Spacer(modifier = Modifier.width(16.dp))
            
            with(sharedTransitionScope) {
                AsyncImage(
                    model = uiState.currentChannel?.logoUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .sharedElement(
                            rememberSharedContentState(key = "logo-${uiState.currentChannel?.streamUrl}"),
                            animatedVisibilityScope = animatedVisibilityScope
                        ),
                    contentScale = ContentScale.Fit
                )
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = uiState.currentChannel?.name ?: "Unknown",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = uiState.currentChannel?.groupTitle ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandAccent
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            IconButton(onClick = onFavoriteToggle) {
                Icon(
                    imageVector = if (uiState.isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    contentDescription = null,
                    tint = if (uiState.isFavorite) BrandAccent else Color.White
                )
            }
        }

        Row(
            modifier = Modifier.align(Alignment.Center),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(48.dp)
        ) {
            IconButton(onClick = onZapPrev, modifier = Modifier.size(56.dp)) {
                Icon(Icons.Default.SkipPrevious, null, tint = Color.White, modifier = Modifier.size(40.dp))
            }
            IconButton(
                onClick = onPlayPause,
                modifier = Modifier.size(80.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f))
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(48.dp)
                )
            }
            IconButton(onClick = onZapNext, modifier = Modifier.size(56.dp)) {
                Icon(Icons.Default.SkipNext, null, tint = Color.White, modifier = Modifier.size(40.dp))
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(24.dp).align(Alignment.BottomStart),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "LIVE",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    modifier = Modifier.background(BrandAccent, RoundedCornerShape(2.dp)).padding(horizontal = 4.dp)
                )
                Spacer(modifier = Modifier.height(4.dp))
                val currentProgram = uiState.currentPrograms.find { 
                    val now = System.currentTimeMillis()
                    it.startTime <= now && it.endTime >= now
                }
                Text(
                    text = currentProgram?.title ?: "No Information Available",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            
            Button(
                onClick = onToggleEpg,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.FormatListBulleted, null, tint = Color.White)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Mini Guide", color = Color.White)
            }
        }
    }
}

@Composable
fun MiniEpgOverlay(programs: List<EpgProgram>) {
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .background(Color.Black.copy(alpha = 0.9f))
            .padding(vertical = 16.dp)
    ) {
        Column {
            Text(
                text = "UPCOMING PROGRAMS",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.5f),
                modifier = Modifier.padding(start = 24.dp, end = 24.dp, bottom = 12.dp)
            )
            
            LazyRow(
                contentPadding = PaddingValues(horizontal = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(programs) { program ->
                    Card(
                        modifier = Modifier.width(220.dp).fillMaxHeight(),
                        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.1f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(
                                text = "${timeFormat.format(Date(program.startTime))} - ${timeFormat.format(Date(program.endTime))}",
                                style = MaterialTheme.typography.labelSmall,
                                color = BrandAccent
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = program.title,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = program.description,
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.6f),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ErrorOverlay(error: String, onRetry: () -> Unit, onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.9f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(Icons.Default.ErrorOutline, null, tint = BrandAccent, modifier = Modifier.size(64.dp))
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = error,
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedButton(onClick = onBack, border = ButtonDefaults.outlinedButtonBorder.copy(width = 1.dp)) {
                    Text("Go Back", color = Color.White)
                }
                Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = BrandAccent)) {
                    Text("Retry", color = Color.Black)
                }
            }
        }
    }
}
