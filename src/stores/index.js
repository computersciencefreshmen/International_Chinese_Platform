import { createPinia } from 'pinia'
import persist from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(persist)
export default pinia

export * from './modules/user'
export * from './modules/localeStore'
export * from './modules/studentPerson'
export * from './modules/adminPerson'
