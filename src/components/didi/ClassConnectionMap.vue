<template>
  <div class="relative w-full h-full bg-gray-100 overflow-hidden">
    <!-- 老师头像位置 -->
    <div
      class="absolute z-10"
      :style="{
        top: teacherPosition.y + 'px',
        left: teacherPosition.x + 'px',
        transition: 'top 0.1s linear, left 0.1s linear',
      }"
    >
      <img
        src="/teacher.png"
        class="w-16 h-16 rounded-full border-4 border-white shadow-lg"
        :class="{ 'ripple-animation': connectionState === 'moving' }"
      />
    </div>

    <!-- 学生位置固定 -->
    <div
      class="absolute bottom-10 left-1/2 transform -translate-x-1/2"
    >
      <img src="/student.png" class="w-16 h-16 rounded-full border-4 border-green-500 shadow" />
    </div>

    <!-- 状态提示 -->
    <div
      v-if="connectionState === 'connecting'"
      class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm shadow"
    >
      正在连接...
    </div>
    <div
      v-else-if="connectionState === 'moving'"
      class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm shadow animate-bounce"
    >
      老师正在靠近你
    </div>
    <div
      v-else-if="connectionState === 'connected'"
      class="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-sm shadow"
    >
      老师已上线，连接成功！
    </div>

    <!-- 控制按钮 -->
    <div class="absolute bottom-4 w-full flex justify-center gap-4">
      <button
        @click="startConnection"
        class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        :disabled="connectionState !== 'idle'"
      >
        开始连接
      </button>
      <button
        @click="cancelConnection"
        class="bg-gray-400 text-white px-4 py-2 rounded shadow hover:bg-gray-500"
        :disabled="connectionState === 'idle'"
      >
        取消连接
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const connectionState = ref('idle');
let moveInterval = null;

const studentPosition = { x: window.innerWidth / 2 - 32, y: window.innerHeight - 120 };
const teacherPosition = ref({ x: 100, y: 100 });
const targetPosition = studentPosition;
const courseStartTime = ref(new Date(Date.now() + 10000)); // 模拟10秒后上课

const speak = (text) => {
  const utter = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utter);
};

const startConnection = () => {
  connectionState.value = 'connecting';
  speak('正在连接老师，请稍等');

  setTimeout(() => {
    connectionState.value = 'moving';
    speak('老师正在靠近你');

    let step = 0;
    const totalSteps = 50;
    const dx = (targetPosition.x - teacherPosition.value.x) / totalSteps;
    const dy = (targetPosition.y - teacherPosition.value.y) / totalSteps;

    moveInterval = setInterval(() => {
      if (step >= totalSteps) {
        clearInterval(moveInterval);
        connectionState.value = 'connected';
        speak('老师已上线，连接成功');
        return;
      }
      teacherPosition.value.x += dx;
      teacherPosition.value.y += dy;
      step++;
    }, 100);
  }, 2000);
};

const cancelConnection = () => {
  connectionState.value = 'idle';
  clearInterval(moveInterval);
};

onMounted(() => {
  const checkCourse = setInterval(() => {
    if (new Date() >= courseStartTime.value && connectionState.value === 'idle') {
      startConnection();
      clearInterval(checkCourse);
    }
  }, 1000);
});
</script>

<style scoped>
@keyframes ripple {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  100% {
    box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
  }
}
.ripple-animation {
  animation: ripple 1.5s infinite;
}
</style>
