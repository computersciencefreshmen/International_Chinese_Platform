<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue

//定义容器盒子
const container = ref(null)

//容器距离顶部的距离
const containerTop = ref(0)

//定义布局架子
const layout = ref(null)

// 动态计算容器的高度
const handleContainerHeight = () => {
  if (container.value && layout.value) {
    // 容器距离顶部的高度
    containerTop.value = container.value.offsetTop
    // //获取布局架子的内边距
    // const layoutPadding =
    // 设置容器的高度
    container.value.style.height = `${
      window.innerHeight -
      containerTop.value -
      parseInt(window.getComputedStyle(layout.value).paddingBottom)
    }px`
  }
}

// 监听窗口大小变化
const handleResize = () => {
  handleContainerHeight()
}

onMounted(() => {
  nextTick(() => {
    // 初始计算容器高度
    handleContainerHeight()

    // 添加窗口大小变化的监听器
    window.addEventListener('resize', handleResize)
  })
})

onUnmounted(() => {
  // 移除窗口大小变化的监听器
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      网课预约
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.scrollBar::-webkit-scrollbar {
  width: 6px; /* 滚动条的宽度 */
}
.scrollBar::-webkit-scrollbar-track {
  background: #f1f1f1; /* 滚动条轨道的背景颜色 */
  border-radius: 10px; /* 滚动条轨道的圆角 */
}

.scrollBar::-webkit-scrollbar-thumb {
  background: #888; /* 滚动条的背景颜色 */
  border-radius: 10px; /* 滚动条的圆角 */
}

.scrollBar::-webkit-scrollbar-thumb:hover {
  background: #6e6d6d; /* 滚动条悬停时的背景颜色 */
}
</style>
