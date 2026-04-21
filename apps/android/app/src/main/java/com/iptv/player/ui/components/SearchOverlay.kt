package com.iptv.player.ui.components

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.ui.theme.Red40
import com.iptv.player.ui.theme.SurfaceDark
import com.iptv.player.ui.theme.SurfaceDarkVariant

@Composable
fun SearchOverlay(
    query: String,
    results: List<M3UChannel>,
    favoriteUrls: Set<String>,
    onQueryChanged: (String) -> Unit,
    onChannelClick: (M3UChannel) -> Unit,
    onFavoriteClick: (M3UChannel) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(SurfaceDark.copy(alpha = 0.95f), SurfaceDark)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // Immersive Search Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 24.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = query,
                    onValueChange = onQueryChanged,
                    modifier = Modifier
                        .weight(1f)
                        .focusRequester(focusRequester),
                    placeholder = {
                        Text(
                            text = "Search Movies, Sports, News...",
                            color = Color.White.copy(alpha = 0.4f),
                            style = MaterialTheme.typography.bodyLarge
                        )
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = Red40,
                            modifier = Modifier.size(28.dp)
                        )
                    },
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { onQueryChanged("") }) {
                                Icon(Icons.Default.Close, null, tint = Color.White)
                            }
                        }
                    },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = Color.White, fontSize = 18.sp),
                    shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = SurfaceDarkVariant,
                        unfocusedContainerColor = SurfaceDarkVariant,
                        focusedIndicatorColor = Red40,
                        unfocusedIndicatorColor = Color.Transparent,
                        cursorColor = Red40
                    )
                )
                
                Spacer(modifier = Modifier.width(16.dp))
                
                TextButton(onClick = onClose) {
                    Text("Cancel", color = Color.White)
                }
            }

            // Spotlight Content
            Box(modifier = Modifier.fillMaxSize()) {
                if (query.isBlank()) {
                    SearchSuggestions(onQueryChanged)
                } else if (results.isEmpty()) {
                    EmptySearchState(query)
                } else {
                    SearchResultsGrid(results, favoriteUrls, onChannelClick, onFavoriteClick)
                }
            }
        }
    }
}

@Composable
fun SearchSuggestions(onSuggestionClick: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        Text(
            text = "SUGGESTED CATEGORIES",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 1.sp
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        val suggestions = listOf("Sports", "Movies", "News", "Documentaries", "Music", "Kids")
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            suggestions.forEach { suggestion ->
                SuggestionChip(text = suggestion, onClick = { onSuggestionClick(suggestion) })
            }
        }

        Spacer(modifier = Modifier.height(40.dp))

        Text(
            text = "RECENT SEARCHES",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White.copy(alpha = 0.5f),
            letterSpacing = 1.sp
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        val recents = listOf("Premier League", "HBO Max", "Discovery+")
        recents.forEach { recent ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSuggestionClick(recent) }
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Default.History, null, tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(16.dp))
                Text(recent, color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.bodyLarge)
                Spacer(modifier = Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Filled.TrendingUp, null, tint = Red40.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SuggestionChip(text: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = SurfaceDarkVariant,
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White
        )
    }
}

@Composable
fun SearchResultsGrid(
    results: List<M3UChannel>,
    favoriteUrls: Set<String>,
    onChannelClick: (M3UChannel) -> Unit,
    onFavoriteClick: (M3UChannel) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 160.dp),
        contentPadding = PaddingValues(16.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        items(
            items = results,
            key = { it.streamUrl }
        ) { channel ->
            ChannelCard(
                name = channel.name,
                groupTitle = channel.groupTitle,
                logoUrl = channel.logoUrl,
                isFavorite = favoriteUrls.contains(channel.streamUrl),
                onClick = { onChannelClick(channel) },
                onFavoriteClick = { onFavoriteClick(channel) }
            )
        }
    }
}

@Composable
fun EmptySearchState(query: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Icon(Icons.Default.Search, null, modifier = Modifier.size(80.dp), tint = Color.White.copy(alpha = 0.05f))
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "No results for \"$query\"",
                style = MaterialTheme.typography.headlineSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Check the spelling or try a broader category like 'Movies' or 'Sports'.",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White.copy(alpha = 0.6f),
                textAlign = TextAlign.Center
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRow(
    modifier: Modifier = Modifier,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.Start,
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    content: @Composable () -> Unit
) {
    androidx.compose.foundation.layout.FlowRow(
        modifier = modifier,
        horizontalArrangement = horizontalArrangement,
        verticalArrangement = verticalArrangement
    ) {
        content()
    }
}
