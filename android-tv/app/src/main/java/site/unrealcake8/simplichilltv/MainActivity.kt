package site.unrealcake8.simplichilltv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import coil3.compose.AsyncImage
import site.unrealcake8.simplichilltv.data.VideoDto
import site.unrealcake8.simplichilltv.player.PlayerScreen
import java.net.URLDecoder
import java.net.URLEncoder

class MainActivity : ComponentActivity() { override fun onCreate(b: Bundle?) { super.onCreate(b); setContent { TvApp() } } }

@Composable fun TvApp(vm: TvViewModel = viewModel()) {
    val nav = rememberNavController(); val state by vm.state.collectAsStateWithLifecycle()
    NavHost(nav, startDestination = "home", modifier = Modifier.background(Color(0xff071219))) {
        composable("home") { HomeScreen(state, { nav.navigate("details/${it.id}") }, { nav.navigate("search") }) }
        composable("search") { SearchScreen(state.videos, { nav.navigate("details/${it.id}") }) }
        composable("details/{id}") { back -> state.videos.find { it.id == back.arguments?.getString("id") }?.let { DetailsScreen(it, { nav.navigate("player/${it.id}/${enc(it.playableUrl)}") }, { nav.popBackStack() }) } }
        composable("player/{id}/{url}", arguments = listOf(navArgument("url") { type = NavType.StringType })) { back -> PlayerScreen(back.arguments!!.getString("id")!!, dec(back.arguments!!.getString("url")!!)) { nav.popBackStack() } }
    }
}
private fun enc(s: String) = URLEncoder.encode(s, "UTF-8"); private fun dec(s: String) = URLDecoder.decode(s, "UTF-8")

@Composable fun HomeScreen(state: TvUiState, open: (VideoDto) -> Unit, search: () -> Unit) {
    LazyColumn(contentPadding = PaddingValues(40.dp), verticalArrangement = Arrangement.spacedBy(28.dp)) {
        item { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) { Text("SimpliChill", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Black); FocusButton("Search", search) } }
        if (state.loading) item { Text("Loading videos…", color = Color.White, fontSize = 24.sp) }
        state.error?.let { item { Text(it, color = Color(0xffffb4ab), fontSize = 22.sp) } }
        val progress = state.progressIds.mapNotNull { id -> state.videos.find { it.id == id } }
        if (progress.isNotEmpty()) item { Rail("Continue Watching", progress, open) }
        item { Rail("Latest", state.videos, open) }
        item { Rail("Recommended", state.videos.shuffled().ifEmpty { state.videos }, open) }
        item { CategoryRail(state.videos, open) }
    }
}
@Composable fun Rail(title: String, videos: List<VideoDto>, open: (VideoDto) -> Unit) { Column { Text(title, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(14.dp)); LazyRow(horizontalArrangement = Arrangement.spacedBy(18.dp)) { items(videos) { VideoCard(it, open) } } } }
@Composable fun CategoryRail(videos: List<VideoDto>, open: (VideoDto) -> Unit) { Column { Text("Categories", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold); Spacer(Modifier.height(14.dp)); videos.groupBy { it.displayCategory }.forEach { (cat, list) -> Text(cat, color = Color(0xff9bdcff), fontSize = 20.sp); LazyRow(horizontalArrangement = Arrangement.spacedBy(18.dp)) { items(list.take(12)) { VideoCard(it, open) } }; Spacer(Modifier.height(18.dp)) } } }
@Composable fun VideoCard(video: VideoDto, open: (VideoDto) -> Unit) { var focused by remember { mutableStateOf(false) }; Column(Modifier.width(260.dp).onFocusChanged { focused = it.isFocused }.border(if (focused) 4.dp else 0.dp, Color(0xff00c8ff)).clickable { open(video) }.padding(6.dp)) { Box(Modifier.height(146.dp).fillMaxWidth().clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp)).background(Brush.linearGradient(listOf(Color(0xff073b4c), Color(0xff00a8cc)))), Alignment.Center) { if (video.imageUrl != null) AsyncImage(video.imageUrl, null, modifier = Modifier.fillMaxSize()) else Text(video.displayTitle.take(1).uppercase(), color = Color.White, fontSize = 42.sp, fontWeight = FontWeight.Black) }; Text(video.displayTitle, color = Color.White, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis); Text("@${video.creator}", color = Color(0xffaaaaaa), maxLines = 1) } }
@Composable fun FocusButton(label: String, onClick: () -> Unit) { var f by remember { mutableStateOf(false) }; Text(label, color = if (f) Color.Black else Color.White, fontSize = 22.sp, modifier = Modifier.onFocusChanged { f = it.isFocused }.background(if (f) Color(0xff00c8ff) else Color(0xff263238)).clickable { onClick() }.padding(18.dp, 10.dp)) }
@Composable fun SearchScreen(videos: List<VideoDto>, open: (VideoDto)->Unit) { var q by remember { mutableStateOf("") }; val filtered = videos.filter { (it.displayTitle + it.creator + it.displayCategory).contains(q, true) }; LazyColumn(Modifier.padding(40.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) { item { Text("Search", color=Color.White, fontSize=34.sp, fontWeight=FontWeight.Black); TextField(q, { q = it }, placeholder={ Text("Search videos") }, modifier=Modifier.fillMaxWidth()) }; item { Rail("Results", filtered, open) } } }
@Composable fun DetailsScreen(v: VideoDto, play: ()->Unit, back: ()->Unit) { Row(Modifier.fillMaxSize().padding(56.dp), horizontalArrangement=Arrangement.spacedBy(34.dp), verticalAlignment=Alignment.CenterVertically) { VideoCard(v) {}; Column(verticalArrangement=Arrangement.spacedBy(18.dp)) { Text(v.displayTitle, color=Color.White, fontSize=36.sp, fontWeight=FontWeight.Black); Text(v.caption ?: v.description ?: v.displayCategory, color=Color(0xffdddddd), fontSize=22.sp); FocusButton("Play / Resume", play); FocusButton("Back", back) } } }
