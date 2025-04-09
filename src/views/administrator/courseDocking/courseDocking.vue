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

//引入自定义按钮组件
import MyButton from '@/components/basic/MyButton.vue'

//引入课程列表数据
const classList = ref([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) // 模拟数据，实际数据应从API获取

//点击tab栏切换课程列表
const handleTabClick = (tab) => {
  // 根据点击的tab更新课程列表数据
  if (tab === '已对接') {
    classList.value = [1, 2, 3, 4, 5] // 已对接的课程列表
  } else {
    classList.value = [1, 2, 3] // 未对接的课程列表
  }
}
</script>

<template>
  <!-- 布局架子 -->
  <div ref="layout" class="container bg-white mx-auto p-4">
    <!-- 布局容器 -->
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <!-- 对接和未对接的tab栏(已对接，未对接）切换 -->
      <div class="bg-white w-full p-4 rounded-lg mb-4">
        <MyButton
          class="bg-blue-500 text-white rounded-lg px-4 py-2 mr-2"
          @click="handleTabClick('已对接')"
          >已对接</MyButton
        >
        <MyButton
          class="bg-gray-200 text-gray-700 rounded-lg px-4 py-2"
          @click="handleTabClick('未对接')"
          >未对接</MyButton
        >
      </div>
      <!-- 课程列表 -->
      <div class="flex-1 bg-white rounded-lg px-4 overflow-y-auto scrollBar">
        <div
          v-for="item in classList"
          :key="item"
          class="bg-primary py-2 px-4 my-4 rounded-lg flex justify-between items-center"
        >
          <div class="flex items-center gap-8">
            <img
              src="@/assets/student/avatar.png"
              class="w-8 h-8 rounded-full"
              alt="用户头像"
            />
            <p class="text-md">Potter</p>
            <p class="text-gray-500">课程话题：问路</p>
            <p class="text-gray-500">预约时间:2025/2/21 08:00-09:00</p>
          </div>
          <MyButton type="primary" class="py-1 px-2">查看详情</MyButton>
        </div>
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
