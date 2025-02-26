<script setup>
import tabSwitch from '@/components/basic/tabSwitch.vue'
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
  <div class="container mx-auto flex">
    <!-- 左边导航栏 -->
    <aside class="w-36">
      <!-- 引入tab栏组件 -->
      <tabSwitch :tabList="routerList"></tabSwitch>
    </aside>
    <!-- 右边对应路由内容 -->
    <main class="bg-blue-50 flex-1">
      <router-view></router-view>
    </main>
  </div>
</template>

<style scoped></style>
