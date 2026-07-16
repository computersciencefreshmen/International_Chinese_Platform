const env = import.meta.env

const normalizeBaseUrl = (value) => {
  const normalizedValue = value?.trim()

  if (!normalizedValue) return '/'
  if (normalizedValue === '/') return normalizedValue

  return normalizedValue.replace(/\/+$/, '')
}

const getDefaultWebSocketUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost/websocket'

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/websocket`
}

const normalizeWebSocketUrl = (value) => {
  const fallbackUrl = getDefaultWebSocketUrl()
  const configuredUrl = value?.trim()

  if (!configuredUrl) return fallbackUrl

  try {
    const baseUrl =
      typeof window === 'undefined' ? 'http://localhost/' : window.location.href
    const url = new URL(configuredUrl, baseUrl)

    if (url.protocol === 'http:') url.protocol = 'ws:'
    if (url.protocol === 'https:') url.protocol = 'wss:'
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      url.protocol === 'ws:'
    ) {
      url.protocol = 'wss:'
    }

    if (!['ws:', 'wss:'].includes(url.protocol)) return fallbackUrl

    return url.toString()
  } catch {
    return fallbackUrl
  }
}

export const API_BASE_URL = normalizeBaseUrl(env.VITE_API_BASE_URL)
export const FORUM_API_URL = env.VITE_FORUM_API_URL?.trim() || '/process_words'
export const WS_URL = normalizeWebSocketUrl(env.VITE_WEBSOCKET_URL)

export const createWebSocketUrl = (token) => {
  const url = new URL(WS_URL)
  const normalizedToken = token == null ? '' : String(token).trim()

  if (normalizedToken) {
    url.searchParams.set('token', normalizedToken)
  }

  return url.toString()
}
