export function isBunnyStreamContent(item = {}) {
  return item.storage_provider === 'bunny_stream' || Boolean(item.bunny_video_id)
}

export function bunnyEmbedUrl(item = {}, options = {}) {
  const videoId = item.bunny_video_id || item.videoId
  const libraryId = item.bunny_library_id || item.libraryId
  if (!videoId || !libraryId) return ''

  const url = new URL(`https://iframe.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}`)
  if (options.autoplay) url.searchParams.set('autoplay', 'true')
  if (options.muted) url.searchParams.set('muted', 'true')
  if (options.loop) url.searchParams.set('loop', 'true')
  if (options.preload) url.searchParams.set('preload', 'true')
  return url.toString()
}
