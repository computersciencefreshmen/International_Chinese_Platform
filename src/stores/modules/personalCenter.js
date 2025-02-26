import { defineStore } from 'pinia'
import { ref } from 'vue'

//用户登录模块
export const usePersonalStore = defineStore(
  'Personal-store',
  () => {
    // 定义个人中心高亮tab栏的下标
    const isTabActive = ref(0)
    return {
      isTabActive
    }
  },
  {
    persist: true
  }
)
