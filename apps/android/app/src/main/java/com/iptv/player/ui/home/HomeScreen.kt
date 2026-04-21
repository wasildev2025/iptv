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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.util.ConnectionState
import com.iptv.player.ui.components.ChannelCard
import com.iptv.player.ui.components.SearchOverlay
import com.iptv.player.ui.theme.BrandAccent
import com.iptv.player.ui.theme.BrandBackground
import com.iptv.player.ui.theme.BrandNavyDeep
import com.iptv.player.ui.theme.BrandTextPrimary
import com.iptv.player.ui.theme.BrandTextSecondary

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
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val loadingProgress by viewModel.loadingProgress.collectAsStateWithLifecycle()
    val feedState by viewModel.feedState.collectAsStateWithLifecycle()
    
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val isSearchActive by viewModel.isSearchActive.collectAsStateWithLifecycle()
    val searchResults by viewModel.searchResults.collectAsStateWithLifecycle()
    val favorites by viewModel.favorites.collectAsStateWithLifecycle()
    val connectionState by viewModel.connectionState.collectAsStateWithLifecycle()
    
    val favoriteUrls = remember(favorites) {
        favorites.map { it.streamUrl }.toSet()
    }

    LaunchedEffect(playlistUrl) {
        if (isLoading && feedState.channelCount == 0) {
            viewModel.loadPlaylist(playlistUrl)
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(BrandBackground)) {
        Scaffold(
            topBar = {
                HomeTopBar(
                    onSearchClick = { viewModel.toggleSearch() },
                    onSettingsClick = onSettingsClick,
                    connectionState = connectionState
                )
            },
            bottomBar = {
                HomeBottomBar(onEpgClick = onEpgClick)
            },
            containerColor = BrandBackground
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues)) {
                when {
                    isLoading -> LoadingContent(loadingProgress)
                    feedState.error != null -> ErrorContent(feedState.error!!, onRetry = { viewModel.refreshPlaylist(playlistUrl) })
                    else -> HomeFeed(
                        items = feedState.feedItems,
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeTopBar(
    onSearchClick: () -> Unit,
    onSettingsClick: () -> Unit,
    connectionState: ConnectionState
) {
    Column {
        CenterAlignedTopAppBar(
            title = {
                Text(
                    text = "IPTV PREMIER",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp,
                    color = BrandAccent
                )
            },
            actions = {
                IconButton(onClick = onSearchClick) {
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
                    color = BrandAccent,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun HomeBottomBar(onEpgClick: () -> Unit) {
    NavigationBar(
        containerColor = BrandNavyDeep.copy(alpha = 0.95f),
        tonalElevation = 0.dp
    ) {
        NavigationBarItem(
            selected = true,
            onClick = { },
            icon = { Icon(Icons.Default.Home, null) },
            label = { Text("Home") },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = BrandAccent,
                selectedTextColor = BrandAccent,
                indicatorColor = Color.Transparent,
                unselectedIconColor = BrandTextSecondary,
                unselectedTextColor = BrandTextSecondary
            )
        )
        NavigationBarItem(
            selected = false,
            onClick = onEpgClick,
            icon = { Icon(Icons.Default.DateRange, null) },
            label = { Text("Guide") },
            colors = NavigationBarItemDefaults.colors(
                unselectedIconColor = BrandTextSecondary,
                unselectedTextColor = BrandTextSecondary
            )
        )
        NavigationBarItem(
            selected = false,
            onClick = { /* Navigate to Favorites */ },
            icon = { Icon(Icons.Default.Favorite, null) },
            label = { Text("My List") },
            colors = NavigationBarItemDefaults.colors(
                unselectedIconColor = BrandTextSecondary,
                unselectedTextColor = BrandTextSecondary
            )
        )
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
        items(
            items = items,
            key = { item ->
                when (item) {
                    is HomeFeedItem.Hero -> "hero-${item.channel.streamUrl}"
                    is HomeFeedItem.SectionHeader -> "header-${item.title}"
                    is HomeFeedItem.ContinueWatchingRow -> "continue-watching"
                    is HomeFeedItem.CategoryRow -> "category-${item.title}"
                    is HomeFeedItem.ChannelGrid -> "grid-${item.title}"
                }
            }
        ) { item ->
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
                        color = BrandTextPrimary,
                        modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 12.dp)
                    )
                }
                is HomeFeedItem.ContinueWatchingRow -> {
                    ContinueWatchingRow(
                        channels = item.channels,
                        favoriteUrls = favoriteUrls,
                        onChannelClick = onChannelClick
                    )
                }
                is HomeFeedItem.CategoryRow -> {
                    CategoryRow(
                        title = item.title,
                        channels = item.channels,
                        favoriteUrls = favoriteUrls,
                        onChannelClick = onChannelClick,
                        onFavoriteClick = onFavoriteClick,
                        sharedTransitionScope = sharedTransitionScope,
                        animatedVisibilityScope = animatedVisibilityScope
                    )
                }
                is HomeFeedItem.ChannelGrid -> {
                    ChannelGridRow(
                        channels = item.channels,
                        favoriteUrls = favoriteUrls,
                        onChannelClick = onChannelClick,
                        onFavoriteClick = onFavoriteClick
                    )
                }
            }
        }
    }
}

@Composable
fun ContinueWatchingRow(
    channels: List<com.iptv.player.data.model.RecentChannel>,
    favoriteUrls: Set<String>,
    onChannelClick: (String, String, String, String) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(channels, key = { it.streamUrl }) { recent ->
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

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
fun CategoryRow(
    title: String,
    channels: List<M3UChannel>,
    favoriteUrls: Set<String>,
    onChannelClick: (String, String, String, String) -> Unit,
    onFavoriteClick: (M3UChannel) -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(channels, key = { it.streamUrl }) { channel ->
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

@Composable
fun ChannelGridRow(
    channels: List<M3UChannel>,
    favoriteUrls: Set<String>,
    onChannelClick: (String, String, String, String) -> Unit,
    onFavoriteClick: (M3UChannel) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(channels.take(20), key = { it.streamUrl }) { channel ->
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
            .background(BrandNavyDeep)
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
                        colors = listOf(Color.Transparent, BrandBackground),
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
                color = BrandAccent,
                shape = RoundedCornerShape(4.dp)
            ) {
                Text(
                    text = "FEATURED",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = BrandBackground
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = channel.name,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = BrandTextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = channel.groupTitle,
                style = MaterialTheme.typography.bodyLarge,
                color = BrandTextSecondary
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
private fun LoadingContent(progress: Float) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(
                progress = { progress },
                color = BrandAccent,
                modifier = Modifier.size(64.dp),
                strokeCap = androidx.compose.ui.graphics.StrokeCap.Round,
                trackColor = BrandNavyDeep
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Building your feed... ${(progress * 100).toInt()}%",
                style = MaterialTheme.typography.bodyLarge,
                color = BrandTextPrimary,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "Optimizing large playlist content",
                style = MaterialTheme.typography.labelSmall,
                color = BrandTextSecondary
            )
        }
    }
}

@Composable
private fun ErrorContent(error: String, onRetry: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Text("Failed to load feed", style = MaterialTheme.typography.headlineSmall, color = BrandTextPrimary, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Text(error, style = MaterialTheme.typography.bodyMedium, color = BrandTextSecondary, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = BrandAccent, contentColor = BrandBackground)) {
                Text("Retry")
            }
        }
    }
}
