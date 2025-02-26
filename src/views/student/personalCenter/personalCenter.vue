<script setup>
import tabSwitch from '@/components/basic/tabSwitch.vue'
import { transitionName } from '@/router' // 从路由配置中导入 transitionName

// 定义路由列表
const routerList = [
  {
    name: '个人消息',
    path: '/student/center/info'
  },
  {
    name: '会员信息',
    path: '/student/center/vip'
  },
  {
    name: '修改密码',
    path: '/student/center/changePassword'
  },
  {
    name: '消息通知',
    path: '/student/center/message'
  },
  {
    name: '退出登录',
    path: ''
  }
]
</script>

<template>
  <!-- 布局容器 -->
  <div class="container mx-auto flex mb-4">
    <!-- 左边导航栏 -->
    <aside class="w-36">
      <!-- 引入tab栏组件 -->
      <tabSwitch :tabList="routerList"></tabSwitch>
    </aside>
    <!-- 右边对应路由内容 -->
    <main class="bg-blue-50 flex-1 rounded-b-lg overflow-hidden">
      <router-view v-slot="{ Component, route }">
        <transition :name="transitionName" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
/* 向下滑动 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}
.slide-down-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* 向上滑动 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.5s ease,
    opacity 0.5s ease;
}
.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.slide-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
