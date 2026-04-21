package com.iptv.player.ui.home

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.model.RecentChannel
import com.iptv.player.data.repository.IPTVRepository
import com.iptv.player.util.ConnectionState
import com.iptv.player.util.NetworkObserver
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@Immutable
sealed class HomeFeedItem {
    @Immutable
    data class Hero(val channel: M3UChannel) : HomeFeedItem()
    @Immutable
    data class SectionHeader(val title: String) : HomeFeedItem()
    @Immutable
    data class ContinueWatchingRow(val channels: List<RecentChannel>) : HomeFeedItem()
    @Immutable
    data class CategoryRow(val title: String, val channels: List<M3UChannel>) : HomeFeedItem()
    @Immutable
    data class ChannelGrid(val title: String, val channels: List<M3UChannel>) : HomeFeedItem()
}

@Immutable
data class HomeUiState(
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

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _loadingProgress = MutableStateFlow(0f)
    val loadingProgress: StateFlow<Float> = _loadingProgress.asStateFlow()

    private val _feedState = MutableStateFlow(HomeUiState())
    val feedState: StateFlow<HomeUiState> = _feedState.asStateFlow()

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
                withContext(Dispatchers.Default) {
                    channels.filter { channel ->
                        channel.name.contains(query, ignoreCase = true) ||
                                channel.groupTitle.contains(query, ignoreCase = true)
                    }
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
            _isLoading.value = true
            _loadingProgress.value = 0.1f
            _feedState.value = _feedState.value.copy(error = null)
            
            val result = repository.loadPlaylist(playlistUrl)
            result.onSuccess { playlist ->
                _loadingProgress.value = 0.5f
                val channels = playlist.channels
                _allChannels.value = channels
                buildHomeFeed(channels)
            }.onFailure { e ->
                _isLoading.value = false
                _feedState.value = _feedState.value.copy(
                    error = e.message ?: "Failed to load playlist"
                )
            }
        }
    }

    private fun buildHomeFeed(channels: List<M3UChannel>) {
        viewModelScope.launch {
            _loadingProgress.value = 0.6f
            
            val feedItems = withContext(Dispatchers.Default) {
                val items = mutableListOf<HomeFeedItem>()
                val recents = recentChannels.first()
                val favs = favorites.first()

                // 1. Hero Section
                val heroChannel = favs.firstOrNull()?.let { f ->
                    channels.find { it.streamUrl == f.streamUrl }
                } ?: channels.firstOrNull()

                heroChannel?.let { items.add(HomeFeedItem.Hero(it)) }
                _loadingProgress.value = 0.7f

                // 2. Continue Watching
                if (recents.isNotEmpty()) {
                    items.add(HomeFeedItem.SectionHeader("Continue Watching"))
                    items.add(HomeFeedItem.ContinueWatchingRow(recents.take(10)))
                }

                // 3. Categories
                val movieKeywords = listOf("movie", "vod", "film", "cinema")
                val sportsKeywords = listOf("sport", "football", "soccer", "espn")

                val movieChannels = channels.filter { c ->
                    movieKeywords.any { c.groupTitle.lowercase().contains(it) }
                }
                if (movieChannels.isNotEmpty()) {
                    items.add(HomeFeedItem.SectionHeader("Movies & Cinema"))
                    items.add(HomeFeedItem.CategoryRow("Movies", movieChannels.take(15)))
                }
                _loadingProgress.value = 0.8f

                val sportsChannels = channels.filter { c ->
                    sportsKeywords.any { c.groupTitle.lowercase().contains(it) }
                }
                if (sportsChannels.isNotEmpty()) {
                    items.add(HomeFeedItem.SectionHeader("Live Sports"))
                    items.add(HomeFeedItem.CategoryRow("Sports", sportsChannels.take(15)))
                }
                _loadingProgress.value = 0.9f

                // 4. Everything Else
                val otherChannels = channels.filter { c ->
                    !movieKeywords.any { c.groupTitle.lowercase().contains(it) } &&
                            !sportsKeywords.any { c.groupTitle.lowercase().contains(it) }
                }
                if (otherChannels.isNotEmpty()) {
                    items.add(HomeFeedItem.SectionHeader("Live TV Channels"))
                    items.add(HomeFeedItem.ChannelGrid("All Channels", otherChannels.take(100)))
                }
                items
            }

            _feedState.value = HomeUiState(
                error = null,
                feedItems = feedItems,
                channelCount = channels.size
            )
            _loadingProgress.value = 1f
            _isLoading.value = false
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
