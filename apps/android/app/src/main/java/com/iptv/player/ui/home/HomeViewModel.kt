package com.iptv.player.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.repository.IPTVRepository
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

data class HomeUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val liveChannels: List<M3UChannel> = emptyList(),
    val movieChannels: List<M3UChannel> = emptyList(),
    val seriesChannels: List<M3UChannel> = emptyList(),
    val groups: List<String> = emptyList(),
    val channelCount: Int = 0
)

@OptIn(FlowPreview::class)
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: IPTVRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _allChannels = MutableStateFlow<List<M3UChannel>>(emptyList())

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isSearchActive = MutableStateFlow(false)
    val isSearchActive: StateFlow<Boolean> = _isSearchActive.asStateFlow()

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

    fun loadPlaylist(playlistUrl: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = repository.loadPlaylist(playlistUrl)
            result.onSuccess { playlist ->
                val channels = playlist.channels
                _allChannels.value = channels

                val movieKeywords = listOf("movie", "vod", "film", "cinema")
                val seriesKeywords = listOf("series", "show", "episode", "season")

                val liveChannels = mutableListOf<M3UChannel>()
                val movieChannels = mutableListOf<M3UChannel>()
                val seriesChannels = mutableListOf<M3UChannel>()

                channels.forEach { channel ->
                    val group = channel.groupTitle.lowercase()
                    when {
                        movieKeywords.any { group.contains(it) } -> movieChannels.add(channel)
                        seriesKeywords.any { group.contains(it) } -> seriesChannels.add(channel)
                        else -> liveChannels.add(channel)
                    }
                }

                _uiState.value = HomeUiState(
                    isLoading = false,
                    liveChannels = liveChannels,
                    movieChannels = movieChannels,
                    seriesChannels = seriesChannels,
                    groups = playlist.groups,
                    channelCount = channels.size
                )
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load playlist"
                )
            }
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
