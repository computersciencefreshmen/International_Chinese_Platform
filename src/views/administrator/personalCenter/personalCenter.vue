<script setup>
import TabSwitch from '@/components/basic/TabSwitch.vue'
import { useAdminStore } from '@/stores'

const adminStore = useAdminStore()

// 定义路由列表
const routerList = [
  {
    id: 1,
    name: '修改密码',
    path: '/administrator/personalCenter/changePassword'
  },
  {
    id: 2,
    name: '消息通知',
    path: '/administrator/personalCenter/message'
  }
]
</script>

<template>
  <!-- 布局容器 -->
  <div class="container mx-auto flex">
    <!-- 左边导航栏 -->
    <aside class="w-36">
      <!-- 引入tab栏组件 -->
      <TabSwitch
        :tabList="routerList"
        :activeTabIndex="adminStore.isTabActive"
      ></TabSwitch>
    </aside>
    <!-- 右边对应路由内容 -->
    <main class="flex-1 rounded-b-lg overflow-hidden">
      <Transition name="slide-down" mode="out-in">
        <router-view></router-view>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
/* 向下滑动 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition:
    transform 0.7s ease,
    opacity 0.7s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}
.slide-down-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
