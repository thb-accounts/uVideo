export function isBunnyStreamContent(item = {}) {
  return item.storage_provider === 'bunny_stream' || Boolean(item.bunny_video_id)
}

export function bunnyEmbedUrl(item = {}) {
  const videoId = item.bunny_video_id
  let host = ''
  try {
    host = item.media_url ? new URL(item.media_url).host : ''
  } catch {
    host = ''
  }
  if (!videoId || !host) return ''
  return `https://${host}/${videoId}/iframe`
}
