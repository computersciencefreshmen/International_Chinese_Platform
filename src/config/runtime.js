const normalizeBaseUrl = (value) => {
  const configured = value?.trim()
  if (!configured) return '/api/v1'
  if (configured === '/') return configured
  return configured.replace(/\/+$/, '')
}

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
