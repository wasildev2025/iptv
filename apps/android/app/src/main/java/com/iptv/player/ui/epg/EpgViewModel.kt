package com.iptv.player.ui.epg

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.iptv.player.data.model.CachedChannel
import com.iptv.player.data.model.EpgProgram
import com.iptv.player.data.repository.IPTVRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Calendar
import javax.inject.Inject

data class EpgUiState(
    val isLoading: Boolean = false,
    val channels: List<CachedChannel> = emptyList(),
    val programs: Map<String, List<EpgProgram>> = emptyMap(), // channelId -> programs
    val startTimeMillis: Long = 0L,
    val endTimeMillis: Long = 0L,
    val error: String? = null
)

@HiltViewModel
class EpgViewModel @Inject constructor(
    private val repository: IPTVRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(EpgUiState())
    val uiState: StateFlow<EpgUiState> = _uiState.asStateFlow()

    init {
        val now = Calendar.getInstance()
        now.set(Calendar.MINUTE, 0)
        now.set(Calendar.SECOND, 0)
        now.set(Calendar.MILLISECOND, 0)
        val start = now.timeInMillis
        val end = start + (24 * 60 * 60 * 1000) // 24 hours

        _uiState.value = _uiState.value.copy(
            startTimeMillis = start,
            endTimeMillis = end
        )
        loadEpg()
    }

    fun loadEpg() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val channels = repository.getCachedChannels()
                val programsList = repository.getProgramsInRange(
                    _uiState.value.startTimeMillis,
                    _uiState.value.endTimeMillis
                )
                
                val programsMap = programsList.groupBy { it.channelId }
                
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    channels = channels,
                    programs = programsMap
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Failed to load EPG"
                )
            }
        }
    }
    
    fun onChannelClick(channel: CachedChannel) {
        // Handle channel selection (e.g. navigate to player)
    }
}
