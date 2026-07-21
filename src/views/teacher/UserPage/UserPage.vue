<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import NotificationCenter from '@/components/account/NotificationCenter.vue'
import PasswordForm from '@/components/account/PasswordForm.vue'
import ProfileForm from '@/components/account/ProfileForm.vue'

const route = useRoute()
const activeTab = ref(route.query.tab === 'security' ? 'security' : 'profile')
</script>

<template>
  <div class="teacher-account">
    <nav aria-label="教师账户设置">
      <button
        v-for="item in [
          { id: 'profile', label: '教学名片' },
          { id: 'security', label: '账号安全' },
          { id: 'notices', label: '消息通知' }
        ]"
        :key="item.id"
        type="button"
        :class="{ active: activeTab === item.id }"
        @click="activeTab = item.id"
      >
        {{ item.label }}
      </button>
    </nav>
    <KeepAlive>
      <ProfileForm v-if="activeTab === 'profile'" />
      <PasswordForm v-else-if="activeTab === 'security'" />
      <NotificationCenter v-else />
    </KeepAlive>
  </div>
</template>

<style scoped>
.teacher-account {
  min-height: 100%;
  background: #fffdf7;
}

nav {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  gap: 2px;
  border-bottom: 1px solid rgba(23, 44, 53, 0.16);
  padding: 12px clamp(20px, 4vw, 52px) 0;
  background: rgba(255, 253, 247, 0.94);
  backdrop-filter: blur(10px);
}

button {
  border: 0;
  border-bottom: 3px solid transparent;
  padding: 11px 18px;
  color: #66757b;
  background: transparent;
  cursor: pointer;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', serif;
}

button.active {
  border-color: #bf3d2f;
  color: #172c35;
  font-weight: 700;
}
</style>
