package com.iptv.player.ui.home

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.util.ConnectionState
import com.iptv.player.ui.components.ChannelCard
import com.iptv.player.ui.components.SearchOverlay
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkVariant

@OptIn(ExperimentalMaterial3Api::class, ExperimentalSharedTransitionApi::class)
@Composable
fun HomeScreen(
    playlistUrl: String,
    onChannelClick: (String, String, String, String) -> Unit,
    onSettingsClick: () -> Unit,
    onEpgClick: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isSearchActive by viewModel.isSearchActive.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    val connectionState by viewModel.connectionState.collectAsState()
    
    val favoriteUrls = remember(favorites) {
        favorites.map { it.streamUrl }.toSet()
    }

    LaunchedEffect(playlistUrl) {
        if (uiState.isLoading && uiState.channelCount == 0) {
            viewModel.loadPlaylist(playlistUrl)
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(SurfaceDark)) {
        Scaffold(
            topBar = {
                Column {
                    CenterAlignedTopAppBar(
                        title = {
                            Text(
                                text = "IPTV PREMIER",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 2.sp,
                                color = Red40
                            )
                        },
                        actions = {
                            IconButton(onClick = { viewModel.toggleSearch() }) {
                                Icon(Icons.Default.Search, contentDescription = "Search", tint = Color.White)
                            }
                            IconButton(onClick = onSettingsClick) {
                                Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.White)
                            }
                        },
                        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                            containerColor = Color.Transparent
                        )
                    )
                    
                    // Connection State Banner
                    AnimatedVisibility(
                        visible = connectionState is ConnectionState.Unavailable,
                        enter = expandVertically(),
                        exit = shrinkVertically()
                    ) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            color = Color.Black.copy(alpha = 0.8f)
                        ) {
                            Text(
                                text = "OFFLINE MODE - Showing cached content",
                                modifier = Modifier.padding(vertical = 4.dp).fillMaxWidth(),
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.White.copy(alpha = 0.7f),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            },
            bottomBar = {
                NavigationBar(
                    containerColor = SurfaceDarkVariant.copy(alpha = 0.95f),
                    tonalElevation = 0.dp
                ) {
                    NavigationBarItem(
                        selected = true,
                        onClick = { },
                        icon = { Icon(Icons.Default.Home, null) },
                        label = { Text("Home") },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = Red40, indicatorColor = Color.Transparent)
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = onEpgClick,
                        icon = { Icon(Icons.Default.DateRange, null) },
                        label = { Text("Guide") }
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick = { /* Navigate to Favorites */ },
                        icon = { Icon(Icons.Default.Favorite, null) },
                        label = { Text("My List") }
                    )
                }
            },
            containerColor = SurfaceDark
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues)) {
                when {
                    uiState.isLoading -> LoadingContent()
                    uiState.error != null -> ErrorContent(uiState.error!!, onRetry = { viewModel.refreshPlaylist(playlistUrl) })
                    else -> HomeFeed(
                        items = uiState.feedItems,
                        favoriteUrls = favoriteUrls,
                        onChannelClick = onChannelClick,
                        onFavoriteClick = { viewModel.toggleFavorite(it) },
                        sharedTransitionScope = sharedTransitionScope,
                        animatedVisibilityScope = animatedVisibilityScope
                    )
                }
            }
        }

        // Search overlay
        AnimatedVisibility(
            visible = isSearchActive,
            enter = fadeIn() + slideInVertically(),
            exit = fadeOut() + slideOutVertically()
        ) {
            SearchOverlay(
                query = searchQuery,
                results = searchResults,
                favoriteUrls = favoriteUrls,
                onQueryChanged = { viewModel.onSearchQueryChanged(it) },
                onChannelClick = { channel ->
                    viewModel.closeSearch()
                    onChannelClick(channel.streamUrl, channel.name, channel.groupTitle, channel.logoUrl)
                },
                onFavoriteClick = { viewModel.toggleFavorite(it) },
                onClose = { viewModel.closeSearch() }
            )
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun HomeFeed(
    items: List<HomeFeedItem>,
    favoriteUrls: Set<String>,
    onChannelClick: (String, String, String, String) -> Unit,
    onFavoriteClick: (M3UChannel) -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 16.dp)
    ) {
        items(items) { item ->
            when (item) {
                is HomeFeedItem.Hero -> {
                    HeroSection(
                        channel = item.channel,
                        onClick = {
                            onChannelClick(item.channel.streamUrl, item.channel.name, item.channel.groupTitle, item.channel.logoUrl)
                        },
                        sharedTransitionScope = sharedTransitionScope,
                        animatedVisibilityScope = animatedVisibilityScope
                    )
                }
                is HomeFeedItem.SectionHeader -> {
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 12.dp)
                    )
                }
                is HomeFeedItem.ContinueWatchingRow -> {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(item.channels) { recent ->
                            ChannelCard(
                                name = recent.name,
                                groupTitle = recent.groupTitle,
                                logoUrl = recent.logoUrl,
                                isFavorite = favoriteUrls.contains(recent.streamUrl),
                                onClick = { onChannelClick(recent.streamUrl, recent.name, recent.groupTitle, recent.logoUrl) },
                                modifier = Modifier.width(200.dp)
                            )
                        }
                    }
                }
                is HomeFeedItem.CategoryRow -> {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(item.channels) { channel ->
                            with(sharedTransitionScope) {
                                ChannelCard(
                                    name = channel.name,
                                    groupTitle = channel.groupTitle,
                                    logoUrl = channel.logoUrl,
                                    isFavorite = favoriteUrls.contains(channel.streamUrl),
                                    onClick = { onChannelClick(channel.streamUrl, channel.name, channel.groupTitle, channel.logoUrl) },
                                    onFavoriteClick = { onFavoriteClick(channel) },
                                    modifier = Modifier
                                        .width(160.dp)
                                        .sharedElement(
                                            rememberSharedContentState(key = "logo-${channel.streamUrl}"),
                                            animatedVisibilityScope = animatedVisibilityScope
                                        )
                                )
                            }
                        }
                    }
                }
                is HomeFeedItem.ChannelGrid -> {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(item.channels.take(20)) { channel ->
                            ChannelCard(
                                name = channel.name,
                                groupTitle = channel.groupTitle,
                                logoUrl = channel.logoUrl,
                                isFavorite = favoriteUrls.contains(channel.streamUrl),
                                onClick = { onChannelClick(channel.streamUrl, channel.name, channel.groupTitle, channel.logoUrl) },
                                onFavoriteClick = { onFavoriteClick(channel) },
                                modifier = Modifier.width(140.dp),
                                aspectRatio = 1f
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun HeroSection(
    channel: M3UChannel,
    onClick: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(300.dp)
            .background(SurfaceDarkVariant)
    ) {
        with(sharedTransitionScope) {
            AsyncImage(
                model = channel.logoUrl,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxSize()
                    .sharedElement(
                        rememberSharedContentState(key = "logo-${channel.streamUrl}"),
                        animatedVisibilityScope = animatedVisibilityScope
                    ),
                contentScale = ContentScale.Crop,
                alpha = 0.6f
            )
        }
        
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, SurfaceDark),
                        startY = 300f
                    )
                )
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(24.dp)
        ) {
            Surface(
                color = Red40,
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = "FEATURED",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = channel.name,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = channel.groupTitle,
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onClick,
                colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color.Black),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Watch Now", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun LoadingContent() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = Red40, modifier = Modifier.size(48.dp))
            Spacer(modifier = Modifier.height(16.dp))
            Text("Building your feed...", color = Color.White.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun ErrorContent(error: String, onRetry: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Text("Failed to load feed", style = MaterialTheme.typography.headlineSmall, color = Color.White, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Text(error, style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = 0.6f), textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = Red40)) {
                Text("Retry")
            }
        }
    }
}
