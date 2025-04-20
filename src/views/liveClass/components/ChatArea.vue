<script setup>
import { ref } from 'vue'
import { useWebSocket } from '@/utils/websocket'

const { send } = useWebSocket()

const newMessage = ref('')

const handleSend = () => {
  if (newMessage.value.trim()) {
    send(newMessage.value)
    newMessage.value = ''
  }
}

const isHandRaised = ref(false)

const messages = ref([])

// 模拟老师和学生数据
const teacher = ref({
  name: '张老师',
  avatar: 'T',
  isSpeaking: true
})

const students = ref([
  { id: 1, name: '李同学', avatar: 'L', isSpeaking: false }
])
</script>

<template>
  <div class="flex flex-col h-full bg-gray-50">
    <!-- 顶部：老师和学生卡片 -->
    <div class="p-4 border-b border-gray-200 bg-white">
      <div class="flex gap-4">
        <!-- 老师卡片 -->
        <div
          class="flex items-center p-3 bg-blue-50 rounded-lg shadow-sm w-full max-w-xs"
        >
          <div
            class="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500 text-white items-center justify-center text-lg font-medium hidden 2xl:flex"
            :class="{ 'ring-2 ring-blue-400': teacher.isSpeaking }"
          >
            {{ teacher.avatar }}
          </div>
          <div class="ml-3">
            <div class="font-medium text-gray-900">{{ teacher.name }}</div>
            <div class="text-sm text-gray-500 flex items-center">
              <span class="relative flex h-2 w-2 mr-1">
                <span
                  class="absolute inline-flex h-full w-full rounded-full opacity-75"
                  :class="
                    teacher.isSpeaking
                      ? 'bg-green-400 animate-ping'
                      : 'bg-gray-400'
                  "
                ></span>
                <span
                  class="relative inline-flex rounded-full h-2 w-2"
                  :class="teacher.isSpeaking ? 'bg-green-500' : 'bg-gray-400'"
                ></span>
              </span>
              {{ teacher.isSpeaking ? '正在讲话' : '静音中' }}
            </div>
          </div>
        </div>

        <!-- 学生卡片列表 -->
        <div
          v-for="student in students"
          :key="student.id"
          class="flex items-center p-3 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 transition-colors w-full max-w-xs"
        >
          <div
            class="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 text-white items-center justify-center text-lg font-medium hidden 2xl:flex"
            :class="{ 'ring-2 ring-green-400': student.isSpeaking }"
          >
            {{ student.avatar }}
          </div>
          <div class="ml-3">
            <div class="font-medium text-gray-900">{{ student.name }}</div>
            <div class="text-sm text-gray-500 flex items-center">
              <span class="relative flex h-2 w-2 mr-1">
                <span
                  class="absolute inline-flex h-full w-full rounded-full opacity-75"
                  :class="
                    student.isSpeaking
                      ? 'bg-green-400 animate-ping'
                      : 'bg-gray-400'
                  "
                ></span>
                <span
                  class="relative inline-flex rounded-full h-2 w-2"
                  :class="student.isSpeaking ? 'bg-green-500' : 'bg-gray-400'"
                ></span>
              </span>
              {{ student.isSpeaking ? '正在讲话' : '静音中' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 聊天窗口 -->
    <div class="flex flex-col flex-1 overflow-hidden">
      <!-- 消息列表 -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="flex"
          :class="msg.type === 'system' ? 'justify-center' : 'justify-start'"
        >
          <!-- 系统消息 -->
          <div
            v-if="msg.type === 'system'"
            class="px-3 py-1.5 bg-gray-100 rounded-full text-xs text-gray-600"
          >
            {{ msg.content }}
          </div>

          <!-- 用户消息 -->
          <div v-else class="flex max-w-[80%]">
            <div
              class="flex-shrink-0 mt-1 mr-2 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium"
            >
              {{ msg.user.charAt(0) }}
            </div>
            <div>
              <div class="text-xs text-gray-500 mb-1">{{ msg.user }}</div>
              <div
                class="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 text-sm text-gray-800"
              >
                {{ msg.content }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="p-4 border-t border-gray-200 bg-white">
        <div class="flex gap-2 h-10">
          <input
            v-model="newMessage"
            @keyup.enter="handleSend"
            placeholder="输入消息..."
            class="flex-1 px-2 py-1 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          <button
            @click="handleSend"
            class="p-2 bg-blue-500 text-white text-sm rounded-full hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 2xl:mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            <span class="hidden 2xl:flex"> 发送 </span>
          </button>
          <button
            :class="[
              'p-2 text-white text-sm rounded-full transition-colors flex items-center justify-center',
              isHandRaised
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            ]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 2xl:mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
              />
            </svg>
            <span class="hidden 2xl:flex">{{
              isHandRaised ? '取消举手' : '举手连麦'
            }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
