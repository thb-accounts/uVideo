package site.unrealcake8.simplichilltv

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import site.unrealcake8.simplichilltv.data.ApiProvider
import site.unrealcake8.simplichilltv.data.ProgressStore
import site.unrealcake8.simplichilltv.data.VideoDto

data class TvUiState(val loading: Boolean = true, val videos: List<VideoDto> = emptyList(), val progressIds: List<String> = emptyList(), val error: String? = null)

class TvViewModel(app: Application) : AndroidViewModel(app) {
    private val progress = ProgressStore(app)
    private val _state = MutableStateFlow(TvUiState())
    val state: StateFlow<TvUiState> = _state.asStateFlow()
    init { refresh() }
    private fun refresh() = viewModelScope.launch {
        try {
            val videos = ApiProvider.videoApi.feed().videos.filter { it.playableUrl.isNotBlank() }
            val continueIds = progress.all().keys.toList()
            _state.value = TvUiState(loading = false, videos = videos, progressIds = continueIds)
        } catch (e: Exception) { _state.value = TvUiState(loading = false, error = "Could not load SimpliChill videos: ${e.message}") }
    }
}
