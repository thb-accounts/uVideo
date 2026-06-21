const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

const units = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
]

export function relativeDate(value) {
  if (!value) return 'Recently uploaded'

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Recently uploaded'

  const elapsedSeconds = (timestamp - Date.now()) / 1000
  const absoluteSeconds = Math.abs(elapsedSeconds)

  if (absoluteSeconds < 45) return 'Just now'

  const match = units.find(({ seconds }) => absoluteSeconds >= seconds) || units[units.length - 1]
  return relativeFormatter.format(Math.round(elapsedSeconds / match.seconds), match.unit)
}
