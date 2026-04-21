package com.iptv.player.ui.favorites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.FavoriteChannel
import com.iptv.player.data.model.M3UChannel
import com.iptv.player.data.repository.IPTVRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FavoriteUiState(
    val favorites: List<FavoriteChannel> = emptyList(),
    val isLoading: Boolean = false
)

@HiltViewModel
class FavoriteViewModel @Inject constructor(
    private val repository: IPTVRepository
) : ViewModel() {

    val uiState: StateFlow<FavoriteUiState> = repository.getFavorites()
        .map { FavoriteUiState(favorites = it, isLoading = false) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = FavoriteUiState(isLoading = true)
        )

    fun toggleFavorite(channel: FavoriteChannel) {
        viewModelScope.launch {
            repository.removeFavorite(channel.streamUrl)
        }
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
}
