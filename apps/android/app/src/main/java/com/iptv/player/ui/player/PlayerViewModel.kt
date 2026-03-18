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
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject

@HiltViewModel
class PlayerViewModel @Inject constructor(
    private val repository: IPTVRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    val streamUrl: String = savedStateHandle.get<String>("streamUrl")?.let {
        URLDecoder.decode(it, StandardCharsets.UTF_8.toString())
    } ?: ""

    val channelName: String = savedStateHandle.get<String>("channelName")?.let {
        URLDecoder.decode(it, StandardCharsets.UTF_8.toString())
    } ?: ""

    val groupTitle: String = savedStateHandle.get<String>("groupTitle")?.let {
        URLDecoder.decode(it, StandardCharsets.UTF_8.toString())
    } ?: ""

    val logoUrl: String = savedStateHandle.get<String>("logoUrl")?.let {
        URLDecoder.decode(it, StandardCharsets.UTF_8.toString())
    } ?: ""

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
