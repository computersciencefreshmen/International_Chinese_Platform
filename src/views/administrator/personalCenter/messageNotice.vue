<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue' // 引入vue

const contentLoaded = ref(false)

//定义容器盒子
const container = ref(null)

//容器距离顶部的距离
const containerTop = ref(0)

// 动态计算容器的高度
const handleContainerHeight = () => {
  if (container.value) {
    // 打印容器距离顶部的高度
    containerTop.value = container.value.offsetTop
    // 设置容器的高度
    container.value.style.height = `${window.innerHeight - containerTop.value}px`
  }
}

// 监听窗口大小变化
const handleResize = () => {
  handleContainerHeight()
}

onMounted(() => {
  // 初始计算容器高度
  handleContainerHeight()

  // 添加窗口大小变化的监听器
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 移除窗口大小变化的监听器
  window.removeEventListener('resize', handleResize)
})

onMounted(async () => {
  await nextTick()
  contentLoaded.value = true // 设置内容加载完成,显示聊天框
  handleContainerHeight() // 动态计算容器的高度
})
</script>

<template>
  <!-- 通知架子 -->
  <div ref="container" class="p-4 bg-blue-50 flex h-screen">
    <!-- 分左边通知人，右边聊天框 -->
    <aside
      class="w-48 bg-white mr-6 rounded-lg p-4 overflow-auto scroll-m-0 scrollBar"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="flex border-2 border-dashed border-blue-300 rounded-lg p-2 cursor-pointer justify-center items-center mb-2"
      >
        <img
          class="h-10 w-10 rounded-full border-2 mr-4 shadow-lg"
          src="@/assets/student/avatar.png"
          alt="聊天对象"
        />
        <p class="font-semibold text-lg">通知人</p>
      </div>
    </aside>
    <main class="flex-1 bg-white rounded-lg p-4">
      <div v-if="contentLoaded" class="flex flex-col h-full">
        <!-- 聊天对象昵称 -->
        <div class="flex items-center mb-4 justify-center">
          <span class="ml-2 text-black font-semibold text-lg">聊天对象</span>
        </div>

        <!-- 聊天内容区域 -->
        <div class="flex-1 overflow-auto p-4 rounded-lg scrollBar">
          <!-- 对方消息 -->
          <div class="flex items-start mb-4">
            <img
              src="@/assets/student/avatar.png"
              alt="Avatar"
              class="w-10 h-10 rounded-full mr-2 bg-orange-100"
            />
            <div
              class="bg-gray-200 text-gray-800 p-2 rounded-lg rounded-tr-none max-w-xs"
            >
              <p>
                1方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息方消息1
              </p>
            </div>
          </div>
          <!-- 对方消息 -->
          <div class="flex items-start mb-4">
            <img
              src="@/assets/student/avatar.png"
              alt="Avatar"
              class="w-10 h-10 rounded-full mr-2 bg-orange-100"
            />
            <div
              class="bg-gray-200 text-gray-800 p-2 rounded-lg rounded-tr-none max-w-xs"
            >
              <p>11</p>
            </div>
          </div>

          <!-- 自己的消息 -->
          <div class="flex items-start mb-4">
            <div
              class="bg-blue-500 text-white p-2 rounded-lg rounded-tl-none max-w-xs ml-auto"
            >
              <p>
                你好，这是我的回复 你好，这是我的回复 你好，这是我的回复
                你好，这是我的回复 你好，这是我的回复 你好，这是我的回复
                你好，这是我的回复你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。你好，这是我的回复。
              </p>
            </div>
            <img
              src="@/assets/student/avatar.png"
              alt="Avatar"
              class="w-10 h-10 rounded-full ml-2"
            />
          </div>

          <!-- 更多消息 -->
          <div class="flex items-start mb-4">
            <img
              src="@/assets/student/avatar.png"
              alt="Avatar"
              class="w-10 h-10 rounded-full mr-2"
            />
            <div
              class="bg-gray-200 text-gray-800 p-2 rounded-lg rounded-tr-none max-w-xs"
            >
              <p>这是另一条消息。</p>
            </div>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="flex items-center mt-4">
          <input
            type="text"
            placeholder="输入消息..."
            class="flex-1 p-2 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
          />
          <button
            class="bg-blue-200 hover:bg-blue-500 transition-all duration-100 ease-in-out text-white p-2 ml-2 rounded-lg"
          >
            <img
              src="@/assets/student/send.svg"
              alt="发送图标"
              class="w-6 h-6"
            />
          </button>
        </div>
      </div>
    </main>
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
