import { defineStore } from 'pinia'

// 用户信息模块
export const useUserStore = defineStore('user', {
  state: () => ({
    basicUser: {
      token: '',
      role: '',
      email: ''
    }
  }),
  getters: {
    token: (state) => state.basicUser.token,
    role: (state) => state.basicUser.role
  },
  actions: {
    setUserInfo(payload) {
      this.basicUser.token = payload.token
      this.basicUser.role = payload.role
      this.basicUser.email = payload.email
    },
    clearUserInfo() {
      this.basicUser.token = ''
      this.basicUser.role = ''
      this.basicUser.email = ''
    },
    clearToken() {
      this.basicUser.token = ''
    },
    async getUserInfo() {
      // 这里可以添加获取用户信息的API调用
      // 目前由于没有对应的API，我们直接返回
      return Promise.resolve()
    }
  }
})
