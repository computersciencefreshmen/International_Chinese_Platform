<script setup>
import HeaderNav from '../components/HeaderNav.vue'
</script>

<template>
  <div class="LayoutContainer px-24">
    <!-- 顶部导航栏 -->
    <HeaderNav />
    <!-- 路由出口 -->
    <router-view></router-view>
  </div>
</template>

<style scoped>
.LayoutContainer {
  min-width: 1000px;
}
</style>
