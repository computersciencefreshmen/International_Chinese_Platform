import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@/assets/style/tailwind.css' // 引入 Tailwind CSS

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
