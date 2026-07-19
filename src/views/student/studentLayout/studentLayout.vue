<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import logoComponent from '@/components/service/logoComponent.vue'
import LanguageToggle from '@/components/service/LanguageToggle.vue'
import defaultAvatar from '@/assets/student/avatar.png'
import { getNotifications } from '@/api/platform'
import { useUserStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const unread = ref(0)

const tabs = [
  { name: '学习首页', path: '/student/home', match: '/student/home' },
  { name: '预约老师', path: '/student/order', match: '/student/order' },
  { name: '网络课程', path: '/student/course', match: '/student/course' },
  { name: '对话练习', path: '/student/chatTurn', match: '/student/chatTurn' }
]

const profile = computed(() => userStore.profile || {})
const avatar = computed(() => profile.value.avatarUrl || defaultAvatar)

function isActive(tab) {
  return route.path.startsWith(tab.match)
}

async function refreshUnread() {
  if (!userStore.isAuthenticated) return
  try {
    const data = await getNotifications({
      status: 'unread',
      page: 1,
      pageSize: 1
    })
    unread.value = data.unread
  } catch {
    unread.value = 0
  }
}

function openNotifications() {
  unread.value = 0
  router.push('/student/center/message')
}

onMounted(refreshUnread)
watch(
  () => route.fullPath,
  (path) => {
    if (!path.startsWith('/student/center/message')) refreshUnread()
  }
)
</script>

<template>
  <div class="student-shell">
    <header class="student-header">
      <logoComponent class="brand" />
      <nav aria-label="学生主导航">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          :class="{ active: isActive(tab) }"
        >
          {{ tab.name }}
        </RouterLink>
      </nav>
      <div class="header-tools">
        <LanguageToggle class="language-toggle" />
        <button
          type="button"
          class="notice-button"
          aria-label="打开消息通知"
          @click="openNotifications"
        >
          <span aria-hidden="true">信</span>
          <b v-if="unread > 0">{{ unread > 99 ? '99+' : unread }}</b>
        </button>
        <button
          type="button"
          class="profile-button"
          @click="router.push('/student/center/info')"
        >
          <img :src="avatar" alt="个人头像" />
          <span>{{ profile.displayName || '学习者' }}</span>
        </button>
      </div>
    </header>
    <main class="student-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.student-shell {
  min-height: 100vh;
  color: #17313a;
  background: #f5f1e8;
}

.student-header {
  position: sticky;
  z-index: 100;
  top: 0;
  display: grid;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: clamp(18px, 3vw, 44px);
  min-height: 68px;
  border-bottom: 1px solid rgba(23, 49, 58, 0.14);
  padding: 7px clamp(14px, 3vw, 42px);
  background: rgba(255, 253, 247, 0.94);
  box-shadow: 0 5px 22px rgba(23, 49, 58, 0.05);
  backdrop-filter: blur(14px);
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

.brand {
  min-width: 150px;
}

nav {
  display: flex;
  align-self: stretch;
  justify-content: center;
  gap: 4px;
}

nav a {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0 15px;
  color: #65777c;
  text-decoration: none;
  white-space: nowrap;
}

nav a::after {
  position: absolute;
  right: 14px;
  bottom: 5px;
  left: 14px;
  height: 2px;
  background: #bd4435;
  content: '';
  transform: scaleX(0);
  transition: transform 0.2s ease;
}

nav a:hover,
nav a.active {
  color: #17313a;
}

nav a.active::after {
  transform: scaleX(1);
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notice-button,
.profile-button {
  position: relative;
  display: flex;
  align-items: center;
  border: 0;
  color: #17313a;
  background: transparent;
  cursor: pointer;
}

.notice-button {
  width: 40px;
  height: 40px;
  justify-content: center;
  border: 1px solid rgba(23, 49, 58, 0.18);
  font-weight: 700;
}

.notice-button b {
  position: absolute;
  top: -6px;
  right: -7px;
  min-width: 20px;
  border: 2px solid #fffdf7;
  border-radius: 999px;
  padding: 1px 5px;
  color: white;
  background: #bd4435;
  font:
    9px ui-monospace,
    monospace;
}

.profile-button {
  gap: 8px;
  padding: 4px 8px 4px 4px;
}

.profile-button img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-button span {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-content {
  min-width: 0;
}

@media (max-width: 980px) {
  .student-header {
    grid-template-columns: auto 1fr;
  }

  nav {
    grid-column: 1 / -1;
    grid-row: 2;
    order: 3;
    overflow-x: auto;
  }

  nav a {
    min-height: 42px;
  }

  .header-tools {
    justify-self: end;
  }
}

@media (max-width: 620px) {
  .language-toggle,
  .profile-button span {
    display: none;
  }
}
</style>
