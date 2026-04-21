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
import androidx.compose.ui.draw.drawWithContent
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
import androidx.compose.foundation.lazy.rememberLazyListState
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.util.ConnectionState
import com.iptv.player.ui.components.ChannelCard
import com.iptv.player.ui.components.HeroCarousel
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
    // Shared list state so the hero can read scroll offset for parallax.
    val listState = rememberLazyListState()

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 16.dp)
    ) {
        items(
            items = items,
            key = { item ->
                when (item) {
                    is HomeFeedItem.Hero -> "hero-carousel"
                    is HomeFeedItem.SectionHeader -> "header-${item.title}"
                    is HomeFeedItem.ContinueWatchingRow -> "continue-watching"
                    is HomeFeedItem.CategoryRow -> "category-${item.title}"
                    is HomeFeedItem.ChannelGrid -> "grid-${item.title}"
                }
            }
        ) { item ->
            when (item) {
                is HomeFeedItem.Hero -> {
                    HeroCarousel(
                        channels = item.channels,
                        onChannelClick = { ch ->
                            onChannelClick(ch.streamUrl, ch.name, ch.groupTitle, ch.logoUrl)
                        },
                        sharedTransitionScope = sharedTransitionScope,
                        animatedVisibilityScope = animatedVisibilityScope,
                        parallaxOffsetPx = {
                            if (listState.firstVisibleItemIndex == 0)
                                listState.firstVisibleItemScrollOffset.toFloat()
                            else 0f
                        }
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
                    HorizontalRailContainer {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(item.channels, key = { it.streamUrl }) { recent ->
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
                }
                is HomeFeedItem.CategoryRow -> {
                    HorizontalRailContainer {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(item.channels, key = { it.streamUrl }) { channel ->
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
                }
                is HomeFeedItem.ChannelGrid -> {
                    HorizontalRailContainer {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(item.channels.take(20), key = { it.streamUrl }) { channel ->
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
}

/**
 * Adds a cinematic horizontal edge-fade to its content. This makes partially
 * visible cards in a horizontal rail look like they're "emerging from the shadows"
 * rather than being abruptly cropped at the screen edge.
 */
@Composable
private fun HorizontalRailContainer(
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .drawWithContent {
                drawContent()
                // Left edge fade
                drawRect(
                    brush = Brush.horizontalGradient(
                        0.0f to BrandBackground,
                        0.05f to Color.Transparent,
                        startX = 0f,
                        endX = 100f
                    )
                )
                // Right edge fade
                drawRect(
                    brush = Brush.horizontalGradient(
                        0.95f to Color.Transparent,
                        1.0f to BrandBackground,
                        startX = size.width - 100f,
                        endX = size.width
                    )
                )
            }
    ) {
        content()
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
