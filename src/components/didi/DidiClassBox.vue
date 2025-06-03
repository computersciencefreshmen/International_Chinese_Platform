<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
// import { useStudentStore } from '@/stores'
import { useStudentPersonStore } from '@/stores/modules/studentPerson'

// const studentStore = useStudentStore()
const studentPersonStore = useStudentPersonStore()
const router = useRouter()
let digitalHumanTimeout = null

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
  // 5秒倒计时逻辑
  digitalHumanTimeout = setTimeout(async () => {
    if (connectionState.value !== '已连接') {
      try {
        await ElMessageBox.confirm(
          '5秒内未匹配到老师，是否开启数字人授课？',
          '提示',
          {
            confirmButtonText: '开启数字人',
            cancelButtonText: '再等一等',
            type: 'warning',
          }
        )
        // 用户点击"开启数字人"
        router.push({
          path: '/student/digitalHuman/TeachDetails',
          // 可根据需要传递参数
        })
      } catch {
        // 用户点击"再等一等"
      }
    }
  }, 5000)
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
  if (digitalHumanTimeout) {
    clearTimeout(digitalHumanTimeout)
  }
})

// 时间格式化函数
function formatDateToChinese(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr // 兜底
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  return `${y}年${m}月${d}日 ${hh}:${mm}`
}

// 计算相对时间
function getRelativeTime(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const date = new Date(dateStr)
  const diff = date.getTime() - now.getTime()
  if (isNaN(diff)) return ''
  if (diff < 0) return '已过期'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `还有${days}天${hours > 0 ? hours + '小时' : ''}`
  if (hours > 0) return `还有${hours}小时`
  return '即将开始'
}
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
      <!-- 寻找老师动画和进度条 -->
      <transition name="fade">
        <div v-if="connectionState === '连接中'" class="mt-4 flex flex-col items-center">
          <div class="loader mb-2"></div>
          <div class="w-64 bg-gray-200 rounded-full h-3 overflow-hidden">
            <div class="bg-blue-400 h-3 rounded-full animate-progress"></div>
          </div>
          <div class="text-sm text-blue-500 mt-2">正在为您寻找合适的老师，请稍候...</div>
        </div>
      </transition>
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
      <h3 class="text-lg font-bold mb-4 text-blue-600 flex items-center">
        <svg class="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        最新预约信息
      </h3>
      <div v-for="(item, idx) in studentPersonStore.appointmentList" :key="idx" class="relative group bg-gradient-to-br from-blue-100/80 to-blue-50/80 rounded-2xl p-6 mb-6 shadow-xl border-2 border-blue-200/60 flex flex-col md:flex-row md:items-center md:justify-between transition-transform duration-300 hover:-translate-y-2 hover:shadow-2xl overflow-hidden">
        <!-- 渐变立体边框 -->
        <div class="absolute inset-0 rounded-2xl pointer-events-none border-4 border-transparent group-hover:border-blue-300 group-hover:shadow-lg transition-all duration-300 z-0"></div>
        <!-- 左侧内容 -->
        <div class="flex-1 flex flex-col md:flex-row md:items-center z-10">
          <!-- 预约人头像 -->
          <div class="flex-shrink-0 flex flex-col items-center mr-6">
            <img src="@/assets/student/avatar.png" class="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover mb-2" alt="预约人">
            <span class="text-xs text-gray-500">学生</span>
          </div>
          <div class="flex-1 space-y-2">
            <div class="flex items-center text-base text-gray-700 font-semibold">
              <svg class="w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m2 0a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              预约编号：{{ idx + 1 }}
            </div>
            <div class="flex items-center text-base text-gray-700">
              <svg class="w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              <span class="text-blue-500">话题：</span>{{ item.topic }}
            </div>
            <div class="flex items-center text-base text-gray-700">
              <svg class="w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 01-8 0"/></svg>
              <span class="text-blue-500">关键词：</span>{{ item.keywords }}
            </div>
            <div class="flex items-center text-base text-gray-700">
              <svg class="w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3"/></svg>
              <span class="text-blue-500">选择话轮：</span>{{ item.selectedRound }}
            </div>
            <div class="flex items-center text-base text-gray-700">
              <svg class="w-5 h-5 mr-1 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span class="text-blue-500">预约时间：</span>{{ formatDateToChinese(item.appointmentTime) }}
              <span class="ml-3 text-xs text-green-600 font-bold">{{ getRelativeTime(item.appointmentTime) }}</span>
            </div>
          </div>
        </div>
        <!-- 右侧老师头像和状态 -->
        <div class="flex flex-col items-center mt-6 md:mt-0 md:ml-8 z-10">
          <img :src="item.teacherAvatar || 'https://randomuser.me/api/portraits/women/44.jpg'" class="w-14 h-14 rounded-full border-2 border-blue-300 shadow object-cover mb-2" alt="老师">
          <span class="text-xs text-gray-500 mb-1">老师</span>
          <span class="inline-block bg-blue-400 text-white text-xs px-4 py-1 rounded-full shadow mb-2">待上课</span>
          <div class="flex items-center text-xs text-gray-400">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            预约创建于：{{ formatDateToChinese(item.createdAt || item.appointmentTime) }}
          </div>
        </div>
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

/* 寻找老师动画 */
.loader {
  border: 6px solid #e0e7ef;
  border-top: 6px solid #60a5fa;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 进度条动画 */
@keyframes progress {
  0% { width: 0%; }
  100% { width: 100%; }
}
.animate-progress {
  animation: progress 5s linear forwards;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}
</style>
