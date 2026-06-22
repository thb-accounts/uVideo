package site.unrealcake8.simplichilltv.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable data class AuthorDto(val id: String? = null, val username: String? = null, val fullName: String? = null, val avatarUrl: String? = null)
@Serializable data class CountDto(val likes: Int = 0, val comments: Int = 0)
@Serializable data class VideoDto(
    val id: String,
    val title: String? = null,
    val caption: String? = null,
    val description: String? = null,
    val category: String? = null,
    val type: String? = null,
    val duration: String? = null,
    @SerialName("media_url") val mediaUrlSnake: String? = null,
    val mediaUrl: String? = null,
    val videoUrl: String? = null,
    @SerialName("thumbnail_url") val thumbnailUrlSnake: String? = null,
    val thumbnail: String? = null,
    val username: String? = null,
    val createdAt: String? = null,
    @SerialName("created_at") val createdAtSnake: String? = null,
    val author: AuthorDto? = null,
    val _count: CountDto? = null,
) {
    val playableUrl: String get() = mediaUrlSnake ?: mediaUrl ?: videoUrl ?: ""
    val imageUrl: String? get() = thumbnailUrlSnake ?: thumbnail
    val displayTitle: String get() = title ?: caption ?: "Untitled SimpliChill video"
    val creator: String get() = username ?: author?.username ?: author?.fullName ?: "SimpliChill creator"
    val displayCategory: String get() = category ?: type ?: "General"
}
@Serializable data class VideoFeedResponse(val videos: List<VideoDto> = emptyList())
