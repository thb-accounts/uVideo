const defaultApiBaseUrl = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api'

export const appConfig = {
  appName: 'uc8Video',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl,
  featureFlags: {
    enablePremium: true,
    enableVoiceCall: true,
    enableVideoCall: true,
    enableModeration: false,
  },
}
