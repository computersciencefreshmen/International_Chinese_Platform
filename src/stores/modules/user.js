import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

//用户登录模块
export const useUserStore = defineStore(
  'big-store',
  () => {
    const role = ref(null)
    const token = ref(null)
    const profile = ref(null)

    const isAuthenticated = computed(() => Boolean(token.value))

    const setSession = (nextRole, payload = {}) => {
      role.value = nextRole
      token.value =
        payload.token ?? payload.accessToken ?? payload.access_token ?? null
      profile.value = payload
    }

    const clearSession = () => {
      role.value = null
      token.value = null
      profile.value = null
    }

    return {
      role,
      token,
      profile,
      isAuthenticated,
      setSession,
      clearSession
    }
  },
  {
    persist: true
  }
)
