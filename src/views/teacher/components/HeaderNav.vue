<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores'
import defaultAvatar from '@/assets/student/avatar.png'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isLoggingOut = ref(false)

const navigation = [
  { label: '首页', path: '/teacher/home', section: 'home' },
  {
    label: '授课对接',
    path: '/teacher/teachingDocking',
    section: 'teachingDocking'
  },
  {
    label: '网络课程',
    path: '/teacher/onlineCourses',
    section: 'courses'
  }
]

const profile = computed(() => userStore.profile || {})
const displayName = computed(() => profile.value.displayName || '教师用户')
const avatarUrl = computed(() => profile.value.avatarUrl || defaultAvatar)

const activeSection = computed(() => {
  if (route.path === '/teacher/home') return 'home'
  if (route.path.startsWith('/teacher/teachingDocking')) {
    return 'teachingDocking'
  }
  if (
    [
      '/teacher/onlineCourses',
      '/teacher/uploadCourses',
      '/teacher/courseDetails'
    ].some((path) => route.path.startsWith(path))
  ) {
    return 'courses'
  }
  if (route.path.startsWith('/teacher/user')) return 'user'
  return ''
})

const goTo = (path) => router.push(path)

const handleLogout = async () => {
  if (isLoggingOut.value) return

  isLoggingOut.value = true
  try {
    await userStore.logout()
  } catch {
    // 服务端不可达时 store 仍会清除本地会话，继续返回登录页。
  } finally {
    isLoggingOut.value = false
    await router.replace('/login')
  }
}
</script>

<template>
  <header
    class="header-nav fixed top-0 left-0 z-50 flex h-24 w-full items-center justify-between bg-primary px-4 py-2"
  >
    <div class="flex min-w-0 items-center">
      <button
        type="button"
        class="logo-container mr-5 flex shrink-0 items-center"
        aria-label="返回教师首页"
        @click="goTo('/teacher/home')"
      >
        <img class="h-14 w-14" src="/src/assets/icon/logo.png" alt="" />
        <img
          class="h-14 w-56 xl:w-64 2xl:h-16 2xl:w-72"
          src="/src/assets/icon/textLogo.png"
          alt="国际中文教育平台"
        />
      </button>

      <nav class="flex items-center" aria-label="教师工作台主导航">
        <button
          v-for="item in navigation"
          :key="item.path"
          type="button"
          class="mr-3 cursor-pointer rounded-3xl px-5 py-3 text-xl ring-blue-500/50 transition duration-300 hover:ring-2 2xl:text-2xl"
          :class="{ 'bg-sky-200': activeSection === item.section }"
          :aria-current="activeSection === item.section ? 'page' : undefined"
          @click="goTo(item.path)"
        >
          {{ item.label }}
        </button>
      </nav>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="message-button rounded-2xl p-2 transition hover:bg-sky-200"
        title="查看消息通知"
        aria-label="查看消息通知"
        @click="goTo('/teacher/user')"
      >
        <img class="h-9 w-9" src="/src/assets/student/message.png" alt="" />
      </button>

      <button
        type="button"
        class="flex items-center rounded-3xl px-3 py-2 ring-blue-500/50 transition duration-300 hover:ring-2"
        :class="{ 'bg-sky-200': activeSection === 'user' }"
        :aria-current="activeSection === 'user' ? 'page' : undefined"
        @click="goTo('/teacher/user')"
      >
        <img
          class="mr-3 h-12 w-12 rounded-full object-cover"
          :src="avatarUrl"
          alt=""
        />
        <span class="max-w-32 truncate text-xl">{{ displayName }}</span>
      </button>

      <button
        type="button"
        class="ml-1 rounded-2xl border border-red-200 bg-white/90 px-4 py-2 font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
        :disabled="isLoggingOut"
        @click="handleLogout"
      >
        {{ isLoggingOut ? '退出中…' : '退出登录' }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.logo-container,
.message-button {
  border: 0;
  background-color: transparent;
  cursor: pointer;
}
</style>
