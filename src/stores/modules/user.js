import { defineStore } from 'pinia'

//用户登录模块
export const useUserStore = defineStore(
  'big-store',
  () => {
    return {}
  },
  {
    persist: true
  }
)
