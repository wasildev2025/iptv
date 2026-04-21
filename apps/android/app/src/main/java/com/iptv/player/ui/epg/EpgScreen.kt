package com.iptv.player.ui.epg

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.hilt.navigation.compose.hiltViewModel
import com.iptv.player.ui.components.ChannelLogo
import com.iptv.player.data.model.CachedChannel
import com.iptv.player.data.model.EpgProgram
import com.iptv.player.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val HOUR_WIDTH = 260.dp
private val CHANNEL_COLUMN_WIDTH = 160.dp
private val ROW_HEIGHT = 80.dp

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
    var selectedProgram by remember { mutableStateOf<EpgProgram?>(null) }
    
    Box(modifier = Modifier.fillMaxSize().background(BrandBackground)) {
        Column {
            // EPG Header with Date
            EpgHeader()

            // Focused Program Info Section (Premium Feature)
            ProgramDetailHeader(selectedProgram)

            // Time scale
            TimeHeader(
                startTime = uiState.startTimeMillis,
                endTime = uiState.endTimeMillis,
                scrollState = horizontalScrollState
            )

            if (uiState.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BrandAccent)
                }
            } else {
                EpgGrid(
                    channels = uiState.channels,
                    programs = uiState.programs,
                    startTime = uiState.startTimeMillis,
                    horizontalScrollState = horizontalScrollState,
                    onChannelClick = onChannelClick,
                    onProgramFocus = { selectedProgram = it },
                    sharedTransitionScope = sharedTransitionScope,
                    animatedVisibilityScope = animatedVisibilityScope
                )
            }
        }
        
        // Current Time Indicator (Red line)
        CurrentTimeIndicator(
            startTime = uiState.startTimeMillis,
            scrollState = horizontalScrollState
        )
    }
}

@Composable
fun ProgramDetailHeader(program: EpgProgram?) {
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    
    AnimatedContent(
        targetState = program,
        transitionSpec = { fadeIn() togetherWith fadeOut() },
        label = "program_detail"
    ) { current ->
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(100.dp)
                .background(BrandNavyDeep.copy(alpha = 0.3f))
                .padding(horizontal = 24.dp, vertical = 12.dp)
        ) {
            if (current != null) {
                Column {
                    Text(
                        text = current.title,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "${timeFormat.format(Date(current.startTime))} - ${timeFormat.format(Date(current.endTime))}",
                            style = MaterialTheme.typography.labelLarge,
                            color = BrandAccent
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = current.description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = BrandTextSecondary,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            } else {
                Text(
                    text = "Select a program to see details",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandTextSecondary,
                    modifier = Modifier.align(Alignment.CenterStart)
                )
            }
        }
    }
}

@Composable
fun EpgHeader() {
    val dateFormat = remember { SimpleDateFormat("EEEE, MMMM d", Locale.getDefault()) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "TV GUIDE",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Black,
            letterSpacing = 2.sp,
            color = BrandAccent
        )
        Spacer(modifier = Modifier.width(24.dp))
        Text(
            text = dateFormat.format(Date()).uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = BrandTextSecondary,
            letterSpacing = 1.sp
        )
    }
}

@Composable
fun TimeHeader(startTime: Long, endTime: Long, scrollState: ScrollState) {
    val timeFormat = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(44.dp)
            .background(BrandNavyDeep.copy(alpha = 0.5f))
            .drawBehind {
                drawLine(
                    color = Color.White.copy(alpha = 0.1f),
                    start = Offset(0f, size.height),
                    end = Offset(size.width, size.height),
                    strokeWidth = 1.dp.toPx()
                )
            }
    ) {
        // Sticky Header Corner
        Box(
            modifier = Modifier
                .width(CHANNEL_COLUMN_WIDTH)
                .fillMaxHeight()
                .background(BrandBackground)
        )
        
        // Time slots
        Row(modifier = Modifier.horizontalScroll(scrollState)) {
            val totalHours = ((endTime - startTime) / (3600 * 1000)).toInt()
            for (i in 0 until totalHours) {
                val time = startTime + (i * 3600 * 1000)
                Box(
                    modifier = Modifier
                        .width(HOUR_WIDTH)
                        .fillMaxHeight()
                        .padding(start = 12.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text(
                        text = timeFormat.format(Date(time)),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (i == 0) BrandAccent else BrandTextPrimary.copy(alpha = 0.7f)
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
    onProgramFocus: (EpgProgram) -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        items(channels, key = { it.streamUrl }) { channel ->
            Row(
                modifier = Modifier
                    .height(ROW_HEIGHT)
                    .fillMaxWidth()
            ) {
                // Sticky Channel Column
                ChannelItem(
                    channel = channel,
                    sharedTransitionScope = sharedTransitionScope,
                    animatedVisibilityScope = animatedVisibilityScope
                ) {
                    onChannelClick(channel.streamUrl, channel.name, channel.groupTitle, channel.logoUrl)
                }

                // Programs Timeline
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .horizontalScroll(horizontalScrollState)
                        .drawBehind {
                            drawLine(
                                color = Color.White.copy(alpha = 0.05f),
                                start = Offset(0f, size.height),
                                end = Offset(size.width, size.height),
                                strokeWidth = 1.dp.toPx()
                            )
                        }
                ) {
                    val channelPrograms = programs[channel.tvgId] ?: emptyList()
                    channelPrograms.forEach { program ->
                        ProgramItem(program, startTime, onProgramFocus)
                    }
                }
            }
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
            .zIndex(1f),
        color = if (isFocused) BrandAccent.copy(alpha = 0.1f) else BrandBackground
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                with(sharedTransitionScope) {
                    ChannelLogo(
                        logoUrl = channel.logoUrl,
                        contentDescription = null,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .sharedElement(
                                rememberSharedContentState(key = "logo-${channel.streamUrl}"),
                                animatedVisibilityScope = animatedVisibilityScope
                            ),
                        contentScale = ContentScale.Fit
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = channel.name,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (isFocused) BrandAccent else BrandTextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "CH ${channel.tvgId.takeLast(3)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = BrandTextSecondary,
                        fontSize = 10.sp
                    )
                }
            }
            
            if (isFocused) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(4.dp)
                        .background(BrandAccent)
                        .align(Alignment.CenterStart)
                )
            }
        }
    }
}

@Composable
fun ProgramItem(
    program: EpgProgram, 
    gridStartTime: Long,
    onFocus: (EpgProgram) -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    val duration = program.endTime - program.startTime
    val startOffset = program.startTime - gridStartTime
    
    val width = (duration.toFloat() / (3600 * 1000) * HOUR_WIDTH.value).dp
    val offset = (startOffset.toFloat() / (3600 * 1000) * HOUR_WIDTH.value).dp
    
    val now = System.currentTimeMillis()
    val isLive = now in program.startTime..program.endTime

    LaunchedEffect(isFocused) {
        if (isFocused) onFocus(program)
    }

    Box(
        modifier = Modifier
            .offset(x = offset)
            .width(width)
            .fillMaxHeight()
            .padding(vertical = 4.dp, horizontal = 2.dp)
            .onFocusChanged { isFocused = it.isFocused }
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (isFocused) BrandAccent.copy(alpha = 0.15f) 
                else if (isLive) BrandNavyDeep.copy(alpha = 0.8f)
                else BrandNavyDeep.copy(alpha = 0.4f)
            )
            .border(
                width = if (isFocused) 2.dp else 1.dp,
                color = if (isFocused) BrandAccent else Color.White.copy(alpha = 0.05f),
                shape = RoundedCornerShape(8.dp)
            )
            .clickable { /* Details */ }
            .padding(12.dp)
    ) {
        Column {
            Text(
                text = program.title,
                style = MaterialTheme.typography.labelLarge,
                color = if (isFocused) BrandAccent else BrandTextPrimary,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = program.description.ifBlank { "No description available" },
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        
        // Live Progress Indicator for current program
        if (isLive) {
            val progress = (now - program.startTime).toFloat() / (program.endTime - program.startTime)
            Box(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth(progress)
                    .height(2.dp)
                    .background(BrandAccent)
            )
        }
    }
}

@Composable
fun CurrentTimeIndicator(startTime: Long, scrollState: ScrollState) {
    val currentTime = System.currentTimeMillis()
    val offset = ((currentTime - startTime).toFloat() / (3600 * 1000) * HOUR_WIDTH.value).dp
    
    Box(
        modifier = Modifier
            .fillMaxHeight()
            .offset(x = CHANNEL_COLUMN_WIDTH + offset - scrollState.value.dp)
            .width(2.dp)
            .background(
                Brush.verticalGradient(
                    listOf(BrandAccent, Color.Transparent)
                )
            )
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .align(Alignment.TopCenter)
                .offset(y = 40.dp)
                .background(BrandAccent, CircleShape)
        )
    }
}
