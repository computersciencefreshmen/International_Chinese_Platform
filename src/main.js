import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/style/tailwind.css' // 引入 Tailwind CSS
import i18n from '@/i18n' // 引入 i18n

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n) // 使用 i18n

app.mount('#app')
