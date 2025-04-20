<!-- 主布局组件 -->
<script setup>
import { ref, onMounted, nextTick, onUnmounted } from 'vue'
import HeaderBar from './components/HeaderBar.vue'
import VideoArea from './components/VideoArea.vue'
import ChatArea from './components/ChatArea.vue'

const container = ref(null)
const containerTop = ref(0)

const handleContainerHeight = () => {
  if (container.value) {
    const layout = container.value.parentElement
    containerTop.value = container.value.offsetTop
    const paddingBottom = parseInt(getComputedStyle(layout).paddingBottom)
    container.value.style.height = `${window.innerHeight - containerTop.value - paddingBottom}px`
  }
}

onMounted(() => {
  nextTick(() => {
    handleContainerHeight()
    window.addEventListener('resize', handleContainerHeight)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleContainerHeight)
})
</script>

<template>
  <div class="bg-white mx-auto p-4 w-full h-screen">
    <div ref="container" class="bg-blue-50 rounded-lg p-4 flex flex-col">
      <div class="flex flex-col h-full">
        <HeaderBar title="Vue3互动课堂" :count="25" />

        <div class="flex flex-1 overflow-hidden gap-4 mt-4">
          <div class="flex-[3] h-full overflow-hidden">
            <VideoArea />
          </div>

          <div class="flex-1 h-full rounded-lg overflow-hidden">
            <ChatArea class="h-full scrollBar" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
