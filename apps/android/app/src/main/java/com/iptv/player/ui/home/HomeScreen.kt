package com.iptv.player.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.ui.components.ChannelCard
import com.iptv.player.ui.components.SearchOverlay
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkVariant

private enum class HomeTab(val label: String, val icon: ImageVector) {
    LIVE("Live TV", Icons.Default.LiveTv),
    MOVIES("Movies", Icons.Default.Movie),
    FAVORITES("Favorites", Icons.Default.Favorite),
    SETTINGS("Settings", Icons.Default.Settings)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    playlistUrl: String,
    onChannelClick: (streamUrl: String, channelName: String, groupTitle: String, logoUrl: String) -> Unit,
    onSettingsClick: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isSearchActive by viewModel.isSearchActive.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val favorites by viewModel.favorites.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }

    val favoriteUrls = remember(favorites) {
        favorites.map { it.streamUrl }.toSet()
    }

    LaunchedEffect(playlistUrl) {
        if (uiState.isLoading && uiState.error == null && uiState.channelCount == 0) {
            viewModel.loadPlaylist(playlistUrl)
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.LiveTv,
                                contentDescription = null,
                                tint = Red40,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "IPTV Player",
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            if (uiState.channelCount > 0) {
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "${uiState.channelCount} ch",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                                )
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = { viewModel.toggleSearch() }) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Search",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = SurfaceDark
                    )
                )
            },
            bottomBar = {
                NavigationBar(
                    containerColor = SurfaceDarkVariant,
                    contentColor = MaterialTheme.colorScheme.onSurface
                ) {
                    HomeTab.entries.forEachIndexed { index, tab ->
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = tab.icon,
                                    contentDescription = tab.label
                                )
                            },
                            label = { Text(tab.label) },
                            selected = selectedTab == index,
                            onClick = {
                                if (tab == HomeTab.SETTINGS) {
                                    onSettingsClick()
                                } else {
                                    selectedTab = index
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Red40,
                                selectedTextColor = Red40,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                unselectedTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                indicatorColor = Red40.copy(alpha = 0.15f)
                            )
                        )
                    }
                }
            },
            containerColor = SurfaceDark
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when {
                    uiState.isLoading -> {
                        LoadingContent()
                    }
                    uiState.error != null -> {
                        ErrorContent(
                            error = uiState.error!!,
                            onRetry = { viewModel.refreshPlaylist(playlistUrl) }
                        )
                    }
                    else -> {
                        when (selectedTab) {
                            0 -> ChannelGrid(
                                channels = uiState.liveChannels,
                                favoriteUrls = favoriteUrls,
                                onChannelClick = onChannelClick,
                                onFavoriteClick = { viewModel.toggleFavorite(it) },
                                emptyMessage = "No live channels found"
                            )
                            1 -> ChannelGrid(
                                channels = uiState.movieChannels,
                                favoriteUrls = favoriteUrls,
                                onChannelClick = onChannelClick,
                                onFavoriteClick = { viewModel.toggleFavorite(it) },
                                emptyMessage = "No movies found"
                            )
                            2 -> FavoritesGrid(
                                favorites = favorites,
                                onChannelClick = onChannelClick
                            )
                        }
                    }
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

@Composable
private fun ChannelGrid(
    channels: List<M3UChannel>,
    favoriteUrls: Set<String>,
    onChannelClick: (streamUrl: String, channelName: String, groupTitle: String, logoUrl: String) -> Unit,
    onFavoriteClick: (M3UChannel) -> Unit,
    emptyMessage: String
) {
    if (channels.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = emptyMessage,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                style = MaterialTheme.typography.bodyLarge
            )
        }
    } else {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 150.dp),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(
                items = channels,
                key = { it.streamUrl }
            ) { channel ->
                ChannelCard(
                    name = channel.name,
                    groupTitle = channel.groupTitle,
                    logoUrl = channel.logoUrl,
                    isFavorite = favoriteUrls.contains(channel.streamUrl),
                    onClick = {
                        onChannelClick(
                            channel.streamUrl,
                            channel.name,
                            channel.groupTitle,
                            channel.logoUrl
                        )
                    },
                    onLongClick = { onFavoriteClick(channel) },
                    onFavoriteClick = { onFavoriteClick(channel) }
                )
            }
        }
    }
}

@Composable
private fun FavoritesGrid(
    favorites: List<FavoriteChannel>,
    onChannelClick: (streamUrl: String, channelName: String, groupTitle: String, logoUrl: String) -> Unit
) {
    if (favorites.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Default.Favorite,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "No favorites yet",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    text = "Long press on a channel to add it",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    } else {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 150.dp),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(
                items = favorites,
                key = { it.streamUrl }
            ) { channel ->
                ChannelCard(
                    name = channel.name,
                    groupTitle = channel.groupTitle,
                    logoUrl = channel.logoUrl,
                    isFavorite = true,
                    onClick = {
                        onChannelClick(
                            channel.streamUrl,
                            channel.name,
                            channel.groupTitle,
                            channel.logoUrl
                        )
                    }
                )
            }
        }
    }
}

@Composable
private fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(
                color = Red40,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Loading playlist...",
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun ErrorContent(
    error: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Text(
                text = "Failed to load playlist",
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(24.dp))
            TextButton(onClick = onRetry) {
                Text("Retry", color = Red40, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
