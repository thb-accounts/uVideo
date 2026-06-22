package site.unrealcake8.simplichilltv.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.progressDataStore by preferencesDataStore("continue_watching")

class ProgressStore(private val context: Context) {
    private fun key(id: String) = longPreferencesKey("video_$id")
    suspend fun save(videoId: String, positionMs: Long) { context.progressDataStore.edit { it[key(videoId)] = positionMs } }
    suspend fun read(videoId: String): Long = context.progressDataStore.data.first()[key(videoId)] ?: 0L
    suspend fun all(): Map<String, Long> = context.progressDataStore.data.first().asMap().mapNotNull { (k, v) ->
        val name = k.name.removePrefix("video_"); if (v is Long && v > 0L) name to v else null
    }.toMap()
}
