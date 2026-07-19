import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getSession,
  loginByRole,
  logoutSession,
  registerByRole
} from '@/api/user'

const supportedRoles = new Set(['student', 'teacher', 'administrator'])

const sanitizeProfile = (value) => {
  if (!value || typeof value !== 'object') return null

  const profile = { ...value }
  delete profile.token
  delete profile.accessToken
  delete profile.access_token
  return profile
}

// 清除旧版本曾持久化的 bearer token。当前会话只由 HttpOnly Cookie 表示。
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('big-store')
  } catch {
    // 某些隐私模式会禁用 localStorage；Cookie 会话本身不受影响。
  }
}

export const useUserStore = defineStore('big-store', () => {
  const role = ref(null)
  const profile = ref(null)
  const sessionRestored = ref(false)
  const isRestoring = ref(false)
  let restorePromise = null

  const isAuthenticated = computed(() =>
    Boolean(profile.value && supportedRoles.has(role.value))
  )

  const setSession = (nextRole, payload = {}) => {
    const nextProfile = sanitizeProfile(
      typeof nextRole === 'object' ? nextRole : payload
    )
    const resolvedRole =
      typeof nextRole === 'string' ? nextRole : nextProfile?.role

    if (!nextProfile || !supportedRoles.has(resolvedRole)) {
      role.value = null
      profile.value = null
      sessionRestored.value = true
      return null
    }

    role.value = resolvedRole
    profile.value = { ...nextProfile, role: resolvedRole }
    sessionRestored.value = true
    return profile.value
  }

  const clearSession = ({ markRestored = true } = {}) => {
    role.value = null
    profile.value = null
    sessionRestored.value = markRestored
  }

  const restoreSession = async ({ force = false } = {}) => {
    if (sessionRestored.value && !force) return profile.value
    if (restorePromise) return restorePromise

    isRestoring.value = true
    restorePromise = getSession()
      .then((response) => setSession(response.data?.data))
      .catch(() => {
        clearSession()
        return null
      })
      .finally(() => {
        isRestoring.value = false
        restorePromise = null
      })

    return restorePromise
  }

  const login = async ({ email, password, role: requestedRole }) => {
    const response = await loginByRole(requestedRole, email, password)
    return setSession(response.data?.data)
  }

  const register = async (registration) => {
    const response = await registerByRole(registration)
    return setSession(response.data?.data)
  }

  const logout = async () => {
    try {
      await logoutSession()
    } finally {
      clearSession()
    }
  }

  return {
    role,
    profile,
    sessionRestored,
    isRestoring,
    isAuthenticated,
    setSession,
    clearSession,
    restoreSession,
    login,
    register,
    logout
  }
})
