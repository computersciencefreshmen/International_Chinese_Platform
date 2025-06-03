import { defineStore } from 'pinia'
import i18n from '@/i18n'

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: 'zh' // 默认语言
  }),
  actions: {
    setLocale(locale) {
      this.locale = locale
      localStorage.setItem('lang', locale)
      i18n.global.locale.value = locale // 同步到 vue-i18n
    }
  }
})
