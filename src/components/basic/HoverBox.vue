<template>
  <div
    class="relative overflow-hidden rounded-lg cursor-pointer"
    @mouseenter="startFill"
    @mouseleave="resetFill"
  >
    <div
      class="absolute inset-0 bg-blue-300 pointer-events-none opacity-50"
      :style="{ width: fillWidth }"
      :class="transitionClass"
    ></div>
    <slot></slot>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const fillWidth = ref('0%') // 动态宽度
const transitionClass = ref('') // 动画类名

const startFill = () => {
  transitionClass.value = 'transition-width duration-500 ease-in-out' // 添加动画
  fillWidth.value = '100%' // 开始填充
}

const resetFill = () => {
  transitionClass.value = 'transition-width duration-500 ease-in-out' // 添加动画
  fillWidth.value = '0%' // 重置填充
}
</script>
