package site.unrealcake8.simplichilltv.player

import android.view.KeyEvent
import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.launch
import site.unrealcake8.simplichilltv.data.ProgressStore

@Composable
fun PlayerScreen(videoId: String, url: String, exit: () -> Unit) {
    val context = LocalContext.current; val scope = rememberCoroutineScope(); val store = remember { ProgressStore(context) }
    val player = remember { ExoPlayer.Builder(context).build() }
    LaunchedEffect(url) {
        val item = MediaItem.Builder().setUri(url).apply { if (url.endsWith(".m3u8", true)) setMimeType(MimeTypes.APPLICATION_M3U8) }.build()
        player.setMediaItem(item); player.seekTo(store.read(videoId)); player.prepare(); player.playWhenReady = true
    }
    fun saveAndExit() { scope.launch { store.save(videoId, player.currentPosition); player.release(); exit() } }
    BackHandler { saveAndExit() }
    DisposableEffect(Unit) { onDispose { scope.launch { store.save(videoId, player.currentPosition) }; player.release() } }
    AndroidView(factory = {
        PlayerView(it).apply { this.player = player; useController = true; layoutParams = ViewGroup.LayoutParams(-1, -1); requestFocus() }
    }, modifier = Modifier.fillMaxSize().onPreviewKeyEvent {
        if (it.nativeKeyEvent.action != KeyEvent.ACTION_DOWN) false else when (it.nativeKeyEvent.keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { if (player.isPlaying) player.pause() else player.play(); true }
            KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { player.seekTo(player.currentPosition + 10_000); true }
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_MEDIA_REWIND -> { player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0)); true }
            KeyEvent.KEYCODE_BACK -> { saveAndExit(); true }
            else -> false
        }
    })
}
