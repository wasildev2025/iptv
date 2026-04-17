package com.iptv.player.ui.player

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.repository.IPTVRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val repository: IPTVRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    // Note: Navigation component automatically decodes path parameters, 
    // so we don't need to call URLDecoder.decode manually here.
    val streamUrl: String = savedStateHandle.get<String>("streamUrl") ?: ""
    val channelName: String = savedStateHandle.get<String>("channelName") ?: ""
    val groupTitle: String = savedStateHandle.get<String>("groupTitle") ?: ""
    val logoUrl: String = savedStateHandle.get<String>("logoUrl") ?: ""

    private val _isFavorite = MutableStateFlow(false)
    val isFavorite: StateFlow<Boolean> = _isFavorite.asStateFlow()

    private val _playerError = MutableStateFlow<String?>(null)
    val playerError: StateFlow<String?> = _playerError.asStateFlow()

    init {
        addToRecentHistory()
        checkFavoriteStatus()
    }

    private fun toM3UChannel() = M3UChannel(
        name = channelName,
        groupTitle = groupTitle,
        logoUrl = logoUrl,
        streamUrl = streamUrl
    )

    private fun addToRecentHistory() {
        if (streamUrl.isBlank()) return
        viewModelScope.launch {
            repository.addRecent(toM3UChannel())
        }
    }

    private fun checkFavoriteStatus() {
        if (streamUrl.isBlank()) return
        viewModelScope.launch {
            _isFavorite.value = repository.isFavorite(streamUrl)
        }
    }

    fun toggleFavorite() {
        if (streamUrl.isBlank()) return
        viewModelScope.launch {
            if (_isFavorite.value) {
                repository.removeFavorite(streamUrl)
                _isFavorite.value = false
            } else {
                repository.addFavorite(toM3UChannel())
                _isFavorite.value = true
            }
        }
    }

    fun onPlayerError(error: String) {
        _playerError.value = error
    }

    fun clearError() {
        _playerError.value = null
    }
}
