package com.iptv.player.ui.home

import androidx.compose.runtime.Immutable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.model.RecentChannel
import com.iptv.player.data.model.XtreamHomeResponse
import com.iptv.player.data.repository.IPTVRepository
import com.iptv.player.util.ConnectionState
import com.iptv.player.util.NetworkObserver
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@Immutable
sealed class HomeFeedItem {
    /**
     * Featured carousel. Typically 3–5 channels; the first is the user's top
     * favourite (when known), then curated seeds from the largest categories.
     */
    @Immutable
    data class Hero(val channels: List<M3UChannel>) : HomeFeedItem()
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
    private val _xtreamHome = MutableStateFlow<XtreamHomeResponse?>(null)
    private val _activePlaylistUrl = MutableStateFlow("")
    private val _isXtreamMode = MutableStateFlow(false)

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _isSearchActive = MutableStateFlow(false)
    val isSearchActive: StateFlow<Boolean> = _isSearchActive.asStateFlow()

    private val _searchResults = MutableStateFlow<List<M3UChannel>>(emptyList())
    val searchResults: StateFlow<List<M3UChannel>> = _searchResults.asStateFlow()

    private var searchJob: Job? = null

    val connectionState: StateFlow<ConnectionState> = networkObserver.connectionState
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ConnectionState.Available)

    val favorites: StateFlow<List<FavoriteChannel>> = repository.getFavorites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val recentChannels: StateFlow<List<RecentChannel>> = repository.getRecent()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        // Observe favorites and recents to rebuild feed dynamically
        combine(recentChannels, favorites, _allChannels, _xtreamHome) { recents, favs, channels, xtreamHome ->
            when {
                xtreamHome != null -> buildXtreamFeed(xtreamHome, recents, favs)
                channels.isNotEmpty() -> buildHomeFeed(channels, recents, favs)
            }
        }.launchIn(viewModelScope)
    }

    fun loadPlaylist(playlistUrl: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _loadingProgress.value = 0.1f
            _feedState.value = _feedState.value.copy(error = null)
            _activePlaylistUrl.value = playlistUrl
            _searchResults.value = emptyList()

            if (repository.isXtreamPlaylistUrl(playlistUrl)) {
                _isXtreamMode.value = true
                _allChannels.value = emptyList()
                _xtreamHome.value = null
                val result = repository.loadXtreamHome(playlistUrl)
                result.onSuccess { home ->
                    _loadingProgress.value = 0.7f
                    _xtreamHome.value = home
                }.onFailure { e ->
                    viewModelScope.launch {
                        loadDirectPlaylistFallback(
                            playlistUrl = playlistUrl,
                            fallbackReason = e.message ?: "Xtream proxy unavailable"
                        )
                    }
                }
                return@launch
            }

            _isXtreamMode.value = false
            _xtreamHome.value = null
            _allChannels.value = emptyList()
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

    private suspend fun loadDirectPlaylistFallback(
        playlistUrl: String,
        fallbackReason: String
    ) {
        _isXtreamMode.value = false
        _xtreamHome.value = null
        _allChannels.value = emptyList()
        _loadingProgress.value = 0.2f

        val fallbackResult = repository.loadPlaylist(playlistUrl)
        fallbackResult.onSuccess { playlist ->
            _loadingProgress.value = 0.5f
            _allChannels.value = playlist.channels
        }.onFailure { fallbackError ->
            _isLoading.value = false
            _feedState.value = _feedState.value.copy(
                error = buildString {
                    append(fallbackReason)
                    append(". ")
                    append(fallbackError.message ?: "Failed to load playlist")
                }
            )
        }
    }

    private suspend fun buildHomeFeed(
        channels: List<M3UChannel>,
        recents: List<RecentChannel>,
        favs: List<FavoriteChannel>
    ) {
        withContext(Dispatchers.Default) {
            val items = mutableListOf<HomeFeedItem>()

            // 1. Hero carousel — up to 5 featured channels.
            //    Order: favourites first (so users see "their" content), then
            //    the first channel of each of the biggest groups. Deduped.
            val heroCandidates = buildList {
                // Favourites that actually exist in the current playlist.
                favs.asSequence()
                    .mapNotNull { f -> channels.find { it.streamUrl == f.streamUrl } }
                    .forEach(::add)
                // Top channel from each of the largest groups.
                channels.groupBy { it.groupTitle }
                    .entries
                    .sortedByDescending { it.value.size }
                    .forEach { (_, groupChannels) -> groupChannels.firstOrNull()?.let(::add) }
            }
                .distinctBy { it.streamUrl }
                .take(5)

            if (heroCandidates.isNotEmpty()) {
                items.add(HomeFeedItem.Hero(heroCandidates))
            }

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

    private suspend fun buildXtreamFeed(
        home: XtreamHomeResponse,
        recents: List<RecentChannel>,
        favs: List<FavoriteChannel>
    ) {
        withContext(Dispatchers.Default) {
            val items = mutableListOf<HomeFeedItem>()

            val heroCandidates = buildList {
                favs.asSequence()
                    .mapNotNull { favorite ->
                        home.categories.asSequence()
                            .flatMap { it.channels.asSequence() }
                            .firstOrNull { it.streamUrl == favorite.streamUrl }
                    }
                    .forEach(::add)
                addAll(home.featured)
            }
                .distinctBy { it.streamUrl }
                .take(5)

            if (heroCandidates.isNotEmpty()) {
                items.add(HomeFeedItem.Hero(heroCandidates))
            }

            if (recents.isNotEmpty()) {
                items.add(HomeFeedItem.SectionHeader("Continue Watching"))
                items.add(HomeFeedItem.ContinueWatchingRow(recents.take(15)))
            }

            home.categories.forEach { category ->
                if (category.channels.isNotEmpty()) {
                    items.add(HomeFeedItem.SectionHeader(category.title))
                    items.add(
                        HomeFeedItem.CategoryRow(
                            category.title,
                            category.channels.map { it.copy(groupTitle = category.title) }
                        )
                    )
                }
            }

            _feedState.value = HomeUiState(
                error = null,
                feedItems = items,
                channelCount = home.categories.sumOf { it.channels.size }
            )
            _isLoading.value = false
            _loadingProgress.value = 1f
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        searchJob?.cancel()
        if (query.isBlank()) {
            _searchResults.value = emptyList()
            return
        }

        searchJob = viewModelScope.launch {
            kotlinx.coroutines.delay(300L)
            if (_isXtreamMode.value) {
                repository.searchXtreamChannels(_activePlaylistUrl.value, query)
                    .onSuccess { results -> _searchResults.value = results }
                    .onFailure {
                        val directChannels = ensureDirectFallbackChannelsLoaded()
                        _searchResults.value = withContext(Dispatchers.Default) {
                            directChannels.filter { channel ->
                                channel.name.contains(query, ignoreCase = true) ||
                                    channel.groupTitle.contains(query, ignoreCase = true)
                            }
                        }
                    }
            } else {
                _searchResults.value = withContext(Dispatchers.Default) {
                    _allChannels.value.filter { channel ->
                        channel.name.contains(query, ignoreCase = true) ||
                            channel.groupTitle.contains(query, ignoreCase = true)
                    }
                }
            }
        }
    }

    private suspend fun ensureDirectFallbackChannelsLoaded(): List<M3UChannel> {
        if (!_isXtreamMode.value && _allChannels.value.isNotEmpty()) {
            return _allChannels.value
        }

        val fallbackResult = repository.loadPlaylist(_activePlaylistUrl.value)
        return fallbackResult.fold(
            onSuccess = { playlist ->
                _isXtreamMode.value = false
                _xtreamHome.value = null
                _allChannels.value = playlist.channels
                playlist.channels
            },
            onFailure = {
                emptyList()
            }
        )
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
