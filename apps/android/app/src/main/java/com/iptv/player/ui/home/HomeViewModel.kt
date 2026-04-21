package com.iptv.player.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.model.RecentChannel
import com.iptv.player.data.repository.IPTVRepository
import com.iptv.player.util.ConnectionState
import com.iptv.player.util.NetworkObserver
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class HomeFeedItem {
    data class Hero(val channel: M3UChannel) : HomeFeedItem()
    data class SectionHeader(val title: String) : HomeFeedItem()
    data class ContinueWatchingRow(val channels: List<RecentChannel>) : HomeFeedItem()
    data class CategoryRow(val title: String, val channels: List<M3UChannel>) : HomeFeedItem()
    data class ChannelGrid(val title: String, val channels: List<M3UChannel>) : HomeFeedItem()
}

data class HomeUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val feedItems: List<HomeFeedItem> = emptyList(),
    val channelCount: Int = 0
)

@OptIn(FlowPreview::class)
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: IPTVRepository,
    private val networkObserver: NetworkObserver
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _allChannels = MutableStateFlow<List<M3UChannel>>(emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isSearchActive = MutableStateFlow(false)
    val isSearchActive: StateFlow<Boolean> = _isSearchActive.asStateFlow()

    val connectionState: StateFlow<ConnectionState> = networkObserver.connectionState
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ConnectionState.Available)

    val searchResults: StateFlow<List<M3UChannel>> = _searchQuery
        .debounce(300L)
        .combine(_allChannels) { query, channels ->
            if (query.isBlank()) {
                emptyList()
            } else {
                channels.filter { channel ->
                    channel.name.contains(query, ignoreCase = true) ||
                            channel.groupTitle.contains(query, ignoreCase = true)
                }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val favorites: StateFlow<List<FavoriteChannel>> = repository.getFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val recentChannels: StateFlow<List<RecentChannel>> = repository.getRecent()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun loadPlaylist(playlistUrl: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = repository.loadPlaylist(playlistUrl)
            result.onSuccess { playlist ->
                val channels = playlist.channels
                _allChannels.value = channels
                buildHomeFeed(channels)
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load playlist"
                )
            }
        }
    }

    private fun buildHomeFeed(channels: List<M3UChannel>) {
        viewModelScope.launch {
            combine(recentChannels, favorites) { recents, favs ->
                val feedItems = mutableListOf<HomeFeedItem>()

                // 1. Hero Section (Pick a random popular channel or first favorite)
                val heroChannel = favs.firstOrNull()?.let { f ->
                    channels.find { it.streamUrl == f.streamUrl }
                } ?: channels.firstOrNull()

                heroChannel?.let {
                    feedItems.add(HomeFeedItem.Hero(it))
                }

                // 2. Continue Watching
                if (recents.isNotEmpty()) {
                    feedItems.add(HomeFeedItem.SectionHeader("Continue Watching"))
                    feedItems.add(HomeFeedItem.ContinueWatchingRow(recents.take(10)))
                }

                // 3. Categories (Dynamic rows for top categories)
                val movieKeywords = listOf("movie", "vod", "film", "cinema")
                val sportsKeywords = listOf("sport", "football", "soccer", "espn")

                val movieChannels = channels.filter { c ->
                    movieKeywords.any { c.groupTitle.lowercase().contains(it) }
                }
                if (movieChannels.isNotEmpty()) {
                    feedItems.add(HomeFeedItem.SectionHeader("Movies & Cinema"))
                    feedItems.add(HomeFeedItem.CategoryRow("Movies", movieChannels.take(15)))
                }

                val sportsChannels = channels.filter { c ->
                    sportsKeywords.any { c.groupTitle.lowercase().contains(it) }
                }
                if (sportsChannels.isNotEmpty()) {
                    feedItems.add(HomeFeedItem.SectionHeader("Live Sports"))
                    feedItems.add(HomeFeedItem.CategoryRow("Sports", sportsChannels.take(15)))
                }

                // 4. Everything Else (Grid)
                val otherChannels = channels.filter { c ->
                    !movieKeywords.any { c.groupTitle.lowercase().contains(it) } &&
                            !sportsKeywords.any { c.groupTitle.lowercase().contains(it) }
                }
                if (otherChannels.isNotEmpty()) {
                    feedItems.add(HomeFeedItem.SectionHeader("Live TV Channels"))
                    feedItems.add(HomeFeedItem.ChannelGrid("All Channels", otherChannels))
                }

                _uiState.value = HomeUiState(
                    isLoading = false,
                    feedItems = feedItems,
                    channelCount = channels.size
                )
            }.collect { /* Triggered by combine */ }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun toggleSearch() {
        _isSearchActive.value = !_isSearchActive.value
        if (!_isSearchActive.value) {
            _searchQuery.value = ""
        }
    }

    fun closeSearch() {
        _isSearchActive.value = false
        _searchQuery.value = ""
    }

    fun toggleFavorite(channel: M3UChannel) {
        viewModelScope.launch {
            val isFav = repository.isFavorite(channel.streamUrl)
            if (isFav) {
                repository.removeFavorite(channel.streamUrl)
            } else {
                repository.addFavorite(channel)
            }
        }
    }

    fun refreshPlaylist(playlistUrl: String) {
        loadPlaylist(playlistUrl)
    }
}
