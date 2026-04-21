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

    init {
        // Observe favorites and recents to rebuild feed dynamically
        combine(recentChannels, favorites, _allChannels) { recents, favs, channels ->
            if (channels.isNotEmpty()) {
                buildHomeFeed(channels, recents, favs)
            }
        }.launchIn(viewModelScope)
    }

    fun loadPlaylist(playlistUrl: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _loadingProgress.value = 0.1f
            _feedState.value = _feedState.value.copy(error = null)
            
            val result = repository.loadPlaylist(playlistUrl)
            result.onSuccess { playlist ->
                _loadingProgress.value = 0.5f
                _allChannels.value = playlist.channels
            }.onFailure { e ->
                _isLoading.value = false
                _feedState.value = _feedState.value.copy(
                    error = e.message ?: "Failed to load playlist"
                )
            }
        }
    }

    private suspend fun buildHomeFeed(
        channels: List<M3UChannel>,
        recents: List<RecentChannel>,
        favs: List<FavoriteChannel>
    ) {
        withContext(Dispatchers.Default) {
            val items = mutableListOf<HomeFeedItem>()

            // 1. Hero Section
            val heroChannel = favs.firstOrNull()?.let { f ->
                channels.find { it.streamUrl == f.streamUrl }
            } ?: channels.firstOrNull()

            heroChannel?.let { items.add(HomeFeedItem.Hero(it)) }

            // 2. Continue Watching
            if (recents.isNotEmpty()) {
                items.add(HomeFeedItem.SectionHeader("Continue Watching"))
                items.add(HomeFeedItem.ContinueWatchingRow(recents.take(15)))
            }

            // 3. Dynamic Categories
            val grouped = channels.groupBy { it.groupTitle }
            val sortedGroups = grouped.keys.sortedBy { it.lowercase() }

            for (group in sortedGroups) {
                val groupChannels = grouped[group] ?: continue
                if (groupChannels.isNotEmpty()) {
                    items.add(HomeFeedItem.SectionHeader(group))
                    items.add(HomeFeedItem.CategoryRow(group, groupChannels.take(20)))
                }
            }

            _feedState.value = HomeUiState(
                error = null,
                feedItems = items,
                channelCount = channels.size
            )
            _isLoading.value = false
            _loadingProgress.value = 1f
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
