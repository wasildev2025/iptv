package com.iptv.player.ui.favorites

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.ui.components.ChannelCard
import com.iptv.player.ui.components.ChannelCardSkeleton
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.SurfaceDark

@OptIn(ExperimentalMaterial3Api::class, ExperimentalSharedTransitionApi::class)
@Composable
fun FavoriteScreen(
    onChannelClick: (String, String, String, String) -> Unit,
    onBack: () -> Unit,
    sharedTransitionScope: SharedTransitionScope,
    animatedVisibilityScope: AnimatedVisibilityScope,
    viewModel: FavoriteViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = "MY LIST",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 2.sp,
                        color = Red40
                    )
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        },
        containerColor = SurfaceDark
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
            when {
                uiState.isLoading -> FavoriteSkeletonGrid()
                uiState.favorites.isEmpty() -> EmptyFavoritesState(onBack)
                else -> {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 160.dp),
                        contentPadding = PaddingValues(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(
                            items = uiState.favorites,
                            key = { it.streamUrl }
                        ) { favorite ->
                            with(sharedTransitionScope) {
                                ChannelCard(
                                    name = favorite.name,
                                    groupTitle = favorite.groupTitle,
                                    logoUrl = favorite.logoUrl,
                                    isFavorite = true,
                                    onClick = {
                                        onChannelClick(
                                            favorite.streamUrl,
                                            favorite.name,
                                            favorite.groupTitle,
                                            favorite.logoUrl
                                        )
                                    },
                                    onFavoriteClick = { viewModel.toggleFavorite(favorite) },
                                    modifier = Modifier.sharedElement(
                                        rememberSharedContentState(key = "logo-${favorite.streamUrl}"),
                                        animatedVisibilityScope = animatedVisibilityScope
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EmptyFavoritesState(onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Favorite,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = Color.White.copy(alpha = 0.1f)
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Your list is empty",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Add channels while browsing to quickly access them later.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            Button(
                onClick = onBack,
                colors = ButtonDefaults.buttonColors(containerColor = Red40),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Home, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Explore Channels")
            }
        }
    }
}

@Composable
fun FavoriteSkeletonGrid() {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 160.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(8) {
            ChannelCardSkeleton()
        }
    }
}
