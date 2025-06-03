<!-- VideoArea.vue -->
<script setup>
import { ref } from 'vue'
import { useWebRTC } from '../composables/useWebRTC'

const isHoveringCamera = ref(false)

const {
  localStream,
  remoteStreams,
  screenStream,
  startCamera,
  stopCamera,
  startScreenShare,
  stopScreenShare,
  toggleMic
} = useWebRTC()

const isScreenSharing = ref(false)
const isCameraOn = ref(false)
const isMicOn = ref(false)

const toggleScreenShare = async () => {
  if (isScreenSharing.value) {
    stopScreenShare()
  } else {
    await startScreenShare()
    // 共享屏幕时自动关闭摄像头
    if (isCameraOn.value) toggleCamera()
  }
  isScreenSharing.value = !isScreenSharing.value
}

const toggleCamera = () => {
  if (isCameraOn.value) {
    stopCamera()
  } else {
    startCamera()
  }
  isCameraOn.value = !isCameraOn.value
}

const toggleMicState = () => {
  toggleMic()
  isMicOn.value = !isMicOn.value
}

const video = ref(null) //主屏幕

const toggleFullscreen = () => {
  const elem = video.value // 选择主容器
  if (!document.fullscreenElement) {
    elem.requestFullscreen().catch((err) => {
      console.error(`全屏错误: ${err.message}`)
    })
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }
}
</script>

<template>
  <div class="relative w-full h-full" ref="video">
    <!-- 主显示区域（屏幕共享/占位符） -->
    <div class="h-full bg-gray-900 rounded-lg overflow-hidden">
      <video
        v-if="screenStream"
        :srcObject="screenStream"
        class="w-full h-full object-contain"
        autoplay
        playsinline
      />
      <div v-else class="h-full flex items-center justify-center text-gray-500">
        <div class="text-center">
          <svg
            class="w-16 h-16 mx-auto mb-4 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p class="text-sm">等待上课开始...</p>
        </div>
      </div>
    </div>

    <!-- 独立悬浮摄像头窗口 -->
    <div
      v-if="localStream"
      class="fixed top-4 right-4 z-[100] w-48 hover:w-52 transition-all duration-300 group"
      @mouseenter="isHoveringCamera = true"
      @mouseleave="isHoveringCamera = false"
    >
      <div
        class="relative rounded-lg shadow-2xl overflow-hidden border-2 border-blue-400 bg-black"
      >
        <video
          ref="localVideo"
          autoplay
          playsinline
          :srcObject="localStream"
          class="w-full aspect-video object-cover video"
        />

        <!-- 摄像头控制栏 -->
        <div
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2"
        >
          <div class="flex items-center justify-between text-white">
            <span class="text-xs">我的镜头</span>
            <button
              v-show="isHoveringCamera"
              @click.stop="toggleCamera"
              class="p-1 hover:bg-white/10 rounded-full"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 学生连麦列表（右下角） -->
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      <div
        v-for="(stream, index) in remoteStreams"
        :key="stream.id"
        class="relative w-32 hover:w-36 transition-all duration-300 rounded-lg overflow-hidden shadow-lg border border-white/10"
      >
        <video
          :srcObject="stream"
          autoplay
          playsinline
          class="w-full aspect-video object-cover video"
        />
        <div
          class="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-2 py-1 rounded-full"
        >
          学生 {{ index + 1 }}
        </div>
      </div>
    </div>

    <!-- 控制栏 -->
    <div
      class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-3 bg-black/30 backdrop-blur-sm rounded-2xl shadow-xl"
    >
      <button
        @click="toggleCamera"
        class="flex items-center 2xl:gap-2 px-4 py-2 text-sm transition-all duration-200 rounded-xl"
        :class="
          isCameraOn
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        "
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <span class="hidden xl:flex">
          {{ isCameraOn ? '关闭摄像头' : '开启摄像头' }}</span
        >
      </button>

      <button
        @click="toggleMicState"
        class="flex items-center 2xl:gap-2 px-4 py-2 text-sm transition-all duration-200 rounded-xl"
        :class="
          isMicOn
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        "
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <span class="hidden xl:flex">
          {{ isMicOn ? '取消静音' : '静音麦克风' }}</span
        >
      </button>

      <button
        @click="toggleScreenShare"
        class="flex items-center 2xl:gap-2 px-4 py-2 text-sm transition-all duration-200 rounded-xl"
        :class="
          isScreenSharing
            ? 'bg-purple-500 hover:bg-purple-600 text-white'
            : 'bg-gray-600 hover:bg-gray-700 text-white'
        "
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <span class="hidden xl:flex">
          {{ isScreenSharing ? '停止共享' : '共享屏幕' }}</span
        >
      </button>
      <!-- 全屏 -->
      <button
        @click="toggleFullscreen"
        class="flex items-center 2xl:gap-2 px-4 py-2 text-sm transition-all duration-200 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
          />
        </svg>
        <span class="hidden xl:flex"> 全屏 </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.video {
  transform: rotateY(180deg);
  -webkit-transform: rotateY(180deg);
  -moz-transform: rotateY(180deg);
}

.fixed {
  will-change: transform; /* 优化动画性能 */
}

.hover\\:transform:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

.ring-2 {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}
</style>
