<script setup>
import TabSwitch from '@/components/basic/TabSwitch.vue'
// import { transitionName } from '@/router' // 从路由配置中导入 transitionName

// 定义路由列表
const routerList = [
  {
    id: 1,
    name: '个人消息',
    path: '/student/center/info'
  },
  {
    id: 2,
    name: '会员信息',
    path: '/student/center/vip'
  },
  {
    id: 3,
    name: '修改密码',
    path: '/student/center/changePassword'
  },
  {
    id: 4,
    name: '消息通知',
    path: '/student/center/message'
  }
]
</script>

<template>
  <!-- 布局容器 -->
  <div class="container mx-auto flex">
    <!-- 左边导航栏 -->
    <aside class="w-36">
      <!-- 引入tab栏组件 -->
      <TabSwitch :tabList="routerList"></TabSwitch>
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

/* @keyframes slideDownTwice {
  0% {
    transform: translateY(-100%);
    opacity: 1;
  }
  50% {
    transform: translateY(100%);
    opacity: 1;
  }
  50.01% {
    transform: translateY(-100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
} */
/* 向上滑动
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.6s ease,
    opacity 0.6s ease;
}
.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}
.slide-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
} */
</style>
