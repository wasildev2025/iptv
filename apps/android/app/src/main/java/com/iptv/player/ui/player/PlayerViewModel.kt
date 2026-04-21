package com.iptv.player.ui.player

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.EpgProgram
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.repository.IPTVRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlayerUiState(
    val currentChannel: M3UChannel? = null,
    val isFavorite: Boolean = false,
    val playerError: String? = null,
    val isMiniEpgVisible: Boolean = false,
    val currentPrograms: List<EpgProgram> = emptyList(),
    val nextChannel: M3UChannel? = null,
    val previousChannel: M3UChannel? = null
)

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val repository: IPTVRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val initialStreamUrl: String = savedStateHandle.get<String>("streamUrl") ?: ""
    private val initialChannelName: String = savedStateHandle.get<String>("channelName") ?: ""
    private val initialGroupTitle: String = savedStateHandle.get<String>("groupTitle") ?: ""
    private val initialLogoUrl: String = savedStateHandle.get<String>("logoUrl") ?: ""

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var allChannels: List<M3UChannel> = emptyList()
    private var epgJob: Job? = null

    init {
        val initialChannel = M3UChannel(
            name = initialChannelName,
            groupTitle = initialGroupTitle,
            logoUrl = initialLogoUrl,
            streamUrl = initialStreamUrl
        )
        _uiState.value = _uiState.value.copy(currentChannel = initialChannel)
        
        loadChannels()
        addToRecentHistory(initialChannel)
        checkFavoriteStatus(initialStreamUrl)
        loadEpg(initialChannel)
    }

    private fun loadChannels() {
        viewModelScope.launch {
            // Only load siblings within the same group — this keeps the query
            // under SQLite's CursorWindow limit even for Xtream panels with
            // 50k+ VOD entries, and matches user expectation for zap-next
            // (next channel within the current category, not the next alphabetically).
            val currentGroup = _uiState.value.currentChannel?.groupTitle.orEmpty()
            val cached = if (currentGroup.isBlank()) {
                // Fallback: first page of all channels.
                repository.getCachedChannelsPage(limit = 500, offset = 0)
            } else {
                repository.getChannelsByGroup(currentGroup)
            }
            allChannels = cached.map {
                M3UChannel(it.name, it.groupTitle, it.logoUrl, it.streamUrl, it.tvgId)
            }
            updateAdjacentChannels()
        }
    }

    private fun updateAdjacentChannels() {
        val current = _uiState.value.currentChannel ?: return
        val index = allChannels.indexOfFirst { it.streamUrl == current.streamUrl }
        if (index != -1) {
            val prev = if (index > 0) allChannels[index - 1] else allChannels.lastOrNull()
            val next = if (index < allChannels.size - 1) allChannels[index + 1] else allChannels.firstOrNull()
            _uiState.value = _uiState.value.copy(previousChannel = prev, nextChannel = next)
        }
    }

    fun zapNext() {
        _uiState.value.nextChannel?.let { switchToChannel(it) }
    }

    fun zapPrevious() {
        _uiState.value.previousChannel?.let { switchToChannel(it) }
    }

    private fun switchToChannel(channel: M3UChannel) {
        _uiState.value = _uiState.value.copy(
            currentChannel = channel,
            playerError = null,
            isMiniEpgVisible = false
        )
        addToRecentHistory(channel)
        checkFavoriteStatus(channel.streamUrl)
        loadEpg(channel)
        updateAdjacentChannels()
    }

    private fun loadEpg(channel: M3UChannel) {
        epgJob?.cancel() // Cancel stale EPG requests during rapid zapping
        epgJob = viewModelScope.launch {
            repository.getProgramsForChannel(channel.tvgId).collect { programs ->
                _uiState.value = _uiState.value.copy(currentPrograms = programs)
            }
        }
    }

    private fun addToRecentHistory(channel: M3UChannel) {
        viewModelScope.launch {
            repository.addRecent(channel)
        }
    }

    private fun checkFavoriteStatus(url: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isFavorite = repository.isFavorite(url))
        }
    }

    fun toggleFavorite() {
        val channel = _uiState.value.currentChannel ?: return
        viewModelScope.launch {
            if (_uiState.value.isFavorite) {
                repository.removeFavorite(channel.streamUrl)
                _uiState.value = _uiState.value.copy(isFavorite = false)
            } else {
                repository.addFavorite(channel)
                _uiState.value = _uiState.value.copy(isFavorite = true)
            }
        }
    }

    fun toggleMiniEpg() {
        _uiState.value = _uiState.value.copy(isMiniEpgVisible = !_uiState.value.isMiniEpgVisible)
    }

    fun onPlayerError(error: String) {
        _uiState.value = _uiState.value.copy(playerError = error)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(playerError = null)
    }

    override fun onCleared() {
        super.onCleared()
        epgJob?.cancel()
    }
}
