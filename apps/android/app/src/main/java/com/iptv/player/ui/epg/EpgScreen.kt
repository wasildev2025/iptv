package com.iptv.player.ui.epg

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.iptv.player.data.model.CachedChannel
import com.iptv.player.data.model.EpgProgram
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkElevated
import com.iptv.player.ui.theme.SurfaceDarkVariant
import java.text.SimpleDateFormat
import java.util.*

private val HOUR_WIDTH = 240.dp
private val CHANNEL_COLUMN_WIDTH = 120.dp
private val ROW_HEIGHT = 70.dp

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun EpgScreen(
    onChannelClick: (String, String, String, String) -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    viewModel: EpgViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val horizontalScrollState = rememberScrollState()
    
    Box(modifier = Modifier.fillMaxSize().background(SurfaceDark)) {
        Column {
            // Header / Time scale
            TimeHeader(
                startTime = uiState.startTimeMillis,
                endTime = uiState.endTimeMillis,
                scrollState = horizontalScrollState
            )

            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Red40)
                }
            } else {
                EpgGrid(
                    channels = uiState.channels,
                    programs = uiState.programs,
                    startTime = uiState.startTimeMillis,
                    horizontalScrollState = horizontalScrollState,
                    onChannelClick = onChannelClick,
                    sharedTransitionScope = sharedTransitionScope,
                    animatedVisibilityScope = animatedVisibilityScope
                )
            }
        }
        
        // Current Time Indicator
        CurrentTimeIndicator(
            startTime = uiState.startTimeMillis,
            scrollState = horizontalScrollState
        )
    }
}

@Composable
fun TimeHeader(startTime: Long, endTime: Long, scrollState: ScrollState) {
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    
    Row(modifier = Modifier.fillMaxWidth().height(40.dp).background(SurfaceDarkVariant)) {
        // Empty corner
        Box(modifier = Modifier.width(CHANNEL_COLUMN_WIDTH).fillMaxHeight())
        
        // Time slots
        Row(modifier = Modifier.horizontalScroll(scrollState)) {
            val totalHours = ((endTime - startTime) / (3600 * 1000)).toInt()
            for (i in 0 until totalHours) {
                val time = startTime + (i * 3600 * 1000)
                Box(
                    modifier = Modifier.width(HOUR_WIDTH).fillMaxHeight().padding(start = 8.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text(
                        text = timeFormat.format(Date(time)),
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.White.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun EpgGrid(
    channels: List<CachedChannel>,
    programs: Map<String, List<EpgProgram>>,
    startTime: Long,
    horizontalScrollState: ScrollState,
    onChannelClick: (String, String, String, String) -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(channels) { channel ->
            Row(modifier = Modifier.height(ROW_HEIGHT).fillMaxWidth()) {
                // Sticky Channel Column
                ChannelItem(
                    channel = channel,
                    sharedTransitionScope = sharedTransitionScope,
                    animatedVisibilityScope = animatedVisibilityScope
                ) {
                    onChannelClick(channel.streamUrl, channel.name, channel.groupTitle, channel.logoUrl)
                }

                // Programs Row
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .horizontalScroll(horizontalScrollState)
                ) {
                    val channelPrograms = programs[channel.tvgId] ?: emptyList()
                    channelPrograms.forEach { program ->
                        ProgramItem(program, startTime)
                    }
                }
            }
            Divider(color = Color.White.copy(alpha = 0.05f))
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun ChannelItem(
    channel: CachedChannel,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    onClick: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    
    Surface(
        onClick = onClick,
        modifier = Modifier
            .width(CHANNEL_COLUMN_WIDTH)
            .fillMaxHeight()
            .onFocusChanged { isFocused = it.isFocused }
            .background(SurfaceDarkVariant)
            .border(1.dp, if (isFocused) Color.White else Color.Transparent),
        color = SurfaceDarkVariant
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            with(sharedTransitionScope) {
                AsyncImage(
                    model = channel.logoUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .size(32.dp)
                        .sharedElement(
                            rememberSharedContentState(key = "logo-${channel.streamUrl}"),
                            animatedVisibilityScope = animatedVisibilityScope
                        ),
                    contentScale = ContentScale.Fit
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = channel.name,
                style = MaterialTheme.typography.labelSmall,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun ProgramItem(program: EpgProgram, gridStartTime: Long) {
    var isFocused by remember { mutableStateOf(false) }
    val duration = program.endTime - program.startTime
    val startOffset = program.startTime - gridStartTime
    
    val width = (duration.toFloat() / (3600 * 1000) * HOUR_WIDTH.value).dp
    val offset = (startOffset.toFloat() / (3600 * 1000) * HOUR_WIDTH.value).dp
    
    Box(
        modifier = Modifier
            .offset(x = offset)
            .width(width)
            .fillMaxHeight()
            .padding(2.dp)
            .scale(if (isFocused) 1.02f else 1f)
            .onFocusChanged { isFocused = it.isFocused }
            .clip(RoundedCornerShape(4.dp))
            .background(if (isFocused) Red40.copy(alpha = 0.2f) else SurfaceDarkElevated)
            .border(if (isFocused) 2.dp else 0.dp, Color.White, RoundedCornerShape(4.dp))
            .clickable { /* Show details */ }
            .padding(8.dp)
    ) {
        Column {
            Text(
                text = program.title,
                style = MaterialTheme.typography.labelMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = program.description,
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.5f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun CurrentTimeIndicator(startTime: Long, scrollState: ScrollState) {
    val currentTime = System.currentTimeMillis()
    if (currentTime < startTime) return
    
    val offset = ((currentTime - startTime).toFloat() / (3600 * 1000) * HOUR_WIDTH.value).dp
    
    Box(
        modifier = Modifier
            .fillMaxHeight()
            .offset(x = CHANNEL_COLUMN_WIDTH + offset - scrollState.value.dp)
            .width(2.dp)
            .background(Red40)
    )
}
