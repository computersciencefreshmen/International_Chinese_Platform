import { createI18n } from 'vue-i18n'
import zh from '@/i18n/locales/zh.json'
import en from '@/i18n/locales/en.json'

const messages = {
  zh,
  en
}

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'zh', // 默认语言
  messages
})

export default i18n
