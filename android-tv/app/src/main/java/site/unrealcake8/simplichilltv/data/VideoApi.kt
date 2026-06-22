package site.unrealcake8.simplichilltv.data

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.Retrofit
import retrofit2.http.GET

interface VideoApi { @GET("videos/feed") suspend fun feed(): VideoFeedResponse }

object ApiProvider {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    val videoApi: VideoApi = Retrofit.Builder()
        .baseUrl(ApiConfig.BASE_URL)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build().create(VideoApi::class.java)
}
