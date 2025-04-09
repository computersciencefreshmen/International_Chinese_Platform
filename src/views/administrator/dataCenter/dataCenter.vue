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

const courses = ref([
  { title: '今日系统课程', number: 11 },
  { title: '今日发布的录播课', number: 12 },
  { title: '生成教案数', number: 13 },
  { title: '生成课题数', number: 50 },
  { title: '汉语水平测试参与人数', number: 30 }
])
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- 头部区域 -->
      <div
        class="flex items-center mb-4 bg-white p-4 rounded-lg justify-center gap-16"
      >
        <div
          v-for="item in courses"
          :key="item.title"
          class="bg-primary py-2 px-4 rounded-lg text-lg flex flex-col items-center"
        >
          <!-- 设置文字颜色 -->
          <p>{{ item.title }}</p>
          <p class="font-bold mt-2">{{ item.number }}</p>
        </div>
      </div>
      <!-- 内容区域 -->
      <div class="flex flex-col h-full overflow-hidden p-2 bg-white rounded-lg">
        <h2 class="text-lg font-semibold mb-2">数据列表</h2>
        <ul class="list-disc pl-5">
          <li>数据项 1</li>
          <li>数据项 2</li>
          <li>数据项 3</li>
          <li>数据项 4</li>
          <li>数据项 5</li>
          <li>数据项 6</li>
          <li>数据项 7</li>
          <li>数据项 8</li>
          <li>数据项 9</li>
          <li>数据项 10</li>
        </ul>
      </div>
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
