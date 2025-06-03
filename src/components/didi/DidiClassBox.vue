<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
// import { useStudentStore } from '@/stores'
import { useStudentPersonStore } from '@/stores/modules/studentPerson'

// const studentStore = useStudentStore()
const studentPersonStore = useStudentPersonStore()

// Connection states
const connectionState = ref('未连接')

// Avatar positions (in percentage of container)
const studentPosition = ref({ x: 20, y: 50 })
const teacherPosition = ref({ x: 80, y: 50 })
const connectionLine = ref(null)
let animationFrame = null

// Teacher movement variables
const isConnecting = ref(false)
const connectionProgress = ref(0)
const animationDuration = 3000 // ms
let startTime = null

// Update connection line
const updateConnectionLine = () => {
  if (!connectionLine.value) return
  
  const dx = studentPosition.value.x - teacherPosition.value.x
  const dy = studentPosition.value.y - teacherPosition.value.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  
  connectionLine.value.style.width = `${distance}%`
  connectionLine.value.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
  connectionLine.value.style.left = `${teacherPosition.value.x}%`
  connectionLine.value.style.top = `${teacherPosition.value.y}%`
}

// Animation loop
const animate = (timestamp) => {
  if (!startTime) startTime = timestamp
  const elapsed = timestamp - startTime
  
  if (connectionState.value === '连接中' && elapsed < animationDuration) {
    connectionProgress.value = Math.min(elapsed / animationDuration, 1)
    
    // Move teacher towards student
    const progress = easeInOutCubic(connectionProgress.value)
    teacherPosition.value = {
      x: 80 - (60 * progress),
      y: 50 + (Math.sin(progress * Math.PI * 2) * 15)
    }
    
    updateConnectionLine()
    animationFrame = requestAnimationFrame(animate)
  } else if (connectionProgress.value >= 1) {
    connectionState.value = '已连接'
    isConnecting.value = false
  }
}

// Easing function for smooth animation
const easeInOutCubic = (t) => {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
}

// Start connection
const startConnection = () => {
  if (connectionState.value === '未连接') {
    connectionState.value = '连接中'
    connectionProgress.value = 0
    isConnecting.value = true
    startTime = null
    teacherPosition.value = { x: 80, y: 50 }
    animationFrame = requestAnimationFrame(animate)
  }
}

// Reset connection
const resetConnection = () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
  connectionState.value = '未连接'
  isConnecting.value = false
  connectionProgress.value = 0
  teacherPosition.value = { x: 80, y: 50 }
  updateConnectionLine()
}

// Lifecycle hooks
onMounted(() => {
  updateConnectionLine()
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-lg p-6 w-full">
    <h2 class="text-2xl font-bold text-gray-800 mb-6 text-center">滴滴上课</h2>
    
    <!-- Connection Status -->
    <div class="mb-6 text-center">
      <div class="inline-flex items-center px-4 py-2 rounded-full" :class="{
        'bg-gray-100 text-gray-700': connectionState === '未连接',
        'bg-yellow-100 text-yellow-700': connectionState === '连接中',
        'bg-green-100 text-green-700': connectionState === '已连接'
      }">
        <span class="w-3 h-3 rounded-full mr-2" :class="{
          'bg-gray-500': connectionState === '未连接',
          'bg-yellow-500 animate-pulse': connectionState === '连接中',
          'bg-green-500': connectionState === '已连接'
        }"></span>
        {{ connectionState }}
      </div>
    </div>

    <!-- Connection Visualization -->
    <div class="relative w-full h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 mb-6">
      <!-- Connection Line -->
      <div 
        ref="connectionLine"
        class="absolute h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent transform -translate-x-1/2 -translate-y-1/2 origin-left"
        :class="{
          'opacity-30': connectionState !== '已连接',
          'opacity-100': connectionState === '已连接',
          'animate-pulse': connectionState === '连接中'
        }"
      ></div>

      <!-- Student Avatar -->
      <div 
        class="absolute w-16 h-16 rounded-full border-4 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out"
        :style="{
          left: `${studentPosition.x}%`,
          top: `${studentPosition.y}%`,
          'z-index': 10
        }"
      >
        <img 
          src="@/assets/student/avatar.png" 
          alt="Student"
          class="w-full h-full rounded-full object-cover"
          @error="$event.target.src = 'https://via.placeholder.com/80?text=学生'"
        >
        <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
          学生
        </div>
      </div>

      <!-- Teacher Avatar -->
      <div 
        class="absolute w-16 h-16 rounded-full border-4 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out"
        :class="{
          'animate-bounce-slow': connectionState === '连接中'
        }"
        :style="{
          left: `${teacherPosition.x}%`,
          top: `${teacherPosition.y}%`,
          'z-index': 10
        }"
      >
        <img 
          src="https://randomuser.me/api/portraits/women/44.jpg" 
          alt="Teacher"
          class="w-full h-full rounded-full object-cover"
          @error="$event.target.src = 'https://via.placeholder.com/80?text=老师'"
        >
        <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
          老师
        </div>
      </div>

      <!-- Connection Animation Elements -->
      <template v-if="connectionState === '连接中'">
        <div 
          v-for="i in 3" 
          :key="i"
          class="absolute w-3 h-3 rounded-full bg-blue-400 opacity-0 transform -translate-x-1/2 -translate-y-1/2"
          :style="{
            left: `${teacherPosition.x + (studentPosition.x - teacherPosition.x) * 0.3 * i}%`,
            top: `${teacherPosition.y + (studentPosition.y - teacherPosition.y) * 0.3 * i}%`,
            animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`
          }"
        ></div>
      </template>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-center space-x-4">
      <button 
        @click="startConnection"
        :disabled="connectionState === '连接中'"
        class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ connectionState === '已连接' ? '重新连接' : '开始连接' }}
      </button>
      <button 
        @click="resetConnection"
        class="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-opacity-50"
      >
        重置
      </button>
    </div>

    <!-- Connection Info -->
    <div v-if="connectionState === '已连接'" class="mt-6 p-4 bg-green-50 rounded-lg border border-green-200 text-center">
      <div class="flex justify-center items-center text-green-600">
        <svg class="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="font-medium">连接成功！正在为您匹配最佳老师...</span>
      </div>
    </div>

    <!-- 预约信息展示 -->
    <div v-if="studentPersonStore.appointmentList.length" class="mt-8">
      <h3 class="text-lg font-bold mb-2 text-blue-600">最新预约信息</h3>
      <div v-for="(item, idx) in studentPersonStore.appointmentList" :key="idx" class="bg-blue-50 rounded p-3 mb-2">
        <div>话题：{{ item.topic }}</div>
        <div>关键词：{{ item.keywords }}</div>
        <div>选择话轮：{{ item.selectedRound }}</div>
        <div>预约时间：{{ item.appointmentTime }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes bounce-slow {
  0%, 100% { transform: translateY(0) translateX(-50%); }
  50% { transform: translateY(-10px) translateX(-50%); }
}

.animate-bounce-slow {
  animation: bounce-slow 2s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.8;
  }
  70% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0;
  }
  100% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0;
  }
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}
</style>
