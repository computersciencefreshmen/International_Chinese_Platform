<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoComponent from '@/components/service/logoComponent.vue'
import { useUserStore } from '@/stores'
import defaultAvatar from '@/assets/student/avatar.png'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isLoggingOut = ref(false)

const navigation = [
  { name: '课程对接', path: '/administrator/courseDocking' },
  { name: '审核中心', path: '/administrator/auditCenter' },
  { name: '数据中心', path: '/administrator/dataCenter' }
]

const profile = computed(() => userStore.profile || {})
const displayName = computed(() => profile.value.displayName || '平台管理员')
const avatarUrl = computed(() => profile.value.avatarUrl || defaultAvatar)

const activePath = computed(() => route.path)
const isNavigationActive = (path) => activePath.value.startsWith(path)
const isMessageActive = computed(
  () => activePath.value === '/administrator/center/AdminMessage'
)
const isProfileActive = computed(
  () =>
    activePath.value.startsWith('/administrator/center') &&
    !isMessageActive.value
)

const goTo = (path) => router.push(path)

const handleLogout = async () => {
  if (isLoggingOut.value) return

  isLoggingOut.value = true
  try {
    await userStore.logout()
  } catch {
    // 即使退出接口暂时不可用，store 也会清除本地会话。
  } finally {
    isLoggingOut.value = false
    await router.replace('/login')
  }
}
</script>

<template>
  <div class="bg-image flex min-h-screen flex-col">
    <header
      class="admin-header sticky top-0 z-[100] flex min-h-16 flex-row items-center border-b border-gray-300 bg-primary bg-primary1 px-4 py-1"
    >
      <button
        type="button"
        class="logo-button shrink-0 rounded-lg p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        aria-label="返回管理员课程对接页"
        @click="goTo('/administrator/courseDocking')"
      >
        <logoComponent />
      </button>

      <nav
        class="ml-8 flex min-w-0 flex-1 flex-row items-center"
        aria-label="管理员工作台主导航"
      >
        <button
          v-for="item in navigation"
          :key="item.path"
          type="button"
          class="nav-item mx-1 cursor-pointer rounded-lg px-4 py-2 text-base font-medium transition hover:bg-blue-300 lg:text-xl"
          :class="{ active: isNavigationActive(item.path) }"
          :aria-current="isNavigationActive(item.path) ? 'page' : undefined"
          @click="goTo(item.path)"
        >
          {{ item.name }}
        </button>
      </nav>

      <div class="flex shrink-0 items-center justify-center gap-2">
        <button
          type="button"
          class="icon-button rounded-lg border-2 p-2 transition hover:border-blue-300 hover:bg-blue-50"
          :class="
            isMessageActive ? 'border-blue-300 bg-blue-50' : 'border-primary'
          "
          title="查看消息通知"
          aria-label="查看消息通知"
          :aria-current="isMessageActive ? 'page' : undefined"
          @click="goTo('/administrator/center/AdminMessage')"
        >
          <img class="h-6 w-6" src="@/assets/student/message.png" alt="" />
        </button>

        <button
          type="button"
          class="flex max-w-52 items-center justify-center rounded-full p-1 transition hover:bg-blue-300"
          :class="{ 'bg-blue-300': isProfileActive }"
          :aria-current="isProfileActive ? 'page' : undefined"
          @click="goTo('/administrator/center/changePasswordAdmin')"
        >
          <img
            class="mr-2 h-10 w-10 rounded-full border-2 border-gray-300 object-cover"
            :src="avatarUrl"
            alt=""
          />
          <span class="truncate">{{ displayName }}</span>
        </button>

        <button
          type="button"
          class="rounded-lg border border-red-200 bg-white/90 px-3 py-2 font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
          :disabled="isLoggingOut"
          @click="handleLogout"
        >
          {{ isLoggingOut ? '退出中…' : '退出登录' }}
        </button>
      </div>
    </header>

    <router-view class="flex-1" />
  </div>
</template>

<style scoped>
.logo-button,
.nav-item,
.icon-button {
  border-style: solid;
  cursor: pointer;
}

.logo-button,
.nav-item {
  border-color: transparent;
  background-color: transparent;
}

.nav-item {
  position: relative;
}

.nav-item.active {
  background-color: rgb(147 197 253);
}

.nav-item.active::after {
  position: absolute;
  right: 12px;
  bottom: -5px;
  left: 12px;
  height: 4px;
  border-radius: 9999px;
  background: rgb(147 197 253);
  content: '';
}
</style>
